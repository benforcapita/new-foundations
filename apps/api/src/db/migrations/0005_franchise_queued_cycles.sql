alter table franchise_shipments drop constraint franchise_shipments_command_unique;
alter table franchise_shipments add column cycle_index integer not null default 0;
alter table franchise_shipments add constraint franchise_shipments_command_unique unique (franchise_id, command_id, cycle_index);
