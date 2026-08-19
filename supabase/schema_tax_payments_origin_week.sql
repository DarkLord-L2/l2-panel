-- L2 Clan Cabinet — «Налоги»: у отметок «Заплатил наперёд» / «Погасил долг»
-- реальные деньги переходят из рук в руки один раз, в ту неделю, когда админ
-- нажал «ОК» (даже если сама отметка ставится в tax_payments сразу на несколько
-- будущих/прошлых недель отдельными строками с их week_start). Раньше «Итого за
-- неделю» (taxes.html) считало налог по week_start — если наперёд оплачивались
-- 2 будущие недели, эти же деньги задваивались/расползались по будущим отчётам,
-- хотя реально их получили один раз, сейчас.
--
-- origin_week — «неделя происхождения» платежа: для обычной оплаты (kind='normal')
-- совпадает с week_start (кто-то заплатил за эту неделю — деньги этой неделе и
-- принадлежат), для наперёд/долга — это неделя, которая была открыта в редакторе
-- в момент нажатия «ОК» (её и настроили считать в приложении). Триггер сам
-- подставляет week_start по умолчанию, если приложение явно не передало
-- origin_week — так старый код (нормальные оплаты) не пришлось трогать.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_taxes.sql)

alter table public.tax_payments add column if not exists origin_week date;

create or replace function public.tax_payments_default_origin_week()
returns trigger language plpgsql as $$
begin
  if new.origin_week is null then
    new.origin_week := new.week_start;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tax_payments_origin_week on public.tax_payments;
create trigger trg_tax_payments_origin_week
before insert on public.tax_payments
for each row execute function public.tax_payments_default_origin_week();

-- уже существующие строки — лучшее доступное приближение (не знаем задним числом,
-- в какой неделе на самом деле отмечали старые наперёд/долг записи)
update public.tax_payments set origin_week = week_start where origin_week is null;

alter table public.tax_payments alter column origin_week set not null;

create index if not exists tax_payments_origin_week_idx on public.tax_payments(clan_id, origin_week);
