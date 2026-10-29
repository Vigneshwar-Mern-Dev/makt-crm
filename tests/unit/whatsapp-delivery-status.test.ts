import { describe, it, expect } from "vitest";
import {
  hasCompletedWhatsAppDelivery,
  getWhatsAppMessageDeliveryState,
  COMPLETED_WHATSAPP_QUEUE_STATUSES,
} from "@/app/lib/whatsapp-delivery-status";

describe("WhatsApp Delivery Status Calculator", () => {
  describe("hasCompletedWhatsAppDelivery", () => {
    it("returns true if any status in list indicates completed delivery", () => {
      expect(hasCompletedWhatsAppDelivery(["FAILED", "SENT"])).toBe(true);
      expect(hasCompletedWhatsAppDelivery(["OPENED"])).toBe(true);
      expect(hasCompletedWhatsAppDelivery(["FORM_SUBMITTED"])).toBe(true);
    });

    it("returns false if no statuses represent completed delivery", () => {
      expect(hasCompletedWhatsAppDelivery(["QUEUED", "SENDING"])).toBe(false);
      expect(hasCompletedWhatsAppDelivery(["FAILED"])).toBe(false);
      expect(hasCompletedWhatsAppDelivery([])).toBe(false);
    });

    it("verifies all registered completed statuses", () => {
      for (const status of COMPLETED_WHATSAPP_QUEUE_STATUSES) {
        expect(hasCompletedWhatsAppDelivery([status])).toBe(true);
      }
    });
  });

  describe("getWhatsAppMessageDeliveryState", () => {
    it("returns SENT when form was opened or submitted regardless of queue status", () => {
      expect(getWhatsAppMessageDeliveryState("FAILED", "NEW", true)).toBe("SENT");
    });

    it("preserves SENT status even if a subsequent retry failed", () => {
      expect(getWhatsAppMessageDeliveryState(["FAILED", "SENT"], "FAILED")).toBe("SENT");
    });

    it("evaluates single status strings correctly", () => {
      expect(getWhatsAppMessageDeliveryState("QUEUED", "NEW")).toBe("QUEUED");
      expect(getWhatsAppMessageDeliveryState("SENDING", "NEW")).toBe("SENDING");
      expect(getWhatsAppMessageDeliveryState("FAILED", "FAILED")).toBe("FAILED");
      expect(getWhatsAppMessageDeliveryState("CANCELLED", "CANCELLED")).toBe("CANCELLED");
    });

    it("falls back to lead status when queue status is empty", () => {
      expect(getWhatsAppMessageDeliveryState([], "REPLIED")).toBe("SENT");
      expect(getWhatsAppMessageDeliveryState(null, "NOT_CONTACTED")).toBe("NOT_SENT");
    });
  });
});
