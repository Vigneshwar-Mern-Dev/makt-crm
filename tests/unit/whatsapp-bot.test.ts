import { describe, it, expect } from "vitest";
import { matchCategory, BOT_TEMPLATES } from "@/app/lib/whatsapp-bot";

describe("Bilingual WhatsApp Auto-Reply Bot Keyword Matcher", () => {
  describe("matchCategory", () => {
    it("matches DNC (Do Not Contact) English and Tamil keywords", () => {
      expect(matchCategory("stop")).toBe("DNC");
      expect(matchCategory("STOP")).toBe("DNC");
      expect(matchCategory("unsubscribe")).toBe("DNC");
      expect(matchCategory("vendam")).toBe("DNC");
      expect(matchCategory("வேண்டாம்")).toBe("DNC");
      expect(matchCategory("விலகு")).toBe("DNC");
      expect(matchCategory("please stop sending messages")).toBe("DNC");
      expect(matchCategory("don't call me")).toBe("DNC");
    });

    it("matches URGENT_CALL keywords and prioritizes call escalation", () => {
      expect(matchCategory("call me please")).toBe("URGENT_CALL");
      expect(matchCategory("urgent")).toBe("URGENT_CALL");
      expect(matchCategory("அழைக்கவும்")).toBe("URGENT_CALL");
      expect(matchCategory("I want to speak with your manager")).toBe("URGENT_CALL");
    });

    it("matches INVESTMENT keywords in English and Tamil", () => {
      expect(matchCategory("how much is the investment?")).toBe("INVESTMENT");
      expect(matchCategory("what is the cost of ATM?")).toBe("INVESTMENT");
      expect(matchCategory("முதலீடு விவரங்கள் என்ன?")).toBe("INVESTMENT");
      expect(matchCategory("கட்டணம் எவ்வளவு?")).toBe("INVESTMENT");
      expect(matchCategory("what is the price")).toBe("INVESTMENT");
    });

    it("matches LOCATION and address inquiries", () => {
      expect(matchCategory("where is your office?")).toBe("LOCATION");
      expect(matchCategory("office address")).toBe("LOCATION");
      expect(matchCategory("உங்கள் முகவரி என்ன?")).toBe("LOCATION");
      expect(matchCategory("இடம் எங்குள்ளது?")).toBe("LOCATION");
    });

    it("returns NONE when no trigger keywords match", () => {
      expect(matchCategory("ok")).toBe("NONE");
      expect(matchCategory("yes")).toBe("NONE");
      expect(matchCategory("thank you")).toBe("NONE");
      expect(matchCategory("12345")).toBe("NONE");
    });
  });

  describe("BOT_TEMPLATES", () => {
    it("contains Tamil and English investment breakdown", () => {
      expect(BOT_TEMPLATES.INVESTMENT).toContain("முதலீடு விவரங்கள்");
      expect(BOT_TEMPLATES.INVESTMENT).toContain("Security Deposit");
    });

    it("contains unsubscribe confirmation for DNC", () => {
      expect(BOT_TEMPLATES.DNC).toContain("unsubscribed");
      expect(BOT_TEMPLATES.DNC).toContain("not contact you again");
    });

    it("contains urgent priority reassurance for URGENT_CALL", () => {
      expect(BOT_TEMPLATES.URGENT_CALL).toContain("HIGH PRIORITY");
      expect(BOT_TEMPLATES.URGENT_CALL).toContain("15–30 நிமிடங்களில்");
    });
  });
});
