import "server-only";

import type { OrgRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";

/**
 * Organization-aware session context.
 *
 * Contains the authenticated user, their organization, and their role
 * within that organization. This is the primary auth context for all
 * multi-tenant operations.
 */
export type OrgContext = {
  user: {
    id: string;
    username: string;
    email: string;
  };
  org: {
    id: string;
    name: string;
    slug: string;
  };
  orgRole: OrgRole;
};

/**
 * Returns the authenticated user's org context.
 *
 * Validates the session, looks up org membership, and returns a typed
 * OrgContext. Redirects to /login if no session, to /create-org if the
 * user has no organization.
 */
export async function requireOrgUser(): Promise<OrgContext> {
  const session = await readSession();

  if (!session) {
    redirect("/login");
  }

  const user = await db.user.findFirst({
    where: { id: session.userId, isActive: true },
    select: {
      id: true,
      username: true,
      email: true,
      sessionVersion: true,
      organizationId: true,
    },
  });

  if (!user || user.sessionVersion !== session.sessionVersion) {
    redirect("/login");
  }

  // User exists but hasn't joined or created an org yet
  if (!user.organizationId) {
    redirect("/create-org");
  }

  // Fetch membership + org in one query
  const membership = await db.orgMember.findFirst({
    where: {
      userId: user.id,
      organizationId: user.organizationId,
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!membership) {
    // User has an organizationId but no OrgMember row — data inconsistency.
    // Send them to create-org so they can re-establish membership.
    redirect("/create-org");
  }

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
    },
    org: membership.organization,
    orgRole: membership.role,
  };
}

/**
 * Require a minimum org role level.
 *
 * Role hierarchy: OWNER > ADMIN > MEMBER
 *
 * Redirects to the dashboard home if the user doesn't meet the required role.
 */
const ROLE_HIERARCHY: Record<OrgRole, number> = {
  MEMBER: 0,
  ADMIN: 1,
  OWNER: 2,
};

export async function requireOrgRole(
  minimumRole: OrgRole,
): Promise<OrgContext> {
  const ctx = await requireOrgUser();

  if (ROLE_HIERARCHY[ctx.orgRole] < ROLE_HIERARCHY[minimumRole]) {
    redirect("/admin");
  }

  return ctx;
}

/**
 * Check if the current user has at least the given role level.
 * Non-redirecting variant — returns boolean.
 */
export function hasMinRole(
  currentRole: OrgRole,
  requiredRole: OrgRole,
): boolean {
  return ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[requiredRole];
}
