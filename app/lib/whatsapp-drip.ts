import "server-only";

import { db } from "./db";
import { queueWhatsAppMessage } from "./whatsapp-lifecycle";

const DRIP_TEMPLATE = `{வணக்கம்|ஹலோ|Hi} {{name}}! 🙏

{ATM Franchise பற்றிய உங்கள் விண்ணப்பத்தை சரிபார்த்தீர்களா?|MAKT ATM Franchise-ல் நீங்கள் காட்டிய ஆர்வத்திற்கு நன்றி.} {உங்கள் பகுதியில் ATM நிறுவ நல்ல வாய்ப்பு உள்ளது.|உங்கள் வணிக இடத்திற்கான அனுமதி விரைவாக பெற கீழ்கண்ட பாதுகாப்பான லிங்கை பூர்த்தி செய்யவும்:}

👉 {{formLink}}

{ஏதேனும் சந்தேகம் இருந்தால் இந்த எண்ணில் தெரிவிக்கலாம் அல்லது அழைக்கலாம்.|எங்கள் அணி உங்களுக்கு உதவ தயாராக உள்ளது.}
{நன்றி! 🙏|நன்றி 😊}
ATM Franchise Team`;

export type DripRunResult = {
  totalScanned: number;
  queuedCount: number;
  skippedCount: number;
  leadsProcessed: Array<{ id: string; phone: string; reason: string }>;
};

/**
 * 24-Hour Non-Responder Re-engagement Drip Runner
 *
 * Scans for leads that received the initial WhatsApp message 20 to 72 hours ago
 * but have not yet submitted the application form and haven't opted out.
 * Automatically staggers and queues a gentle follow-up reminder.
 */
export async function runWhatsAppDripReengagement(): Promise<DripRunResult> {
  const now = Date.now();
  const twentyHoursAgo = new Date(now - 20 * 60 * 60 * 1000);
  const seventyTwoHoursAgo = new Date(now - 72 * 60 * 60 * 1000);

  // 1. Find candidate WhatsApp leads
  const candidateLeads = await db.whatsAppLead.findMany({
    where: {
      deletedAt: null,
      status: { in: ["SENT", "REPLIED", "QUEUED"] },
      createdAt: {
        gte: seventyTwoHoursAgo,
        lte: twentyHoursAgo,
      },
    },
    include: {
      account: true,
    },
    take: 50, // Safe batch limit per drip cycle
  });

  const result: DripRunResult = {
    totalScanned: candidateLeads.length,
    queuedCount: 0,
    skippedCount: 0,
    leadsProcessed: [],
  };

  for (const lead of candidateLeads) {
    // Skip if DNC
    if (lead.status === "DO_NOT_CONTACT") {
      result.skippedCount++;
      result.leadsProcessed.push({ id: lead.id, phone: lead.phone, reason: "do_not_contact" });
      continue;
    }

    // Skip if already submitted form
    const submittedForm = await db.formSubmission.findFirst({
      where: {
        phone: lead.phone,
        status: "FORM_SUBMITTED",
        deletedAt: null,
      },
    });

    if (submittedForm) {
      result.skippedCount++;
      result.leadsProcessed.push({ id: lead.id, phone: lead.phone, reason: "form_already_submitted" });
      continue;
    }

    // Look up associated call lead by phone
    const callLead = await db.callLead.findUnique({
      where: { phone: lead.phone },
      select: { id: true },
    });

    // Skip if already received drip in last 72 hours
    if (callLead) {
      const priorDrip = await db.callActivity.findFirst({
        where: {
          leadId: callLead.id,
          description: { contains: "re-engagement" },
          createdAt: { gte: seventyTwoHoursAgo },
        },
      });

      if (priorDrip) {
        result.skippedCount++;
        result.leadsProcessed.push({ id: lead.id, phone: lead.phone, reason: "drip_already_sent" });
        continue;
      }
    }

    // Pick active WhatsApp sender account
    const accountId = lead.accountId || lead.account?.id;
    if (!accountId) {
      result.skippedCount++;
      result.leadsProcessed.push({ id: lead.id, phone: lead.phone, reason: "no_account_available" });
      continue;
    }

    // Queue the drip reminder
    try {
      const queueRes = await queueWhatsAppMessage({
        accountId,
        phone: lead.phone,
        displayName: lead.displayName || "Customer",
        message: DRIP_TEMPLATE,
        callLeadId: callLead?.id,
        source: "drip_followup_24h",
      });

      if (queueRes.queued) {
        if (callLead) {
          await db.callActivity.create({
            data: {
              leadId: callLead.id,
              actionType: "WHATSAPP_QUEUED",
              description: `Automated 24h WhatsApp re-engagement follow-up queued`,
            },
          });
        }
        result.queuedCount++;
        result.leadsProcessed.push({ id: lead.id, phone: lead.phone, reason: "queued_successfully" });
      } else {
        result.skippedCount++;
        result.leadsProcessed.push({ id: lead.id, phone: lead.phone, reason: queueRes.reason });
      }
    } catch (err) {
      console.error(`[whatsapp-drip] Failed to queue drip for ${lead.phone}:`, err);
      result.skippedCount++;
      result.leadsProcessed.push({ id: lead.id, phone: lead.phone, reason: "queue_exception" });
    }
  }

  console.log(
    `[whatsapp-drip] Finished drip cycle: ${result.queuedCount} queued, ${result.skippedCount} skipped out of ${result.totalScanned} scanned.`,
  );

  return result;
}
