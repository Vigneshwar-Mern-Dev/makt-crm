import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
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

const TEMPLATES = [
  `வணக்கம் {{name}}! 🙏\n\nATM Franchise பற்றி விசாரித்தமைக்கு நன்றி.\n\nகீழே உள்ள பாதுகாப்பான லிங்கில் உங்கள் விவரங்களை பதிவு செய்யவும்:\n{{formLink}}\n\nஎங்கள் அணி விரைவில் உங்களை அழைக்கும்.\n\nநன்றி! 🙏\nATM Franchise Team`,
  `Hello {{name}}! 🙏\n\nThank you for reaching out regarding the ATM Franchise opportunity.\n\nPlease fill out your property details using this secure link:\n{{formLink}}\n\nOur team will review your location and get back to you shortly.\n\nWarm regards,\nATM Franchise Team`
];

async function main() {
  loadEnv();
  const prisma = new PrismaClient();

  const baseUrl = process.env.CRM_PUBLIC_URL?.trim() || process.env.NEXT_PUBLIC_CRM_URL?.trim() || "https://crm.planle.com";

  console.log("=== Backfill WhatsApp Queue for Existing Call Leads ===");

  try {
    const waAccount = await prisma.whatsAppAccount.findFirst({
      where: { autoReplyEnabled: true },
      orderBy: { createdAt: "asc" }
    });

    if (!waAccount) {
      console.error("No WhatsApp account found with autoReplyEnabled=true.");
      return;
    }

    console.log(`Using WhatsApp Account: "${waAccount.label}" (ID: ${waAccount.id}, Status: ${waAccount.status})`);

    // Find CallLeads that have no WhatsAppQueueItems
    const unqueuedLeads = await prisma.callLead.findMany({
      where: {
        whatsappQueueItems: { none: {} },
        organizationId: waAccount.organizationId
      },
      orderBy: { createdAt: "desc" }
    });

    console.log(`Found ${unqueuedLeads.length} leads waiting for WhatsApp intro.`);

    // Deduplicate by phone so we never process the same phone number twice in one batch
    const uniqueLeadsByPhone = [];
    const seenPhonesInBatch = new Set();

    for (const lead of unqueuedLeads) {
      if (!lead.phone) continue;
      if (seenPhonesInBatch.has(lead.phone)) {
        console.log(`[dedup] Skipped duplicate lead in batch for phone ${lead.phone} ("${lead.displayName}")`);
        continue;
      }

      // Check if phone already has any existing queue item or sent item in DB
      const existingInDb = await prisma.whatsAppQueueItem.findFirst({
        where: {
          phone: lead.phone,
          deletedAt: null,
          status: { in: ["QUEUED", "SENDING", "SENT", "OPENED", "FORM_STARTED", "FORM_SUBMITTED"] },
        },
        select: { id: true, status: true },
      });

      if (existingInDb) {
        console.log(`[dedup] Skipped phone ${lead.phone}: already in state ${existingInDb.status}`);
        continue;
      }

      seenPhonesInBatch.add(lead.phone);
      uniqueLeadsByPhone.push(lead);
    }

    console.log(`After deduplication: ${uniqueLeadsByPhone.length} unique phone numbers to queue.`);

    if (uniqueLeadsByPhone.length === 0) {
      console.log("All leads already have WhatsApp queue records!");
      return;
    }

    let queuedCount = 0;
    const now = Date.now();

    for (let i = 0; i < uniqueLeadsByPhone.length; i++) {
      const lead = uniqueLeadsByPhone[i];
      const formToken = `ft_${randomBytes(12).toString("hex")}`;
      const formLink = `${baseUrl}/f/${formToken}`;

      // Pick template and replace placeholders
      const template = TEMPLATES[i % TEMPLATES.length];
      const messageBody = template
        .replace("{{name}}", lead.displayName || "Partner")
        .replace("{{formLink}}", formLink);

      // Create or link WhatsAppLead
      let waLead = await prisma.whatsAppLead.findFirst({
        where: { phone: lead.phone, organizationId: lead.organizationId }
      });

      if (!waLead) {
        waLead = await prisma.whatsAppLead.create({
          data: {
            organizationId: lead.organizationId,
            phone: lead.phone,
            displayName: lead.displayName || "Partner",
            accountId: waAccount.id,
            status: "QUEUED",
            formToken: formToken
          }
        });
      }

      // Stagger send times by 45 seconds each to comply with anti-ban guidelines
      const sendAfterAt = new Date(now + i * 45 * 1000);

      await prisma.whatsAppQueueItem.create({
        data: {
          organizationId: lead.organizationId,
          whatsappLeadId: waLead.id,
          callLeadId: lead.id,
          phone: lead.phone,
          displayName: lead.displayName || "Partner",
          message: messageBody,
          accountId: waAccount.id,
          status: "QUEUED",
          formToken: formToken,
          sendAfterAt: sendAfterAt
        }
      });

      queuedCount++;
    }

    console.log(`🎉 Successfully queued ${queuedCount} WhatsApp messages!`);
    console.log(`They are scheduled with safe 45-second intervals and will send once WhatsApp shows CONNECTED.`);

  } catch (err) {
    console.error("Backfill failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

