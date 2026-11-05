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
  const now = new Date();

  console.log("=== WhatsApp Queue Deduplication & Safety Healer ===");

  try {
    // 1. Find all phones that already have a DELIVERED/SENT message
    const delivered = await prisma.whatsAppQueueItem.findMany({
      where: {
        status: { in: ["SENT", "OPENED", "FORM_STARTED", "FORM_SUBMITTED"] },
        deletedAt: null,
      },
      select: { phone: true, displayName: true, sentAt: true },
    });

    const deliveredPhoneSet = new Set(delivered.map((d) => d.phone));
    console.log(`Found ${deliveredPhoneSet.size} unique phones that already received messages.`);

    // 2. Cancel any QUEUED items for phones that already received a message
    if (deliveredPhoneSet.size > 0) {
      const redundantQueued = await prisma.whatsAppQueueItem.findMany({
        where: {
          phone: { in: Array.from(deliveredPhoneSet) },
          status: "QUEUED",
          deletedAt: null,
        },
        select: { id: true, phone: true, displayName: true, callLeadId: true },
      });

      if (redundantQueued.length > 0) {
        console.log(`Cancelling ${redundantQueued.length} queue items for already-contacted phones...`);
        for (const item of redundantQueued) {
          await prisma.whatsAppQueueItem.update({
            where: { id: item.id },
            data: {
              status: "CANCELLED",
              cancelledAt: now,
              lastError: `Duplicate phone: Already received a WhatsApp message earlier.`,
            },
          });

          if (item.callLeadId) {
            await prisma.callActivity.create({
              data: {
                leadId: item.callLeadId,
                actionType: "NOTE_ADDED",
                description: `[Duplicate Cancelled] Queue item for ${item.phone} ("${item.displayName}") cancelled because message was already delivered.`,
              },
            }).catch(() => {});
          }
        }
      }
    }

    // 3. Find duplicate active QUEUED items for the same phone number
    const activeQueued = await prisma.whatsAppQueueItem.findMany({
      where: {
        status: "QUEUED",
        deletedAt: null,
      },
      orderBy: [{ sendAfterAt: "asc" }, { queuedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        phone: true,
        displayName: true,
        callLeadId: true,
        sendAfterAt: true,
      },
    });

    const seenPhones = new Map(); // phone -> firstItem
    const duplicatesToCancel = [];

    for (const item of activeQueued) {
      if (seenPhones.has(item.phone)) {
        duplicatesToCancel.push({
          duplicate: item,
          preserved: seenPhones.get(item.phone),
        });
      } else {
        seenPhones.set(item.phone, item);
      }
    }

    if (duplicatesToCancel.length > 0) {
      console.log(`Found ${duplicatesToCancel.length} redundant QUEUED items sharing the same phone number.`);
      for (const { duplicate, preserved } of duplicatesToCancel) {
        await prisma.whatsAppQueueItem.update({
          where: { id: duplicate.id },
          data: {
            status: "CANCELLED",
            cancelledAt: now,
            lastError: `Duplicate phone in queue: Kept "${preserved.displayName}" (ID: ${preserved.id}), cancelled redundant "${duplicate.displayName}".`,
          },
        });

        if (duplicate.callLeadId) {
          await prisma.callActivity.create({
            data: {
              leadId: duplicate.callLeadId,
              actionType: "NOTE_ADDED",
              description: `[Duplicate Queue Cancelled] Redundant queue item for ${duplicate.phone} ("${duplicate.displayName}") cancelled in favor of earlier queue item ("${preserved.displayName}").`,
            },
          }).catch(() => {});
        }
      }
    } else {
      console.log("No redundant active queue items found.");
    }

    console.log("=== WhatsApp Deduplication Complete ===");
  } catch (error) {
    console.error("Deduplication failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
