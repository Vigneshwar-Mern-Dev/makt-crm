import { describe, it, expect } from "vitest";
import {
  isWhatsAppQuietTime,
  moveOutsideWhatsAppQuietTime,
} from "@/app/lib/whatsapp-schedule";

describe("WhatsApp Quiet Hours & Drip Scheduling", () => {
  const timeZone = "Asia/Kolkata";
  const quietStart = "21:00"; // 9 PM
  const quietEnd = "08:00"; // 8 AM

  it("identifies overnight quiet periods accurately", () => {
    // 22:30 IST is during quiet time
    const lateNight = new Date("2026-10-15T17:00:00.000Z"); // 17:00 UTC = 22:30 IST
    expect(isWhatsAppQuietTime(lateNight, quietStart, quietEnd, timeZone)).toBe(true);

    // 03:00 IST is during quiet time
    const earlyMorning = new Date("2026-10-14T21:30:00.000Z"); // 21:30 UTC = 03:00 IST
    expect(isWhatsAppQuietTime(earlyMorning, quietStart, quietEnd, timeZone)).toBe(true);

    // 14:00 IST is outside quiet time (active hours)
    const afternoon = new Date("2026-10-15T08:30:00.000Z"); // 08:30 UTC = 14:00 IST
    expect(isWhatsAppQuietTime(afternoon, quietStart, quietEnd, timeZone)).toBe(false);
  });

  it("moves messages queued during quiet hours to active daytime window", () => {
    const lateNight = new Date("2026-10-15T17:00:00.000Z"); // 22:30 IST
    const adjusted = moveOutsideWhatsAppQuietTime(lateNight, quietStart, quietEnd, timeZone);

    expect(isWhatsAppQuietTime(adjusted, quietStart, quietEnd, timeZone)).toBe(false);
    expect(adjusted.getTime()).toBeGreaterThan(lateNight.getTime());
  });

  it("leaves daytime candidate times untouched", () => {
    const afternoon = new Date("2026-10-15T08:30:00.000Z"); // 14:00 IST
    const adjusted = moveOutsideWhatsAppQuietTime(afternoon, quietStart, quietEnd, timeZone);

    expect(adjusted.getTime()).toBe(afternoon.getTime());
  });
});
