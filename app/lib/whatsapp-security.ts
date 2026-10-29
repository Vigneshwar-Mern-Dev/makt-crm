import "server-only";

import { NextResponse } from "next/server";
import { getClientIpFromHeaders } from "./request-ip";

const INTERNAL_IPS = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "localhost",
  "unknown", // Local Node.js internal fetch without reverse proxy headers
]);

/**
 * Validates Bridge Token and ensures callers originate from internal localhost/subnet.
 */
export function validateBridgeRequest(request: Request): {
  authorized: boolean;
  response?: NextResponse;
} {
  const expectedToken = process.env.WHATSAPP_BRIDGE_TOKEN;
  const token = request.headers.get("x-whatsapp-bridge-token");

  if (!expectedToken || token !== expectedToken) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized: Invalid or missing bridge token" },
        { status: 401 },
      ),
    };
  }

  // IP verification
  const clientIp = getClientIpFromHeaders(request.headers);

  // In production, enforce that bridge calls originate locally unless ALLOW_REMOTE_WORKER=true
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_REMOTE_WORKER !== "true" &&
    !INTERNAL_IPS.has(clientIp)
  ) {
    console.warn(`[whatsapp-security] Blocked non-local bridge call from IP: ${clientIp}`);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Forbidden: WhatsApp worker bridge is only accessible internally" },
        { status: 403 },
      ),
    };
  }

  return { authorized: true };
}

/**
 * Sanitizes incoming WhatsApp customer text:
 * - Clamps max character length (default 1000 chars)
 * - Strips zero-width characters and invisible unicode control clusters
 * - Trims excess whitespace
 */
export function sanitizeIncomingWhatsAppMessage(
  message: string | null | undefined,
  maxLength = 1000,
): string {
  if (!message || typeof message !== "string") {
    return "";
  }

  // Remove zero-width characters and invisible control clusters
  const cleaned = message
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Strip non-printable ASCII controls except newline/tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();

  // Clamp length
  return cleaned.slice(0, maxLength);
}
