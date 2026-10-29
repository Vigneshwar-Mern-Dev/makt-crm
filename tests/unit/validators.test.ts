import { describe, it, expect } from "vitest";
import {
  whatsappBridgePayloadSchema,
  whatsappOutboxResultSchema,
  whatsappInboxPayloadSchema,
} from "@/app/lib/validators/whatsapp";
import {
  callTrackerRegistrationSchema,
  callTrackerHeartbeatSchema,
  callTrackerEventSchema,
} from "@/app/lib/validators/call-tracker";
import { normalizedPhoneString } from "@/app/lib/validators/common";

describe("Validation Schemas", () => {
  describe("normalizedPhoneString", () => {
    it("strips spaces, hyphens, and formats phone to E.164 with leading plus", () => {
      const parsed = normalizedPhoneString.parse("+91 98765-43210");
      expect(parsed).toBe("+919876543210");
    });

    it("rejects phone numbers with too few digits", () => {
      expect(() => normalizedPhoneString.parse("1234")).toThrow();
    });

    it("rejects phone numbers with too many digits", () => {
      expect(() => normalizedPhoneString.parse("123456789012345678")).toThrow();
    });
  });

  describe("whatsappOutboxResultSchema", () => {
    it("validates successful outbox result payload", () => {
      const payload = {
        leadId: "lead-789",
        ok: true,
        providerMessageId: "msg-12345",
      };
      const result = whatsappOutboxResultSchema.parse(payload);
      expect(result.leadId).toBe("lead-789");
      expect(result.ok).toBe(true);
    });

    it("validates error outbox result payload with errorType", () => {
      const payload = {
        leadId: "lead-789",
        ok: false,
        error: "Recipient not on WhatsApp",
        errorType: "NOT_REGISTERED",
      };
      const result = whatsappOutboxResultSchema.parse(payload);
      expect(result.errorType).toBe("NOT_REGISTERED");
      expect(result.error).toBe("Recipient not on WhatsApp");
    });
  });

  describe("whatsappBridgePayloadSchema", () => {
    it("parses valid bridge status update payload", () => {
      const payload = {
        accountId: "acc-123",
        status: "CONNECTED",
        phoneNumber: "919585888319",
      };
      const result = whatsappBridgePayloadSchema.parse(payload);
      expect(result.status).toBe("CONNECTED");
      expect(result.phoneNumber).toBe("919585888319");
    });

    it("handles lowercase status by uppercasing", () => {
      const payload = {
        status: "qr_required",
      };
      const result = whatsappBridgePayloadSchema.parse(payload);
      expect(result.status).toBe("QR_REQUIRED");
    });
  });

  describe("whatsappInboxPayloadSchema", () => {
    it("parses incoming customer reply payload", () => {
      const payload = {
        phone: "+91 98765 43210",
        message: "விவரங்கள் வேண்டும்",
        receivedAt: new Date().toISOString(),
      };
      const result = whatsappInboxPayloadSchema.parse(payload);
      expect(result.phone).toBe("+919876543210");
      expect(result.message).toBe("விவரங்கள் வேண்டும்");
    });
  });

  describe("callTrackerRegistrationSchema", () => {
    it("validates Android phone registration", () => {
      const payload = {
        companyPhone: "+91 95858 88319",
        deviceId: "android-dev-pixel-7",
        label: "Sales Line 1",
      };
      const result = callTrackerRegistrationSchema.parse(payload);
      expect(result.companyPhone).toBe("+91 95858 88319");
      expect(result.deviceId).toBe("android-dev-pixel-7");
    });

    it("rejects registration without companyPhone or deviceId", () => {
      expect(() => callTrackerRegistrationSchema.parse({})).toThrow();
    });
  });

  describe("callTrackerHeartbeatSchema", () => {
    it("validates heartbeat payload from active device", () => {
      const payload = {
        deviceId: "android-dev-pixel-7",
        appVersion: "2.4.1",
        batteryPercent: 95,
        isCharging: true,
        chargingType: "AC",
        networkType: "WIFI",
      };
      const result = callTrackerHeartbeatSchema.parse(payload);
      expect(result.deviceId).toBe("android-dev-pixel-7");
      expect(result.batteryPercent).toBe(95);
      expect(result.isCharging).toBe(true);
    });
  });

  describe("callTrackerEventSchema", () => {
    it("validates incoming call event", () => {
      const payload = {
        eventId: "evt-001",
        deviceId: "android-dev-pixel-7",
        companyPhone: "+919585888319",
        caller: "+91 98765 43210",
        eventType: "RINGING",
        callDirection: "INCOMING",
        occurredAt: new Date().toISOString(),
        batteryPercent: 88,
        isCharging: false,
      };
      const result = callTrackerEventSchema.parse(payload);
      expect(result.eventType).toBe("RINGING");
      expect(result.callDirection).toBe("INCOMING");
      expect(result.batteryPercent).toBe(88);
    });

    it("validates answered call with duration", () => {
      const payload = {
        eventId: "evt-002",
        deviceId: "android-dev-pixel-7",
        companyPhone: "+919585888319",
        caller: "+91 98765 43210",
        eventType: "OUTGOING",
        durationSeconds: 145,
        occurredAt: new Date().toISOString(),
      };
      const result = callTrackerEventSchema.parse(payload);
      expect(result.durationSeconds).toBe(145);
      expect(result.eventType).toBe("ANSWERED");
      expect(result.callDirection).toBe("OUTGOING");
    });
  });
});
