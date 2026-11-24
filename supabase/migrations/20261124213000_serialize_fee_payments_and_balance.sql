-- Serialize the fee-payment RPC and align SQL balances with the application ledger rules.
CREATE SEQUENCE IF NOT EXISTS public.payment_receipt_seq;

SELECT setval(
  'public.payment_receipt_seq',
  GREATEST(
    COALESCE((
      SELECT MAX((regexp_match(receipt_no, '^RCPT-' || to_char(CURRENT_DATE, 'YYMMDD') || '-([0-9]+)$'))[1]::bigint)
      FROM public.payments
      WHERE receipt_no ~ ('^RCPT-' || to_char(CURRENT_DATE, 'YYMMDD') || '-[0-9]+$')
    ), 0) + 1,
    1
  ),
  false
);

CREATE OR REPLACE FUNCTION public.process_student_payment(
    p_student_id text,
    p_amount numeric,
    p_zig numeric,
    p_method text,
    p_cashier text,
    p_notes text,
    p_breakdowns jsonb,
    p_ledger_entries jsonb
)
RETURNS text
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
    v_receipt_no text;
    v_ledger_id text;
    v_breakdown jsonb;
    v_ledger jsonb;
BEGIN
    IF p_student_id IS NULL OR btrim(p_student_id) = '' THEN
        RAISE EXCEPTION 'Student ID is required';
    END IF;
    IF COALESCE(p_amount, 0) < 0 OR COALESCE(p_zig, 0) < 0 THEN
        RAISE EXCEPTION 'Payment amounts cannot be negative';
    END IF;
    IF p_breakdowns IS NULL OR jsonb_typeof(p_breakdowns) <> 'array'
       OR p_ledger_entries IS NULL OR jsonb_typeof(p_ledger_entries) <> 'array' THEN
        RAISE EXCEPTION 'Invalid payment breakdown or ledger payload';
    END IF;

    PERFORM 1 FROM public.students WHERE id = p_student_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student does not exist';
    END IF;

    v_receipt_no := 'RCPT-' || to_char(CURRENT_DATE, 'YYMMDD') || '-' ||
                    lpad(nextval('public.payment_receipt_seq')::text, 8, '0');

    PERFORM pg_advisory_xact_lock(hashtextextended(v_receipt_no, 0));

    INSERT INTO public.payments (
        student_id, date, amount, zig, method, receipt_no, notes, category, status, processed_by
    ) VALUES (
        p_student_id, CURRENT_DATE, p_amount, p_zig, p_method, v_receipt_no,
        p_notes, 'Fees', 'PAID', p_cashier
    );

    FOR v_breakdown IN SELECT value FROM jsonb_array_elements(p_breakdowns)
    LOOP
        INSERT INTO public.payment_breakdowns (receipt_no, description, amount)
        VALUES (
            v_receipt_no,
            COALESCE(v_breakdown->>'description', ''),
            COALESCE((v_breakdown->>'amount')::numeric, 0)
        );
    END LOOP;

    FOR v_ledger IN SELECT value FROM jsonb_array_elements(p_ledger_entries)
    LOOP
        IF lower(COALESCE(v_ledger->>'type', '')) NOT IN
           ('payment', 'overpayment', 'discount', 'waiver', 'credit') THEN
            RAISE EXCEPTION 'Unsupported payment ledger entry type: %', v_ledger->>'type';
        END IF;

        v_ledger_id := 'LGR-' || replace(gen_random_uuid()::text, '-', '');

        INSERT INTO public.student_ledger (
            id, student_id, date, type, description, amount, zig, method,
            receipt_no, status, breakdown, processed_by
        ) VALUES (
            v_ledger_id,
            p_student_id,
            COALESCE((v_ledger->>'date')::date, CURRENT_DATE),
            v_ledger->>'type',
            COALESCE(v_ledger->>'description', p_notes, 'Payment'),
            COALESCE((v_ledger->>'amount')::numeric, 0),
            COALESCE((v_ledger->>'zig')::numeric, 0),
            p_method,
            v_receipt_no,
            'ACTIVE',
            v_ledger->'breakdown',
            p_cashier
        );
    END LOOP;

    UPDATE public.students
    SET balance_owing = public.get_student_balance(p_student_id)
    WHERE id = p_student_id;

    RETURN v_receipt_no;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_balance(p_student_id text)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $function$
    SELECT round(COALESCE(SUM(
        CASE
            WHEN lower(type) IN ('charge', 'fee') THEN amount
            WHEN lower(type) IN ('payment', 'discount', 'waiver', 'credit', 'overpayment') THEN -amount
            ELSE 0
        END
    ), 0), 2)
    FROM public.student_ledger
    WHERE student_id = p_student_id
      AND upper(COALESCE(status, 'ACTIVE')) NOT IN ('VOID', 'VOIDED', 'REVERSAL');
$function$;

GRANT USAGE, SELECT ON SEQUENCE public.payment_receipt_seq TO anon, authenticated;
