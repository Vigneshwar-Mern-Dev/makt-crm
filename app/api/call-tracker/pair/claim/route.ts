import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/app/lib/call-tracker-api-response";
import { claimDevicePairingCode } from "@/app/lib/call-tracker";
import { consumeRateLimit, rateLimitKey } from "@/app/lib/rate-limit";
import { getClientIpFromHeaders } from "@/app/lib/request-ip";
import { callTrackerPairClaimSchema } from "@/app/lib/validators/call-tracker";
import { validateBody } from "@/app/lib/validators/validate";

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIpFromHeaders(request.headers);
    const ipLimit = await consumeRateLimit({
      key: rateLimitKey("call-tracker-pair-claim-ip", clientIp),
      limit: 20,
      windowMs: 15 * 60 * 1000,
      blockMs: 5 * 60 * 1000,
    });

    if (!ipLimit.allowed) {
      return apiErrorResponse({
        code: "RATE_LIMITED",
        error: "Too many pairing attempts. Try again later.",
        status: 429,
        retryable: true,
        retryAfterSeconds: ipLimit.retryAfterSeconds,
      });
    }

    const validation = await validateBody(request, callTrackerPairClaimSchema);
    if (!validation.success) {
      return validation.response;
    }

    const registration = await claimDevicePairingCode(validation.data);

    return NextResponse.json({
      ok: true,
      registered: true,
      companyPhone: registration.companyPhone.phoneNumber,
      deviceToken: registration.deviceToken,
      label: registration.companyPhone.label,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pairing failed.";
    const isClientError =
      message.toLowerCase().includes("invalid") || message.toLowerCase().includes("expired");
    return apiErrorResponse({
      code: isClientError ? "INVALID_PAIRING_CODE" : "PAIRING_FAILED",
      error: message,
      status: isClientError ? 400 : 500,
      retryable: false,
    });
  }
}
