import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function resetStuckQueue() {
  console.log("Checking for stuck queue items...");
  const cutoff = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes

  const stuck = await prisma.whatsAppQueueItem.findMany({
    where: {
      status: "SENDING",
      sendingAt: { lte: cutoff },
      deletedAt: null,
      isArchived: false,
    },
    select: { id: true, whatsappLeadId: true, phone: true },
  });

  if (stuck.length === 0) {
    console.log("No stuck SENDING items found. Queue is clean.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${stuck.length} stuck items. Reclaiming to QUEUED...`);

  await prisma.$transaction([
    prisma.whatsAppQueueItem.updateMany({
      where: { id: { in: stuck.map((s) => s.id) } },
      data: {
        status: "QUEUED",
        sendingAt: null,
        claimExpiresAt: null,
        attemptCount: { increment: 1 },
        lastError: "Reclaimed from stuck SENDING state via CLI script.",
      },
    }),
    prisma.whatsAppLead.updateMany({
      where: { id: { in: stuck.map((s) => s.whatsappLeadId) } },
      data: {
        status: "QUEUED",
        lastError: "Reclaimed from stuck SENDING state via CLI script.",
      },
    }),
  ]);

  console.log(`Successfully reclaimed ${stuck.length} items to QUEUED.`);
  await prisma.$disconnect();
}

resetStuckQueue().catch((err) => {
  console.error("Error resetting stuck queue:", err);
  process.exit(1);
});
