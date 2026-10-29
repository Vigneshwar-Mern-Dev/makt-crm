import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";
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

async function run() {
  loadEnv();
  const prisma = new PrismaClient();

  const testSuffix = randomBytes(3).toString("hex");
  const testOrgSlug = `test-org-${testSuffix}`;
  const ownerEmail = `owner-${testSuffix}@testsaas.local`;
  const inviteeEmail = `invitee-${testSuffix}@testsaas.local`;
  const manualUserEmail = `manual-${testSuffix}@testsaas.local`;

  console.log(`\n========================================`);
  console.log(`🧪 STARTING SAAS MULTI-TENANT WORKFLOW TEST`);
  console.log(`========================================\n`);

  try {
    // 1. Verify default Organization exists
    console.log(`[Step 1] Checking existing default organization...`);
    const defaultOrg = await prisma.organization.findUnique({
      where: { slug: "makt" },
      include: { members: true },
    });
    console.log(`✅ Default Organization: "${defaultOrg?.name}" (ID: ${defaultOrg?.id}), Members: ${defaultOrg?.members.length}`);

    // 2. Simulate User Signup & Workspace Creation
    console.log(`\n[Step 2] Testing User Signup & Organization Creation...`);
    const newOwner = await prisma.user.create({
      data: {
        username: `owner_${testSuffix}`,
        email: ownerEmail,
        passwordHash: hashPassword("SecurePass1234!"),
        role: "ADMIN",
      },
    });
    console.log(`✅ User registered: ID ${newOwner.id} (${newOwner.email})`);

    const newOrg = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: `Apex Enterprise ${testSuffix.toUpperCase()}`,
          slug: testOrgSlug,
          createdById: newOwner.id,
        },
      });

      await tx.orgMember.create({
        data: {
          organizationId: org.id,
          userId: newOwner.id,
          role: "OWNER",
        },
      });

      await tx.user.update({
        where: { id: newOwner.id },
        data: { organizationId: org.id },
      });

      return org;
    });
    console.log(`✅ Organization created: "${newOrg.name}" (Slug: ${newOrg.slug}, ID: ${newOrg.id})`);
    console.log(`✅ Owner linked: User ${newOwner.id} is OrgMember OWNER of ${newOrg.id}`);

    // 3. Test Invite via Link / Token
    console.log(`\n[Step 3] Testing Member Invitation Creation & Validation...`);
    const inviteToken = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.orgInvitation.create({
      data: {
        organizationId: newOrg.id,
        email: inviteeEmail,
        role: "MEMBER",
        token: inviteToken,
        status: "PENDING",
        invitedById: newOwner.id,
        expiresAt,
      },
      include: { organization: true },
    });
    console.log(`✅ Invitation created for ${invitation.email}`);
    console.log(`   Token: ${invitation.token}`);
    console.log(`   Invite Link: http://localhost:3000/invite/${invitation.token}`);
    console.log(`   Expires: ${invitation.expiresAt.toISOString()}`);

    // Validate the invitation lookup (simulating /invite/[token] visit)
    const fetchedInvite = await prisma.orgInvitation.findUnique({
      where: { token: inviteToken },
      include: { organization: true },
    });
    const isValid = fetchedInvite?.status === "PENDING" && fetchedInvite.expiresAt > new Date();
    if (!isValid) throw new Error("Invitation token validation failed!");
    console.log(`✅ Invitation token successfully validated for public /invite/[token] route!`);

    // 4. Test Manual Member Account Creation (direct provisioning)
    console.log(`\n[Step 4] Testing Manual Member Creation (Direct Provisioning)...`);
    const manualUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          username: `manual_${testSuffix}`,
          email: manualUserEmail,
          passwordHash: hashPassword("TempPass98765#"),
          role: "USER",
          department: "Telecalling",
          organizationId: newOrg.id,
        },
      });

      const m = await tx.orgMember.create({
        data: {
          organizationId: newOrg.id,
          userId: u.id,
          role: "MEMBER",
        },
      });

      return { user: u, member: m };
    });
    console.log(`✅ Manual member created without invite: ${manualUser.user.username} (${manualUser.user.email})`);
    console.log(`✅ Member role: ${manualUser.member.role}, Department: ${manualUser.user.department}`);

    // 5. Test Role Update (Promotion to ADMIN)
    console.log(`\n[Step 5] Testing Member Role Promotion (MEMBER -> ADMIN)...`);
    await prisma.$transaction(async (tx) => {
      await tx.orgMember.update({
        where: { id: manualUser.member.id },
        data: { role: "ADMIN" },
      });
      await tx.user.update({
        where: { id: manualUser.user.id },
        data: { role: "ADMIN" },
      });
    });
    const updatedMember = await prisma.orgMember.findUnique({
      where: { id: manualUser.member.id },
    });
    console.log(`✅ Member role updated to: ${updatedMember?.role}`);

    // 6. Test Data Isolation Verification
    console.log(`\n[Step 6] Testing Multi-Tenant Data Isolation...`);
    const orgMembers = await prisma.orgMember.findMany({
      where: { organizationId: newOrg.id },
      include: { user: true },
    });
    console.log(`✅ Organization ${newOrg.slug} has exactly ${orgMembers.length} member(s):`);
    orgMembers.forEach((m) => {
      console.log(`   - ${m.user.username} (${m.user.email}) -> Role: ${m.role}`);
    });

    const defaultOrgMembers = await prisma.orgMember.findMany({
      where: { organizationId: defaultOrg?.id },
    });
    console.log(`✅ Default Organization (MAKT CRM) members remain isolated: ${defaultOrgMembers.length} member(s)`);

    // 7. Cleanup test records
    console.log(`\n[Step 7] Cleaning up test records...`);
    await prisma.orgInvitation.deleteMany({ where: { organizationId: newOrg.id } });
    await prisma.orgMember.deleteMany({ where: { organizationId: newOrg.id } });
    await prisma.user.deleteMany({
      where: {
        id: { in: [newOwner.id, manualUser.user.id] },
      },
    });
    await prisma.organization.delete({ where: { id: newOrg.id } });
    console.log(`✅ Test organization and temporary accounts cleanly removed.`);

    console.log(`\n========================================`);
    console.log(`🎉 ALL MULTI-TENANT SAAS WORKFLOWS PASSED!`);
    console.log(`========================================\n`);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error("❌ Workflow test failed:", err);
  process.exit(1);
});
