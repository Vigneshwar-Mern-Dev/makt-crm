import type { CallDirection, CallEventType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/app/lib/call-tracker-api-response";
import {
  authenticateCompanyPhone,
  ingestCallEventsBatch,
} from "@/app/lib/call-tracker";
import { consumeRateLimit, rateLimitKey } from "@/app/lib/rate-limit";
import { callTrackerBatchEventsSchema } from "@/app/lib/validators/call-tracker";
import { validateBody } from "@/app/lib/validators/validate";

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return apiErrorResponse({
        code: "AUTH_REQUIRED",
        error: "A bearer token is required.",
        status: 401,
        retryable: false,
      });
    }

    const validation = await validateBody(request, callTrackerBatchEventsSchema, {
      retryable: false,
      includeServerTime: true,
    });
    if (!validation.success) {
      return validation.response;
    }

    const body = validation.data;
    const authenticatedPhone = await authenticateCompanyPhone(body.deviceId, token);

    if (!authenticatedPhone) {
      return apiErrorResponse({
        code: "UNAUTHORIZED_DEVICE",
        error: "Unauthorized device.",
        status: 401,
        retryable: false,
      });
    }

    const limit = await consumeRateLimit({
      key: rateLimitKey("call-tracker-events-batch", authenticatedPhone.id),
      limit: 300,
      windowMs: 5 * 60 * 1000,
    });

    if (!limit.allowed) {
      return apiErrorResponse({
        code: "RATE_LIMITED",
        error: "Call-event batch rate limit exceeded.",
        status: 429,
        retryable: true,
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const rawEvents =
      validation.raw &&
      typeof validation.raw === "object" &&
      "events" in validation.raw &&
      Array.isArray((validation.raw as { events?: unknown[] }).events)
        ? (validation.raw as { events: unknown[] }).events
        : [];

    const mappedEvents = body.events.map((item, idx) => ({
      eventId: item.eventId,
      callSessionLocalId: item.callSessionLocalId,
      deviceId: item.deviceId,
      companyPhone: item.companyPhone,
      caller: item.caller,
      eventType: item.eventType as CallEventType,
      callDirection: item.callDirection as CallDirection,
      occurredAt: item.occurredAt,
      durationSeconds: item.durationSeconds,
      androidCallLogId: item.androidCallLogId,
      simSlot: item.simSlot,
      simDisplayName: item.simDisplayName,
      simCarrierName: item.simCarrierName,
      simSubscriptionId: item.simSubscriptionId,
      localContactName: item.localContactName,
      retryCount: item.retryCount,
      skipAutoReply: item.skipAutoReply,
      appVersion: item.appVersion,
      androidVersion: item.androidVersion,
      deviceModel: item.deviceModel,
      batteryPercent: item.batteryPercent,
      isCharging: item.isCharging,
      chargingType: item.chargingType,
      networkType: item.networkType,
      pendingSyncCount: item.pendingSyncCount,
      lastSyncAttemptAt: item.lastSyncAttemptAt,
      lastSuccessfulSyncAt: item.lastSuccessfulSyncAt,
      lastSyncError: item.lastSyncError,
      lastSyncErrorAt: item.lastSyncErrorAt,
      syncRetryCount: item.syncRetryCount,
      permissionStatus: item.permissionStatus,
      rawPayload: (rawEvents[idx] ?? item) as Prisma.InputJsonValue,
    }));

    const summary = await ingestCallEventsBatch(authenticatedPhone, mappedEvents);

    return NextResponse.json(
      {
        ok: true,
        success: true,
        retryable: false,
        serverTime: new Date().toISOString(),
        ...summary,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Call tracker batch event ingestion failed:", error);
    return apiErrorResponse({
      code: "BATCH_EVENT_INGESTION_FAILED",
      error: "Call tracker batch event ingestion failed.",
      status: 500,
      retryable: true,
    });
  }
}

