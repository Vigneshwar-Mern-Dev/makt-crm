# MAKT CRM — Architecture & Technical Documentation

MAKT CRM is an enterprise telecalling, lead management, and WhatsApp marketing automation platform built with Next.js 16 (App Router), React 19, TypeScript, Prisma ORM, and PostgreSQL 17 on Neon Cloud.

---

## 1. System Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │        Android Call Tracker          │
                      │  (Physical Call Center Smartphones)  │
                      └──────────────────┬───────────────────┘
                                         │ POST /api/call-tracker/*
                                         ▼
┌─────────────────────────┐   ┌──────────────────────────────────────┐   ┌─────────────────────────┐
│     Telecallers /       │   │        MAKT CRM Server Engine        │   │      Google Sheets      │
│      Admin Web UI       ├──►│           (Next.js 16 App)           ├──►│       Integration       │
│  (Realtime Lead Drawers)│   │  • Telecalling Queue Engine          │   │ (Google Apps Script API)│
└─────────────────────────┘   │  • PostgreSQL Advisory Locks         │   └─────────────────────────┘
                              │  • Security & Bridge Gateways        │
                              └──────────────────┬───────────────────┘
                                                 │ HTTP Bridge (Token-Auth)
                                                 ▼
                              ┌──────────────────────────────────────┐
                              │       WhatsApp Worker Cluster        │
                              │   • whatsapp-worker-manager.mjs      │
                              │   • whatsapp-worker.mjs (Chromium)   │
                              │   • SpinTax Text Rotator             │
                              │   • Interactive Tamil/Eng Bot        │
                              └──────────────────┬───────────────────┘
                                                 │
                                                 ▼
                                     WhatsApp Web / Customers
```

---

## 2. WhatsApp Automation Suite

### A. Anti-Ban SpinTax Engine (`app/lib/whatsapp-spintax.ts`)
- Prevents WhatsApp spam filters from detecting broadcast patterns by automatically randomizing words and phrases using curly brace syntax:
  - Example: `{வணக்கம்|வணக்கம் நண்பரே|வணக்கம் சார்}`
- Injected into all initial greetings, automated drips, and template variants.

### B. Anti-Leak Worker & Nightly Recycle (`scripts/whatsapp-worker.mjs`)
- Runs headless Chromium via `whatsapp-web.js` with capped memory (`--js-flags=--max-old-space-size=512`) and capped disk cache (`--disk-cache-size=50MB`).
- Executes a soft restart at 2:00 AM daily to clear lingering Chromium V8 heap memory.
- Adaptive polling: Polls every 5s during active queues; backs off to 20–25s when idle.

### C. Bilingual Interactive Auto-Reply Bot (`app/lib/whatsapp-bot.ts`)
- Intercepts incoming customer WhatsApp replies (`POST /api/whatsapp/inbox`).
- Analyzes Tamil and English trigger keywords:
  - **`STOP` / `வேண்டாம்` / `வேண்டாம் நிறுத்து`**: Marks lead as `DO_NOT_CONTACT` and purges upcoming queued messages.
  - **`DETAILS` / `விவரங்கள்` / `திட்டம்`**: Queues investment brochure & product details.
  - **`OFFICE` / `முகவரி` / `அலுவலகம்`**: Dispatches office address and Google Maps location pin.
  - **`TALK` / `பேச வேண்டும்` / `அழைக்கவும்`**: Elevates lead priority to `URGENT` in CRM telecalling queue.

### D. 2-Way Live Chat Drawer (`call-leads-page.tsx`)
- Agents can view incoming and outgoing WhatsApp message history inside the customer drawer and dispatch custom WhatsApp replies directly via `sendCustomWhatsAppMessageAction`.

### E. 24-Hour Non-Responder Drip (`app/lib/whatsapp-drip.ts`)
- Automatically re-engages leads who received an initial message 24–48 hours ago but have neither replied nor submitted a form.
- Automated cron trigger available at `POST /api/cron/whatsapp-drip`.

### F. Read Receipts & Blue Ticks (`/api/whatsapp/ack`)
- Worker intercepts `message_ack` events (`ack = 2` for handset delivery, `ack = 3` for blue ticks).
- Records `deliveredAt` and `readAt` on `WhatsAppQueueItem` in real time.

### G. Dead-Letter Queue (DLQ) Auto-Healer (`app/lib/whatsapp-queue-healer.ts`)
- Rescues orphaned items stuck in `SENDING` (>3 minutes) if a worker process crashes or loses internet.
- Recovers items with `< 3` attempts back to `QUEUED`; escalates items with `≥ 3` attempts to `FAILED` (DLQ) with an alert log.
- Cron trigger available at `POST /api/cron/queue-healer`.

### H. Multi-Account Supervisor & Failover
- `scripts/whatsapp-worker-manager.mjs` supervises dedicated child worker processes per linked WhatsApp account.
- `app/lib/whatsapp-account-picker.ts` dynamically balances traffic across active accounts and automatically fails over when an account disconnects.

---

## 3. Telecalling & Google Sheets Sync

- **Call Tracker Ingestion:** Android devices register via `/api/call-tracker/register` and stream call events (`INCOMING`, `MISSED`, `OUTGOING`, durations) via `/api/call-tracker/events`.
- **Google Sheets Two-Way Sync:**
  - Qualified leads can be synced to Google Sheets in 1-click via `Save Lead, Workflow & Sheet` (`saveCallLeadToSheetAction`).
  - Calls Google Apps Script endpoint configured in `LeadIntegration` table.
  - Live agent counters on Admin Calls page track "Sheet saves today".
- **Excel/CSV Export:**
  - One-click export for client form submissions at `/api/admin/exports/submitted-leads`.

---

## 4. Security & Sanitization

- **Bridge Authentication:** All internal worker and cron endpoints require `x-whatsapp-bridge-token` validated with constant-time cryptographic comparison (`timingSafeEqual`) in `whatsapp-security.ts`.
- **Payload Sanitization:** `sanitizeIncomingWhatsAppMessage` strips HTML tags, control characters, null bytes, and trims excess whitespace before database ingestion.
- **Session Security:** Signed HMAC-SHA256 session cookies with automatic token invalidation on password change.
- **Rate Limiting:** Sliding-window rate limiters across auth and public form submission endpoints.

---

## 5. Operations & CLI Reference

| Command | Description |
| :--- | :--- |
| `npm run check` | Runs full suite: Prisma validate + ESLint + TypeScript + Next.js build |
| `npm run dev` | Starts local Next.js dev server on `http://localhost:3000` |
| `npm run build` | Compiles optimized production bundle |
| `npm run start:prod` | Starts production PM2 cluster (`crm-next` + `crm-whatsapp-workers`) |
| `npm run whatsapp:workers` | Starts multi-account WhatsApp worker supervisor |
| `npm run whatsapp:workers:check` | Inspects database WhatsApp accounts and connection states |
| `npm run queue:reset-stuck` | Reclaims orphaned `SENDING` messages |
| `npm run cleanup:security` | Purges expired rate-limit buckets and stale login attempts |
| `npm run setup:production` | Automated server deployment script (Prisma deploy + Build + PM2 reload + Logrotate) |
| `npm run backup:encrypted` | Creates AES-256-CBC encrypted archive of Postgres DB, `.env`, and WhatsApp sessions |
