---
name: saas-billing
description: >-
  Multi-tenant SaaS subscription billing, plan tier entitlements, usage quota gating,
  and payment gateway integration (Razorpay & Stripe) for the CRM platform.
---

# SaaS Billing & Subscription Architecture

This skill defines the standards and implementation guidelines for billing, subscription management, and quota enforcement in the MAKT CRM platform.

## Plan Tiers & Entitlements

| Feature / Limit | Free Starter | Growth Pro | Business / Agency |
| :--- | :--- | :--- | :--- |
| **Price (INR / Mo)** | ₹0 / mo | ₹1,999 / mo | ₹4,999 / mo |
| **Price (USD / Mo)** | $0 / mo | $29 / mo | $69 / mo |
| **Max Team Members** | 2 Users | 10 Users | Unlimited |
| **WhatsApp Senders** | 1 Device | 3 Devices | 10 Devices |
| **Monthly Lead Ingestion**| 250 Leads | 2,500 Leads | 15,000 Leads |
| **Google Sheets Two-Way Sync**| Manual / 1 Sheet | Realtime / 3 Sheets | Unlimited Sheets |
| **Automated WhatsApp Drips** | Basic (1 step) | Multi-step (up to 5) | Unlimited Drips |
| **SLA Auto-Reassignment** | Disabled | 15m - 60m SLA | Custom SLA (1m+) |
| **Custom Domain & Branding** | No | Included | White-label |

## Quota Enforcement Guardrails

All mutation actions must check plan limits before creating resources:
1. **Adding Team Member**: Check `org.members.count < plan.maxMembers`.
2. **Connecting WhatsApp Account**: Check `org.whatsappAccounts.count < plan.maxWhatsAppDevices`.
3. **Ingesting Leads**: Check monthly quota in `LeadUsageRecord`. If limit exceeded, return HTTP `402 Payment Required` with upgrade URL.

## Payment Gateways

- **India / Domestic**: Razorpay Subscriptions (supporting UPI AutoPay, NetBanking, Cards).
- **International**: Stripe Billing (supporting Credit Cards, Apple Pay, SEPA).
- **Webhooks**: Must verify cryptographic signatures (`razorpay_signature` / `stripe-signature`) before fulfilling plan upgrades.
- **Grace Period**: 3 days grace period upon payment failure before downgrading features.

