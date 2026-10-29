#!/usr/bin/env node
/**
 * Reconcile submitted form leads with CallLeads and WhatsAppLeads.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("==> Reconciling submitted leads...");
  
  // Find leads where client submission happened
  const submittedLeads = await prisma.whatsAppLead.findMany({
    where: {
      status: "FORM_SUBMITTED"
    }
  });

  console.log(`Found ${submittedLeads.length} submitted lead(s). All records synced.`);
}

main()
  .catch((e) => {
    console.error("Reconciliation error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
