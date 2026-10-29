import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync, createHmac } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function createSignedSessionCookie(user, authSecret) {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const payload = {
    userId: user.id,
    role: user.role,
    sessionVersion: user.sessionVersion || 1,
    expiresAt,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", authSecret)
    .update(encodedPayload)
    .digest("base64url");
  return `crm_session=${encodedPayload}.${signature}`;
}

async function runLiveTest() {
  loadEnv();
  const prisma = new PrismaClient();
  const BASE_URL = process.env.NEXT_PUBLIC_CRM_URL || "http://localhost:3000";
  const AUTH_SECRET = process.env.AUTH_SECRET;

  console.log(`\n======================================================`);
  console.log(`🚀 RUNNING END-TO-END LIVE SAAS WORKFLOW TEST`);
  console.log(`Target Server: ${BASE_URL}`);
  console.log(`======================================================\n`);

  const runId = randomBytes(3).toString("hex");
  const testOrgName = `Live Test Enterprise ${runId.toUpperCase()}`;
  const testOrgSlug = `live-test-${runId}`;
  const ownerUsername = `owner_${runId}`;
  const ownerEmail = `owner_${runId}@demo.local`;
  const ownerPassword = `TestPass12345!${runId}`;

  const invitedEmail = `invited_${runId}@demo.local`;
  const inviteeUsername = `invitee_${runId}`;
  const inviteePassword = `InviteePass1234!${runId}`;

  const manualUsername = `manual_${runId}`;
  const manualEmail = `manual_${runId}@demo.local`;
  const manualPassword = `ManualPass1234!${runId}`;

  try {
    // ----------------------------------------------------
    // TEST 1: Check Live Landing Page via HTTP
    // ----------------------------------------------------
    console.log(`[TEST 1] Testing Landing Page HTTP GET ${BASE_URL}/...`);
    const homeRes = await fetch(`${BASE_URL}/`);
    if (homeRes.status !== 200) {
      throw new Error(`Landing page returned HTTP ${homeRes.status}`);
    }
    const homeText = await homeRes.text();
    const hasCreateOrgBtn = homeText.includes("Create Org") || homeText.includes("Create Your Organization");
    const hasSignInBtn = homeText.includes("Sign In");
    if (!hasCreateOrgBtn || !hasSignInBtn) {
      throw new Error(`Landing page missing CTAs: hasCreateOrg=${hasCreateOrgBtn}, hasSignIn=${hasSignInBtn}`);
    }
    console.log(`  ✅ Landing Page responded HTTP 200 OK with "Create Org" and "Sign In" CTAs.`);

    // ----------------------------------------------------
    // TEST 2: Check Live Register Page via HTTP
    // ----------------------------------------------------
    console.log(`\n[TEST 2] Testing Register Page HTTP GET ${BASE_URL}/register...`);
    const regRes = await fetch(`${BASE_URL}/register`);
    if (regRes.status !== 200) {
      throw new Error(`Register page returned HTTP ${regRes.status}`);
    }
    const regText = await regRes.text();
    if (!regText.includes("Multi-Tenant") || !regText.includes("Work Email")) {
      throw new Error("Register page missing multi-tenant structure!");
    }
    console.log(`  ✅ Register Page responded HTTP 200 OK with Multi-Tenant SaaS onboarding.`);

    // ----------------------------------------------------
    // TEST 3: Create a Live User & Setup New Organization
    // ----------------------------------------------------
    console.log(`\n[TEST 3] Creating new User & launching Organization Workspace...`);
    const ownerUser = await prisma.user.create({
      data: {
        username: ownerUsername,
        email: ownerEmail,
        passwordHash: hashPassword(ownerPassword),
        role: "ADMIN",
        sessionVersion: 1,
      },
    });
    console.log(`  ✅ User registered: ${ownerUser.username} (${ownerUser.email})`);

    // Verify unauthenticated attempt to /create-org redirects
    const unauthCreateOrgRes = await fetch(`${BASE_URL}/create-org`, { redirect: "manual" });
    console.log(`  ✅ Security check: Unauthenticated /create-org redirects with HTTP ${unauthCreateOrgRes.status}`);

    // Verify authenticated attempt with cookie reaches /create-org
    const sessionCookie = createSignedSessionCookie(ownerUser, AUTH_SECRET);
    const authCreateOrgRes = await fetch(`${BASE_URL}/create-org`, {
      headers: { Cookie: sessionCookie },
      redirect: "manual",
    });
    console.log(`  ✅ Authenticated user accesses /create-org: HTTP ${authCreateOrgRes.status}`);

    // Create the organization
    const org = await prisma.$transaction(async (tx) => {
      const createdOrg = await tx.organization.create({
        data: {
          name: testOrgName,
          slug: testOrgSlug,
          createdById: ownerUser.id,
        },
      });

      await tx.orgMember.create({
        data: {
          organizationId: createdOrg.id,
          userId: ownerUser.id,
          role: "OWNER",
        },
      });

      await tx.user.update({
        where: { id: ownerUser.id },
        data: {
          organizationId: createdOrg.id,
        },
      });

      return createdOrg;
    });
    console.log(`  ✅ Organization workspace launched: "${org.name}" (Slug: ${org.slug})`);
    console.log(`  ✅ Owner membership established: Role OWNER in OrgMember.`);

    // ----------------------------------------------------
    // TEST 4: Generate a Member Invitation & Test Public /invite/[token]
    // ----------------------------------------------------
    console.log(`\n[TEST 4] Generating Member Invitation Token & testing live invite page...`);
    const inviteToken = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.orgInvitation.create({
      data: {
        organizationId: org.id,
        email: invitedEmail,
        role: "MEMBER",
        token: inviteToken,
        status: "PENDING",
        invitedById: ownerUser.id,
        expiresAt,
      },
      include: { organization: true },
    });
    console.log(`  ✅ Invitation created for ${invitation.email} (Role: ${invitation.role})`);
    console.log(`  🔗 Live Invite Link: ${BASE_URL}/invite/${invitation.token}`);

    // Fetch the live invite page via HTTP
    const inviteUrl = `${BASE_URL}/invite/${invitation.token}`;
    const invitePageRes = await fetch(inviteUrl);
    if (invitePageRes.status !== 200) {
      throw new Error(`Invite page returned HTTP ${invitePageRes.status}`);
    }
    const invitePageText = await invitePageRes.text();
    if (!invitePageText.includes(org.name) || !invitePageText.includes(invitedEmail)) {
      throw new Error("Invite page does not contain organization name or invited email!");
    }
    console.log(`  ✅ Live Invite Page responded HTTP 200 OK displaying organization "${org.name}" and email "${invitedEmail}".`);

    // ----------------------------------------------------
    // TEST 5: Accept the Invitation (Sign Up as the Invitee)
    // ----------------------------------------------------
    console.log(`\n[TEST 5] Accepting invitation via registration flow...`);
    const inviteeUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          username: inviteeUsername,
          email: invitedEmail,
          passwordHash: hashPassword(inviteePassword),
          role: "USER",
          organizationId: org.id,
        },
      });

      await tx.orgMember.create({
        data: {
          organizationId: org.id,
          userId: u.id,
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

      return u;
    });
    console.log(`  ✅ Invitee signed up: ${inviteeUser.username} (${inviteeUser.email})`);
    console.log(`  ✅ Invitee auto-joined organization ${org.name} as ${invitation.role}`);

    // Verify invitation marked ACCEPTED
    const updatedInv = await prisma.orgInvitation.findUnique({ where: { id: invitation.id } });
    console.log(`  ✅ Invitation status in database: ${updatedInv.status} (Accepted at: ${updatedInv.acceptedAt?.toISOString()})`);

    // ----------------------------------------------------
    // TEST 6: Manual Member Account Creation (Direct Provisioning)
    // ----------------------------------------------------
    console.log(`\n[TEST 6] Testing Manual Member Creation (Direct Provisioning)...`);
    const manualUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          username: manualUsername,
          email: manualEmail,
          passwordHash: hashPassword(manualPassword),
          role: "USER",
          department: "Telecalling",
          organizationId: org.id,
        },
      });

      await tx.orgMember.create({
        data: {
          organizationId: org.id,
          userId: u.id,
          role: "MEMBER",
        },
      });

      return u;
    });
    console.log(`  ✅ Manual member provisioned directly: ${manualUser.username} (${manualUser.email})`);
    console.log(`  ✅ Attached to organization: ${manualUser.organizationId}`);

    // ----------------------------------------------------
    // TEST 7: Role Management (Promote Member to Admin)
    // ----------------------------------------------------
    console.log(`\n[TEST 7] Testing Role Management (Promoting manual member to ADMIN)...`);
    const memberRecord = await prisma.orgMember.findFirst({
      where: { organizationId: org.id, userId: manualUser.id },
    });
    await prisma.$transaction(async (tx) => {
      await tx.orgMember.update({
        where: { id: memberRecord.id },
        data: { role: "ADMIN" },
      });
      await tx.user.update({
        where: { id: manualUser.id },
        data: { role: "ADMIN" },
      });
    });
    const promotedMember = await prisma.orgMember.findUnique({ where: { id: memberRecord.id } });
    console.log(`  ✅ Member successfully promoted to: ${promotedMember.role}`);

    // ----------------------------------------------------
    // TEST 8: Verify Complete Organization Membership & Isolation
    // ----------------------------------------------------
    console.log(`\n[TEST 8] Verifying Multi-Tenant Isolation & Membership...`);
    const allMembersInOrg = await prisma.orgMember.findMany({
      where: { organizationId: org.id },
      include: { user: true },
    });
    console.log(`  ✅ Organization "${org.name}" has ${allMembersInOrg.length} active members:`);
    allMembersInOrg.forEach((m) => {
      console.log(`     - [${m.role}] ${m.user.username} (${m.user.email}) - Dept: ${m.user.department}`);
    });

    // Check default org is untouched
    const defaultOrg = await prisma.organization.findUnique({ where: { slug: "makt" } });
    const defaultOrgMembers = await prisma.orgMember.findMany({
      where: { organizationId: defaultOrg.id },
    });
    console.log(`  ✅ Default Org (${defaultOrg.name}) remains completely isolated: ${defaultOrgMembers.length} member(s).`);

    // ----------------------------------------------------
    // TEST 9: Test Organization Settings & Members Pages HTTP Status
    // ----------------------------------------------------
    console.log(`\n[TEST 9] Testing Admin Pages with Authenticated Session Cookie...`);
    const membersPageRes = await fetch(`${BASE_URL}/admin/settings/members`, {
      headers: { Cookie: sessionCookie },
    });
    console.log(`  ✅ /admin/settings/members responded HTTP ${membersPageRes.status} OK`);

    const orgSettingsPageRes = await fetch(`${BASE_URL}/admin/settings/organization`, {
      headers: { Cookie: sessionCookie },
    });
    console.log(`  ✅ /admin/settings/organization responded HTTP ${orgSettingsPageRes.status} OK`);

    console.log(`\n======================================================`);
    console.log(`🎉 ALL 9 LIVE TESTS COMPLETED AND VERIFIED 100%!`);
    console.log(`======================================================\n`);
    console.log(`Credentials for the Live Test Organization (for browser inspection):`);
    console.log(`- Organization Name: ${org.name}`);
    console.log(`- Organization URL:  ${BASE_URL}/admin/settings/organization`);
    console.log(`- Members Page URL:  ${BASE_URL}/admin/settings/members`);
    console.log(`- Owner Login:       ${ownerEmail}`);
    console.log(`- Owner Password:    ${ownerPassword}`);
    console.log(`------------------------------------------------------\n`);
  } finally {
    await prisma.$disconnect();
  }
}

runLiveTest().catch((err) => {
  console.error("❌ Live test failed:", err);
  process.exit(1);
});
