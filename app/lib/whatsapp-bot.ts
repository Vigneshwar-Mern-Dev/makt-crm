import "server-only";

import { db } from "./db";
import { queueWhatsAppMessage } from "./whatsapp-lifecycle";
import { WhatsAppLeadStatus } from "./prisma-enums";

export type BotKeywordCategory = "DNC" | "INVESTMENT" | "LOCATION" | "URGENT_CALL" | "NONE";

export type BotEvaluationResult = {
  category: BotKeywordCategory;
  handled: boolean;
  replyText?: string;
  reason?: string;
};

// Keyword dictionary supporting both English and Tamil
const KEYWORD_PATTERNS = {
  DNC: [
    "stop",
    "unsubscribe",
    "no",
    "vendam",
    "வேண்டாம்",
    "விலகு",
    "cancel",
    "dont call",
    "don't call",
    "do not call",
  ],
  INVESTMENT: [
    "cost",
    "investment",
    "how much",
    "fees",
    "fee",
    "முதலீடு",
    "விலை",
    "கட்டணம்",
    "amount",
    "charges",
    "expense",
    "rupees",
    "rate",
    "budget",
    "price",
  ],
  LOCATION: [
    "location",
    "office",
    "address",
    "where",
    "இடம்",
    "முகவரி",
    "company",
    "branch",
    "head office",
  ],
  URGENT_CALL: [
    "call me",
    "call now",
    "urgent",
    "speak",
    "அழைக்கவும்",
    "contact me",
    "please call",
    "call immediately",
  ],
};

export function matchCategory(text: string): BotKeywordCategory {
  const normalized = text.toLowerCase().trim();

  for (const kw of KEYWORD_PATTERNS.DNC) {
    if (
      normalized === kw ||
      normalized.startsWith(`${kw} `) ||
      normalized.endsWith(` ${kw}`) ||
      normalized.includes(` ${kw} `)
    ) {
      return "DNC";
    }
  }

  for (const kw of KEYWORD_PATTERNS.URGENT_CALL) {
    if (normalized.includes(kw)) {
      return "URGENT_CALL";
    }
  }

  for (const kw of KEYWORD_PATTERNS.INVESTMENT) {
    if (normalized.includes(kw)) {
      return "INVESTMENT";
    }
  }

  for (const kw of KEYWORD_PATTERNS.LOCATION) {
    if (normalized.includes(kw)) {
      return "LOCATION";
    }
  }

  return "NONE";
}

export const BOT_TEMPLATES = {
  DNC: `You have been successfully unsubscribed from MAKT ATM Franchise updates. We will not contact you again. Thank you.`,

  INVESTMENT: `{வணக்கம்|Hi}! 🙏 MAKT ATM Franchise முதலீடு விவரங்கள் (Investment Details):

• வணிக இடம் தேவை (Space): 40 முதல் 80 சதுர அடி (தரை தளம்)
• முதலீடு / Security Deposit: ₹3.5L முதல் ₹5.5L வரை
• மாதாந்திர வருமானம்: ₹25,000 முதல் ₹75,000+ வரை (பரிவர்த்தனைகளின் அடிப்படையில்)
• மெஷின் பராமரிப்பு மற்றும் பண நிர்வாகம் அனைத்தும் வங்கி கூட்டாளர்களால் கவனிக்கப்படும்.

எங்கள் நிர்வாகி உங்களை தொடர்பு கொண்டு உங்கள் மாவட்டத்திற்கான சிறப்பு சலுகைகளை விளக்குவார்! 🙏`,

  LOCATION: `{வணக்கம்|Hi}! 🙏 MAKT Solution Head Office:
📍 தமிழ்நாடு (Tamil Nadu, India)
🕒 அலுவலக நேரம்: திங்கள் – சனி, காலை 9:30 முதல் மாலை 6:30 வரை

எங்கள் மேலாளர் உங்களை தொடர்பு கொள்ளும்போது உங்கள் ஊருக்கு அருகிலுள்ள ATM மையங்கள் மற்றும் திட்ட விவரங்களை வழங்குவார். நன்றி!`,

  URGENT_CALL: `{வணக்கம்|Hi}! 🙏 உங்கள் கோரிக்கை [HIGH PRIORITY]-ல் வைக்கப்பட்டுள்ளது. 

எங்கள் மூத்த ATM Franchise அதிகாரி இன்னும் 15–30 நிமிடங்களில் உங்கள் எண்ணை அழைப்பார். தயவுசெய்து உங்கள் அழைப்பை எதிர்நோக்கவும்! நன்றி! 🙏`,
};

export async function processInboundBotReply(input: {
  phone: string;
  message: string;
  callLeadId: string;
  accountId?: string | null;
  displayName?: string;
}): Promise<BotEvaluationResult> {
  const { phone, message, callLeadId, accountId, displayName = "Caller" } = input;
  const category = matchCategory(message);

  if (category === "NONE") {
    return { category: "NONE", handled: false, reason: "no_keyword_matched" };
  }

  // 1. DNC Opt-Out Handling
  if (category === "DNC") {
    await db.$transaction([
      db.whatsAppLead.updateMany({
        where: { phone, deletedAt: null },
        data: { status: WhatsAppLeadStatus.DO_NOT_CONTACT },
      }),
      db.callLead.update({
        where: { id: callLeadId },
        data: { status: "CLOSED" },
      }),
      db.callActivity.create({
        data: {
          leadId: callLeadId,
          actionType: "NOTE_ADDED",
          description: `Customer opted out via WhatsApp keyword ("${message.slice(0, 50)}")`,
        },
      }),
    ]);

    if (accountId) {
      await queueWhatsAppMessage({
        accountId,
        phone,
        displayName,
        message: BOT_TEMPLATES.DNC,
        callLeadId,
        source: "bot_dnc_confirm",
      }).catch(() => {});
    }

    return { category: "DNC", handled: true, replyText: BOT_TEMPLATES.DNC };
  }

  // Cooldown check: Has the bot already replied to this phone for this category in the last 12 hours?
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const recentBotActivity = await db.callActivity.findFirst({
    where: {
      leadId: callLeadId,
      actionType: "NOTE_ADDED",
      description: { startsWith: `[Bot Auto-Reply: ${category}]` },
      createdAt: { gte: twelveHoursAgo },
    },
  });

  if (recentBotActivity) {
    return {
      category,
      handled: false,
      reason: `cooldown_active_for_${category.toLowerCase()}`,
    };
  }

  // 2. Urgent Call Request Handling
  if (category === "URGENT_CALL") {
    await db.$transaction([
      db.callLead.update({
        where: { id: callLeadId },
        data: {
          status: "INTERESTED",
          isImportant: true,
          notes: `[HIGH PRIORITY - URGENT CALL REQUESTED] Customer messaged: "${message}"`,
        },
      }),
      db.callActivity.create({
        data: {
          leadId: callLeadId,
          actionType: "NOTE_ADDED",
          description: `[Bot Auto-Reply: URGENT_CALL] Customer requested urgent callback via WhatsApp. Tagged as HIGH PRIORITY.`,
        },
      }),
    ]);
  } else {
    await db.callActivity.create({
      data: {
        leadId: callLeadId,
        actionType: "NOTE_ADDED",
        description: `[Bot Auto-Reply: ${category}] Customer inquired about ${category.toLowerCase()}`,
      },
    });
  }

  // Queue automated bot reply
  if (accountId) {
    const template = BOT_TEMPLATES[category];
    await queueWhatsAppMessage({
      accountId,
      phone,
      displayName,
      message: template,
      callLeadId,
      source: `bot_${category.toLowerCase()}`,
    }).catch((err) => {
      console.error("[whatsapp-bot] Failed to queue bot reply:", err);
    });

    return { category, handled: true, replyText: template };
  }

  return { category, handled: false, reason: "missing_account_id" };
}
