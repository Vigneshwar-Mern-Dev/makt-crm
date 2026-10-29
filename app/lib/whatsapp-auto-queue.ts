import "server-only";

import { db } from "./db";
import { queueWhatsAppMessage } from "./whatsapp-lifecycle";
import { pickWhatsAppAccount, pickWhatsAppAccountForCall } from "./whatsapp-account-picker";

const ANSWERED_TEMPLATE = `{Hi|Hello|வணக்கம்} {{name}}! 🙏

{Thank you for your inquiry about the ATM Franchise.|ATM Franchise-ஐ தொடர்பு கொண்டதற்கு நன்றி.|MAKT ATM Franchise பற்றி விசாரித்தமைக்கு நன்றி.} {It was good speaking with you today.|உங்களுடன் பேசியதில் மகிழ்ச்சி.}

{Please fill out your details using this secure link so we can finalize the next steps:|உங்கள் விவரங்களை இந்த பாதுகாப்பான லிங்க் மூலம் பூர்த்தி செய்யுங்கள்:|கீழே உள்ள லிங்கில் உங்கள் விவரங்களை பதிவு செய்யவும்:}
{{formLink}}

{Our team will review your details and contact you shortly.|எங்கள் குழு உங்கள் விவரங்களை ஆய்வு செய்து விரைவில் உங்களைத் தொடர்பு கொள்ளும்.|எங்கள் அணி விரைவில் முழு விவரங்களுடன் உங்களை அழைக்கும்.}

{Thank you,|நன்றி! 🙏|Warm regards,}
ATM Franchise Team`;

const MISSED_TEMPLATE = `{Hi|Hello|வணக்கம்} {{name}}! 🙏

{We are from ATM Franchise.|நாங்கள் ATM Franchise குழுவிலிருந்து தொடர்பு கொள்கிறோம்.} {Apologies for missing your call.|பதில் அளிக்க இயலாததற்கு மன்னிக்கவும்.} {We are currently receiving a high volume of inquiries.|தற்போது அதிக அழைப்புகள் வருவதால் தாமதம் ஏற்பட்டுள்ளது.}

{Please fill out your details using this secure link:|உங்கள் தகவல்களை இந்த லிங்க் மூலம் பதிவு செய்யவும்:|கீழே உள்ள பாதுகாப்பான லிங்கில் விவரங்களை பூர்த்தி செய்யவும்:}
{{formLink}}

{Our team will contact you and provide complete information.|எங்கள் குழு உங்களை உடனடியாக தொடர்பு கொண்டு முழு விவரங்களை வழங்கும்.}

{Thank you,|நன்றி! 🙏|With regards,}
ATM Franchise Team`;

export async function autoQueueWhatsAppForCaller(
  callerPhone: string,
  displayName: string,
  callState: "ANSWERED" | "MISSED",
  callLeadId?: string,
  companyPhoneId?: string,
  organizationId?: string,
): Promise<void> {
  try {
    const picked = companyPhoneId
      ? await pickWhatsAppAccountForCall(companyPhoneId, callerPhone)
      : await pickWhatsAppAccount(callerPhone);

    if (!picked) {
      console.log(
        "[whatsapp-auto-queue] No enabled account for " + callerPhone +
          (companyPhoneId ? ". Map the company phone or enable auto-reply." : ". No available WhatsApp accounts."),
      );
      return;
    }

    // Fetch account-level settings for cooldown check
    const account = await db.whatsAppAccount.findUnique({
      where: { id: picked.accountId },
      select: {
        id: true,
        autoReplyEnabled: true,
        contactCooldownDays: true,
      },
    });

    if (!account?.autoReplyEnabled) {
      return;
    }

    const existing = await db.whatsAppLead.findFirst({
      where: { phone: callerPhone, deletedAt: null },
      select: { id: true, status: true, lastSentAt: true, lastReplyAt: true },
    });

    if (existing?.status === "DO_NOT_CONTACT") {
      console.log(`[whatsapp-auto-queue] Skipping ${callerPhone}: DO_NOT_CONTACT.`);
      return;
    }

    if (existing?.status === "SENT" || existing?.status === "REPLIED") {
      const lastContactDate = existing.lastReplyAt ?? existing.lastSentAt;

      if (lastContactDate && account.contactCooldownDays > 0) {
        const cooldownMs = account.contactCooldownDays * 24 * 60 * 60 * 1000;
        const timeSinceContact = Date.now() - lastContactDate.getTime();

        if (timeSinceContact < cooldownMs) {
          const hoursLeft = Math.ceil((cooldownMs - timeSinceContact) / (60 * 60 * 1000));
          console.log(
            `[whatsapp-auto-queue] Skipping ${callerPhone}: cooldown active, ${hoursLeft}h remaining.`,
          );
          return;
        }
      }
    }

    const selectedMessage = callState === "ANSWERED" ? ANSWERED_TEMPLATE : MISSED_TEMPLATE;
    const result = await queueWhatsAppMessage({
      accountId: account.id,
      phone: callerPhone,
      displayName,
      message: selectedMessage,
      consentAt: new Date(),
      callLeadId,
      organizationId,
      source: `auto_${callState.toLowerCase()}`,
      routingReason: picked.reason,
      routingWarning: picked.warning,
    });

    if (result.queued) {
      console.log(
        "[whatsapp-auto-queue] Queued WhatsApp for " + callerPhone +
          " (account=" + account.id + ", callLead=" + (callLeadId ?? "none") +
          ", queueItem=" + result.queueItemId + ", deferred=" + Boolean(picked.deferred) + ").",
      );
    } else {
      console.log(
        `[whatsapp-auto-queue] Skipped ${callerPhone}: ${result.reason} (callLead=${callLeadId ?? "none"}).`,
      );
    }
  } catch (error) {
    console.error("[whatsapp-auto-queue] Failed to queue WhatsApp message:", error);
  }
}
