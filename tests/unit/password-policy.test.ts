import { describe, it, expect } from "vitest";
import {
  passwordPolicyError,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/app/lib/password-policy";

describe("Password Security Policy", () => {
  it("rejects passwords shorter than PASSWORD_MIN_LENGTH", () => {
    const shortPassword = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    const error = passwordPolicyError(shortPassword);
    expect(error).toContain(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  });

  it("rejects passwords longer than PASSWORD_MAX_LENGTH", () => {
    const longPassword = "a".repeat(PASSWORD_MAX_LENGTH + 1);
    const error = passwordPolicyError(longPassword);
    expect(error).toContain(`Password must be no more than ${PASSWORD_MAX_LENGTH} characters long`);
  });

  it("accepts valid passwords within range", () => {
    expect(passwordPolicyError("correct-horse-battery-staple")).toBeNull();
    expect(passwordPolicyError("a".repeat(PASSWORD_MIN_LENGTH))).toBeNull();
    expect(passwordPolicyError("a".repeat(PASSWORD_MAX_LENGTH))).toBeNull();
  });
});
