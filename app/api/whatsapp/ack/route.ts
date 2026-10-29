import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { WhatsAppLeadStatus } from "@/app/lib/prisma-enums";
import { validateBridgeRequest } from "@/app/lib/whatsapp-security";

export async function POST(request: Request) {
  const auth = validateBridgeRequest(request);
  if (!auth.authorized) {
    return auth.response!;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const phone = typeof body.phone === "string" ? body.phone.trim() : null;
    const ack = typeof body.ack === "number" ? body.ack : null;

    if (!phone || ack === null) {
      return NextResponse.json({ error: "Missing phone or ack" }, { status: 400 });
    }

    const now = new Date();

    // ack = 3 is ACK_READ (Blue tick - customer read the message)
    if (ack >= 3) {
      const activeQueueItem = await db.whatsAppQueueItem.findFirst({
        where: {
          phone,
          status: { in: ["SENT", "SENDING", "QUEUED"] },
          openedAt: null,
          deletedAt: null,
        },
        orderBy: { queuedAt: "desc" },
      });

      if (activeQueueItem) {
        await db.$transaction([
          db.whatsAppQueueItem.update({
            where: { id: activeQueueItem.id },
            data: { openedAt: now },
          }),
          db.whatsAppLead.updateMany({
            where: {
              phone,
              status: WhatsAppLeadStatus.SENT,
              deletedAt: null,
            },
            data: {
              status: WhatsAppLeadStatus.OPENED,
              formOpenedAt: now,
            },
          }),
        ]);

        if (activeQueueItem.callLeadId) {
          // Prevent spamming timeline if already logged recently
          const existingReadNote = await db.callActivity.findFirst({
            where: {
              leadId: activeQueueItem.callLeadId,
              description: { contains: "Blue tick confirmed" },
              createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
            },
          });

          if (!existingReadNote) {
            await db.callActivity.create({
              data: {
                leadId: activeQueueItem.callLeadId,
                actionType: "NOTE_ADDED",
                description: `WhatsApp message read by customer (Blue tick confirmed)`,
                metadata: { ack, queueItemId: activeQueueItem.id },
              },
            });
          }
        }

        console.log(`[whatsapp-ack] Blue tick (read) tracked for ${phone}.`);
        return NextResponse.json({ ok: true, action: "marked_read" });
      }
    }

    return NextResponse.json({ ok: true, action: "acknowledged", ack });
  } catch (error) {
    console.error("[whatsapp-ack] Error processing ack:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Ack processing failed" },
      { status: 500 },
    );
  }
}
