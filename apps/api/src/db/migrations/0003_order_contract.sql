-- LLD snapshot orders include story and recovery cards, and closed
-- cards can be REROLLED or REPLACED. 0001 on databases migrated before
-- that contract only allowed easy/medium/specialized and OPEN/FULFILLED.

alter table order_instances drop constraint if exists order_instances_status_check;
alter table order_instances add constraint order_instances_status_check
  check (status in ('OPEN', 'FULFILLED', 'REROLLED', 'REPLACED'));

alter table order_instances drop constraint if exists order_instances_difficulty_check;
alter table order_instances add constraint order_instances_difficulty_check
  check (difficulty in ('easy', 'medium', 'specialized', 'story', 'recovery'));
