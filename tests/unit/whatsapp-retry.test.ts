import { describe, it, expect } from "vitest";
import {
  evaluateWhatsAppRetry,
  isNonRetryableNumberFailure,
  type RetryCandidate,
} from "@/app/lib/whatsapp-retry";

describe("WhatsApp Retry Evaluation Engine", () => {
  describe("isNonRetryableNumberFailure", () => {
    it("returns false for null, undefined, or empty error", () => {
      expect(isNonRetryableNumberFailure(null)).toBe(false);
      expect(isNonRetryableNumberFailure(undefined)).toBe(false);
      expect(isNonRetryableNumberFailure("")).toBe(false);
    });

    it("detects permanent phone number invalidity errors", () => {
      expect(isNonRetryableNumberFailure("Error: invalid_number supplied")).toBe(true);
      expect(isNonRetryableNumberFailure("The phone wid is invalid")).toBe(true);
      expect(isNonRetryableNumberFailure("Recipient is an invalid phone format")).toBe(true);
    });

    it("returns false for transient network or timeout errors", () => {
      expect(isNonRetryableNumberFailure("Timeout after 30000ms")).toBe(false);
      expect(isNonRetryableNumberFailure("Worker socket disconnected")).toBe(false);
      expect(isNonRetryableNumberFailure("Rate limit exceeded on browser")).toBe(false);
    });
  });

  describe("evaluateWhatsAppRetry", () => {
    it("allows retry for failed lead with transient errors", () => {
      const candidate: RetryCandidate = {
        status: "FAILED",
        lastError: "Network connection lost",
        formSubmissions: [],
        queueItems: [{ status: "FAILED", lastError: "Network connection lost" }],
      };

      const result = evaluateWhatsAppRetry(candidate);
      expect(result.retryable).toBe(true);
      expect(result.reasons).toEqual([]);
    });

    it("rejects retry if lead already submitted form", () => {
      const candidate: RetryCandidate = {
        status: "FAILED",
        lastError: "Network timeout",
        formSubmissions: [{ status: "FORM_SUBMITTED" }],
        queueItems: [{ status: "FAILED", lastError: "Network timeout" }],
      };

      const result = evaluateWhatsAppRetry(candidate);
      expect(result.retryable).toBe(false);
      expect(result.reasons).toContain("Form already submitted");
    });

    it("rejects retry if lead already in active QUEUED state", () => {
      const candidate: RetryCandidate = {
        status: "FAILED",
        lastError: "Network timeout",
        formSubmissions: [],
        queueItems: [{ status: "QUEUED", lastError: null }],
      };

      const result = evaluateWhatsAppRetry(candidate);
      expect(result.retryable).toBe(false);
      expect(result.reasons).toContain("Active QUEUED/SENDING queue item exists");
    });

    it("rejects retry if lead is marked DO_NOT_CONTACT or CANCELLED", () => {
      const candidate: RetryCandidate = {
        status: "DO_NOT_CONTACT",
        lastError: null,
        formSubmissions: [],
        queueItems: [],
      };

      const result = evaluateWhatsAppRetry(candidate);
      expect(result.retryable).toBe(false);
      expect(result.reasons).toContain("Lead status is DO_NOT_CONTACT");
    });

    it("rejects retry if phone number is permanently invalid", () => {
      const candidate: RetryCandidate = {
        status: "FAILED",
        lastError: "Recipient is invalid_number",
        formSubmissions: [],
        queueItems: [{ status: "FAILED", lastError: "Recipient is invalid_number" }],
      };

      const result = evaluateWhatsAppRetry(candidate);
      expect(result.retryable).toBe(false);
      expect(result.reasons).toContain("Non-retryable WhatsApp number failure detected");
    });
  });
});
