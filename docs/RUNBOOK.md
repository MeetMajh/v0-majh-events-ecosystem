# Operational Runbook

**Status:** Skeleton. Add entries every time you encounter and resolve an
operational issue. By August this should be 5–10 pages.

**Format:** Each entry is "Symptom → Diagnosis → Action."

---

## Stripe webhook stops firing

**Symptom:** `core.financial_intents` rows accumulating in 'submitted'
status; users seeing payments that don't complete.

**Diagnosis:**
- Check Stripe Dashboard → Developers → Webhooks. Is the endpoint marked
  as failing?
- Check Vercel logs for `app/api/webhooks/stripe/route.ts`. Are requests
  arriving?
- Is the webhook signing secret correct in Vercel env vars?

**Action:**
1. The reconciler at `app/api/cron/reconcile-stripe-intents` runs every
   15 minutes and will catch up automatically. Wait one cycle.
2. If still stuck after 30 min, manually trigger reconciliation:
   `POST /api/cron/reconcile-stripe-intents` with `Authorization: Bearer <CRON_SECRET>`
3. If the endpoint itself is broken, check whether the most recent deploy
   broke it. Roll back via Vercel.

**Owner:** Founder, until ops hire.

---

## Payout fails

**Symptom:** `core.financial_intents` row for payout marked 'failed'.
User reports payout didn't arrive.

**Diagnosis:**
- Check `last_error` column for Stripe's error message.
- Common causes: organizer's Connect account requirements pending; 
  insufficient platform balance; bank account verification expired.

**Action:**
1. If organizer requirements pending: notify organizer to complete Stripe
   onboarding (T-060 surface).
2. If platform balance issue: top up via Stripe Dashboard.
3. If user error (wrong bank info): user updates payout method, manual
   retry via admin panel.

---

## Outbox backs up

**Symptom:** Alert fires: "outbox unprocessed > 100 rows for > 5 minutes."

**Diagnosis:**
- Check `app/api/cron/process-outbox/route.ts` cron logs. Is it running?
- Check whether a specific topic is failing repeatedly (look at
  `attempts` column distribution).

**Action:**
1. If cron isn't running, check Vercel cron status.
2. If specific topic fails: the handler has a bug. Patch the handler;
   rows retry automatically.
3. If everything is processing but slowly: scale cron frequency in
   `vercel.json` from `* * * * *` (every min) to `*/30 * * * * *` (every 30s).

---

## Tournament needs to be cancelled mid-event

**Symptom:** Network outage at venue, scheduling conflict, force majeure.

**Action:**
1. As tournament organizer (or platform admin):
   `app/(dashboard)/tournaments/[slug]/cancel`
2. Confirm cancellation reason (free text).
3. System creates refund intents for all paid registrations.
4. Audit log row for cancellation written automatically.
5. Notifications fire to all registrants.
6. Match in-progress rows marked cancelled (winner_id stays null).

**If escrow was funded:** Escrow refund flow runs (T-025).

**If prizes already partially distributed:** Document manually in
`core.audit_log` via admin tool. Do not modify history.

---

## Reactions / viewer counts wrong on live match

**Symptom:** Audience UI shows obviously wrong counts (e.g., 0 viewers
when the room is full).

**Diagnosis:**
- Check `audience.match_summary` row for the match. Is `last_updated`
  recent?
- Check Realtime subscription on client side via browser devtools.

**Action:**
1. Match summary is maintained by outbox worker (T-026). Check outbox
   for `match.engagement.update` topic.
2. If summary is stale: trigger manual recompute via admin endpoint.
3. If Realtime broken: client-side subscription needs reconnect — usually
   self-heals on refresh.

---

## Stuck `outbox` row from way back

**Note for posterity:** When this runbook was first written, there was 1
unprocessed outbox row. Investigated as part of T-014. [Update with what
we found when T-014 lands.]

---

## (Add new entries here as issues arise)

