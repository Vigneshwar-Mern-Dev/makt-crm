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
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnv();
  const prisma = new PrismaClient();

  console.log("=== Re-queue Expired WhatsApp Leads (With Deduplication) ===");

  try {
    const waAccount = await prisma.whatsAppAccount.findFirst({
      where: { autoReplyEnabled: true },
      orderBy: { createdAt: "asc" },
    });

    if (!waAccount) {
      console.error("No active WhatsApp account found.");
      return;
    }

    // 1. Get already sent/delivered phones
    const delivered = await prisma.whatsAppQueueItem.findMany({
      where: {
        status: { in: ["SENT", "OPENED", "FORM_STARTED", "FORM_SUBMITTED"] },
        deletedAt: null,
      },
      select: { phone: true },
    });
    const deliveredPhoneSet = new Set(delivered.map((d) => d.phone));

    // 2. Find all EXPIRED queue items
    const expiredItems = await prisma.whatsAppQueueItem.findMany({
      where: {
        status: "EXPIRED",
        deletedAt: null,
      },
      orderBy: { queuedAt: "asc" },
      select: {
        id: true,
        phone: true,
        displayName: true,
        whatsappLeadId: true,
        callLeadId: true,
      },
    });

    console.log(`Found ${expiredItems.length} expired queue items.`);

    if (expiredItems.length === 0) {
      console.log("No expired items to re-queue.");
      return;
    }

    // 3. Deduplicate: keep only 1 item per unique phone number that has NOT been delivered
    const itemsToRequeue = [];
    const seenPhones = new Set();
    const duplicateIdsToCancel = [];

    for (const item of expiredItems) {
      if (deliveredPhoneSet.has(item.phone)) {
        duplicateIdsToCancel.push(item.id);
        continue;
      }

      if (seenPhones.has(item.phone)) {
        duplicateIdsToCancel.push(item.id);
        continue;
      }

      seenPhones.add(item.phone);
      itemsToRequeue.push(item);
    }

    // Cancel redundant/delivered expired items
    if (duplicateIdsToCancel.length > 0) {
      await prisma.whatsAppQueueItem.updateMany({
        where: { id: { in: duplicateIdsToCancel } },
        data: {
          status: "CANCELLED",
          lastError: "Cancelled: Duplicate phone number or already delivered.",
        },
      });
      console.log(`Cancelled ${duplicateIdsToCancel.length} duplicate/already-delivered expired items.`);
    }

    console.log(`Re-queueing ${itemsToRequeue.length} unique phone leads with 45-second spacing...`);

    const now = Date.now();
    for (let i = 0; i < itemsToRequeue.length; i++) {
      const item = itemsToRequeue[i];
      const sendAfterAt = new Date(now + i * 45 * 1000);

      await prisma.whatsAppQueueItem.update({
        where: { id: item.id },
        data: {
          status: "QUEUED",
          sendAfterAt,
          sendingAt: null,
          claimExpiresAt: null,
          attemptCount: 0,
          lastError: null,
          expiredAt: null,
        },
      });

      if (item.whatsappLeadId) {
        await prisma.whatsAppLead.update({
          where: { id: item.whatsappLeadId },
          data: { status: "QUEUED", lastError: null },
        }).catch(() => {});
      }
    }

    console.log(`Successfully re-queued ${itemsToRequeue.length} leads! They will start sending automatically.`);
  } catch (err) {
    console.error("Re-queue failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
