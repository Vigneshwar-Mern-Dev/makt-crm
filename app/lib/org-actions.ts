"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import { db } from "./db";
import { requireOrgRole } from "./org-session";
import { hashPassword } from "./password";
import { passwordPolicyError } from "./password-policy";
import { readSession } from "./session";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Creates a new organization for an authenticated user who has no organization.
 * The creating user automatically becomes the OWNER.
 */
export async function createOrganizationAction(formData: FormData) {
  const session = await readSession();
  if (!session) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, email: true, organizationId: true },
  });

  if (!user) {
    redirect("/login");
  }

  if (user.organizationId) {
    // Already has an organization, head to admin
    redirect("/admin");
  }

  const rawName = formData.get("name");
  const rawSlug = formData.get("slug");

  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name || name.length < 2 || name.length > 80) {
    return { error: "Organization name must be between 2 and 80 characters." };
  }

  let slug = typeof rawSlug === "string" && rawSlug.trim() ? slugify(rawSlug) : slugify(name);
  if (!slug || slug.length < 2) {
    slug = `org-${randomBytes(3).toString("hex")}`;
  }

  // Ensure slug uniqueness
  const existingOrg = await db.organization.findUnique({
    where: { slug },
  });

  if (existingOrg) {
    slug = `${slug}-${randomBytes(3).toString("hex")}`;
  }

  try {
    const org = await db.$transaction(async (tx) => {
      const createdOrg = await tx.organization.create({
        data: {
          name,
          slug,
          apiKey: "makt_live_" + randomBytes(16).toString("hex"),
          createdById: user.id,
        },
      });

      await tx.orgMember.create({
        data: {
          organizationId: createdOrg.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          organizationId: createdOrg.id,
          role: "ADMIN",
        },
      });

      return createdOrg;
    });

    revalidatePath("/admin");
    return { success: true, slug: org.slug };
  } catch (err: unknown) {
    console.error("Failed to create organization:", err);
    return { error: "Failed to create organization. Please try again." };
  }
}

/**
 * Creates an invitation link for a new member to join the current organization.
 * Caller must be OWNER or ADMIN.
 */
export async function inviteMemberAction(data: {
  email: string;
  role: "ADMIN" | "MEMBER";
}) {
  try {
    const { org, user: caller } = await requireOrgRole("ADMIN");

    const email = data.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return { error: "A valid email address is required." };
    }

    const role: OrgRole = data.role === "ADMIN" ? "ADMIN" : "MEMBER";

    // 1. Check if user is already a member of this organization
    const existingMember = await db.orgMember.findFirst({
      where: {
        organizationId: org.id,
        user: { email },
      },
    });

    if (existingMember) {
      return { error: "A user with this email is already a member of your organization." };
    }

    // 2. Clear any old pending invitations for this email in this org
    await db.orgInvitation.deleteMany({
      where: {
        organizationId: org.id,
        email,
        status: "PENDING",
      },
    });

    // 3. Create fresh invitation token (valid for 7 days)
    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await db.orgInvitation.create({
      data: {
        organizationId: org.id,
        email,
        role,
        token,
        status: "PENDING",
        invitedById: caller.id,
        expiresAt,
      },
      include: {
        organization: {
          select: { name: true, slug: true },
        },
      },
    });

    revalidatePath("/admin/settings/members");

    return {
      success: true,
      token: invitation.token,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  } catch (err: unknown) {
    console.error("Error creating invitation:", err);
    return { error: "Failed to create invitation. Please try again." };
  }
}

/**
 * Revokes a pending invitation.
 */
export async function revokeInvitationAction(invitationId: string) {
  try {
    const { org } = await requireOrgRole("ADMIN");

    const invitation = await db.orgInvitation.findFirst({
      where: { id: invitationId, organizationId: org.id },
    });

    if (!invitation) {
      return { error: "Invitation not found." };
    }

    await db.orgInvitation.update({
      where: { id: invitationId },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });

    revalidatePath("/admin/settings/members");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error revoking invitation:", err);
    return { error: "Failed to revoke invitation." };
  }
}

/**
 * Directly creates a user account within the organization without requiring an email invite flow.
 * Perfect for admins creating colleague/agent logins directly.
 */
export async function createMemberManuallyAction(data: {
  username: string;
  email: string;
  password: string;
  department?: string;
  role: "ADMIN" | "MEMBER";
}) {
  try {
    const { org } = await requireOrgRole("ADMIN");

    const username = data.username.trim().toLowerCase();
    const email = data.email.trim().toLowerCase();
    const password = data.password;
    const department = data.department?.trim() || "Operations";
    const role: OrgRole = data.role === "ADMIN" ? "ADMIN" : "MEMBER";

    if (!username || !email || !password) {
      return { error: "Username, email, and password are all required." };
    }

    const passwordError = passwordPolicyError(password);
    if (passwordError) {
      return { error: passwordError };
    }

    // Check if username or email already exists anywhere in the system
    const existing = await db.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
      include: {
        orgMemberships: true,
      },
    });

    if (existing) {
      if (existing.organizationId === org.id) {
        return { error: "A user with this username or email already belongs to your organization." };
      }
      return { error: "A user with this username or email already exists in the system." };
    }

    const passwordHash = await hashPassword(password);

    await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username,
          email,
          passwordHash,
          department,
          role: role === "ADMIN" ? "ADMIN" : "USER",
          organizationId: org.id,
        },
      });

      await tx.orgMember.create({
        data: {
          organizationId: org.id,
          userId: newUser.id,
          role,
        },
      });
    });

    revalidatePath("/admin/settings/members");
    revalidatePath("/admin/users");

    return {
      success: true,
      message: `User ${username} successfully created and added to ${org.name}.`,
    };
  } catch (err: unknown) {
    console.error("Error creating member manually:", err);
    return { error: "Failed to create member. Please try again." };
  }
}

/**
 * Changes a member's role (OWNER, ADMIN, MEMBER).
 * Owners can change any role. Admins can promote/demote members to/from ADMIN.
 */
export async function updateMemberRoleAction(data: {
  memberId: string;
  newRole: "ADMIN" | "MEMBER" | "OWNER";
}) {
  try {
    const { org, orgRole: callerRole, user: caller } = await requireOrgRole("ADMIN");

    const member = await db.orgMember.findFirst({
      where: { id: data.memberId, organizationId: org.id },
      include: { user: true },
    });

    if (!member) {
      return { error: "Member not found." };
    }

    if (member.userId === caller.id && member.role === "OWNER" && data.newRole !== "OWNER") {
      return { error: "Owners cannot demote themselves. Transfer ownership instead." };
    }

    if (callerRole !== "OWNER") {
      if (member.role === "OWNER") {
        return { error: "Only owners can modify an owner's role." };
      }
      if (data.newRole === "OWNER") {
        return { error: "Only an owner can transfer or assign the OWNER role." };
      }
    }

    await db.$transaction(async (tx) => {
      await tx.orgMember.update({
        where: { id: data.memberId },
        data: { role: data.newRole as OrgRole },
      });

      await tx.user.update({
        where: { id: member.userId },
        data: {
          role: data.newRole === "MEMBER" ? "USER" : "ADMIN",
        },
      });
    });

    revalidatePath("/admin/settings/members");
    revalidatePath("/admin/users");

    return { success: true };
  } catch (err: unknown) {
    console.error("Error updating member role:", err);
    return { error: "Failed to update member role." };
  }
}

/**
 * Removes a member from the organization.
 */
export async function removeMemberAction(memberId: string) {
  try {
    const { org, orgRole: callerRole, user: caller } = await requireOrgRole("ADMIN");

    const member = await db.orgMember.findFirst({
      where: { id: memberId, organizationId: org.id },
    });

    if (!member) {
      return { error: "Member not found in your organization." };
    }

    if (member.userId === caller.id) {
      return { error: "You cannot remove yourself from the organization." };
    }

    if (member.role === "OWNER") {
      return { error: "The organization owner cannot be removed." };
    }

    if (callerRole !== "OWNER" && member.role === "ADMIN") {
      return { error: "Admins cannot remove other admins. Only an owner can." };
    }

    await db.$transaction(async (tx) => {
      await tx.orgMember.delete({
        where: { id: memberId },
      });

      await tx.user.update({
        where: { id: member.userId },
        data: {
          organizationId: null,
          isActive: false,
          sessionVersion: { increment: 1 },
        },
      });
    });

    revalidatePath("/admin/settings/members");
    revalidatePath("/admin/users");

    return { success: true };
  } catch (err: unknown) {
    console.error("Error removing member:", err);
    return { error: "Failed to remove member." };
  }
}

/**
 * Updates organization metadata (name, slug).
 */
export async function updateOrganizationAction(data: {
  name: string;
  slug?: string;
  logo?: string;
}) {
  try {
    const { org } = await requireOrgRole("ADMIN");

    const name = data.name.trim();
    if (!name || name.length < 2) {
      return { error: "Organization name must be at least 2 characters long." };
    }

    const updateData: { name: string; slug?: string; logo?: string } = { name };

    if (data.slug) {
      const slug = slugify(data.slug);
      if (slug !== org.slug) {
        const existing = await db.organization.findUnique({
          where: { slug },
        });
        if (existing) {
          return { error: "This organization URL slug is already taken." };
        }
        updateData.slug = slug;
      }
    }

    if (data.logo !== undefined) {
      updateData.logo = data.logo.trim() || null as unknown as string;
    }

    await db.organization.update({
      where: { id: org.id },
      data: updateData,
    });

    revalidatePath("/admin/settings/organization");
    return { success: true };
  } catch (err: unknown) {
    console.error("Error updating organization:", err);
    return { error: "Failed to update organization." };
  }
}

/**
 * Fetches invitation details by token for public display on /invite/[token].
 */
export async function getInvitationByToken(token: string) {
  if (!token) return null;

  const invitation = await db.orgInvitation.findUnique({
    where: { token },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
        },
      },
    },
  });

  if (!invitation) return null;

  const isExpired = invitation.expiresAt < new Date();
  const isValid = invitation.status === "PENDING" && !isExpired;

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    isExpired,
    isValid,
    expiresAt: invitation.expiresAt.toISOString(),
    organization: invitation.organization,
  };
}

/**
 * Accepts an invitation for the currently logged in user.
 */
export async function acceptInvitationAction(token: string) {
  const session = await readSession();
  if (!session) {
    redirect(`/login?redirect=/invite/${token}`);
  }

  const invitation = await db.orgInvitation.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
    return { error: "This invitation is invalid or has expired." };
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) {
    redirect("/login");
  }

  if (user.organizationId && user.organizationId !== invitation.organizationId) {
    return {
      error: "You are already a member of another organization. You must leave your current organization first.",
    };
  }

  try {
    await db.$transaction(async (tx) => {
      // Upsert membership
      await tx.orgMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: user.id,
          },
        },
        create: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role,
        },
        update: {
          role: invitation.role,
        },
      });

      // Update user
      await tx.user.update({
        where: { id: user.id },
        data: {
          organizationId: invitation.organizationId,
          role: invitation.role === "MEMBER" ? "USER" : "ADMIN",
        },
      });

      // Mark invitation accepted
      await tx.orgInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      });
    });

    return {
      success: true,
      redirect: invitation.role === "MEMBER" ? "/user" : "/admin",
    };
  } catch (err: unknown) {
    console.error("Error accepting invitation:", err);
    return { error: "Failed to accept invitation. Please try again." };
  }
}

/**
 * Regenerates the organization's public Ingestion API key.
 * Only OWNER or ADMIN can roll keys.
 */
export async function regenerateOrgApiKeyAction() {
  const { org } = await requireOrgRole("ADMIN");
  const newKey = "makt_live_" + randomBytes(16).toString("hex");

  await db.organization.update({
    where: { id: org.id },
    data: { apiKey: newKey },
  });

  revalidatePath("/admin/settings/developer");
  revalidatePath("/admin/settings/organization");
  return { success: true, apiKey: newKey };
}

