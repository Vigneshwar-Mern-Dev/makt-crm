import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as handleAck } from "@/app/api/whatsapp/ack/route";
import { GET as handleWhatsAppStatus } from "@/app/api/whatsapp/status/route";

describe("API Route Integration Tests", () => {
  const originalToken = process.env.WHATSAPP_BRIDGE_TOKEN;

  beforeEach(() => {
    process.env.WHATSAPP_BRIDGE_TOKEN = "integration-secret-token";
  });

  afterEach(() => {
    process.env.WHATSAPP_BRIDGE_TOKEN = originalToken;
  });

  describe("/api/whatsapp/ack", () => {
    it("returns 401 Unauthorized when bridge token is absent", async () => {
      const req = new Request("http://localhost:3000/api/whatsapp/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+919876543210", ack: 2 }),
      });

      const res = await handleAck(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Unauthorized");
    });

    it("returns 400 Bad Request when phone or ack is missing", async () => {
      const req = new Request("http://localhost:3000/api/whatsapp/ack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-whatsapp-bridge-token": "integration-secret-token",
        },
        body: JSON.stringify({}),
      });

      const res = await handleAck(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Missing phone or ack");
    });
  });

  describe("/api/whatsapp/status", () => {
    it("returns 200 and list of WhatsApp accounts with valid bridge token", async () => {
      const req = new Request("http://localhost:3000/api/whatsapp/status", {
        method: "GET",
        headers: {
          "x-whatsapp-bridge-token": "integration-secret-token",
        },
      });

      const res = await handleWhatsAppStatus(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(Array.isArray(json.accounts)).toBe(true);
    });

    it("returns 401 Unauthorized without bridge token and without admin session", async () => {
      const req = new Request("http://localhost:3000/api/whatsapp/status", {
        method: "GET",
        headers: {},
      });

      const res = await handleWhatsAppStatus(req);
      expect([401, 403]).toContain(res.status);
    });
  });
});
