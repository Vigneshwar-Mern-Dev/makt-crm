import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  hashDeviceToken,
  normalizeIndianPhoneNumber,
  validateRegistrationSecret,
} from "@/app/lib/call-tracker";

describe("Call Tracker Helpers", () => {
  const originalSecret = process.env.CALL_TRACKER_REGISTRATION_SECRET;

  beforeEach(() => {
    process.env.CALL_TRACKER_REGISTRATION_SECRET = "test-call-tracker-secret-123";
  });

  afterEach(() => {
    process.env.CALL_TRACKER_REGISTRATION_SECRET = originalSecret;
  });

  describe("normalizeIndianPhoneNumber", () => {
    it("normalizes 10-digit Indian numbers to +91 format", () => {
      expect(normalizeIndianPhoneNumber("9876543210")).toBe("+919876543210");
      expect(normalizeIndianPhoneNumber(" 98765-43210 ")).toBe("+919876543210");
    });

    it("strips leading zero on 11-digit numbers", () => {
      expect(normalizeIndianPhoneNumber("09876543210")).toBe("+919876543210");
    });

    it("preserves 91-prefixed 12-digit numbers with leading plus", () => {
      expect(normalizeIndianPhoneNumber("+91 98765 43210")).toBe("+919876543210");
      expect(normalizeIndianPhoneNumber("919876543210")).toBe("+919876543210");
    });

    it("returns null for empty or too-short values", () => {
      expect(normalizeIndianPhoneNumber(null)).toBeNull();
      expect(normalizeIndianPhoneNumber("")).toBeNull();
      expect(normalizeIndianPhoneNumber("12345")).toBeNull();
    });
  });

  describe("hashDeviceToken", () => {
    it("produces deterministic SHA-256 hex digest", () => {
      const h1 = hashDeviceToken("token-abc");
      const h2 = hashDeviceToken("token-abc");
      const h3 = hashDeviceToken("token-xyz");
      expect(h1).toHaveLength(64);
      expect(h1).toBe(h2);
      expect(h1).not.toBe(h3);
    });
  });

  describe("validateRegistrationSecret", () => {
    it("accepts matching trimmed secret and rejects wrong or missing values", () => {
      expect(validateRegistrationSecret("test-call-tracker-secret-123")).toBe(true);
      expect(validateRegistrationSecret("  test-call-tracker-secret-123  ")).toBe(true);
      expect(validateRegistrationSecret("wrong-secret")).toBe(false);
      expect(validateRegistrationSecret("")).toBe(false);
      expect(validateRegistrationSecret(null)).toBe(false);
    });

    it("throws if CALL_TRACKER_REGISTRATION_SECRET is not configured", () => {
      delete process.env.CALL_TRACKER_REGISTRATION_SECRET;
      expect(() => validateRegistrationSecret("anything")).toThrow();
    });
  });
});

