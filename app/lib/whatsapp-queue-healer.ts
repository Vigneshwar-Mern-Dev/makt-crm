import "server-only";

import { db } from "./db";
import { WhatsAppLeadStatus } from "./prisma-enums";

export type QueueHealerResult = {
  reclaimedCount: number;
  failedDlqCount: number;
  expiredCount: number;
  timestamp: string;
};

const STUCK_SENDING_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
const QUEUE_EXPIRY_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_DELIVERY_ATTEMPTS = 3;

/**
 * Dead-Letter Queue (DLQ) Auto-Healer & Sweeper
 *
 * Runs automatically in background:
 * 1. Reclaims items stuck in "SENDING" due to worker crashes or network timeouts.
 * 2. Escalates repeatedly failing items (>= 3 attempts) to DLQ FAILED state.
 * 3. Marks stale queue items older than 24h as EXPIRED.
 */
export async function healStuckQueueItems(): Promise<QueueHealerResult> {
  const now = new Date();
  const stuckSendingCutoff = new Date(now.getTime() - STUCK_SENDING_THRESHOLD_MS);
  const staleQueueCutoff = new Date(now.getTime() - QUEUE_EXPIRY_THRESHOLD_MS);

  let reclaimedCount = 0;
  let failedDlqCount = 0;
  let expiredCount = 0;

  // 1. Find stuck "SENDING" items
  const stuckSendingItems = await db.whatsAppQueueItem.findMany({
    where: {
      status: "SENDING",
      OR: [
        { claimExpiresAt: { lte: now } },
        { claimExpiresAt: null, sendingAt: { lte: stuckSendingCutoff } },
      ],
      deletedAt: null,
      isArchived: false,
    },
    take: 100,
    select: {
      id: true,
      whatsappLeadId: true,
      attemptCount: true,
      phone: true,
    },
  });

  const retryableIds: string[] = [];
  const retryableLeadIds: string[] = [];
  const dlqIds: string[] = [];
  const dlqLeadIds: string[] = [];

  for (const item of stuckSendingItems) {
    if (item.attemptCount >= MAX_DELIVERY_ATTEMPTS) {
      dlqIds.push(item.id);
      dlqLeadIds.push(item.whatsappLeadId);
    } else {
      retryableIds.push(item.id);
      retryableLeadIds.push(item.whatsappLeadId);
    }
  }

  // Reclaim retryable items back to QUEUED
  if (retryableIds.length > 0) {
    await db.$transaction([
      db.whatsAppQueueItem.updateMany({
        where: { id: { in: retryableIds } },
        data: {
          status: "QUEUED",
          sendingAt: null,
          claimExpiresAt: null,
          attemptCount: { increment: 1 },
          lastError: "Auto-healer: Reclaimed stuck sending lock after timeout.",
        },
      }),
      db.whatsAppLead.updateMany({
        where: { id: { in: retryableLeadIds } },
        data: {
          status: WhatsAppLeadStatus.QUEUED,
          lastError: "Auto-healer: Reclaimed stuck sending lock after timeout.",
        },
      }),
    ]);
    reclaimedCount = retryableIds.length;
    console.log(`[queue-healer] Reclaimed ${reclaimedCount} stuck SENDING items back to QUEUED.`);
  }

  // Escalate items with max attempts exceeded to FAILED (DLQ)
  if (dlqIds.length > 0) {
    await db.$transaction([
      db.whatsAppQueueItem.updateMany({
        where: { id: { in: dlqIds } },
        data: {
          status: "FAILED",
          failedAt: now,
          sendingAt: null,
          claimExpiresAt: null,
          lastError: `Auto-healer DLQ: Exceeded max ${MAX_DELIVERY_ATTEMPTS} attempts without delivery confirmation.`,
        },
      }),
      db.whatsAppLead.updateMany({
        where: { id: { in: dlqLeadIds } },
        data: {
          status: WhatsAppLeadStatus.FAILED,
          lastError: `Auto-healer DLQ: Exceeded max ${MAX_DELIVERY_ATTEMPTS} attempts without delivery confirmation.`,
        },
      }),
    ]);
    failedDlqCount = dlqIds.length;
    console.log(`[queue-healer] Moved ${failedDlqCount} permanently failing items to DLQ (FAILED).`);
  }

  // 2. Expire stale QUEUED items older than 24 hours
  const expiredUpdate = await db.whatsAppQueueItem.updateMany({
    where: {
      status: "QUEUED",
      sendAfterAt: { lte: staleQueueCutoff },
      deletedAt: null,
      isArchived: false,
    },
    data: {
      status: "EXPIRED",
      expiredAt: now,
      lastError: "Auto-healer: Queue item expired after 24h in queue without delivery.",
    },
  });
  expiredCount = expiredUpdate.count;

  return {
    reclaimedCount,
    failedDlqCount,
    expiredCount,
    timestamp: now.toISOString(),
  };
}
