#!/usr/bin/env node
/**
 * Reconcile WhatsApp lead statuses with WhatsAppQueue delivery records.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("==> Starting WhatsApp delivery reconciliation...");
  
  // Find leads where queue has SENT or DELIVERED or READ but lead status is still NEW or QUEUED
  const leads = await prisma.whatsAppLead.findMany({
    include: {
      queueItems: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  let updated = 0;
  for (const lead of leads) {
    const latestQueue = lead.queueItems[0];
    if (!latestQueue) continue;

    if (["SENT", "DELIVERED", "READ"].includes(latestQueue.status) && (lead.status === "NEW" || lead.status === "QUEUED")) {
      await prisma.whatsAppLead.update({
        where: { id: lead.id },
        data: { status: "SENT" }
      });
      updated++;
    }
  }

  console.log(`==> Reconciled ${updated} out-of-sync lead(s). Finished.`);
}

main()
  .catch((e) => {
    console.error("Reconciliation error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
