create index if not exists idx_student_ledger_student_status_date
  on public.student_ledger (student_id, status, date desc);

create index if not exists idx_student_ledger_receipt_no
  on public.student_ledger (receipt_no);

create index if not exists idx_student_ledger_batch_status
  on public.student_ledger (batch_id, status);

create index if not exists idx_payments_receipt_status
  on public.payments (receipt_no, status);

create index if not exists idx_payments_student_date
  on public.payments (student_id, date desc);

create index if not exists idx_transactions_receipt_status
  on public.transactions (receipt_no, status);

create index if not exists idx_transactions_student_date
  on public.transactions (student_id, date desc);

create index if not exists idx_transactions_reconciled_status
  on public.transactions (reconciled, status);

create index if not exists idx_attendance_date
  on public.attendance (date desc);

create index if not exists idx_student_ledger_date_type_status
  on public.student_ledger (date desc, type, status);

create index if not exists idx_payments_date_status
  on public.payments (date desc, status);

create index if not exists idx_students_grade_status
  on public.students (grade, status);

insert into storage.buckets (id, name, public)
values ('school-assets', 'school-assets', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('application-documents', 'application-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "school_assets_public_read" on storage.objects;
create policy "school_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'school-assets');

drop policy if exists "school_assets_authenticated_write" on storage.objects;
create policy "school_assets_authenticated_write"
  on storage.objects for insert
  with check (bucket_id = 'school-assets' and auth.role() = 'authenticated');

drop policy if exists "application_documents_authenticated_read" on storage.objects;
create policy "application_documents_authenticated_read"
  on storage.objects for select
  using (bucket_id = 'application-documents' and auth.role() = 'authenticated');

drop policy if exists "application_documents_public_upload" on storage.objects;
create policy "application_documents_public_upload"
  on storage.objects for insert
  with check (bucket_id = 'application-documents');
