import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { WhatsAppLeadStatus } from "@/app/lib/prisma-enums";
import { validateBody } from "@/app/lib/validators/validate";
import { whatsappInboxPayloadSchema } from "@/app/lib/validators/whatsapp";
import { processInboundBotReply } from "@/app/lib/whatsapp-bot";
import {
  sanitizeIncomingWhatsAppMessage,
  validateBridgeRequest,
} from "@/app/lib/whatsapp-security";

export async function POST(request: Request) {
  const auth = validateBridgeRequest(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  const validation = await validateBody(request, whatsappInboxPayloadSchema);
  if (!validation.success) {
    return validation.response;
  }

  const payload = validation.data;
  const phone = payload.phone;
  const message = sanitizeIncomingWhatsAppMessage(payload.message, 1000);
  const receivedAt = payload.receivedAt ?? new Date();
  const snippet = message.slice(0, 200) || "(no text)";

  const account = await db.whatsAppAccount.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const callLead = await db.callLead.upsert({
    where: { phone },
    update: { lastContactedAt: receivedAt },
    create: {
      phone,
      displayName: `Caller ${phone.slice(-4)}`,
      lastContactedAt: receivedAt,
    },
    select: { id: true, displayName: true },
  });
  const lead = await db.whatsAppLead.findFirst({
    where: { phone, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, status: true, accountId: true, displayName: true },
  });

  if (!lead) {
    const created = await db.whatsAppLead.create({
      data: {
        accountId: account?.id ?? null,
        phone,
        displayName: `Caller ${phone.slice(-4)}`,
        status: WhatsAppLeadStatus.REPLIED,
        lastReplyAt: receivedAt,
        lastReplySnippet: snippet,
      },
      select: { id: true },
    });

    await db.callActivity.create({
      data: {
        leadId: callLead.id,
        actionType: "NOTE_ADDED",
        description: `Inbound WhatsApp reply: ${snippet}`,
        metadata: { whatsappLeadId: created.id, receivedAt },
      },
    });

    return NextResponse.json({ ok: true, action: "created_from_unknown", leadId: created.id });
  }

  if (lead.status === WhatsAppLeadStatus.DO_NOT_CONTACT) {
    return NextResponse.json({ ok: true, action: "ignored_dnc" });
  }

  await db.$transaction([
    db.whatsAppLead.update({
      where: { id: lead.id },
      data: {
        status:
          lead.status === WhatsAppLeadStatus.FORM_SUBMITTED
            ? WhatsAppLeadStatus.FORM_SUBMITTED
            : WhatsAppLeadStatus.REPLIED,
        lastReplyAt: receivedAt,
        lastReplySnippet: snippet,
        lastError: null,
      },
    }),
    db.callActivity.create({
      data: {
        leadId: callLead.id,
        actionType: "NOTE_ADDED",
        description: `Inbound WhatsApp reply: ${snippet}`,
        metadata: { whatsappLeadId: lead.id, receivedAt },
      },
    }),
  ]);

  console.log(`[whatsapp-inbox] Tracked reply for lead ${lead.id} (${phone}).`);

  // Evaluate interactive bot keywords (Opt-Out, Investment, Location, Priority Call)
  let botResult = null;
  try {
    botResult = await processInboundBotReply({
      phone,
      message,
      callLeadId: callLead.id,
      accountId: lead?.accountId ?? account?.id,
      displayName: callLead.displayName,
    });
  } catch (botErr) {
    console.error("[whatsapp-inbox] Bot processing error:", botErr);
  }

  return NextResponse.json({
    ok: true,
    action: "marked_replied",
    leadId: lead.id,
    bot: botResult,
  });
}
