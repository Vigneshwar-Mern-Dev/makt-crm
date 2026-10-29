import { PrismaClient } from "@prisma/client";
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
    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnv();
  const prisma = new PrismaClient();

  try {
    console.log("==> Starting multi-tenant migration and backfill...");

    // 1. Find or create default organization
    let defaultOrg = await prisma.organization.findUnique({
      where: { slug: "makt" },
    });

    const firstAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { id: "asc" },
    });

    const anyUser = await prisma.user.findFirst({
      orderBy: { id: "asc" },
    });

    const ownerId = firstAdmin?.id || anyUser?.id || "system";

    if (!defaultOrg) {
      console.log(`Creating default organization 'MAKT' (slug: makt) with owner ID: ${ownerId}...`);
      defaultOrg = await prisma.organization.create({
        data: {
          name: "MAKT CRM",
          slug: "makt",
          createdById: ownerId,
        },
      });
      console.log(`Default organization created: ${defaultOrg.id}`);
    } else {
      console.log(`Found existing default organization: ${defaultOrg.id} (${defaultOrg.name})`);
    }

    const orgId = defaultOrg.id;

    // 2. Backfill Users
    const unlinkedUsers = await prisma.user.findMany({
      where: { organizationId: null },
    });
    console.log(`Linking ${unlinkedUsers.length} user(s) to organization ${orgId}...`);

    for (const user of unlinkedUsers) {
      await prisma.user.update({
        where: { id: user.id },
        data: { organizationId: orgId },
      });

      // Upsert OrgMember
      const role = user.role === "ADMIN" ? "OWNER" : "MEMBER";
      await prisma.orgMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: user.id,
          },
        },
        create: {
          organizationId: orgId,
          userId: user.id,
          role: role,
        },
        update: {
          role: role,
        },
      });
      console.log(`  - User ${user.email} -> OrgMember (${role})`);
    }

    // 3. Backfill tenant-scoped models
    const updates = [
      { name: "Task", model: prisma.task },
      { name: "WebsiteLead", model: prisma.websiteLead },
      { name: "InstagramLead", model: prisma.instagramLead },
      { name: "CallLead", model: prisma.callLead },
      { name: "CallSession", model: prisma.callSession },
      { name: "CallEvent", model: prisma.callEvent },
      { name: "CompanyPhone", model: prisma.companyPhone },
      { name: "WhatsAppAccount", model: prisma.whatsAppAccount },
      { name: "WhatsAppLead", model: prisma.whatsAppLead },
      { name: "WhatsAppQueueItem", model: prisma.whatsAppQueueItem },
      { name: "LeadIntegration", model: prisma.leadIntegration },
      { name: "FormSubmission", model: prisma.formSubmission },
    ];

    for (const { name, model } of updates) {
      try {
        const res = await model.updateMany({
          where: { organizationId: null },
          data: { organizationId: orgId },
        });
        console.log(`Updated ${res.count} ${name} record(s) -> organization ${orgId}`);
      } catch (err) {
        console.error(`Error updating ${name}:`, err.message);
      }
    }

    console.log("==> Multi-tenant migration and backfill completed successfully! 🎉");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
