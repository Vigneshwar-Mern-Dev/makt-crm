import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sanitizeIncomingWhatsAppMessage, validateBridgeRequest } from "@/app/lib/whatsapp-security";

describe("WhatsApp Security Utilities", () => {
  describe("sanitizeIncomingWhatsAppMessage", () => {
    it("handles null and undefined gracefully", () => {
      expect(sanitizeIncomingWhatsAppMessage(null)).toBe("");
      expect(sanitizeIncomingWhatsAppMessage(undefined)).toBe("");
    });

    it("strips zero-width characters and invisible control clusters", () => {
      const dirty = "Hello\u200B\u200CWorld\uFEFF!";
      expect(sanitizeIncomingWhatsAppMessage(dirty)).toBe("HelloWorld!");
    });

    it("strips non-printable ASCII control characters except newline/tab", () => {
      const input = "Valid Line\nSecond Line\tTabbed\x00\x07Alert";
      const sanitized = sanitizeIncomingWhatsAppMessage(input);
      expect(sanitized).toBe("Valid Line\nSecond Line\tTabbedAlert");
    });

    it("trims excess leading and trailing whitespace", () => {
      const input = "   Lots of space around   ";
      expect(sanitizeIncomingWhatsAppMessage(input)).toBe("Lots of space around");
    });

    it("clamps string to maxLength", () => {
      const longInput = "a".repeat(1500);
      const clamped = sanitizeIncomingWhatsAppMessage(longInput, 500);
      expect(clamped.length).toBe(500);
    });
  });

  describe("validateBridgeRequest", () => {
    const originalToken = process.env.WHATSAPP_BRIDGE_TOKEN;

    beforeEach(() => {
      process.env.WHATSAPP_BRIDGE_TOKEN = "test-secret-token-12345";
    });

    afterEach(() => {
      process.env.WHATSAPP_BRIDGE_TOKEN = originalToken;
    });

    it("rejects request when x-whatsapp-bridge-token is missing", () => {
      const req = new Request("http://localhost:3000/api/whatsapp/bridge", {
        headers: {},
      });
      const result = validateBridgeRequest(req);
      expect(result.authorized).toBe(false);
      expect(result.response?.status).toBe(401);
    });

    it("rejects request when token does not match WHATSAPP_BRIDGE_TOKEN", () => {
      const req = new Request("http://localhost:3000/api/whatsapp/bridge", {
        headers: {
          "x-whatsapp-bridge-token": "wrong-token",
        },
      });
      const result = validateBridgeRequest(req);
      expect(result.authorized).toBe(false);
      expect(result.response?.status).toBe(401);
    });

    it("authorizes request with matching bridge token from internal IP", () => {
      const req = new Request("http://localhost:3000/api/whatsapp/bridge", {
        headers: {
          "x-whatsapp-bridge-token": "test-secret-token-12345",
          "x-forwarded-for": "127.0.0.1",
        },
      });
      const result = validateBridgeRequest(req);
      expect(result.authorized).toBe(true);
      expect(result.response).toBeUndefined();
    });
  });
});
