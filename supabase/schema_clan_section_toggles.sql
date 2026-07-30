-- L2 Clan Cabinet — «Разделы и права»: полное вкл/выкл раздела на весь клан,
-- отдельно от видимости по ролям (role_sections). Если раздел выключен на клан —
-- он не появится в меню ни у кого, вообще ни у одной роли, даже если у роли
-- стоит галочка "видимый" в матрице ролей.
-- Отсутствие строки = раздел включён (значение по умолчанию).
-- «Админ-панель» (section_key = 'admin') нельзя выключить — иначе некому будет
-- включить остальное обратно; это ограничение — на уровне фронта (admin.html
-- просто не даёт такую строку создать), не в самой схеме.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_clan_section_order.sql)

create table public.clan_section_toggles (
  clan_id uuid not null references public.clans(id) on delete cascade,
  section_key text not null references public.sections(key) on delete cascade,
  enabled boolean not null default true,
  primary key (clan_id, section_key)
);

alter table public.clan_section_toggles enable row level security;

-- читать нужно всем в клане: по этому флагу фильтруется навигация у любой роли
create policy "clan_section_toggles_select" on public.clan_section_toggles for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "clan_section_toggles_write_glavadmin" on public.clan_section_toggles for all
  using (
    public.is_glavadmin()
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.is_glavadmin()
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
