-- «Проверка буста»: скриншот-подсказка раздела теперь может быть своим для каждого
-- класса (например, «Скилы» — свой набор под каждый класс), тот же принцип, что уже
-- есть у подписей пунктов (boost_class_values), только со скриншотом вместо текста.
-- boost_sections.reference_image (schema_gear_check_section_image.sql) остаётся
-- запасным вариантом — используется, если для класса участника своей картинки нет.
create table if not exists public.boost_section_class_images (
  clan_id uuid not null references public.clans(id) on delete cascade,
  section_id uuid not null references public.boost_sections(id) on delete cascade,
  class_name text not null,
  image text not null,
  primary key (section_id, class_name)
);

alter table public.boost_section_class_images enable row level security;

drop policy if exists "boost_section_class_images_select" on public.boost_section_class_images;
create policy "boost_section_class_images_select" on public.boost_section_class_images for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));

drop policy if exists "boost_section_class_images_write_admins" on public.boost_section_class_images;
create policy "boost_section_class_images_write_admins" on public.boost_section_class_images for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
