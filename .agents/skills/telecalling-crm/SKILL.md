---
name: telecalling-crm
description: >-
  Telecalling operations, lead assignment algorithms, SLA tracking, Android call tracker
  device synchronization, and agent workload distribution.
---

# Telecalling Operations & Lead Distribution Engine

This skill governs telecaller lifecycle, call event ingestion, real-time popup coordination, and SLA monitoring.

## 1. Distribution Engine Models

The CRM supports two core distribution models:
- **Round-Robin**: Leads are sequentially distributed among online agents whose active lead count is below `maxConcurrentLeads`.
- **Workload Weighted**: Leads are assigned to the agent with the lowest number of pending or open callback requests.

## 2. SLA Tracking & Auto-Reassignment

- When a new lead is assigned, `slaExpiresAt = now() + responseSlaMinutes`.
- If an agent does not log an activity, note, or call event before `slaExpiresAt`:
  1. The SLA is flagged as `BREACHED`.
  2. If `autoReassignOnBreach` is enabled, the lead is immediately re-queued and transferred to the next available online agent.
  3. An audit log entry is recorded for administrative review.

## 3. Android Call Tracker Integration

- **Device Registration**: Handled via `POST /api/call-tracker/register` using `CALL_TRACKER_REGISTRATION_SECRET`.
- **Heartbeat & Battery**: Periodic pings to `/api/call-tracker/heartbeat` ensure device is online.
- **Call Events (`/api/call-tracker/events`)**:
  - `RINGING`: Triggers real-time popup on agent dashboard.
  - `OFFHOOK`: Sets agent state to IN_CALL.
  - `IDLE`: Calculates call duration, uploads recording if enabled, updates lead timeline.

