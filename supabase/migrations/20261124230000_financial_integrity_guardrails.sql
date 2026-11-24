-- Reconcile stale student balance snapshots from the authoritative ledger,
-- keep balances synchronized after future ledger mutations, and prevent new
-- duplicate payment receipt references. Historical receipts are preserved.

CREATE TABLE IF NOT EXISTS private.student_balance_reconciliation_audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_id uuid NOT NULL,
    student_id text NOT NULL,
    previous_balance numeric(14,2) NOT NULL,
    ledger_balance numeric(14,2) NOT NULL,
    difference numeric(14,2) NOT NULL,
    reconciled_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

REVOKE ALL ON TABLE private.student_balance_reconciliation_audit FROM PUBLIC, anon, authenticated;

DO $reconcile$
DECLARE
    v_batch_id uuid := gen_random_uuid();
BEGIN
    INSERT INTO private.student_balance_reconciliation_audit (
        batch_id, student_id, previous_balance, ledger_balance, difference
    )
    SELECT
        v_batch_id,
        s.id,
        round(COALESCE(s.balance_owing, 0), 2),
        round(public.get_student_balance(s.id), 2),
        round(COALESCE(s.balance_owing, 0) - public.get_student_balance(s.id), 2)
    FROM public.students AS s
    WHERE abs(COALESCE(s.balance_owing, 0) - public.get_student_balance(s.id)) > 0.01;

    UPDATE public.students AS s
    SET balance_owing = round(public.get_student_balance(s.id), 2)
    WHERE abs(COALESCE(s.balance_owing, 0) - public.get_student_balance(s.id)) > 0.01;
END;
$reconcile$;

CREATE OR REPLACE FUNCTION private.sync_student_balance_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE public.students
        SET balance_owing = round(public.get_student_balance(OLD.student_id), 2)
        WHERE id = OLD.student_id;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.student_id IS DISTINCT FROM NEW.student_id THEN
        UPDATE public.students
        SET balance_owing = round(public.get_student_balance(OLD.student_id), 2)
        WHERE id = OLD.student_id;
    END IF;

    UPDATE public.students
    SET balance_owing = round(public.get_student_balance(NEW.student_id), 2)
    WHERE id = NEW.student_id;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.sync_student_balance_from_ledger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_student_balance_from_ledger ON public.student_ledger;
CREATE TRIGGER sync_student_balance_from_ledger
AFTER INSERT OR UPDATE OR DELETE ON public.student_ledger
FOR EACH ROW
EXECUTE FUNCTION private.sync_student_balance_from_ledger();

CREATE OR REPLACE FUNCTION private.prevent_duplicate_payment_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
    v_receipt_no text;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.receipt_no IS NOT DISTINCT FROM OLD.receipt_no THEN
        RETURN NEW;
    END IF;

    v_receipt_no := NULLIF(btrim(NEW.receipt_no), '');
    IF v_receipt_no IS NULL THEN
        RETURN NEW;
    END IF;

    NEW.receipt_no := v_receipt_no;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_receipt_no, 0));

    IF EXISTS (
        SELECT 1
        FROM public.payments AS p
        WHERE p.receipt_no = v_receipt_no
          AND (TG_OP = 'INSERT' OR p.id IS DISTINCT FROM NEW.id)
    ) THEN
        RAISE EXCEPTION 'Payment receipt reference already exists: %', v_receipt_no
            USING ERRCODE = 'unique_violation';
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.prevent_duplicate_payment_receipt() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_duplicate_payment_receipt ON public.payments;
CREATE TRIGGER prevent_duplicate_payment_receipt
BEFORE INSERT OR UPDATE OF receipt_no ON public.payments
FOR EACH ROW
EXECUTE FUNCTION private.prevent_duplicate_payment_receipt();

-- Keep the event-trigger automation available to PostgreSQL itself, not as a
-- callable Data API function.
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- The view must obey the querying role's underlying table privileges/RLS.
ALTER VIEW public.event_payments_view SET (security_invoker = true);
