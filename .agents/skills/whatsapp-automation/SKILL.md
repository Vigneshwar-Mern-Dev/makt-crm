---
name: whatsapp-automation
description: >-
  WhatsApp Web headless session management, anti-ban throttling, SpinTax generation,
  drip campaign scheduling, and customer intake form automation.
---

# WhatsApp Automation & Intake Lifecycle

This skill defines the operational boundaries and execution rules for the WhatsApp automation pipeline.

## 1. Anti-Ban Throttling & SpinTax

- **Delay Between Messages**: Minimum 15–30 seconds random jitter between dispatches.
- **SpinTax Dynamic Text**: All automated messages MUST use SpinTax variants `{variant1|variant2|variant3}` and user placeholders `{{name}}`, `{{city}}` to ensure uniqueness.
- **Daily Dispatch Caps**: Accounts warm up gradually (Day 1: 30 msgs, Day 3: 100 msgs, Day 7+: 300 msgs).

## 2. Customer Intake Form Flow

1. Lead arrives (from Call Tracker, Website, or Google Sheet).
2. CRM generates an encrypted short token `ft_<hex>` and queues an automated WhatsApp message with link `https://crm.planle.com/f/[token]`.
3. Customer clicks link ➔ Status updates to `OPENED`.
4. Customer enters details ➔ Status updates to `FORM_STARTED`.
5. Customer submits property type and Google Maps pin ➔ Status updates to `FORM_SUBMITTED`, CallLead stage transitions to `INTERESTED`, and lead is synced back to Google Sheets.

## 3. Worker Architecture & Self-Healing

- Headless Puppeteer Chromium worker runs via `scripts/whatsapp-worker.mjs`.
- If a message gets stuck in `SENDING` state for > 5 minutes, `/api/cron/queue-healer` automatically resets it to `QUEUED` or marks it failed after 3 retries.
- Drip messages are triggered by `/api/cron/whatsapp-drip` every 5 minutes.

