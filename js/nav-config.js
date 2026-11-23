// Раскладка левого меню — ОДНА на весь сайт: её читают и оболочка (index.html), и Админ-панель («Порядок разделов в меню»),
// поэтому список в админке всегда совпадает с настоящим меню.
//   GROUPS   — пункты-папки со свёрнутыми подпунктами («Учёт клана», «ДКП»).
//   SECTIONS — разделы меню с подписями; порядок разделов фиксированный, внутри раздела пункты идут так, как их расставил
//              клан-лидер. Раздел, которого нет ни в одном списке (новый, из базы), попадает в тот, где стоит rest: true.
//   Чисто визуальное: на права доступа не влияет.
window.L2_NAV = {
  GROUPS: [
    { label: "Учёт клана", i18nKey: "navgroup.uchet", keys: ["census", "taxes", "attendance"] },
    { label: "ДКП", i18nKey: "navgroup.dkp", keys: ["loot_split", "loot_split_party", "loot_payout"] },
  ],
  SECTIONS: [
    { id: "main", i18nKey: null, label: null, keys: ["my_cabinet"] },
    { id: "clan", i18nKey: "navsec.clan", label: "Клан", keys: ["groups", "roster", "gear_check", "census", "taxes", "attendance"] },
    { id: "stats", i18nKey: "navsec.stats", label: "Статистика", keys: ["reports", "leaderboard", "trends"] },
    { id: "economy", i18nKey: "navsec.economy", label: "Экономика", keys: ["loot_split", "loot_split_party", "loot_payout"] },
    { id: "tools", i18nKey: "navsec.tools", label: "Инструменты", keys: ["skill_cd", "abilities", "skill_panel"], rest: true },
    { id: "system", i18nKey: "navsec.system", label: "Система", keys: ["admin"] },
  ],
};
