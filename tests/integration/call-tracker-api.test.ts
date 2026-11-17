import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as handleRegister } from "@/app/api/call-tracker/register/route";
import { POST as handleHeartbeat } from "@/app/api/call-tracker/heartbeat/route";
import { POST as handleSingleEvent } from "@/app/api/call-tracker/events/route";
import { POST as handleBatchEvents } from "@/app/api/call-tracker/events/batch/route";
import { POST as handleClaimPair } from "@/app/api/call-tracker/pair/claim/route";
import { generateDevicePairingCode } from "@/app/lib/call-tracker";
import { db } from "@/app/lib/db";
import { rateLimitKey, resetRateLimit } from "@/app/lib/rate-limit";

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

  describe("POST /api/call-tracker/events/batch", () => {
    it("rejects batch upload without bearer token", async () => {
      const req = new NextRequest("http://localhost:3000/api/call-tracker/events/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          deviceId: "device-unauthorized",
          events: [],
        }),
      });

      const res = await handleBatchEvents(req);
      expect(res.status).toBe(401);
    });
  });

  describe("End-to-End Mobile App <-> CRM Flow", () => {
    it("registers device, sends heartbeat, streams RINGING->ANSWERED->ENDED, and ingests idempotent batch", async () => {
      const suffix = Date.now().toString().slice(-6);
      const deviceId = `vitest-e2e-${suffix}`;
      const companyPhoneRaw = `9999${suffix}`;
      const callerNumber = `8888${suffix}`;
      const normalizedCaller = `+91${callerNumber}`;
      const sessionLocalId = `sess-e2e-${suffix}`;
      let registeredCompanyPhoneId: string | null = null;

      try {
        // 1. Register mobile device
        const regReq = new NextRequest("http://localhost:3000/api/call-tracker/register", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.99" },
          body: JSON.stringify({
            registrationSecret: "secret-call-tracker-code-456",
            companyPhone: companyPhoneRaw,
            deviceId,
            label: "Vitest Pixel",
          }),
        });
        const regRes = await handleRegister(regReq);
        expect(regRes.status).toBe(200);
        const regJson = await regRes.json();
        expect(regJson.ok).toBe(true);
        expect(regJson.deviceToken).toBeTruthy();
        expect(regJson.companyPhone.phoneNumber).toBe(`+91${companyPhoneRaw}`);
        registeredCompanyPhoneId = regJson.companyPhone.id;

        const token = regJson.deviceToken as string;
        const canonicalPhone = regJson.companyPhone.phoneNumber as string;

        // 2. Heartbeat returns ok + canonical phone
        const hbReq = new NextRequest("http://localhost:3000/api/call-tracker/heartbeat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            deviceId,
            appVersion: "2.0",
            batteryPercent: 87,
            isCharging: true,
            networkType: "WIFI",
            pendingSyncCount: 0,
            lastSyncError: null,
          }),
        });
        const hbRes = await handleHeartbeat(hbReq);
        expect(hbRes.status).toBe(200);
        const hbJson = await hbRes.json();
        expect(hbJson.ok).toBe(true);
        expect(hbJson.companyPhone.phoneNumber).toBe(canonicalPhone);

        // 3. Live single RINGING -> ENDED events (using skipAutoReply so no test WA queues are created)
        const ringTime = new Date(Date.now() - 20_000).toISOString();
        const ringReq = new NextRequest("http://localhost:3000/api/call-tracker/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            eventId: `${sessionLocalId}_RINGING`,
            callSessionLocalId: sessionLocalId,
            deviceId,
            companyPhone: canonicalPhone,
            caller: callerNumber,
            eventType: "RINGING",
            callDirection: "INCOMING",
            occurredAt: ringTime,
            skipAutoReply: true,
          }),
        });
        const ringRes = await handleSingleEvent(ringReq);
        expect(ringRes.status).toBe(200);
        const ringJson = await ringRes.json();
        expect(ringJson.status).toBe("RINGING");

        // 4. Batch upload for ANSWERED + ENDED + duplicate retry
        const answeredTime = new Date(Date.now() - 15_000).toISOString();
        const endTime = new Date().toISOString();
        const batchReq = new NextRequest("http://localhost:3000/api/call-tracker/events/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            deviceId,
            events: [
              {
                eventId: `${sessionLocalId}_ENDED`,
                callSessionLocalId: sessionLocalId,
                deviceId,
                companyPhone: canonicalPhone,
                caller: normalizedCaller,
                eventType: "ENDED",
                callDirection: "INCOMING",
                durationSeconds: 15,
                occurredAt: endTime,
                skipAutoReply: true,
              },
              {
                eventId: `${sessionLocalId}_ANSWERED`,
                callSessionLocalId: sessionLocalId,
                deviceId,
                companyPhone: canonicalPhone,
                caller: normalizedCaller,
                eventType: "ANSWERED",
                callDirection: "INCOMING",
                occurredAt: answeredTime,
                skipAutoReply: true,
              },
              {
                eventId: `${sessionLocalId}_RINGING`,
                callSessionLocalId: sessionLocalId,
                deviceId,
                companyPhone: canonicalPhone,
                caller: normalizedCaller,
                eventType: "RINGING",
                callDirection: "INCOMING",
                occurredAt: ringTime,
                skipAutoReply: true,
              },
            ],
          }),
        });
        const batchRes = await handleBatchEvents(batchReq);
        expect(batchRes.status).toBe(200);
        const batchJson = await batchRes.json();
        expect(batchJson.ok).toBe(true);
        expect(batchJson.processed).toBe(3);
        expect(batchJson.succeeded).toBe(3);
        expect(batchJson.failed).toBe(0);
      } finally {
        // Clean up synthetic test records cleanly in child-to-parent order
        if (registeredCompanyPhoneId) {
          await db.callActivity.deleteMany({
            where: {
              OR: [
                { session: { companyPhoneId: registeredCompanyPhoneId } },
                { lead: { phone: normalizedCaller } },
              ],
            },
          });
          await db.callEvent.deleteMany({
            where: { companyPhoneId: registeredCompanyPhoneId },
          });
          await db.callSession.deleteMany({
            where: { companyPhoneId: registeredCompanyPhoneId },
          });
          await db.callLead.deleteMany({
            where: { phone: normalizedCaller },
          });
          await db.companyPhone.deleteMany({
            where: { id: registeredCompanyPhoneId },
          });
          await resetRateLimit(rateLimitKey("call-tracker-register-device", deviceId));
          await resetRateLimit(rateLimitKey("call-tracker-register-ip", "127.0.0.99"));
          await resetRateLimit(rateLimitKey("call-tracker-heartbeat", registeredCompanyPhoneId));
          await resetRateLimit(rateLimitKey("call-tracker-events", registeredCompanyPhoneId));
          await resetRateLimit(rateLimitKey("call-tracker-events-batch", registeredCompanyPhoneId));
        }
      }
    }, 35000);
  });

  describe("POST /api/call-tracker/pair/claim", () => {
    it("rejects invalid or non-existent pairing code", async () => {
      const req = new NextRequest("http://localhost:3000/api/call-tracker/pair/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1",
        },
        body: JSON.stringify({
          pairCode: "000000",
          companyPhone: "+919876543210",
          deviceId: "test-device-claim-fail",
        }),
      });

      const res = await handleClaimPair(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("INVALID_PAIRING_CODE");
    });

    it("successfully claims code and prevents replay (single-use)", async () => {
      const { code } = await generateDevicePairingCode();
      const testDeviceId = "pair-claim-test-device-" + Date.now();
      const testPhone = "+919123456789";

      try {
        const req = new NextRequest("http://localhost:3000/api/call-tracker/pair/claim", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "127.0.0.1",
          },
          body: JSON.stringify({
            pairCode: code,
            companyPhone: testPhone,
            deviceId: testDeviceId,
            label: "Paired Test Phone",
          }),
        });

        const res = await handleClaimPair(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(true);
        expect(json.registered).toBe(true);
        expect(json.deviceToken).toBeDefined();

        // Second attempt with the same code must fail (single-use)
        const replayReq = new NextRequest("http://localhost:3000/api/call-tracker/pair/claim", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "127.0.0.1",
          },
          body: JSON.stringify({
            pairCode: code,
            companyPhone: testPhone,
            deviceId: testDeviceId,
          }),
        });

        const replayRes = await handleClaimPair(replayReq);
        expect(replayRes.status).toBe(400);
      } finally {
        await db.companyPhone.deleteMany({
          where: { deviceId: testDeviceId },
        });
      }
    }, 35000);
  });
});
