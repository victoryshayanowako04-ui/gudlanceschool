# Gudlance security remediation notes

## Changes in the financial integrity guardrails migration

- Reconciles student balance snapshots against the existing authoritative get_student_balance() ledger calculation.
- Writes an audit record for each corrected snapshot in the non-exposed private.student_balance_reconciliation_audit table.
- Keeps students.balance_owing synchronized after future ledger inserts, updates, and deletes.
- Prevents new duplicate payments.receipt_no values under concurrent writes. Existing receipt conflicts are intentionally preserved for manual review.
- Makes event_payments_view use invoker permissions and removes public Data API execute grants from the RLS event-trigger function.

## Security work still required

The current application authenticates staff through a custom browser-side lookup against public.users, then directly reads and writes many public tables using the Supabase client. The live database currently has 41 public tables with RLS disabled and broad grants to anon and authenticated. Enabling RLS indiscriminately would break existing modules because most tables have no role-aware policies yet.

The frontend also contains a hard-coded God Mode credential. This must be replaced with a server-verified, environment-managed administrator authentication path before it can be considered secure.

A complete RLS rollout therefore requires a coordinated authentication migration: move credential verification and privileged operations to server-side functions, establish trusted server-issued identity/role claims, map each table to the actual school/staff/parent access rules, then enable RLS and test each role. Do not add blanket USING (true) policies or enable RLS on all tables as a cosmetic fix.

## Historical payment review

Six payment receipt numbers are currently shared by two different students each. They are not rewritten by this migration because printed receipts and accounting history must remain traceable. The new trigger prevents those receipt references from being reused on future payment rows.
