# Alloc — milestone implementation plan

Calendar source: [CONTEXT](CONTEXT.md). Times below are **internal targets in IST**, not organizer deadlines. This is a two-day build across three calendar dates. At handoff, mark actual progress rather than assuming elapsed milestones were completed.

One person may fill every role: integrator (scope/contracts), settlement owner, inference owner, UI owner, presenter/submission owner. **Assign named owners and presenter at M0**. Role names do not authorize parallel agents or imply a team exists.

## Milestones

| Gate / target | Work and deliverable | Exit criterion | If late |
| --- | --- | --- | --- |
| M0 · Nov 7, 02:30 | Confirm registration/form/video rules; select HTTPS/persistent host; assign roles; lock stack versions; fund three wallets; prove minimal wallet-sign + Devnet send; review model terms | Real smoke-test signature, working RPC, host decision and package locks recorded | Timebox SDK/host investigation to 45 min; use official minimal recipe; no catalog/UI extras |
| M1 · Nov 7, 10:30 | Rest block; initialize gateway/private worker, Docker/volume, SQLite migration; load and warm CPU classifier; upload validation; quote endpoint | Real local classification and persistent quote survive restart; model provenance logged | Use CPU only; no GPU setup or training |
| M2 · Nov 7, 14:00 | Prepare exact split+memo, sign/broadcast, RPC verification, candidate ledger, unique claims | Happy payment plus wrong-amount, wrong-payer, memo, duplicate, and race tests | Minimal receipt UI; preserve verification |
| M3 · Nov 7, 18:00 | Connect upload → quote → wallet → verified claim → worker → stored result; initial deployment | First complete flow on selected HTTPS host with Explorer receipt | Freeze every optional feature |
| M4 · Nov 7, 22:00 | Recover pending/paid states; private worker auth; restart/concurrency tests; handle rejection, unknown payment, and paid failure | Critical negative tests and persistence pass; UI reflects actual state | Remove polish; fix broken core only |
| M5 · Nov 8, 12:00 | Rest block; improve screen readability/accessibility; fresh-install build and 3 Devnet runs | Release candidate and evidence checklist; no fabricated performance claims | No stretch client |
| M6 · Nov 8, 16:00 | Feature freeze; rehearse twice; record/upload short video; write submission and limitations | Public video, working URL, repo and model attribution ready | Submit working scope; explain gaps |
| M7 · Nov 8, 19:30 | Internal initial-submission target; check from logged-out browser; recheck official cutoff | Submission saved and links playable; receipt/screenshot captured | Submission work takes priority over code |
| M8 · Nov 8, 21:30 | Internal final-submission target; reconcile form/links, tag tested commit | Final saved entry verified before official cutoff | Only blocking correction, no new feature |

Targets allow sleep and absorb uncertainty; they are not continuous working-hour quotas. If kickoff handoff is later, compress extras, not mandatory correctness or submission buffers.

## Suggested implementation order

1. Bootstrap exact versions and wallet smoke test; write actual commands into README.
2. Add migration and quote/input persistence.
3. Build CPU worker and confirm image decoding/model provenance.
4. Build and test deterministic payment parser against RPC fixtures.
5. Add preparation/signing/broadcast and reconciliation.
6. Add DB claim transaction, dispatcher, cached result, and recovery.
7. Connect the single browser journey.
8. Deploy early, then exercise failures and record evidence.

No milestone is complete on a screenshot alone. Attach commit, command/test output, and real signature where relevant to the release record in [RUNBOOK](RUNBOOK.md).

## Integration and stop rules

Spend at most 30 minutes on a cosmetic problem before M4. Resolve API discrepancies in API.md before two components implement different payloads. Commit coherent slices; never merge code that bypasses verification for convenience.

If M2 fails, stop UI work and fix settlement. If M3 fails, drop every stretch. If M5 fails, explicitly record incomplete gates and prioritize a truthful submission. A demo recording is a genuine earlier run, never a substitute presented as current live output.

## Optional stretch gate

Only if every MVP gate is green before M6: a maximum 45-minute scripted API client, one inference, explicit operator approval, hard Devnet spend cap. It must reuse existing endpoints and never affect the required release. Calling it an LLM agent requires an actual LLM decision/tool flow; a script is a script.
