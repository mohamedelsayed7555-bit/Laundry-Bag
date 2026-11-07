-- The competitor carries a good deal we did not: a shoe section, a children's
-- tier, and the heavier formal pieces that carry the best margin. Priced on the
-- same rule as the rest - 69% of theirs - so the list reads as one list.
create temp table newitem(item text, cat text, iron numeric, wash_iron numeric, dry numeric);
insert into newitem values
  -- upper body
  ('تيشيرت طويل',     'ملابس عادية',  17,  37,  null),
  ('قميص طويل',       'ملابس رسمية',  19,  38,  null),
  ('سويتر',           'ملابس عادية',  38,  60,  null),
  ('جاكيت دبل فيس',   'ملابس عادية',  79, 151,  null),
  -- formal
  ('بدلة 3 قطع',      'ملابس رسمية',  95, null, 207),
  ('عباية صوف',       'ملابس رسمية',  57,  95,  null),
  ('سالوبيت',         'ملابس عادية',  50,  80,  null),
  ('فستان خاص',       'ملابس رسمية',  95, null, 590),
  ('جلابية حريمي',    'ملابس رسمية',  30,  43,  null),
  -- swim and robes
  ('مايوه شرعي',      'ملابس رياضية', null, 64, null),
  ('روب حمام',        'مفروشات',      null, 43, null),
  -- household
  ('منديل سفرة',      'مفروشات',      15,  18,  null),
  ('فوطة صغيرة',      'مفروشات',      12,  22,  null),
  ('ملاية سرير فردي', 'مفروشات',      30,  43,  null),
  -- dry clean only
  ('بالطو شمواه',     'ملابس رسمية',  null, null, 456),
  ('جاكيت شمواه',     'ملابس رسمية',  null, null, 370),
  ('ايشارب',          'أخرى',         null, null, 43),
  ('كاب',             'أخرى',         null, null, 47),
  -- shoes: a section we did not have at all
  ('حذاء رياضة',          'أخرى', null, 141, null),
  ('حذاء شمواه أو جلد',   'أخرى', null, 173, null),
  ('بوت',                 'أخرى', null, 220, null),
  ('حذاء جلد كاجوال',     'أخرى', null, 157, null),
  ('حذاء رياضة أطفال',    'أخرى', null,  79, null),
  ('حذاء جلد أطفال',      'أخرى', null,  86, null);

-- iron, wash+iron and dry clean straight from the table above
insert into public.prices (item_type, service_type, price, is_active, category_id)
select n.item, 'iron', n.iron, true, c.id
from newitem n join public.categories c on c.name = n.cat
where n.iron is not null
  and not exists (select 1 from public.prices p where p.item_type = n.item and p.service_type = 'iron');

insert into public.prices (item_type, service_type, price, is_active, category_id)
select n.item, 'wash_iron', n.wash_iron, true, c.id
from newitem n join public.categories c on c.name = n.cat
where n.wash_iron is not null
  and not exists (select 1 from public.prices p where p.item_type = n.item and p.service_type = 'wash_iron');

insert into public.prices (item_type, service_type, price, is_active, category_id)
select n.item, 'dry_clean', n.dry, true, c.id
from newitem n join public.categories c on c.name = n.cat
where n.dry is not null
  and not exists (select 1 from public.prices p where p.item_type = n.item and p.service_type = 'dry_clean');

-- and wash at two thirds of wash+iron, the same rule the rest of the list follows
insert into public.prices (item_type, service_type, price, is_active, category_id)
select n.item, 'wash', greatest(5, round(n.wash_iron * 2.0 / 3.0)), true, c.id
from newitem n join public.categories c on c.name = n.cat
where n.wash_iron is not null
  and not exists (select 1 from public.prices p where p.item_type = n.item and p.service_type = 'wash');
