-- Reject UPDATE and DELETE on inventory_ledger. Inserts stay allowed.
create or replace function inventory_ledger_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'inventory_ledger is append-only';
end;
$$;

drop trigger if exists inventory_ledger_no_update on inventory_ledger;

create trigger inventory_ledger_no_update
  before update or delete on inventory_ledger
  for each row
  execute function inventory_ledger_append_only();
