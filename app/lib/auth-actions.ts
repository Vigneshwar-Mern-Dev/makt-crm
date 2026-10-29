"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { passwordPolicyError } from "./password-policy";
import { hasPrismaCode } from "./prisma-utils";
import { consumeRateLimit, rateLimitKey, resetRateLimit } from "./rate-limit";
import { getClientIpFromHeaders } from "./request-ip";
import { createSession, destroySession } from "./session";

const loginWindowMs = 10 * 60 * 1000;

function formValue(formData: FormData, key: string, trim = true) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return "";
  }

  return trim ? value.trim() : value;
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function handleDatabaseError(path: string, error: unknown): never {
  if (hasPrismaCode(error, "P1001")) {
    redirectWithError(
      path,
      "Database connection failed. Check your internet connection or Neon database status, then try again.",
    );
  }

  throw error;
}

export async function loginAction(formData: FormData) {
  const identifier = formValue(formData, "identifier").toLowerCase();
  const password = formValue(formData, "password", false);

  if (!identifier || !password) {
    redirectWithError("/login", "Enter your username or email and password.");
  }

  const ipAddress = getClientIpFromHeaders(await headers());
  const ipKey = rateLimitKey("login-ip", ipAddress);
  const accountIpKey = rateLimitKey("login-account-ip", identifier, ipAddress);

  try {
    const [ipLimit, accountIpLimit] = await Promise.all([
      consumeRateLimit({ key: ipKey, limit: 30, windowMs: loginWindowMs }),
      consumeRateLimit({
        key: accountIpKey,
        limit: 5,
        windowMs: loginWindowMs,
        blockMs: loginWindowMs,
      }),
    ]);

    if (!ipLimit.allowed || !accountIpLimit.allowed) {
      redirectWithError(
        "/login",
        "Too many login attempts from this network. Wait a few minutes, then try again.",
      );
    }

    const user = await db.user.findFirst({
      where: {
        isActive: true,
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: {
        orgMemberships: true,
      },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      redirectWithError(
        "/login",
        "We could not sign you in. Check your details or contact your CRM administrator.",
      );
    }

    await resetRateLimit(accountIpKey);
    await createSession(user);

    // If user has not created or joined an organization yet, route to onboarding
    if (!user.organizationId || user.orgMemberships.length === 0) {
      redirect("/create-org");
    }

    const membership = user.orgMemberships.find(
      (m) => m.organizationId === user.organizationId,
    );

    if (membership && membership.role === "MEMBER") {
      redirect("/user");
    }

    redirect("/admin");
  } catch (error) {
    handleDatabaseError("/login", error);
  }
}

export async function registerAction(formData: FormData) {
  const username = formValue(formData, "username").toLowerCase();
  const email = formValue(formData, "email").toLowerCase();
  const password = formValue(formData, "password", false);
  const inviteToken = formValue(formData, "inviteToken");

  const registerErrorUrl = inviteToken
    ? `/invite/${inviteToken}`
    : "/register";

  if (!username || !email || !password) {
    redirectWithError(registerErrorUrl, "Please fill in all required fields.");
  }

  const passError = passwordPolicyError(password);
  if (passError) {
    redirectWithError(registerErrorUrl, passError);
  }

  const ipAddress = getClientIpFromHeaders(await headers());
  const ipKey = rateLimitKey("register-ip", ipAddress);
  const ipLimit = await consumeRateLimit({ key: ipKey, limit: 10, windowMs: loginWindowMs });

  if (!ipLimit.allowed) {
    redirectWithError(
      registerErrorUrl,
      "Too many registration attempts. Please wait a few minutes before trying again.",
    );
  }

  try {
    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      redirectWithError(
        registerErrorUrl,
        "An account with this email or username already exists. Please sign in instead.",
      );
    }

    const passwordHash = await hashPassword(password);

    // Flow A: Joining via Invitation
    if (inviteToken) {
      const invitation = await db.orgInvitation.findUnique({
        where: { token: inviteToken },
        include: { organization: true },
      });

      if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
        redirectWithError("/register", "This invitation link is invalid or has expired.");
      }

      const createdUser = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username,
            email,
            passwordHash,
            organizationId: invitation.organizationId,
            role: invitation.role === "MEMBER" ? "USER" : "ADMIN",
          },
        });

        await tx.orgMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId: user.id,
            role: invitation.role,
          },
        });

        await tx.orgInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "ACCEPTED",
            acceptedAt: new Date(),
          },
        });

        return user;
      });

      await createSession(createdUser);
      redirect(invitation.role === "MEMBER" ? "/user" : "/admin");
    }

    // Flow B: Standard SaaS Signup (New Org Creator)
    const newUser = await db.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: "ADMIN",
        organizationId: null,
      },
    });

    await createSession(newUser);
    // Send directly to organization creation
    redirect("/create-org");
  } catch (error) {
    handleDatabaseError(registerErrorUrl, error);
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}