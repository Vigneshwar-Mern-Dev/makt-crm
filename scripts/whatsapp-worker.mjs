import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import "dotenv/config";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

const CRM_BASE_URL = process.env.CRM_BASE_URL || "http://127.0.0.1:3000";
const BRIDGE_TOKEN = process.env.WHATSAPP_BRIDGE_TOKEN;
const ACCOUNT_ID = process.env.WHATSAPP_ACCOUNT_ID || undefined;
const POLL_MS = Number.parseInt(process.env.WHATSAPP_POLL_MS || "10000", 10);
const SEND_TYPING = process.env.WHATSAPP_SEND_TYPING !== "false";

if (!BRIDGE_TOKEN) {
  console.error("WHATSAPP_BRIDGE_TOKEN is required.");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, timeoutMs, errorMsg = "Operation timed out") {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function randomDelay(minSeconds, maxSeconds) {
  const min = Math.max(30, Number(minSeconds) || 120);
  const max = Math.max(min, Number(maxSeconds) || 180);
  return Math.floor((min + Math.random() * (max - min)) * 1000);
}

function isRestHour(now = new Date()) {
  const hours = now.getHours();
  return hours === 0; // 00:00:00 to 00:59:59 is 12:00 AM to 1:00 AM (rest time)
}

async function postBridge(payload) {
  const response = await fetch(`${CRM_BASE_URL}/api/whatsapp/bridge`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-whatsapp-bridge-token": BRIDGE_TOKEN,
    },
    body: JSON.stringify({ accountId: ACCOUNT_ID, ...payload }),
  });

  if (!response.ok) {
    throw new Error(`Bridge update failed: ${response.status}`);
  }
}

async function getOutboxLead() {
  const url = new URL(`${CRM_BASE_URL}/api/whatsapp/outbox`);
  if (ACCOUNT_ID) {
    url.searchParams.set("accountId", ACCOUNT_ID);
  }

  const response = await fetch(url.toString(), {
    headers: { "x-whatsapp-bridge-token": BRIDGE_TOKEN },
  });

  if (!response.ok) {
    throw new Error(`Outbox fetch failed: ${response.status}`);
  }

  return response.json();
}

async function postOutboxResult(leadId, ok, error = null, errorType = null) {
  const response = await fetch(`${CRM_BASE_URL}/api/whatsapp/outbox`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-whatsapp-bridge-token": BRIDGE_TOKEN,
    },
    body: JSON.stringify({ leadId, ok, error, errorType }),
  });

  if (!response.ok) {
    throw new Error(`Outbox result failed: ${response.status}`);
  }
}

async function postInboxReply(phone, message) {
  try {
    const response = await fetch(`${CRM_BASE_URL}/api/whatsapp/inbox`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-whatsapp-bridge-token": BRIDGE_TOKEN,
      },
      body: JSON.stringify({ phone, message, receivedAt: new Date().toISOString() }),
    });

    if (!response.ok) {
      console.warn(`[inbox] Failed to post reply for ${phone}: ${response.status}`);
    }
  } catch (err) {
    console.error("[inbox] Error posting reply:", err);
  }
}

function toWhatsAppId(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return `${digits}@c.us`;
}

function fromWhatsAppId(chatId) {
  // "919876543210@c.us" → "+919876543210"
  const digits = String(chatId || "").split("@")[0];
  return digits ? `+${digits}` : null;
}

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: ACCOUNT_ID || "primary",
    dataPath: ".whatsapp-auth-new",
  }),
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
  puppeteer: {
    headless: process.env.WHATSAPP_HEADLESS !== "false",
    protocolTimeout: 300000, // 5 minutes
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--disable-extensions",
      "--disk-cache-size=52428800",
      "--media-cache-size=26214400",
      "--disable-application-cache",
      "--js-flags=--max-old-space-size=512",
    ],
  },
});

let ready = false;
let sending = false;

// Reconnection variables
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnecting = false;

async function handleReconnect(reason = "Connection lost") {
  if (reconnecting) return;
  reconnecting = true;
  ready = false;

  reconnectAttempts++;
  console.log(`[worker] Attempting reconnection (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in 10 seconds... Reason: ${reason}`);

  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    console.error("[worker] Max reconnection attempts reached. Pausing worker.");
    await postBridge({ status: "ERROR", lastError: "Max reconnection attempts reached. Please scan QR or click Resume." }).catch(() => {});
    reconnecting = false;
    return;
  }

  await postBridge({ status: "CONNECTING", lastError: `Reconnecting (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...` }).catch(() => {});

  setTimeout(async () => {
    try {
      console.log("[worker] Destroying client...");
      await client.destroy().catch(() => {});

      // If it was an authentication failure, clear the auth directory to force a clean login/QR
      if (reason.toLowerCase().includes("auth") || reason.toLowerCase().includes("fail")) {
        console.log(`[worker] Clearing auth session directory for ${ACCOUNT_ID || "primary"} due to auth failure...`);
        const sessionDir = path.join(".whatsapp-auth-new", `session-${ACCOUNT_ID || "primary"}`);
        if (fs.existsSync(sessionDir)) {
          try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
          } catch {}
        }
      }

      console.log("[worker] Re-initializing client...");
      await client.initialize();
      reconnecting = false;
    } catch (err) {
      console.error("[worker] Reconnection initialization failed:", err);
      reconnecting = false;
      // Schedule next attempt
      handleReconnect(reason);
    }
  }, 10000);
}

client.on("qr", async (qr) => {
  ready = false;
  console.log("QR received. Open /admin/whatsapp and scan it.");
  await postBridge({ status: "QR_REQUIRED", qrCodeData: qr, lastError: null });
});

client.on("authenticated", async () => {
  console.log("WhatsApp authenticated.");
  await postBridge({ status: "CONNECTING", qrCodeData: null, lastError: null });
});

client.on("ready", async () => {
  ready = true;
  reconnectAttempts = 0; // Reset reconnection attempts on successful connection
  const info = client.info;
  console.log("WhatsApp ready.");
  await postBridge({
    status: "CONNECTED",
    phoneNumber: info?.wid?.user || null,
    qrCodeData: null,
    lastError: null,
  });
});

client.on("disconnected", async (reason) => {
  ready = false;
  console.error("WhatsApp disconnected:", reason);
  await postBridge({ status: "DISCONNECTED", lastError: String(reason || "") }).catch(() => {});
  handleReconnect(String(reason || "Disconnected"));
});

client.on("auth_failure", async (msg) => {
  console.error("WhatsApp authentication failure:", msg);
  await postBridge({ status: "ERROR", lastError: "Auth failure: " + String(msg) }).catch(() => {});
  handleReconnect("Authentication failure: " + String(msg));
});

// ── Incoming message listener (reply detection) ──────────────────────────────
client.on("message", async (msg) => {
  // Ignore: outgoing, status updates, group messages, broadcasts
  if (msg.fromMe) return;
  if (msg.isStatus) return;
  if (msg.from.endsWith("@g.us")) return;  // group
  if (msg.from.endsWith("@broadcast")) return;

  const phone = fromWhatsAppId(msg.from);

  if (!phone) return;

  console.log(`[inbox] Received reply from ${phone}: "${msg.body?.slice(0, 60)}"`);
  await postInboxReply(phone, msg.body || "");
});

// ── Delivery & Read Receipt listener (Blue ticks) ────────────────────────────
async function postMessageAck(phone, ack) {
  try {
    await fetch(`${CRM_BASE_URL}/api/whatsapp/ack`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-whatsapp-bridge-token": BRIDGE_TOKEN,
      },
      body: JSON.stringify({ phone, ack }),
    }).catch(() => {});
  } catch {}
}

client.on("message_ack", async (msg, ack) => {
  if (!msg.to || msg.to.endsWith("@g.us") || msg.to.endsWith("@broadcast")) return;
  const phone = fromWhatsAppId(msg.to);
  if (!phone) return;

  if (ack >= 3) {
    console.log(`[ack] Blue tick (read) confirmed for ${phone}`);
    await postMessageAck(phone, ack);
  }
});

// ── Outbound sending loop ────────────────────────────────────────────────────
let lastRecycleDate = new Date().toDateString();

async function checkSoftRecycle() {
  const now = new Date();
  const currentHour = now.getHours();

  // Soft recycle at 2:00 AM once per day when idle to clean Chrome V8 memory
  if (currentHour === 2 && lastRecycleDate !== now.toDateString() && !sending && ready) {
    lastRecycleDate = now.toDateString();
    console.log("[worker] Executing scheduled nightly soft recycle (2:00 AM)...");
    try {
      ready = false;
      await client.destroy().catch(() => {});
      const cacheDir = ".wwebjs_cache";
      if (fs.existsSync(cacheDir)) {
        try {
          fs.rmSync(cacheDir, { recursive: true, force: true });
          console.log("[worker] Cleared .wwebjs_cache during nightly recycle.");
        } catch {}
      }
      await sleep(5000);
      console.log("[worker] Re-initializing WhatsApp client after nightly recycle...");
      await client.initialize();
    } catch (recycleErr) {
      console.error("[worker] Nightly recycle error:", recycleErr);
    }
  }
}

async function sendNextLead() {
  if (!ready || sending) return { hasWork: false };

  sending = true;
  let currentLeadId = null;

  try {
    const outbox = await getOutboxLead();

    if (!outbox.ok) return { hasWork: false };

    if (outbox.logoutRequested) {
      console.log("[worker] Logout requested by server. Destroying session...");
      await postBridge({ status: "QR_REQUIRED", lastError: "Session reset." }).catch(() => {});
      try {
        await client.logout();
      } catch {}
      const sessionDir = path.join(".whatsapp-auth-new", `session-${ACCOUNT_ID || "primary"}`);
      if (fs.existsSync(sessionDir)) {
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch {}
      }
      process.exit(0);
    }

    // Paused, daily capped, or hourly rate-limited — wait quietly
    if (outbox.paused || outbox.capped || outbox.rateLimited || !outbox.lead) {
      if (outbox.rateLimited) {
        console.log(
          `[outbox] Hourly limit reached (${outbox.sentLastHour}/${outbox.hourlyLimit}). Waiting.`,
        );
      }
      return { hasWork: false };
    }

    if (isRestHour()) {
      console.log("[outbox] Midnight rest hour active (12:00 AM - 01:00 AM). Resting...");
      return { hasWork: false };
    }

    currentLeadId = outbox.lead.id;

    const delay = randomDelay(outbox.account.minDelaySeconds, outbox.account.maxDelaySeconds);
    console.log(`Waiting ${Math.round(delay / 1000)}s before sending to ${outbox.lead.phone}.`);
    await sleep(delay);

    const chatId = toWhatsAppId(outbox.lead.phone);

    // Validate if user has a registered WhatsApp account before interacting
    let isRegistered = false;
    try {
      isRegistered = await withTimeout(client.isRegisteredUser(chatId), 30000, "Registration check timed out");
    } catch (regErr) {
      console.warn(`[worker] Registration check failed for ${chatId}:`, regErr.message || regErr);
    }

    if (!isRegistered) {
      const regErr = new Error(`Phone number ${outbox.lead.phone} is not registered on WhatsApp.`);
      regErr.errorType = "NOT_REGISTERED";
      throw regErr;
    }

    let chat = null;
    try {
      chat = await withTimeout(client.getChatById(chatId), 30000, "Get chat timed out");
    } catch (chatErr) {
      console.warn(`[worker] Could not get chat for ${chatId} (likely new contact):`, chatErr.message || chatErr);
    }

    if (SEND_TYPING && chat) {
      try {
        await withTimeout(chat.sendStateTyping(), 10000, "sendStateTyping timed out");
        await sleep(Math.min(5000, Math.max(1500, outbox.lead.message.length * 35)));
      } catch (typingErr) {
        console.warn("[worker] sendStateTyping failed (ignoring):", typingErr.message);
      }
      try {
        await withTimeout(chat.clearState(), 10000, "clearState timed out");
      } catch (clearErr) {
        console.warn("[worker] clearState failed (ignoring):", clearErr.message);
      }
    }

    await withTimeout(client.sendMessage(chatId, outbox.lead.message), 60000, "sendMessage timed out");
    await postOutboxResult(outbox.lead.id, true);
    console.log(`Sent WhatsApp message to ${outbox.lead.phone}.`);
    return { hasWork: true };
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown worker error";

    // If the error happened during/after lead pickup, mark it FAILED
    // so it doesn't stay stuck in QUEUED indefinitely.
    if (currentLeadId) {
      const errorType =
        error?.errorType ||
        (message.toLowerCase().includes("not registered")
          ? "NOT_REGISTERED"
          : message.toLowerCase().includes("invalid")
            ? "INVALID_NUMBER"
            : "DELIVERY_FAILURE");
      await postOutboxResult(currentLeadId, false, message, errorType).catch(() => {});
    } else {
      // Pre-lead error (e.g. outbox fetch failed) — report bridge status only
      await postBridge({ status: "ERROR", lastError: message }).catch(() => {});
    }
    return { hasWork: false };
  } finally {
    sending = false;
  }
}

let lastDripCheckHour = -1;

async function checkDripReengagement() {
  const now = new Date();
  const currentHour = now.getHours();
  // Run once every 2 hours between 10:00 AM and 7:00 PM (10, 12, 14, 16, 18)
  if (currentHour >= 10 && currentHour <= 19 && currentHour % 2 === 0 && lastDripCheckHour !== currentHour) {
    lastDripCheckHour = currentHour;
    try {
      console.log("[worker] Triggering scheduled 24h WhatsApp re-engagement drip check...");
      const res = await fetch(`${CRM_BASE_URL}/api/cron/whatsapp-drip`, {
        method: "POST",
        headers: { "x-whatsapp-bridge-token": BRIDGE_TOKEN },
      });
      const data = await res.json().catch(() => ({}));
      console.log("[worker] Drip check completed:", data?.result?.queuedCount ?? 0, "messages queued.");
    } catch (dripErr) {
      console.warn("[worker] Drip trigger failed (ignoring):", dripErr.message);
    }
  }
}

let lastHealerCheckTime = 0;

async function checkQueueHealer() {
  const now = Date.now();
  // Run every 5 minutes
  if (now - lastHealerCheckTime >= 5 * 60 * 1000) {
    lastHealerCheckTime = now;
    try {
      const res = await fetch(`${CRM_BASE_URL}/api/cron/queue-healer`, {
        method: "POST",
        headers: { "x-whatsapp-bridge-token": BRIDGE_TOKEN },
      });
      const data = await res.json().catch(() => ({}));
      if (data?.result?.reclaimedCount > 0 || data?.result?.failedDlqCount > 0) {
        console.log(
          `[worker] DLQ Auto-Healer: Reclaimed ${data.result.reclaimedCount}, DLQ escalated ${data.result.failedDlqCount}`,
        );
      }
    } catch (healErr) {
      console.warn("[worker] Queue healer check failed (ignoring):", healErr.message);
    }
  }
}

// Adaptive polling loop: 5-10s when active leads exist, 20-25s when queue is empty to protect DB pooler
async function startAdaptiveOutboxLoop() {
  while (true) {
    try {
      await checkSoftRecycle();
      await checkDripReengagement();
      await checkQueueHealer();
      const result = await sendNextLead();
      const waitTime = result?.hasWork ? Math.max(5000, POLL_MS) : Math.max(20000, POLL_MS * 2);
      await sleep(waitTime);
    } catch (err) {
      console.error("[worker] Polling loop error:", err);
      await sleep(10000);
    }
  }
}

startAdaptiveOutboxLoop();

process.on("SIGINT", async () => {
  await postBridge({ status: "DISCONNECTED" }).catch(() => {});
  await client.destroy();
  process.exit(0);
});

console.log(`Starting WhatsApp worker for ${CRM_BASE_URL}... Waiting for server to be ready.`);

(async () => {
  // Wait for the Next.js server to be fully up before starting WhatsApp
  while (true) {
    try {
      await postBridge({ status: "CONNECTING", lastError: null });
      break; // Success! Server is up.
    } catch (error) {
      if (error.cause && error.cause.code === 'ECONNREFUSED') {
        // Server not ready yet, wait 1 second and retry silently
        await sleep(1000);
      } else {
        console.error("Bridge ping failed:", error);
        await sleep(2000);
      }
    }
  }

  console.log("Server is ready. Initializing WhatsApp client...");
  client.initialize();
})();
