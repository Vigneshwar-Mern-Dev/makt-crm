import { describe, it, expect } from "vitest";
import { resolveSpinTax } from "@/app/lib/whatsapp-spintax";

describe("WhatsApp SpinTax Engine", () => {
  it("returns empty string for null, undefined, or non-string inputs", () => {
    expect(resolveSpinTax(null)).toBe("");
    expect(resolveSpinTax(undefined)).toBe("");
    // @ts-expect-error test invalid type
    expect(resolveSpinTax(12345)).toBe("");
  });

  it("returns unchanged text when no SpinTax brackets are present", () => {
    const plain = "Hello John, your ATM application has been approved.";
    expect(resolveSpinTax(plain)).toBe(plain);
  });

  it("resolves single bracketed variant correctly", () => {
    const template = "{Hello|Hi|Greetings} John!";
    const result = resolveSpinTax(template);
    expect(["Hello John!", "Hi John!", "Greetings John!"]).toContain(result);
  });

  it("resolves multiple bracketed variants independently", () => {
    const template = "{Hi|Hello} John, {welcome|glad to have you}!";
    const result = resolveSpinTax(template);
    expect(result).toMatch(/^(Hi|Hello) John, (welcome|glad to have you)!$/);
  });

  it("supports Unicode and Tamil language phrases", () => {
    const template = "{வணக்கம்|வணக்கம் நண்பரே}! உங்கள் ATM விண்ணப்பம் {ஏற்றுக்கொள்ளப்பட்டது|பரிசீலனையில் உள்ளது}.";
    const result = resolveSpinTax(template);
    expect(result).toMatch(/^(வணக்கம்|வணக்கம் நண்பரே)! உங்கள் ATM விண்ணப்பம் (ஏற்றுக்கொள்ளப்பட்டது|பரிசீலனையில் உள்ளது)\.$/);
  });

  it("handles empty options gracefully", () => {
    const template = "Hello{| there} friend!";
    const result = resolveSpinTax(template);
    expect(["Hello friend!", "Hello there friend!"]).toContain(result);
  });

  it("stops within iteration limit when encountering malformed or cyclic brackets", () => {
    const malformed = "{unclosed block without ending";
    expect(resolveSpinTax(malformed)).toBe(malformed);
  });
});
