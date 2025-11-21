-- Allow promotions to target multiple products

alter table if exists public.promotions
  add column if not exists target_product_ids bigint[];

update public.promotions
set target_product_ids = array[ target_product_id ]
where target_product_id is not null
  and (target_product_ids is null or cardinality(target_product_ids) = 0);
