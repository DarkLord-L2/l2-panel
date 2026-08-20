// Локализация сайта (UA / RU / EU=EN) — общий модуль, подключается на каждую
// страницу после supabase-client.js. Пока переведены только каркас (index.html:
// шапка, боковое меню, служебные сообщения) и login.html — остальные страницы
// переводятся отдельными заходами; для непереведённых ключей t() отдаёт fallback
// (текущий русский текст), поэтому старые страницы не ломаются.
//
// Хранение выбора языка — localStorage (как позиции окошек в Налогах, ширина
// таблиц и т.п.), без записи в БД: это личная настройка интерфейса, а не данные
// клана. Переключатель обычно живёт в шапке index.html вне iframe с контентом —
// storage-событие само доносит смену языка до уже открытого раздела без reload.

(function(){
  const LANG_KEY = "l2Lang";
  const DEFAULT_LANG = "ru";
  const HTML_LANG = { ru: "ru", ua: "uk", en: "en" };
  const SWITCH_LABEL = { ua: "UA", ru: "RU", en: "EU" };

  const DICTS = {
    ru: {
      "section.my_cabinet": "Мой кабинет",
      "section.groups": "Группы",
      "section.skill_panel": "Панель скилов",
      "section.admin": "Админ-панель",
      "section.census": "Перепись клана",
      "section.roster": "Участники клана",
      "section.attendance": "Журнал посещаемости",
      "section.taxes": "Налоги",
      "section.reports": "Отчёты по мероприятиям",
      "section.gear_check": "Проверка буста",
      "section.loot_split": "ДКП Соло",
      "section.loot_split_party": "ДКП Пати",
      "section.loot_payout": "Раздача",
      "navgroup.uchet": "Учёт клана",
      "navgroup.dkp": "ДКП",
      "shell.signOut": "Выйти",
      "shell.profileNotFoundTitle": "⚠ Профиль не найден",
      "shell.profileNotFoundHint": "Ваш логин существует, но для него не создана запись профиля. Обратитесь к клан-лидеру.",
      "shell.accessSuspendedTitle": "⛔ Доступ приостановлен",
      "shell.accessSuspendedHint": "Доступ к кабинету клана временно отключён. Обратитесь к клан-лидеру.",
      "shell.sectionNotFound": "Раздел не найден.",
      "shell.sectionComingSoon": "Этот раздел скоро появится.",
      "shell.noSectionsForRole": "Для вашей роли пока не открыто ни одного раздела.",
      "shell.defaultBrandName": "Кабинет клана",
      "login.title": "Кабинет клана",
      "login.hint": "Войдите под логином и паролем, которые вам выдал клан-лидер.",
      "login.usernameLabel": "Логин",
      "login.passwordLabel": "Пароль",
      "login.rememberMe": "Запомнить меня на этом устройстве",
      "login.submit": "Войти",
      "login.submitting": "Входим…",
      "login.error": "Неверный логин или пароль",
      "login.footnote": "Нет логина и пароля? Обратитесь к клан-лидеру.",
    },
    ua: {
      "section.my_cabinet": "Мій кабінет",
      "section.groups": "Групи",
      "section.skill_panel": "Панель скілів",
      "section.admin": "Адмін-панель",
      "section.census": "Перепис клану",
      "section.roster": "Учасники клану",
      "section.attendance": "Журнал відвідуваності",
      "section.taxes": "Податки",
      "section.reports": "Звіти по заходах",
      "section.gear_check": "Перевірка бусту",
      "section.loot_split": "ДКП Соло",
      "section.loot_split_party": "ДКП Паті",
      "section.loot_payout": "Роздача",
      "navgroup.uchet": "Облік клану",
      "navgroup.dkp": "ДКП",
      "shell.signOut": "Вийти",
      "shell.profileNotFoundTitle": "⚠ Профіль не знайдено",
      "shell.profileNotFoundHint": "Ваш логін існує, але для нього не створено запис профілю. Зверніться до лідера клану.",
      "shell.accessSuspendedTitle": "⛔ Доступ призупинено",
      "shell.accessSuspendedHint": "Доступ до кабінету клану тимчасово вимкнено. Зверніться до лідера клану.",
      "shell.sectionNotFound": "Розділ не знайдено.",
      "shell.sectionComingSoon": "Цей розділ скоро з'явиться.",
      "shell.noSectionsForRole": "Для вашої ролі поки що не відкрито жодного розділу.",
      "shell.defaultBrandName": "Кабінет клану",
      "login.title": "Кабінет клану",
      "login.hint": "Увійдіть під логіном і паролем, які вам видав лідер клану.",
      "login.usernameLabel": "Логін",
      "login.passwordLabel": "Пароль",
      "login.rememberMe": "Запам'ятати мене на цьому пристрої",
      "login.submit": "Увійти",
      "login.submitting": "Входимо…",
      "login.error": "Невірний логін або пароль",
      "login.footnote": "Немає логіна й пароля? Зверніться до лідера клану.",
    },
    en: {
      "section.my_cabinet": "My Cabinet",
      "section.groups": "Groups",
      "section.skill_panel": "Skill Panel",
      "section.admin": "Admin Panel",
      "section.census": "Clan Census",
      "section.roster": "Clan Members",
      "section.attendance": "Attendance Log",
      "section.taxes": "Taxes",
      "section.reports": "Event Reports",
      "section.gear_check": "Gear Check",
      "section.loot_split": "DKP Solo",
      "section.loot_split_party": "DKP Party",
      "section.loot_payout": "Payout",
      "navgroup.uchet": "Clan Records",
      "navgroup.dkp": "DKP",
      "shell.signOut": "Sign out",
      "shell.profileNotFoundTitle": "⚠ Profile not found",
      "shell.profileNotFoundHint": "Your login exists, but no profile record has been created for it. Contact your clan leader.",
      "shell.accessSuspendedTitle": "⛔ Access suspended",
      "shell.accessSuspendedHint": "Access to the clan cabinet is temporarily disabled. Contact your clan leader.",
      "shell.sectionNotFound": "Section not found.",
      "shell.sectionComingSoon": "This section is coming soon.",
      "shell.noSectionsForRole": "No sections are available for your role yet.",
      "shell.defaultBrandName": "Clan Cabinet",
      "login.title": "Clan Cabinet",
      "login.hint": "Sign in with the login and password your clan leader gave you.",
      "login.usernameLabel": "Login",
      "login.passwordLabel": "Password",
      "login.rememberMe": "Remember me on this device",
      "login.submit": "Sign in",
      "login.submitting": "Signing in…",
      "login.error": "Incorrect login or password",
      "login.footnote": "No login and password? Contact your clan leader.",
    },
  };

  function getLang(){
    const v = localStorage.getItem(LANG_KEY);
    return DICTS[v] ? v : DEFAULT_LANG;
  }

  function t(key, fallback){
    const lang = getLang();
    const dict = DICTS[lang] || DICTS[DEFAULT_LANG];
    if(dict[key] != null) return dict[key];
    if(DICTS[DEFAULT_LANG][key] != null) return DICTS[DEFAULT_LANG][key];
    return fallback != null ? fallback : key;
  }

  function applyTranslations(root){
    root = root || document;
    // data-i18n-fallback — на случай, если у динамически созданного элемента
    // (например, пункта меню, метка которого пришла из БД) нет перевода под
    // конкретный ключ — показываем то, что было исходно, а не голый ключ
    root.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.getAttribute("data-i18n"), el.getAttribute("data-i18n-fallback"));
    });
    // data-i18n-attr="placeholder:key.a;title:key.b" — перевод атрибутов, не textContent
    root.querySelectorAll("[data-i18n-attr]").forEach(el => {
      el.getAttribute("data-i18n-attr").split(";").forEach(pair => {
        const [attr, key] = pair.split(":").map(x => x && x.trim());
        if(attr && key) el.setAttribute(attr, t(key));
      });
    });
    document.querySelectorAll("[data-i18n-switch]").forEach(el => {
      el.classList.toggle("active", el.dataset.i18nSwitch === getLang());
    });
    document.documentElement.lang = HTML_LANG[getLang()] || "ru";
  }

  function setLang(code){
    if(!DICTS[code]) return;
    localStorage.setItem(LANG_KEY, code);
    applyTranslations();
  }

  function renderSwitcher(container){
    if(!container) return;
    container.innerHTML = Object.keys(SWITCH_LABEL).map(code =>
      `<button type="button" class="lang-switch-btn" data-i18n-switch="${code}">${SWITCH_LABEL[code]}</button>`
    ).join("");
    container.querySelectorAll(".lang-switch-btn").forEach(btn => {
      btn.addEventListener("click", () => setLang(btn.dataset.i18nSwitch));
    });
    applyTranslations();
  }

  // переключатель обычно в шапке index.html, а контент — во вложенном iframe;
  // storage-событие долетает во все same-origin окна (включая уже открытый
  // iframe), кроме того, где localStorage реально поменяли, — без postMessage
  window.addEventListener("storage", (e) => {
    if(e.key === LANG_KEY) applyTranslations();
  });

  window.L2I18n = { t, getLang, setLang, applyTranslations, renderSwitcher };
  document.addEventListener("DOMContentLoaded", () => applyTranslations());
})();
