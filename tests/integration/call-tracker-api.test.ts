import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as handleRegister } from "@/app/api/call-tracker/register/route";
import { POST as handleHeartbeat } from "@/app/api/call-tracker/heartbeat/route";
import { NextRequest } from "next/server";

describe("Call Tracker Ingestion API Integration", () => {
  const originalSecret = process.env.CALL_TRACKER_REGISTRATION_SECRET;

  beforeEach(() => {
    process.env.CALL_TRACKER_REGISTRATION_SECRET = "secret-call-tracker-code-456";
  });

  afterEach(() => {
    process.env.CALL_TRACKER_REGISTRATION_SECRET = originalSecret;
  });

  describe("POST /api/call-tracker/register", () => {
    it("rejects unauthorized request with incorrect secret", async () => {
      const req = new NextRequest("http://localhost:3000/api/call-tracker/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          registrationSecret: "wrong-secret",
          companyPhone: "+919585888319",
          deviceId: "device-test-1",
        }),
      });

      const res = await handleRegister(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe("INVALID_REGISTRATION_SECRET");
    });

    it("rejects missing required payload fields even with valid secret", async () => {
      const req = new NextRequest("http://localhost:3000/api/call-tracker/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          registrationSecret: "secret-call-tracker-code-456",
          // missing companyPhone and deviceId
        }),
      });

      const res = await handleRegister(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/call-tracker/heartbeat", () => {
    it("rejects unauthenticated device without authorization header", async () => {
      const req = new NextRequest("http://localhost:3000/api/call-tracker/heartbeat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          deviceId: "device-unauthorized",
          batteryPercent: 90,
        }),
      });

      const res = await handleHeartbeat(req);
      expect(res.status).toBe(401);
    });
  });
});
