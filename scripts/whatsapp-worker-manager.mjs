import { spawn } from "node:child_process";
import process from "node:process";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const isCheckMode = process.argv.includes("--check");
const workers = new Map(); // accountId -> { process, label, restartCount }

async function getAccounts() {
  try {
    return await prisma.whatsAppAccount.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        label: true,
        phoneNumber: true,
        status: true,
        autoReplyEnabled: true,
      },
    });
  } catch (error) {
    console.error("[manager] Failed to fetch accounts:", error.message);
    return [];
  }
}

async function runCheck() {
  console.log("=== WhatsApp Accounts & Worker Status Check ===");
  const accounts = await getAccounts();
  if (accounts.length === 0) {
    console.log("No WhatsApp accounts found in database.");
  } else {
    accounts.forEach((acc, i) => {
      console.log(
        `${i + 1}. [${acc.status}] ${acc.label} (${acc.phoneNumber || "No phone"}) - AutoReply: ${acc.autoReplyEnabled ? "Enabled" : "Disabled"} (ID: ${acc.id})`,
      );
    });
  }
  await prisma.$disconnect();
  process.exit(0);
}

function startWorkerForAccount(account) {
  if (workers.has(account.id)) {
    return;
  }

  console.log(`[manager] Spawning worker for: ${account.label} (${account.id})`);

  const child = spawn("node", ["scripts/whatsapp-worker.mjs"], {
    env: {
      ...process.env,
      WHATSAPP_ACCOUNT_ID: account.id,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const prefix = `[${account.label}]`;

  child.stdout.on("data", (data) => {
    process.stdout.write(`${prefix} ${data.toString()}`);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(`${prefix} [ERROR] ${data.toString()}`);
  });

  child.on("exit", (code, signal) => {
    console.warn(`[manager] Worker for ${account.label} exited (code: ${code}, signal: ${signal})`);
    workers.delete(account.id);

    // Auto-restart after 5 seconds unless shutting down
    if (!isShuttingDown) {
      setTimeout(async () => {
        const freshAccounts = await getAccounts();
        const freshAcc = freshAccounts.find((a) => a.id === account.id);
        if (freshAcc) {
          startWorkerForAccount(freshAcc);
        }
      }, 5000);
    }
  });

  workers.set(account.id, { process: child, label: account.label });
}

let isShuttingDown = false;

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("\n[manager] Shutting down all WhatsApp workers...");

  for (const worker of workers.values()) {
    console.log(`[manager] Stopping worker for ${worker.label}...`);
    try {
      worker.process.kill("SIGINT");
    } catch {}
  }

  setTimeout(async () => {
    await prisma.$disconnect();
    process.exit(0);
  }, 3000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  if (isCheckMode) {
    return runCheck();
  }

  console.log("[manager] WhatsApp Worker Manager started. Supervising accounts...");

  // Initial spawn
  const accounts = await getAccounts();
  if (accounts.length === 0) {
    console.log("[manager] No WhatsApp accounts found. Retrying in 15 seconds...");
  } else {
    accounts.forEach((acc) => startWorkerForAccount(acc));
  }

  // Periodic supervisor: check for newly added or deleted accounts every 30 seconds
  setInterval(async () => {
    if (isShuttingDown) return;
    const currentAccounts = await getAccounts();

    // Spawn workers for newly created accounts
    for (const acc of currentAccounts) {
      if (!workers.has(acc.id)) {
        startWorkerForAccount(acc);
      }
    }

    // Stop workers for deleted accounts
    const currentIds = new Set(currentAccounts.map((a) => a.id));
    for (const [id, worker] of workers.entries()) {
      if (!currentIds.has(id)) {
        console.log(`[manager] Account ${worker.label} was deleted. Terminating worker...`);
        worker.process.kill("SIGINT");
        workers.delete(id);
      }
    }
  }, 30000);
}

main().catch((err) => {
  console.error("[manager] Fatal error:", err);
  process.exit(1);
});
