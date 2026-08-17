-- L2 Clan Cabinet — эталон иконки класса персонажа: РОВНО ОДНА иконка на профессию
-- (primary key clan_id+class_name — не журнал вырезок, не накапливается). Вырезки
-- из реальных скринов явки (js/event-roster.js) надёжнее чужого набора
-- assets/classes/*.png, который оказался ненадёжным/разнородным для сравнения.
-- Слот заполняется автоматически, только если он ещё ПУСТ (первый уверенный
-- реальный пример остаётся, пока админ сам его не заменит/не очистит в
-- Админ-панели → «Правила» → «Эталоны иконок классов») — так одна неверная
-- догадка не может тихо перезаписать уже хороший подтверждённый эталон.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)

create table public.class_icon_samples (
  clan_id uuid not null references public.clans(id) on delete cascade,
  class_name text not null,
  icon text not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (clan_id, class_name)
);

alter table public.class_icon_samples enable row level security;

create policy "class_icon_samples_select" on public.class_icon_samples for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "class_icon_samples_write_admins" on public.class_icon_samples for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
