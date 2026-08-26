// Локализация сайта (UA / RU / EU=EN) — общий модуль, подключается на каждую
// страницу после supabase-client.js. Переводится страница за страницей отдельными
// заходами; для непереведённых ключей t() отдаёт fallback (текущий русский текст),
// поэтому не тронутые ещё страницы не ломаются и не показывают голые ключи.
//
// Хранение выбора языка — localStorage (как позиции окошек в Налогах, ширина
// таблиц и т.п.), без записи в БД: это личная настройка интерфейса, а не данные
// клана. Переключатель обычно живёт в шапке index.html вне iframe с контентом —
// storage-событие само доносит смену языка до уже открытого раздела без reload.
//
// Формат словаря — один ключ сразу с тремя переводами в одной строке (а не три
// отдельных объекта по языку), чтобы добавлять новую страницу было одним проходом,
// а не тремя синхронными правками в разных местах файла.

(function(){
  const LANG_KEY = "l2Lang";
  const DEFAULT_LANG = "ru";
  const HTML_LANG = { ru: "ru", ua: "uk", en: "en" };
  const BCP47_LANG = { ru: "ru-RU", ua: "uk-UA", en: "en-US" };
  const SWITCH_LABEL = { ua: "UA", ru: "RU", en: "EU" };
  const LANGS = ["ru", "ua", "en"]; // порядок ОБЯЗАН совпадать с порядком в каждом кортеже DICT[key]

  // { key: [ru, ua, en] }
  const DICT = {
    "section.my_cabinet": ["Мой кабинет", "Мій кабінет", "My Cabinet"],
    "section.groups": ["Группы", "Групи", "Groups"],
    "section.skill_panel": ["Панель скилов", "Панель скілів", "Skill Panel"],
    "section.admin": ["Админ-панель", "Адмін-панель", "Admin Panel"],
    "section.census": ["Перепись клана", "Перепис клану", "Clan Census"],
    "section.roster": ["Участники клана", "Учасники клану", "Clan Members"],
    "section.attendance": ["Журнал посещаемости", "Журнал відвідуваності", "Attendance Log"],
    "section.taxes": ["Налоги", "Податки", "Taxes"],
    "section.reports": ["Отчёты по мероприятиям", "Звіти по заходах", "Event Reports"],
    "section.gear_check": ["Проверка буста", "Перевірка бусту", "Gear Check"],
    "section.loot_split": ["ДКП Соло", "ДКП Соло", "DKP Solo"],
    "section.loot_split_party": ["ДКП Пати", "ДКП Паті", "DKP Party"],
    "section.loot_payout": ["Раздача", "Роздача", "Payout"],
    "navgroup.uchet": ["Учёт клана", "Облік клану", "Clan Records"],
    "navgroup.dkp": ["ДКП", "ДКП", "DKP"],
    "shell.signOut": ["Выйти", "Вийти", "Sign out"],
    "shell.profileNotFoundTitle": ["⚠ Профиль не найден", "⚠ Профіль не знайдено", "⚠ Profile not found"],
    "shell.profileNotFoundHint": [
      "Ваш логин существует, но для него не создана запись профиля. Обратитесь к клан-лидеру.",
      "Ваш логін існує, але для нього не створено запис профілю. Зверніться до лідера клану.",
      "Your login exists, but no profile record has been created for it. Contact your clan leader.",
    ],
    "shell.accessSuspendedTitle": ["⛔ Доступ приостановлен", "⛔ Доступ призупинено", "⛔ Access suspended"],
    "shell.accessSuspendedHint": [
      "Доступ к кабинету клана временно отключён. Обратитесь к клан-лидеру.",
      "Доступ до кабінету клану тимчасово вимкнено. Зверніться до лідера клану.",
      "Access to the clan cabinet is temporarily disabled. Contact your clan leader.",
    ],
    "shell.sectionNotFound": ["Раздел не найден.", "Розділ не знайдено.", "Section not found."],
    "shell.sectionComingSoon": ["Этот раздел скоро появится.", "Цей розділ скоро з'явиться.", "This section is coming soon."],
    "shell.noSectionsForRole": [
      "Для вашей роли пока не открыто ни одного раздела.",
      "Для вашої ролі поки що не відкрито жодного розділу.",
      "No sections are available for your role yet.",
    ],
    "shell.defaultBrandName": ["Кабинет клана", "Кабінет клану", "Clan Cabinet"],

    "login.title": ["Кабинет клана", "Кабінет клану", "Clan Cabinet"],
    "login.hint": [
      "Войдите под логином и паролем, которые вам выдал клан-лидер.",
      "Увійдіть під логіном і паролем, які вам видав лідер клану.",
      "Sign in with the login and password your clan leader gave you.",
    ],
    "login.usernameLabel": ["Логин", "Логін", "Login"],
    "login.passwordLabel": ["Пароль", "Пароль", "Password"],
    "login.rememberMe": ["Запомнить меня на этом устройстве", "Запам'ятати мене на цьому пристрої", "Remember me on this device"],
    "login.submit": ["Войти", "Увійти", "Sign in"],
    "login.submitting": ["Входим…", "Входимо…", "Signing in…"],
    "login.error": ["Неверный логин или пароль", "Невірний логін або пароль", "Incorrect login or password"],
    "login.footnote": ["Нет логина и пароля? Обратитесь к клан-лидеру.", "Немає логіна й пароля? Зверніться до лідера клану.", "No login and password? Contact your clan leader."],

    "share.searchLabel": ["Поиск по нику", "Пошук за ніком", "Search by nickname"],
    "share.searchPlaceholder": ["Ник", "Нік", "Nickname"],
    "share.emptyHint": ["Ничего не найдено.", "Нічого не знайдено.", "Nothing found."],
    "share.invalidTitle": ["⛔ Ссылка недействительна", "⛔ Посилання недійсне", "⛔ Link is invalid"],
    "share.invalidHint": [
      "Срок действия ссылки истёк (5 дней) или она указана неверно.",
      "Термін дії посилання минув (5 днів) або воно вказане невірно.",
      "The link has expired (5 days) or is incorrect.",
    ],
    "share.validUntil": ["Ссылка действует до", "Посилання дійсне до", "Link valid until"],

    "changepw.title": ["Смена пароля", "Зміна пароля", "Change password"],
    "changepw.hint": [
      "Это ваш первый вход — придумайте новый пароль, старый (временный) больше не будет действовать.",
      "Це ваш перший вхід — придумайте новий пароль, старий (тимчасовий) більше не діятиме.",
      "This is your first login — choose a new password; the old (temporary) one will stop working.",
    ],
    "changepw.newPasswordLabel": ["Новый пароль", "Новий пароль", "New password"],
    "changepw.repeatPasswordLabel": ["Повторите пароль", "Повторіть пароль", "Repeat password"],
    "changepw.submit": ["Сохранить и войти", "Зберегти і увійти", "Save and sign in"],
    "changepw.saving": ["Сохраняем…", "Зберігаємо…", "Saving…"],
    "changepw.mismatch": ["Пароли не совпадают.", "Паролі не збігаються.", "Passwords do not match."],
    "changepw.tooShort": ["Пароль должен быть не короче 6 символов.", "Пароль має бути не коротшим за 6 символів.", "Password must be at least 6 characters."],
    "changepw.saveFailed": ["Не удалось сохранить: ", "Не вдалося зберегти: ", "Failed to save: "],

    // js/week-roster.js — общий модуль «Переписи клана» и «Налогов»; {n}/{total} —
    // простая подстановка через .replace(), без отдельного шаблонизатора
    "weekRoster.addDefault": ["+ Добавить", "+ Додати", "+ Add"],
    "weekRoster.hideUpload": ["Скрыть загрузку", "Приховати завантаження", "Hide upload"],
    "weekRoster.nothingFound": ["Ничего не найдено.", "Нічого не знайдено.", "Nothing found."],
    "weekRoster.deleteSelectedBtn": ["Удалить выбранных ({n})", "Видалити вибраних ({n})", "Delete selected ({n})"],
    "weekRoster.confirmDeleteSelected": ["Удалить выбранных: {n}?", "Видалити вибраних: {n}?", "Delete selected: {n}?"],
    "weekRoster.onlyFirst9": ["Взяты только первые 9 файлов.", "Взято лише перші 9 файлів.", "Only the first 9 files were used."],
    "weekRoster.scanning": ["Распознаю скрин {n} из {total}…", "Розпізнаю скрин {n} з {total}…", "Scanning screenshot {n} of {total}…"],
    "weekRoster.scanError": ["Скрин {n}: ", "Скрин {n}: ", "Screenshot {n}: "],
    "weekRoster.scanDone": [
      "Готово, распознано {n} ник(ов) — проверьте перед сохранением.",
      "Готово, розпізнано {n} нік(ів) — перевірте перед збереженням.",
      "Done, recognized {n} nickname(s) — review before saving.",
    ],
    "weekRoster.saveFailed": ["Не удалось сохранить: ", "Не вдалося зберегти: ", "Failed to save: "],

    "common.contactLeader": ["Обратитесь к клан-лидеру.", "Зверніться до лідера клану.", "Contact your clan leader."],
    "common.close": ["Закрыть", "Закрити", "Close"],
    "common.cancel": ["Отмена", "Скасувати", "Cancel"],
    "common.add": ["Добавить", "Додати", "Add"],
    "common.selectAll": ["Выбрать всех", "Вибрати всіх", "Select all"],
    "common.howToUse": ["Как пользоваться", "Як користуватись", "How to use"],

    "census.title": ["Перепись клана", "Перепис клану", "Clan Census"],
    "census.today": ["Сегодня", "Сьогодні", "Today"],
    "census.weekNicksPrefix": ["Ники недели (", "Ніки тижня (", "This week's nicknames ("],
    "census.weekNicksSuffix": [")", ")", ")"],
    "census.addEntry": ["+ Добавить перепись", "+ Додати перепис", "+ Add census"],
    "census.deleteMode": ["Удалить", "Видалити", "Delete"],
    "census.deleteModeTitle": ["Режим удаления списком", "Режим видалення списком", "Bulk delete mode"],
    "census.searchPlaceholder": ["Поиск по нику...", "Пошук за ніком...", "Search by nickname..."],
    "census.emptyWeek": ["На этой неделе ещё никто не загружен.", "На цьому тижні ще нікого не завантажено.", "No one has been uploaded for this week yet."],
    "census.uploadTitle": ["Загрузить скрины переписи", "Завантажити скрини перепису", "Upload census screenshots"],
    "census.uploadHint": [
      "До 9 скриншотов со списком ников. Каждый распознаётся отдельно — если один собьётся, остальные не пострадают.",
      "До 9 скриншотів зі списком ніків. Кожен розпізнається окремо — якщо один зіб'ється, інші не постраждають.",
      "Up to 9 screenshots with nickname lists. Each is recognized separately — if one fails, the rest are unaffected.",
    ],
    "census.pickFiles": ["Выбрать файлы…", "Вибрати файли…", "Choose files…"],
    "census.manualPlaceholder": ["Добавить ник вручную", "Додати нік вручну", "Add a nickname manually"],
    "census.saveWeek": ["Сохранить перепись", "Зберегти перепис", "Save census"],
    "census.helpTitle": ["Как пользоваться переписью", "Як користуватись переписом", "How to use the census"],
    "census.helpWeeksSummary": ["Недели", "Тижні", "Weeks"],
    "census.helpWeeksBody": [
      "Каждая календарная неделя (понедельник–воскресенье) — свой отдельный список участников клана. Переключайтесь между неделями стрелками ◀/▶ или кнопкой «Сегодня».",
      "Кожен календарний тиждень (понеділок–неділя) — свій окремий список учасників клану. Перемикайтесь між тижнями стрілками ◀/▶ або кнопкою «Сьогодні».",
      "Every calendar week (Monday–Sunday) has its own separate list of clan members. Switch weeks with the ◀/▶ arrows or the “Today” button.",
    ],
    "census.helpEditsSummary": ["Правки", "Правки", "Edits"],
    "census.helpEditsBody": [
      "Кнопка «Удалить» включает выбор ников для удаления — отметьте нужных (или «Выбрать всех») и подтвердите.",
      "Кнопка «Видалити» вмикає вибір ніків для видалення — відзначте потрібних (або «Вибрати всіх») і підтвердіть.",
      "The “Delete” button turns on nickname selection for removal — check the ones you want (or “Select all”) and confirm.",
    ],

    "payout.title": ["Раздача", "Роздача", "Payout"],
    "payout.fromLabel": ["С", "Від", "From"],
    "payout.toLabel": ["По", "До", "To"],
    "payout.applyBtn": ["Показать", "Показати", "Show"],
    "payout.leaderLabel": ["Пати-лидер", "Паті-лідер", "Party leader"],
    "payout.noDateHint": [
      "Даты не заданы — показывается статистика за всё время.",
      "Дати не задані — показується статистика за весь час.",
      "No dates set — showing all-time statistics.",
    ],
    "payout.noGoldHint": [
      "Голда не показана — нажмите «Раздать» в «ДКП Соло»/«ДКП Пати» сразу после «Разделить дроп».",
      "Голда не показана — натисніть «Роздати» в «ДКП Соло»/«ДКП Паті» одразу після «Розділити дроп».",
      "Gold isn't shown — click “Distribute” in “DKP Solo”/“DKP Party”, right after “Split loot”.",
    ],
    "payout.deleteBatchBtn": ["Удалить раздачу", "Видалити роздачу", "Delete distribution"],
    "payout.periodRange": [
      "Период: {from} — {to}",
      "Період: {from} — {to}",
      "Period: {from} — {to}",
    ],
    "payout.periodAllTime": [
      "Период: за всё время.",
      "Період: за весь час.",
      "Period: all time.",
    ],
    "payout.youAreLeader": [
      "Ты — пати-лидер «{nick}» за этот период.",
      "Ти — паті-лідер «{nick}» за цей період.",
      "You are the party leader “{nick}” for this period.",
    ],
    "payout.youAreNotLeader": [
      "За этот период ты не отмечен лидером ни в одном мероприятии.",
      "За цей період тебе не відмічено лідером у жодному заході.",
      "For this period you're not marked as leader in any event.",
    ],
    "payout.noActiveBatch": [
      "Сейчас нет активной раздачи от клан-лидера.",
      "Зараз немає активної роздачі від клан-лідера.",
      "There's no active distribution from the clan leader right now.",
    ],
    "payout.colNick": ["Ник", "Нік", "Nickname"],
    "payout.colTogether": ["Доли", "Частки", "Shares"],
    "payout.colShare": ["Доля от раздач", "Частка від роздач", "Share of payouts"],
    "payout.colGold": ["Голда", "Голда", "Gold"],
    "payout.copyBtn": ["📋 Скопировать ники", "📋 Скопіювати ніки", "📋 Copy nicknames"],
    "payout.copyBtnTitle": [
      "Скопировать список ников (в порядке таблицы)",
      "Скопіювати список ніків (у порядку таблиці)",
      "Copy the nickname list (in table order)",
    ],
    "payout.loadEventsFailed": ["Не удалось загрузить мероприятия: ", "Не вдалося завантажити заходи: ", "Failed to load events: "],
    "payout.loadDataFailed": ["Не удалось загрузить данные: ", "Не вдалося завантажити дані: ", "Failed to load data: "],
    "payout.payoutsCountSuffix": [" раздач", " роздач", " payouts"],
    "payout.ledCount": ["Раздач под руководством: ", "Роздач під керівництвом: ", "Payouts led: "],
    "payout.uniqueMembers": ["Разных участников: ", "Різних учасників: ", "Unique members: "],
    "payout.leaderGold": ["Себе (лидер): ", "Собі (лідер): ", "For yourself (leader): "],
    "payout.emptyForPeriod": [
      "За выбранный период нет скринов с отмеченным пати-лидером.",
      "За обраний період немає скринів з відміченим паті-лідером.",
      "No screenshots with a marked party leader for the selected period.",
    ],
    "payout.emptyNoScreens": [
      "Пока нет ни одного скрина с отмеченным пати-лидером — загрузите скрины в «Журнале посещаемости».",
      "Поки що немає жодного скрину з відміченим паті-лідером — завантажте скрини в «Журналі відвідуваності».",
      "No screenshots with a marked party leader yet — upload screenshots in the “Attendance Log”.",
    ],

    "cab.title": ["Мой кабинет", "Мій кабінет", "My Cabinet"],
    "cab.otherCabinetPrefix": ["Личный кабинет: ", "Особистий кабінет: ", "Member cabinet: "],
    "cab.backDefault": ["Назад", "Назад", "Back"],
    "cab.accessDeniedTitle": ["⛔ Доступ запрещён", "⛔ Доступ заборонено", "⛔ Access denied"],
    "cab.accessDeniedHint": [
      "У вас нет прав смотреть кабинет этого участника.",
      "У вас немає прав переглядати кабінет цього учасника.",
      "You don't have permission to view this member's cabinet.",
    ],
    "cab.noNickHint": [
      "К вашему аккаунту не привязан игровой ник — обратитесь к клан-лидеру, чтобы он указал его в Админ-панели («Пользователи» → «Ник в игре»).",
      "До вашого акаунта не прив'язаний ігровий нік — зверніться до лідера клану, щоб він вказав його в Адмін-панелі («Користувачі» → «Нік у грі»).",
      "No in-game nickname is linked to your account — ask your clan leader to set it in Admin Panel → “Users” → “In-game nickname”.",
    ],
    "cab.classNotSet": ["Класс не указан", "Клас не вказано", "Class not set"],
    "cab.statsTitle": ["Статистика по мероприятиям", "Статистика по заходах", "Event statistics"],
    "cab.periodLabel": ["Период", "Період", "Period"],
    "cab.allTime": ["Всё время", "Весь час", "All time"],
    "cab.weeksGroup": ["Недели", "Тижні", "Weeks"],
    "cab.eventsGroup": ["Мероприятия", "Заходи", "Events"],
    "cab.kills": ["Килы", "Кили", "Kills"],
    "cab.deaths": ["Смерти", "Смерті", "Deaths"],
    "cab.pvpDamage": ["PvP урон", "PvP урон", "PvP damage"],
    "cab.pveDamage": ["PvE урон", "PvE урон", "PvE damage"],
    "cab.colDate": ["Дата", "Дата", "Date"],
    "cab.colEvent": ["Мероприятие", "Захід", "Event"],
    "cab.noDataForPeriod": ["За выбранный период данных нет.", "За обраний період даних немає.", "No data for the selected period."],
    "cab.boostTitle": ["Проверка буста", "Перевірка бусту", "Gear check"],
    "cab.boostPercent": ["Процент буста: ", "Відсоток бусту: ", "Boost percent: "],
    "cab.boostNotConfigured": ["Разделы буста ещё не настроены.", "Розділи бусту ще не налаштовані.", "Boost sections haven't been configured yet."],

    "oc.title": ["Консоль", "Консоль", "Console"],
    "oc.emailLabel": ["Email", "Email", "Email"],
    "oc.passwordLabel": ["Пароль", "Пароль", "Password"],
    "oc.submit": ["Войти", "Увійти", "Sign in"],
    "oc.submitting": ["Входим…", "Входимо…", "Signing in…"],
    "oc.loginError": ["Неверный email или пароль", "Невірний email або пароль", "Incorrect email or password"],
    "oc.deniedTitle": ["⛔ Нет доступа", "⛔ Немає доступу", "⛔ No access"],
    "oc.deniedHint": ["Эта страница недоступна с этим аккаунтом.", "Ця сторінка недоступна з цим акаунтом.", "This page is not available with this account."],
    "oc.backToLogin": ["Назад ко входу", "Назад до входу", "Back to login"],
    "oc.signOut": ["Выйти", "Вийти", "Sign out"],
    "oc.newClan": ["Новый клан", "Новий клан", "New clan"],
    "oc.clanNameLabel": ["Название клана", "Назва клану", "Clan name"],
    "oc.leaderLoginLabel": ["Логин клан-лидера", "Логін лідера клану", "Clan leader login"],
    "oc.leaderLoginTitle": ["3–32 символа: латиница, цифры, - и _", "3–32 символи: латиниця, цифри, - і _", "3–32 characters: Latin letters, digits, - and _"],
    "oc.create": ["Создать", "Створити", "Create"],
    "oc.tempPassPrefix": ["Логин ", "Логін ", "Login "],
    "oc.tempPassMiddle": [", временный пароль: ", ", тимчасовий пароль: ", ", temporary password: "],
    "oc.copy": ["Скопировать", "Скопіювати", "Copy"],
    "oc.tempPassHint": [
      "Передайте это клан-лидеру — больше пароль нигде не покажется. При первом входе он сменит его сам.",
      "Передайте це лідеру клану — більше пароль ніде не покажеться. При першому вході він змінить його сам.",
      "Pass this to the clan leader — the password won't be shown again. They'll change it themselves on first login.",
    ],
    "oc.clansTitle": ["Кланы", "Клани", "Clans"],
    "oc.colName": ["Название", "Назва", "Name"],
    "oc.colLeaderLogin": ["Логин лидера", "Логін лідера", "Leader login"],
    "oc.colAccess": ["Доступ", "Доступ", "Access"],
    "oc.yes": ["Да", "Так", "Yes"],
    "oc.no": ["Нет", "Ні", "No"],
    "oc.disableAccess": ["Отключить доступ", "Вимкнути доступ", "Disable access"],
    "oc.enableAccess": ["Включить доступ", "Увімкнути доступ", "Enable access"],
    "oc.deleteClan": ["Удалить клан", "Видалити клан", "Delete clan"],
    "oc.deleteConfirmPrompt": [
      "Это НЕОБРАТИМО удалит клан «{name}» целиком: всех участников и их логины, всю перепись, группы, буст, налоги, посещаемость. Чтобы подтвердить, введите точное название клана:",
      "Це НЕЗВОРОТНО видалить клан «{name}» повністю: всіх учасників та їхні логіни, весь перепис, групи, буст, податки, відвідуваність. Щоб підтвердити, введіть точну назву клану:",
      "This will PERMANENTLY delete the clan “{name}” entirely: all members and their logins, the full census, groups, gear check, taxes, attendance. To confirm, type the exact clan name:",
    ],
    "oc.nameMismatch": ["Название не совпало — отменено.", "Назва не збіглася — скасовано.", "Name didn't match — cancelled."],
    "oc.deleteFailed": ["Не удалось удалить: ", "Не вдалося видалити: ", "Failed to delete: "],
    "oc.createFailed": ["Не удалось создать: ", "Не вдалося створити: ", "Failed to create: "],

    "common.day0": ["Пн", "Пн", "Mon"],
    "common.day1": ["Вт", "Вт", "Tue"],
    "common.day2": ["Ср", "Ср", "Wed"],
    "common.day3": ["Чт", "Чт", "Thu"],
    "common.day4": ["Пт", "Пт", "Fri"],
    "common.day5": ["Сб", "Сб", "Sat"],
    "common.day6": ["Вс", "Нд", "Sun"],

    "dkp.fromDateLabel": ["Начальная дата", "Початкова дата", "Start date"],
    "dkp.toDateLabel": ["Конечная дата", "Кінцева дата", "End date"],
    "dkp.goldLabel": ["Голда", "Голда", "Gold"],
    "dkp.splitBtn": ["Разделить дроп", "Розділити дроп", "Split loot"],
    "dkp.toPayoutBtn": ["Раздать", "Роздати", "Distribute"],
    "dkp.payoutSaveFailed": ["Не удалось отправить в раздачу: ", "Не вдалося надіслати в роздачу: ", "Failed to send to payout: "],
    "dkp.payoutSentHint": [
      "Отправлено — у каждого пати-лидера в «Раздаче» появится своя часть (на 24 часа).",
      "Надіслано — у кожного паті-лідера в «Роздачі» з'явиться своя частина (на 24 години).",
      "Sent — every party leader will see their own part in “Payout” (for 24 hours).",
    ],
    "dkp.colNick": ["Участники", "Учасники", "Members"],
    "dkp.colParty": ["Пати", "Паті", "Party"],
    "dkp.colInitial": ["Начальные баллы", "Початкові бали", "Initial points"],
    "dkp.colPct": ["% буста", "% бусту", "Boost %"],
    "dkp.colCoef": ["Коэффициент", "Коефіцієнт", "Coefficient"],
    "dkp.colFinal": ["Финальные баллы", "Фінальні бали", "Final points"],
    "dkp.emptyNoCensusMembers": [
      "В последней переписи нет участников — сначала заполните «Перепись клана».",
      "В останньому переписі немає учасників — спочатку заповніть «Перепис клану».",
      "There are no members in the latest census — fill in the “Clan Census” first.",
    ],
    "dkp.emptyNoPartiesYet": [
      "Пати ещё не заведены — сначала создайте их в разделе «Группы».",
      "Паті ще не заведені — спочатку створіть їх у розділі «Групи».",
      "No parties have been created yet — create them in the “Groups” section first.",
    ],
    "dkp.emptySetPeriod": ["Укажите период и нажмите «Разделить дроп».", "Вкажіть період і натисніть «Розділити дроп».", "Set a period and click “Split loot”."],
    "dkp.emptyNoEvents": [
      "За выбранный период нет мероприятий в «Журнале посещаемости».",
      "За обраний період немає заходів у «Журналі відвідуваності».",
      "No events in the “Attendance Log” for the selected period.",
    ],
    "dkp.emptyHiddenZeroSolo": [
      "Никто из последней переписи не ходил за этот период — настройка «Показывать только тех, кто хоть раз ходил» (Админ-панель → «Правила клана») скрыла всех.",
      "Ніхто з останнього перепису не ходив за цей період — налаштування «Показувати тільки тих, хто хоч раз ходив» (Адмін-панель → «Правила клану») сховало всіх.",
      "No one from the latest census attended during this period — the “Show only those who attended at least once” setting (Admin Panel → “Clan Rules”) hid everyone.",
    ],
    "dkp.emptyHiddenZeroParty": [
      "Ни в одной пати за этот период не было явки — настройка «Показывать только тех, кто хоть раз ходил» (Админ-панель → «Правила клана») скрыла всех.",
      "У жодній паті за цей період не було явки — налаштування «Показувати тільки тих, хто хоч раз ходив» (Адмін-панель → «Правила клану») сховало всіх.",
      "No party had any attendance during this period — the “Show only those who attended at least once” setting (Admin Panel → “Clan Rules”) hid everyone.",
    ],
    "dkp.validateBothDates": ["Укажите начальную и конечную дату.", "Вкажіть початкову і кінцеву дату.", "Set both a start and end date."],
    "dkp.validateDateOrder": ["Начальная дата позже конечной.", "Початкова дата пізніше кінцевої.", "Start date is after the end date."],
    "dkp.saveIconFailed": ["Не удалось сохранить иконку: ", "Не вдалося зберегти іконку: ", "Failed to save the icon: "],
    "dkp.leftMembersTitle": ["Вышли из клана за последнюю неделю", "Вийшли з клану за останній тиждень", "Left the clan in the last week"],
    "dkp.leftClanTitle": ["Уже не в клане", "Вже не в клані", "No longer in the clan"],
    "dkp.leftClanTitleWithDate": [
      "Уже не в клане — был в переписи от {date}",
      "Вже не в клані — був у переписі від {date}",
      "No longer in the clan — last seen in the census on {date}",
    ],
    "dkp.leftClanTitleNoHistory": [
      "Уже не в клане — в переписи вообще не встречался",
      "Вже не в клані — у переписі взагалі не зустрічався",
      "No longer in the clan — never appeared in the census at all",
    ],
    "dkp.membersCountSuffix": [" участников", " учасників", " members"],
    "dkp.leaderPrefix": [" · лидер ", " · лідер ", " · leader "],
    "dkp.noMembersInRoster": ["Участников нет.", "Учасників немає.", "No members."],

    "common.save": ["Сохранить", "Зберегти", "Save"],

    "roster.tabAlpha": ["По алфавиту", "За алфавітом", "Alphabetical"],
    "roster.tabParty": ["По пати", "По паті", "By party"],
    "roster.tabClass": ["По профессиям", "За професіями", "By class"],
    "roster.settingsTitle": ["Настройки", "Налаштування", "Settings"],
    "roster.noParty": ["Без пати", "Без паті", "No party"],
    "roster.noClass": ["Без профессии", "Без професії", "No class"],
    "roster.tagListEmpty": ["Список «{label}» пуст.", "Список «{label}» порожній.", "The “{label}” list is empty."],
    "roster.nothingFound": ["Никого не нашлось.", "Нікого не знайдено.", "No one found."],
    "roster.defaultTagLabel": ["Отдельный список", "Окремий список", "Custom list"],
    "roster.inTagList": ["В «{label}»", "У «{label}»", "In “{label}”"],
    "roster.classLabel": ["Класс", "Клас", "Class"],
    "roster.secondClassLabel": ["Вторая профессия (необязательно)", "Друга професія (необов'язково)", "Second class (optional)"],
    "roster.thirdClassLabel": ["Третья профессия (необязательно)", "Третя професія (необов'язково)", "Third class (optional)"],
    "roster.fourthClassLabel": ["Четвёртая профессия (необязательно)", "Четверта професія (необов'язково)", "Fourth class (optional)"],
    "roster.classSearchPlaceholder": ["Поиск класса...", "Пошук класу...", "Search class..."],
    "roster.levelPlaceholder": ["ур.", "рів.", "lvl"],
    "roster.levelTitle": ["Уровень, 1–85", "Рівень, 1–85", "Level, 1–85"],
    "roster.notChosenM": ["Не выбран", "Не обрано", "Not selected"],
    "roster.notChosenF": ["Не выбрана", "Не обрана", "Not selected"],
    "roster.tagSettingsTitle": ["Настройки отдельного списка", "Налаштування окремого списку", "Custom list settings"],
    "roster.tagSettingsHint": [
      "Свой список участников (например «неактивные, но в клане») — отдельная вкладка со своим названием, ставится/снимается прямо в окне класса участника.",
      "Свій список учасників (наприклад «неактивні, але в клані») — окрема вкладка зі своєю назвою, ставиться/знімається прямо у вікні класу учасника.",
      "Your own member list (e.g. “inactive but still in the clan”) — a separate tab with its own name, set/unset right in the member's class window.",
    ],
    "roster.showTagTab": ["Показывать эту вкладку", "Показувати цю вкладку", "Show this tab"],
    "roster.tagTabNameLabel": ["Название вкладки", "Назва вкладки", "Tab name"],
    "roster.tagTabNamePlaceholder": ["Например: Неактивные", "Наприклад: Неактивні", "e.g. Inactive"],
    "roster.levelRangeError": ["Уровень должен быть числом от 1 до 85 (профессия №{n}).", "Рівень має бути числом від 1 до 85 (професія №{n}).", "Level must be a number from 1 to 85 (class #{n})."],

    "common.copyListTitle": ["Скопировать список ников", "Скопіювати список ніків", "Copy the nickname list"],
    "common.dragTitle": ["Перетащить", "Перетягнути", "Drag"],
    "common.nobodyYet": ["Пока никого.", "Поки що нікого.", "No one yet."],
    "common.all": ["Все", "Всі", "All"],
    "common.ok": ["ОК", "ОК", "OK"],

    "taxes.title": ["Налоги", "Податки", "Taxes"],
    "taxes.reportBtn": ["Отчёт по налогам", "Звіт по податках", "Tax report"],
    "taxes.donationsBtn": ["Донаты", "Донати", "Donations"],
    "taxes.weekPaidPrefix": ["Заплатили на этой неделе (", "Заплатили на цьому тижні (", "Paid this week ("],
    "taxes.weekPaidSuffix": [")", ")", ")"],
    "taxes.addPayments": ["+ Добавить оплаты", "+ Додати оплати", "+ Add payments"],
    "taxes.deleteListMode": ["Удалить списком", "Видалити списком", "Bulk delete"],
    "taxes.emptyWeekPaid": ["На этой неделе ещё никто не платил.", "На цьому тижні ще ніхто не платив.", "No one has paid this week yet."],
    "taxes.totalsTitle": ["Итого за неделю", "Разом за тиждень", "Total for the week"],
    "taxes.taxLineDefault": ["Налог: —", "Податок: —", "Tax: —"],
    "taxes.donateLineDefault": ["Донат: —", "Донат: —", "Donation: —"],
    "taxes.totalLabel": ["Всего", "Разом", "Total"],
    "taxes.taxNotConfigured": [
      "Сумма налога не настроена — задайте её в Админ-панели → «Правила клана».",
      "Сума податку не налаштована — задайте її в Адмін-панелі → «Правила клану».",
      "The tax amount isn't set — set it in Admin Panel → “Clan Rules”.",
    ],
    "taxes.noDonationsThisWeek": ["На этой неделе пока никто не донатил.", "На цьому тижні поки що ніхто не донатив.", "No one has donated this week yet."],
    "taxes.allDonationsBtn": ["Все донаты →", "Усі донати →", "All donations →"],
    "taxes.aheadDebtTitle": ["Наперёд / Долг", "Наперед / Борг", "Ahead / Debt"],
    "taxes.paidAheadPrefix": ["Заплатили наперёд (", "Заплатили наперед (", "Paid ahead ("],
    "taxes.paidOffDebtPrefix": ["Погасили долг (", "Погасили борг (", "Paid off debt ("],
    "taxes.countSuffix": [")", ")", ")"],
    "taxes.uploadTitle": ["Загрузить скрины оплат", "Завантажити скрини оплат", "Upload payment screenshots"],
    "taxes.uploadHint": [
      "До 9 скриншотов со списком заплативших. Каждый распознаётся отдельно — если один собьётся, остальные не пострадают.",
      "До 9 скриншотів зі списком тих, хто заплатив. Кожен розпізнається окремо — якщо один зіб'ється, інші не постраждають.",
      "Up to 9 screenshots with the list of who paid. Each is recognized separately — if one fails, the rest are unaffected.",
    ],
    "taxes.saveBtn": ["Сохранить оплаты", "Зберегти оплати", "Save payments"],
    "taxes.whatToMark": ["Что отметить", "Що відзначити", "What to mark"],
    "taxes.paidAheadOption": ["Заплатил наперёд", "Заплатив наперед", "Paid ahead"],
    "taxes.paidOffDebtOption": ["Погасил долг", "Погасив борг", "Paid off debt"],
    "taxes.donatedOption": ["Задонатил", "Задонатив", "Donated"],
    "taxes.howManyWeeks": ["На сколько недель", "На скільки тижнів", "For how many weeks"],
    "taxes.howMuchDonated": ["Сколько задонатил", "Скільки задонатив", "How much donated"],
    "taxes.sumPlaceholder": ["Сумма", "Сума", "Amount"],
    "taxes.weeksPrefix": ["Недели: ", "Тижні: ", "Weeks: "],
    "taxes.donateSumPrompt": ["Впишите сумму доната.", "Впишіть суму донату.", "Enter the donation amount."],
    "taxes.saveFailed": ["Не удалось сохранить: ", "Не вдалося зберегти: ", "Failed to save: "],
    "taxes.donationSaved": ["✓ Ок — донат записан.", "✓ Ок — донат записано.", "✓ OK — donation recorded."],
    "taxes.alreadyMarkedAll": ["Уже отмечено на все эти недели.", "Вже відмічено на всі ці тижні.", "Already marked for all these weeks."],
    "taxes.markedWeeksCount": ["✓ Ок — отмечено недель: {n}.", "✓ Ок — відмічено тижнів: {n}.", "✓ OK — weeks marked: {n}."],
    "taxes.pickWeeksTitle": ["Выберите недели для отчёта", "Виберіть тижні для звіту", "Select weeks for the report"],
    "taxes.pickWeeksHint": [
      "Можно отметить любое количество недель, не обязательно подряд идущих.",
      "Можна відзначити будь-яку кількість тижнів, не обов'язково поспіль.",
      "You can select any number of weeks, not necessarily consecutive.",
    ],
    "taxes.noWeeksYet": ["Ещё нет ни одной недели с оплатами.", "Ще немає жодного тижня з оплатами.", "There are no weeks with payments yet."],
    "taxes.showReportBtn": ["Показать отчёт", "Показати звіт", "Show report"],
    "taxes.archiveWeeksBtn": ["Архивировать недели...", "Архівувати тижні...", "Archive weeks..."],
    "taxes.archiveTitle": ["Архивация недель", "Архівація тижнів", "Archiving weeks"],
    "taxes.archiveHint": [
      "Заархивированные недели прячутся из списка выбора выше — данные никуда не пропадают.",
      "Заархівовані тижні ховаються зі списку вибору вище — дані нікуди не зникають.",
      "Archived weeks are hidden from the selection list above — the data is not lost.",
    ],
    "taxes.backToWeeksBtn": ["← Назад к выбору недель", "← Назад до вибору тижнів", "← Back to week selection"],
    "taxes.shareLinkTitle": ["Ссылка на отчёт", "Посилання на звіт", "Report link"],
    "taxes.shareLinkHint": [
      "Доступна 5 дней, без пароля — увидит любой, у кого есть ссылка.",
      "Доступне 5 днів, без пароля — побачить будь-хто, у кого є посилання.",
      "Valid for 5 days, no password — anyone with the link can see it.",
    ],
    "taxes.createLinkFailed": ["Не удалось создать ссылку: ", "Не вдалося створити посилання: ", "Failed to create the link: "],
    "taxes.noDataForWeeks": ["Нет данных за выбранные недели.", "Немає даних за обрані тижні.", "No data for the selected weeks."],
    "taxes.shareBtn": ["Поделиться", "Поділитися", "Share"],
    "taxes.copyNicksOrderBtn": ["📋 Скопировать ники", "📋 Скопіювати ніки", "📋 Copy nicknames"],
    "taxes.copyNicksOrderTitle": [
      "Скопировать список ников (в текущем порядке/фильтре)",
      "Скопіювати список ніків (у поточному порядку/фільтрі)",
      "Copy the nickname list (current order/filter)",
    ],
    "taxes.searchNickLabel": ["Поиск по нику", "Пошук за ніком", "Search by nickname"],
    "taxes.partyLabel": ["Пати", "Паті", "Party"],
    "taxes.myPartyFallback": ["Моя пати", "Моя паті", "My party"],
    "taxes.sortLabel": ["Сортировка", "Сортування", "Sort"],
    "taxes.sortPaidDesc": ["Оплата: сначала оплатившие", "Оплата: спочатку ті, хто заплатив", "Payment: paid first"],
    "taxes.sortPaidAsc": ["Оплата: сначала должники", "Оплата: спочатку боржники", "Payment: debtors first"],
    "taxes.sortNameAsc": ["Имя: А → Я", "Ім'я: А → Я", "Name: A → Z"],
    "taxes.sortNameDesc": ["Имя: Я → А", "Ім'я: Я → А", "Name: Z → A"],
    "taxes.weekBtn": ["За неделю", "За тиждень", "This week"],
    "taxes.allTimeBtn": ["За всё время", "За весь час", "All time"],
    "taxes.copyNicksBtn": ["📋 Ники", "📋 Ніки", "📋 Nicknames"],
    "taxes.colNickname": ["Никнейм", "Нікнейм", "Nickname"],
    "taxes.colAmount": ["Сумма", "Сума", "Amount"],
    "taxes.noDonationsYet": ["Донатов ещё не было.", "Донатів ще не було.", "No donations yet."],
    "taxes.deleteTitle": ["Удалить", "Видалити", "Delete"],
    "taxes.confirmDeleteDonation": ["Удалить донат «{nick}» на {amount}?", "Видалити донат «{nick}» на {amount}?", "Delete the donation of {amount} from “{nick}”?"],
    "taxes.helpTitle": ["Как пользоваться налогами", "Як користуватись податками", "How to use taxes"],
    "taxes.helpWeeksBody": [
      "Каждая календарная неделя — свой отдельный список заплативших. Переключайтесь между неделями стрелками ◀/▶ или кнопкой «Сегодня», загружайте скрины так же, как в «Переписи клана».",
      "Кожен календарний тиждень — свій окремий список тих, хто заплатив. Перемикайтесь між тижнями стрілками ◀/▶ або кнопкою «Сьогодні», завантажуйте скрини так само, як у «Переписі клану».",
      "Every calendar week has its own separate list of who paid. Switch weeks with the ◀/▶ arrows or the “Today” button, upload screenshots the same way as in “Clan Census”.",
    ],
    "taxes.helpNickClickSummary": ["Клик по нику", "Клік по ніку", "Clicking a nickname"],
    "taxes.helpNickClickBody": [
      "<p>Открывает окно, где можно отметить <b>«Заплатил наперёд»</b> или <b>«Погасил долг»</b> и указать, на сколько недель. Ник добавится в списки следующих недель (наперёд) или предыдущих (долг) — под окном сразу видно, какие именно недели затронет. В списке недели такие ники подсвечиваются: наперёд — зелёным, долг — оранжевым.</p><p><b>«Задонатил»</b> — отдельно от недель: впишите сумму, запись попадёт в общий список донатов (кнопка «Донаты»).</p><p>Удалить ник из недели можно кнопкой «Удалить списком».</p><p>Окошко <b>«Наперёд / Долг»</b> справа от списка недели собирает всех, у кого сейчас есть такие отметки, в одном месте — клик по нику там открывает то же самое окно.</p>",
      "<p>Відкриває вікно, де можна відзначити <b>«Заплатив наперед»</b> або <b>«Погасив борг»</b> і вказати, на скільки тижнів. Нік додасться у списки наступних тижнів (наперед) або попередніх (борг) — під вікном одразу видно, які саме тижні це зачепить. У списку тижня такі ніки підсвічуються: наперед — зеленим, борг — оранжевим.</p><p><b>«Задонатив»</b> — окремо від тижнів: впишіть суму, запис потрапить до загального списку донатів (кнопка «Донати»).</p><p>Видалити нік з тижня можна кнопкою «Видалити списком».</p><p>Віконце <b>«Наперед / Борг»</b> праворуч від списку тижня збирає всіх, у кого зараз є такі відмітки, в одному місці — клік по ніку там відкриває те саме вікно.</p>",
      "<p>Opens a window where you can mark <b>“Paid ahead”</b> or <b>“Paid off debt”</b> and specify for how many weeks. The nickname is added to the following weeks' lists (ahead) or the previous ones' (debt) — the window shows exactly which weeks are affected. In the week list, such nicknames are highlighted: ahead in green, debt in orange.</p><p><b>“Donated”</b> is separate from weeks: enter the amount, the entry goes into the overall donation list (the “Donations” button).</p><p>You can remove a nickname from a week with the “Bulk delete” button.</p><p>The <b>“Ahead / Debt”</b> box to the right of the week list collects everyone who currently has such marks in one place — clicking a nickname there opens the same window.</p>",
    ],
    "taxes.helpReportSummary": ["Отчёт по налогам", "Звіт по податках", "Tax report"],
    "taxes.helpReportBody": [
      "<p>Кнопка «Отчёт по налогам» — выберите любые недели галочками и нажмите «Показать отчёт». Откроется таблица-матрица (как в отчёте «Посещаемость») на весь экран: по колонке на каждую выбранную неделю, ✓ если оплачена, плюс поиск по нику и фильтр «Пати». Таблицу можно растянуть за правый край — ширина запомнится до следующего захода. Для каждого ника посчитается, сколько раз из выбранных недель он платил, и статус:</p><ul><li><b>Новый</b> — этот ник впервые встретился в самой свежей «Переписи клана» (или его там ещё вообще нет).</li><li><b>Старый</b> — ник встречался в переписи и раньше, до самой свежей.</li></ul>",
      "<p>Кнопка «Звіт по податках» — виберіть будь-які тижні галочками і натисніть «Показати звіт». Відкриється таблиця-матриця (як у звіті «Відвідуваність») на весь екран: по колонці на кожен обраний тиждень, ✓ якщо оплачено, плюс пошук за ніком і фільтр «Паті». Таблицю можна розтягнути за правий край — ширина запам'ятається до наступного заходу. Для кожного ніка порахується, скільки разів з обраних тижнів він платив, і статус:</p><ul><li><b>Новий</b> — цей нік вперше зустрівся в найсвіжішому «Переписі клану» (або його там ще взагалі немає).</li><li><b>Старий</b> — нік зустрічався в переписі і раніше, до найсвіжішого.</li></ul>",
      "<p>The “Tax report” button — check any weeks and click “Show report”. A full-screen matrix table opens (like the “Attendance” report): one column per selected week, ✓ if paid, plus a nickname search and a “Party” filter. The table can be resized by its right edge — the width is remembered for next time. For each nickname it counts how many of the selected weeks they paid, and a status:</p><ul><li><b>New</b> — this nickname first appeared in the latest “Clan Census” (or isn't there at all yet).</li><li><b>Old</b> — the nickname appeared in the census before the latest one too.</li></ul>",
    ],
    "taxes.helpDonationsSummary": ["Донаты", "Донати", "Donations"],
    "taxes.helpDonationsBody": [
      "Кнопка «Донаты» открывает список всех записанных донатов (ник, сумма, дата). Добавляются они через клик по нику → «Задонатил» → сумма. Окошко «Донаты» справа от списка недели показывает донаты текущей недели редактора без открытия окна — «Все донаты →» открывает полный список.",
      "Кнопка «Донати» відкриває список усіх записаних донатів (нік, сума, дата). Додаються вони через клік по ніку → «Задонатив» → сума. Віконце «Донати» праворуч від списку тижня показує донати поточного тижня редактора без відкриття вікна — «Усі донати →» відкриває повний список.",
      "The “Donations” button opens the list of all recorded donations (nickname, amount, date). They're added via click on a nickname → “Donated” → amount. The “Donations” box to the right of the week list shows the current editor week's donations without opening the window — “All donations →” opens the full list.",
    ],
    "taxes.helpArchiveSummary": ["Архив недель", "Архів тижнів", "Week archive"],
    "taxes.helpArchiveBody": [
      "«Архивировать недели...» прячет старые недели из списка выбора, чтобы он не разрастался — данные при этом никуда не удаляются.",
      "«Архівувати тижні...» ховає старі тижні зі списку вибору, щоб він не розростався — дані при цьому нікуди не видаляються.",
      "“Archive weeks...” hides old weeks from the selection list so it doesn't grow indefinitely — the data itself is not deleted.",
    ],
    "taxes.selectAtLeastOneWeek": ["Выберите хотя бы одну неделю.", "Виберіть хоча б один тиждень.", "Select at least one week."],
    "taxes.colTotal": ["Итого", "Разом", "Total"],
    "taxes.colStatus": ["Статус", "Статус", "Status"],
    "taxes.statusNew": ["Новый", "Новий", "New"],
    "taxes.statusOld": ["Старый", "Старий", "Old"],
    "taxes.legendNewZero": ["Новый, 0 оплат", "Новий, 0 оплат", "New, 0 payments"],
    "taxes.legendNewSome": ["Новый, есть оплаты", "Новий, є оплати", "New, has payments"],
    "taxes.legendOldZero": ["Старый, 0 оплат", "Старий, 0 оплат", "Old, 0 payments"],
    "taxes.legendOldSome": ["Старый, частично", "Старий, частково", "Old, partial"],
    "taxes.legendOldFull": ["Старый, оплатил всё", "Старий, оплатив усе", "Old, fully paid"],
    "taxes.resizeHandleTitle": ["Потяните, чтобы изменить ширину таблицы", "Потягніть, щоб змінити ширину таблиці", "Drag to resize the table"],
    "taxes.deleteDonationTitle": ["Удалить", "Видалити", "Delete"],
    "taxes.reportShareTitle": ["Налоги", "Податки", "Taxes"],
    "taxes.taxPrefix": ["Налог: ", "Податок: ", "Tax: "],
    "taxes.donatePrefix": ["Донат: ", "Донат: ", "Donation: "],

    "groups.allGroupsTitle": ["Все группы", "Всі групи", "All groups"],
    "groups.searchPlaceholder": ["Поиск групп...", "Пошук груп...", "Search groups..."],
    "groups.hiddenGroupsBtn": ["Скрытые группы", "Приховані групи", "Hidden groups"],
    "groups.createGroupBtn": ["+ Создать группу", "+ Створити групу", "+ Create group"],
    "groups.noGroupsYet": ["Групп ещё нет.", "Груп ще немає.", "There are no groups yet."],
    "groups.backToJournal": ["← Вернуться в журнал", "← Повернутися до журналу", "← Back to the log"],
    "groups.allGroupsBack": ["← Все группы", "← Всі групи", "← All groups"],
    "groups.renameBtn": ["Переименовать", "Перейменувати", "Rename"],
    "groups.hideGroupBtn": ["Скрыть группу", "Приховати групу", "Hide group"],
    "groups.partyLeaderPrefix": ["👑 Пати лидер: ", "👑 Паті лідер: ", "👑 Party leader: "],
    "groups.notAssigned": ["не назначен", "не призначено", "not assigned"],
    "groups.deputyPrefix": ["🥈 Зам: ", "🥈 Заступник: ", "🥈 Deputy: "],
    "groups.groupIconLabel": ["Иконка группы:", "Іконка групи:", "Group icon:"],
    "groups.membersTitle": ["Участники", "Учасники", "Members"],
    "groups.noMembersYet": ["В группе пока никого нет.", "У групі поки що нікого немає.", "There's no one in the group yet."],
    "groups.nickPlaceholder": ["Ник участника", "Нік учасника", "Member nickname"],
    "groups.newGroupTitle": ["Новая группа", "Нова група", "New group"],
    "groups.nameLabel": ["Название", "Назва", "Name"],
    "groups.hiddenGroupsTitle": ["Скрытые группы", "Приховані групи", "Hidden groups"],
    "groups.hiddenGroupsHint": [
      "Скрытая группа не показывается в общем списке и в фильтрах «Пати» на других страницах, но участники и их данные никуда не деваются. Отсюда можно вернуть группу обратно либо удалить её навсегда.",
      "Прихована група не показується в загальному списку і у фільтрах «Паті» на інших сторінках, але учасники та їхні дані нікуди не діваються. Звідси можна повернути групу назад або видалити її назавжди.",
      "A hidden group isn't shown in the overall list or in “Party” filters on other pages, but the members and their data aren't lost. From here you can restore the group or delete it permanently.",
    ],
    "groups.noHiddenGroups": ["Скрытых групп нет.", "Прихованих груп немає.", "There are no hidden groups."],
    "groups.deleteForeverTitle": ["Удалить группу навсегда?", "Видалити групу назавжди?", "Delete the group permanently?"],
    "groups.deleteForeverHint": [
      "Это необратимо — участники клана никуда не денутся, но сама группа исчезнет без возможности восстановить. Чтобы подтвердить, впишите точное название группы: ",
      "Це незворотно — учасники клану нікуди не дінуться, але сама група зникне без можливості відновити. Щоб підтвердити, впишіть точну назву групи: ",
      "This is irreversible — clan members won't be affected, but the group itself will disappear with no way to restore it. To confirm, type the exact group name: ",
    ],
    "groups.deleteForeverPlaceholder": ["Название группы", "Назва групи", "Group name"],
    "groups.deleteForeverBtn": ["Удалить навсегда", "Видалити назавжди", "Delete permanently"],
    "groups.helpTitle": ["Как пользоваться группами", "Як користуватись групами", "How to use groups"],
    "groups.helpGroupsSummary": ["Группы", "Групи", "Groups"],
    "groups.helpGroupsBody": [
      "Карточки — это группы клана (например, под ивенты). Клик по карточке открывает список участников.",
      "Картки — це групи клану (наприклад, під івенти). Клік по картці відкриває список учасників.",
      "Cards are clan groups (e.g. for events). Clicking a card opens the member list.",
    ],
    "groups.helpManageSummary": ["Управление (главный админ и админ)", "Керування (головний адмін і адмін)", "Management (main admin and admin)"],
    "groups.helpManageBody1": [
      "Можно создавать группы («+ Создать группу»), переименовывать их, удалять и добавлять/убирать участников по нику (с подсказками из последней переписи).",
      "Можна створювати групи («+ Створити групу»), перейменовувати їх, видаляти і додавати/прибирати учасників за ніком (з підказками з останнього перепису).",
      "You can create groups (“+ Create group”), rename them, delete them, and add/remove members by nickname (with autocomplete from the latest census).",
    ],
    "groups.helpManageBody2": ["Остальным группы видны только для просмотра.", "Іншим групи видно лише для перегляду.", "Everyone else can only view groups."],
    "groups.helpClassesSummary": ["Классы и уровни участника", "Класи та рівні учасника", "Member classes and levels"],
    "groups.helpClassesBody1": [
      "«⋮» у карточки участника → «Класс…» открывает окно, где можно задать до четырёх профессий. Рядом с каждой — поле уровня от 1 до 85 (необязательное; поле включается, только когда профессия выбрана).",
      "«⋮» у картки учасника → «Клас…» відкриває вікно, де можна задати до чотирьох професій. Поруч із кожною — поле рівня від 1 до 85 (необов'язкове; поле вмикається, тільки коли професію обрано).",
      "“⋮” on a member card → “Class…” opens a window where you can set up to four classes. Next to each is a level field from 1 to 85 (optional; enabled only once a class is chosen).",
    ],
    "groups.helpClassesBody2": [
      "Первая профессия становится большой аватаркой участника, остальные — маленькими кружочками рядом с ней; при наведении на кружок видно название и уровень. Под ником профессии перечислены через «/» вместе с уровнями.",
      "Перша професія стає великою аватаркою учасника, інші — маленькими гуртками поруч із нею; при наведенні на гурток видно назву і рівень. Під ніком професії перелічені через «/» разом із рівнями.",
      "The first class becomes the member's large avatar, the rest become small circles next to it; hovering a circle shows its name and level. Under the nickname, classes are listed with “/” along with levels.",
    ],
    "groups.helpClassesBody3": [
      "Уровень пока показывается только здесь, в «Группах» — в отчётах и «Проверке буста» он не участвует.",
      "Рівень поки що показується тільки тут, у «Групах» — у звітах і «Перевірці бусту» він не бере участі.",
      "The level is currently only shown here, in “Groups” — it isn't used in reports or “Gear Check”.",
    ],
    "groups.avgKd": ["Ср. К/Д", "Сер. К/Д", "Avg K/D"],
    "groups.avgDamage": ["Ср. Урон", "Сер. Урон", "Avg Damage"],
    "groups.leaderNotAssignedFallback": ["лидер не назначен", "лідер не призначений", "leader not assigned"],
    "groups.membersCountSuffix": [" участников", " учасників", " members"],
    "groups.assignFailed": ["Не удалось сохранить назначение: ", "Не вдалося зберегти призначення: ", "Failed to save the assignment: "],
    "groups.partyLeaderOption": ["👑 Пати Лидер", "👑 Паті Лідер", "👑 Party Leader"],
    "groups.partyDeputyOption": ["🥈 Зам пати лидера", "🥈 Заступник паті лідера", "🥈 Deputy party leader"],
    "groups.clearAssignment": ["Снять назначение", "Зняти призначення", "Clear assignment"],
    "groups.backOption": ["← Назад", "← Назад", "← Back"],
    "groups.iconSaveFailed": ["Не удалось сохранить иконку группы: ", "Не вдалося зберегти іконку групи: ", "Failed to save the group icon: "],
    "groups.showBoost": ["Показать буст", "Показати буст", "Show gear check"],
    "groups.myCabinetOption": ["Личный кабинет", "Особистий кабінет", "Member cabinet"],
    "groups.classOption": ["Класс…", "Клас…", "Class…"],
    "groups.assignOption": ["Назначить…", "Призначити…", "Assign…"],
    "groups.moveOption": ["Переместить в группу…", "Перемістити в групу…", "Move to group…"],
    "groups.removeOption": ["Убрать из группы", "Прибрати з групи", "Remove from group"],
    "groups.actionsTitle": ["Действия", "Дії", "Actions"],
    "groups.dragToSwapTitle": [
      "Перетащите на другого участника, чтобы поменять местами",
      "Перетягніть на іншого учасника, щоб поміняти місцями",
      "Drag onto another member to swap places",
    ],
    "groups.noOtherGroups": ["Других групп нет.", "Інших груп немає.", "There are no other groups."],
    "groups.alreadyInGroup": ["«{nick}» уже есть в этой группе.", "«{nick}» вже є в цій групі.", "“{nick}” is already in this group."],
    "groups.moveFailed": ["Не удалось переместить: ", "Не вдалося перемістити: ", "Failed to move: "],
    "groups.partyLeaderTitle": ["Пати лидер", "Паті лідер", "Party leader"],
    "groups.partyDeputyTitle": ["Зам пати лидера", "Заступник паті лідера", "Deputy party leader"],
    "groups.enterNamePrompt": ["Введите название.", "Введіть назву.", "Enter a name."],
    "groups.nameCannotBeEmpty": ["Название не может быть пустым.", "Назва не може бути порожньою.", "Name cannot be empty."],
    "groups.confirmHide": [
      "Скрыть группу «{name}»? Она пропадёт из общего списка и фильтров «Пати», но данные участников сохранятся — вернуть или удалить навсегда можно в «Скрытые группы».",
      "Приховати групу «{name}»? Вона зникне із загального списку і фільтрів «Паті», але дані учасників збережуться — повернути або видалити назавжди можна в «Прихованих групах».",
      "Hide the group “{name}”? It will disappear from the overall list and “Party” filters, but member data will be kept — you can restore or permanently delete it in “Hidden groups”.",
    ],
    "groups.showBtn": ["Показать", "Показати", "Show"],
    "groups.nickAlreadyInGroup": ["Этот ник уже в группе.", "Цей нік вже в групі.", "This nickname is already in the group."],
    "groups.classFieldLabel": ["Класс", "Клас", "Class"],
    "groups.secondClassLabel": ["Вторая профессия (необязательно)", "Друга професія (необов'язково)", "Second profession (optional)"],
    "groups.thirdClassLabel": ["Третья профессия (необязательно)", "Третя професія (необов'язково)", "Third profession (optional)"],
    "groups.fourthClassLabel": ["Четвёртая профессия (необязательно)", "Четверта професія (необов'язково)", "Fourth profession (optional)"],
    "groups.levelPlaceholder": ["ур.", "рів.", "lvl"],
    "groups.levelTitle": ["Уровень, 1–85", "Рівень, 1–85", "Level, 1–85"],
    "groups.levelRangeError": [
      "Уровень должен быть числом от 1 до 85 (профессия №{n}).",
      "Рівень має бути числом від 1 до 85 (професія №{n}).",
      "Level must be a number from 1 to 85 (profession #{n}).",
    ],

    "role.glavadmin": ["Клан-лидер", "Лідер клану", "Clan Leader"],
    "role.admin": ["Админ", "Адмін", "Admin"],
    "role.sredniy": ["Средний", "Середній", "Intermediate"],
    "role.obychniy": ["Обычный", "Звичайний", "Regular"],

    "admin.title": ["Админ-панель", "Адмін-панель", "Admin Panel"],
    "admin.tabUsers": ["Пользователи", "Користувачі", "Users"],
    "admin.tabSections": ["Разделы и права", "Розділи та права", "Sections and permissions"],
    "admin.tabRules": ["Налоги", "Податки", "Taxes"],
    "admin.tabMisc": ["Разное", "Різне", "Misc"],
    "admin.tabDkp": ["ДКП", "ДКП", "DKP"],
    "admin.tabBranding": ["Оформление", "Оформлення", "Branding"],
    "admin.tabShares": ["Ссылки", "Посилання", "Links"],

    "admin.roleNamesTitle": ["Названия ролей", "Назви ролей", "Role names"],
    "admin.roleNamesHint": [
      "Своё название роли только для вашего клана — права и ранг не меняются, меняется только то, как роль называется на экране. Пусто — используется название по умолчанию (слева).",
      "Своя назва ролі тільки для вашого клану — права і ранг не змінюються, змінюється тільки те, як роль називається на екрані. Порожньо — використовується назва за замовчуванням (зліва).",
      "A custom role name for your clan only — permissions and rank don't change, only how the role is displayed. Empty — uses the default name (shown on the left).",
    ],
    "admin.newUserTitle": ["Новый пользователь", "Новий користувач", "New user"],
    "admin.loginLabel": ["Логин", "Логін", "Login"],
    "admin.loginTitle": ["3–32 символа: латиница, цифры, - и _", "3–32 символи: латиниця, цифри, - і _", "3–32 characters: Latin letters, digits, - and _"],
    "admin.passwordLabel": ["Пароль", "Пароль", "Password"],
    "admin.nicknameOptionalLabel": ["Ник в игре (необязательно)", "Нік у грі (необов'язково)", "In-game nickname (optional)"],
    "admin.nicknameAnyPlaceholder": ["Любой, хоть кириллицей", "Будь-який, хоч кирилицею", "Any, Cyrillic is fine too"],
    "admin.roleLabel": ["Роль", "Роль", "Role"],
    "admin.partyOptionalLabel": ["Пати (необязательно)", "Паті (необов'язково)", "Party (optional)"],
    "admin.createBtn": ["Создать", "Створити", "Create"],
    "admin.usersTitle": ["Пользователи", "Користувачі", "Users"],
    "admin.groupByLabel": ["Группировать по:", "Групувати за:", "Group by:"],
    "admin.groupByParty": ["Пати", "Паті", "Party"],
    "admin.groupByRole": ["Роль", "Роль", "Role"],
    "admin.colLogin": ["Логин", "Логін", "Login"],
    "admin.colNickname": ["Ник в игре", "Нік у грі", "In-game nickname"],
    "admin.colRole": ["Роль", "Роль", "Role"],
    "admin.colParty": ["Пати", "Паті", "Party"],
    "admin.colProtection": ["Защита", "Захист", "Protection"],
    "admin.colCreated": ["Создан", "Створено", "Created"],

    "admin.weeklyTaxTitle": ["Налог за неделю", "Податок за тиждень", "Weekly tax"],
    "admin.weeklyTaxHint": [
      "Сумма налога с одного человека за неделю. Используется в окошке «Итого за неделю» на странице «Налоги» — просто множится на число заплативших и складывается с донатами, саму отметку «кто платил» это не меняет.",
      "Сума податку з однієї людини за тиждень. Використовується у віконці «Разом за тиждень» на сторінці «Податки» — просто множиться на кількість тих, хто заплатив, і додається до донатів, саму позначку «хто платив» це не змінює.",
      "Weekly tax amount per person. Used in the “Total for the week” box on the “Taxes” page — it's simply multiplied by the number of payers and added to donations; it doesn't change the “who paid” marks themselves.",
    ],
    "admin.amountPerPersonLabel": ["Сумма с человека", "Сума з людини", "Amount per person"],
    "admin.dkpSectionsTitle": ["Включённые разделы ДКП", "Увімкнені розділи ДКП", "Enabled DKP sections"],
    "admin.dkpSectionsHint": [
      "Полностью выключает раздел для всего клана — исчезает из меню у абсолютно всех, независимо от роли (та же настройка, что в «Разделы и права» → «Какие разделы вообще есть», просто отдельно и под рукой здесь).",
      "Повністю вимикає розділ для всього клану — зникає з меню в абсолютно всіх, незалежно від ролі (те саме налаштування, що в «Розділи і права» → «Які розділи взагалі є», просто окремо і під рукою тут).",
      "Fully disables the section for the whole clan — disappears from everyone's menu, regardless of role (the same setting as “Sections & Permissions” → “Which sections exist at all”, just kept handy here separately).",
    ],
    "admin.lootSplitSectionTitle": ["Раздел дропа", "Розділ дропу", "Loot split section"],
    "admin.lootHideZeroLabel": ["Показывать только тех, кто хоть раз ходил за отмеченный период", "Показувати тільки тих, хто хоч раз ходив за позначений період", "Only show those who attended at least once in the selected period"],
    "admin.lootHideZeroHint": [
      "Выключено — виден весь состав из последней переписи, даже с 0 начальных баллов. Включено — те, у кого начальных баллов 0, из таблицы пропадают.",
      "Вимкнено — видно весь склад з останнього перепису, навіть з 0 початкових балів. Увімкнено — ті, у кого початкових балів 0, зникають з таблиці.",
      "Off — the full roster from the latest census is shown, even with 0 starting points. On — those with 0 starting points disappear from the table.",
    ],
    "admin.minBoostTitle": ["Минимальный % буста", "Мінімальний % бусту", "Minimum boost %"],
    "admin.minBoostHint": [
      "Применяется только к тем, у кого в «Проверке буста» не отмечено вообще ничего (реальный % = 0) — вместо 0% используется этот минимум, в том числе в «ДКП Соло»/«ДКП Пати». Как только у человека отмечен хоть один пункт — минимум отменяется, используется его настоящий процент, даже если он ниже минимума. 0 — выключено.",
      "Застосовується тільки до тих, у кого в «Перевірці бусту» не відмічено взагалі нічого (реальний % = 0) — замість 0% використовується цей мінімум, у тому числі в «ДКП Соло»/«ДКП Паті». Щойно у людини відмічено хоч один пункт — мінімум скасовується, використовується її справжній відсоток, навіть якщо він нижчий за мінімум. 0 — вимкнено.",
      "Applies only to those with nothing checked at all in “Gear Check” (real % = 0) — instead of 0%, this minimum is used, including in “DKP Solo”/“DKP Party”. As soon as even one item is checked, the minimum is dropped and their real percentage is used, even if it's lower than the minimum. 0 = disabled.",
    ],
    "admin.minBoostLabel": ["Минимальный %", "Мінімальний %", "Minimum %"],
    "admin.minBoostRange": ["Число от 0 до 100.", "Число від 0 до 100.", "A number from 0 to 100."],
    "admin.payoutShowLeftTitle": ["Ушедшие из клана в «Раздаче»", "Ті, хто вийшов з клану, у «Роздачі»", "Members who left the clan, in “Payout”"],
    "admin.payoutShowLeftLabel": ["Показывать в списке тех, кто уже вышел из клана", "Показувати у списку тих, хто вже вийшов з клану", "Show those who already left the clan in the list"],
    "admin.payoutShowLeftHint": [
      "Их голда всегда делится поровну между оставшимися в клане в том же списке лидера — этот переключатель влияет только на то, видна ли сама строка ушедшего (с его исходной, ещё не поделённой суммой, для справки). Выключено — строка просто скрыта, деление остаётся тем же.",
      "Їхня голда завжди ділиться порівну між тими, хто лишився в клані, у тому самому списку лідера — цей перемикач впливає тільки на те, чи видно саму строку того, хто вийшов (з його вихідною, ще не поділеною сумою, для довідки). Вимкнено — рядок просто прихований, поділ лишається тим самим.",
      "Their gold is always split evenly among those still in the clan within the same leader's list — this toggle only controls whether the departed member's own row is shown (with their original, not-yet-split amount, for reference). Off — the row is simply hidden, the split stays the same.",
    ],
    "admin.leaderCoefTitle": ["Коэффициент пати-лидерам", "Коефіцієнт паті-лідерам", "Party leader coefficient"],
    "admin.leaderCoefHint": [
      "Свой множитель для каждого текущего пати-лидера (Группы → лидер) — коэффициенты не складываются: у лидера этот множитель ЗАМЕНЯЕТ собой коэффициент профессии, а не добавляется поверх него. На саму пати и на «ДКП Соло» не влияет. Список — по тем, кто прямо сейчас отмечен лидером хоть одной пати; нет строки — считается как 1.",
      "Свій множник для кожного поточного паті-лідера (Групи → лідер) — коефіцієнти не складаються: у лідера цей множник ЗАМІНЮЄ собою коефіцієнт професії, а не додається поверх нього. На саму паті і на «ДКП Соло» не впливає. Список — за тими, хто прямо зараз відмічений лідером хоч однієї паті; немає рядка — вважається як 1.",
      "A separate multiplier for each current party leader (Groups → leader) — coefficients don't stack: for the leader this multiplier REPLACES their class coefficient instead of adding on top of it. Does not affect the party itself or “DKP Solo”. The list is built from whoever is currently set as a party's leader; no row — treated as 1.",
    ],
    "admin.leaderCoefEmpty": [
      "Ни в одной пати пока не назначен лидер (Группы → лидер).",
      "Жодній паті поки що не призначено лідера (Групи → лідер).",
      "No party has a leader assigned yet (Groups → leader).",
    ],
    "admin.classCoefSoloTitle": ["Коэффициент профессии для «ДКП Соло»", "Коефіцієнт професії для «ДКП Соло»", "Class coefficient for “DKP Solo”"],
    "admin.classCoefSoloHint": [
      "У каждой профессии свой множитель: финальные баллы участника = начальные баллы × % буста × этот коэффициент. Нет строки для класса — считается как 1.",
      "У кожної професії свій множник: фінальні бали учасника = початкові бали × % бусту × цей коефіцієнт. Немає рядка для класу — вважається як 1.",
      "Each class has its own multiplier: a member's final points = starting points × boost % × this coefficient. No row for a class — treated as 1.",
    ],
    "admin.classCoefPartyTitle": ["Коэффициент пати для «ДКП Пати»", "Коефіцієнт паті для «ДКП Паті»", "Party coefficient for “DKP Party”"],
    "admin.classCoefPartyHint": [
      "У каждой пати свой множитель: финальные баллы пати = начальные баллы × % буста × этот коэффициент. Нет строки для пати — считается как 1.",
      "У кожної паті свій множник: фінальні бали паті = початкові бали × % бусту × цей коефіцієнт. Немає рядка для паті — вважається як 1.",
      "Each party has its own multiplier: a party's final points = starting points × boost % × this coefficient. No row for a party — treated as 1.",
    ],

    "admin.sectionsExistTitle": ["Какие разделы вообще есть", "Які розділи взагалі є", "Which sections exist at all"],
    "admin.sectionsExistHint": [
      "Полностью выключает раздел для всего клана — исчезает из меню у абсолютно всех, независимо от роли и от галочек в матрице ниже. «Админ-панель» выключить нельзя — иначе некому будет включить остальное обратно.",
      "Повністю вимикає розділ для всього клану — зникає з меню в абсолютно всіх, незалежно від ролі і від галочок у матриці нижче. «Адмін-панель» вимкнути не можна — інакше нікому буде увімкнути решту назад.",
      "Fully disables a section for the whole clan — it disappears from the menu for absolutely everyone, regardless of role or the checkboxes in the matrix below. “Admin Panel” can't be disabled — otherwise no one could turn the rest back on.",
    ],
    "admin.sectionOrderTitle": ["Порядок разделов в меню", "Порядок розділів у меню", "Section order in the menu"],
    "admin.sectionOrderHint": [
      "Стрелками ▲▼ переставьте пункты — в таком порядке они будут идти в левом меню у всех в клане. «Учёт клана» двигается целиком, вместе со своими подпунктами.",
      "Стрілками ▲▼ переставте пункти — у такому порядку вони будуть йти в лівому меню в усіх у клані. «Облік клану» рухається цілком, разом зі своїми підпунктами.",
      "Use the ▲▼ arrows to reorder items — they'll appear in that order in the left menu for everyone in the clan. “Clan Records” moves as a whole, together with its sub-items.",
    ],
    "admin.orderSaved": ["Порядок сохранён.", "Порядок збережено.", "Order saved."],
    "admin.reloadMenu": ["Обновить меню", "Оновити меню", "Reload menu"],
    "admin.moveUp": ["Выше", "Вище", "Move up"],
    "admin.moveDown": ["Ниже", "Нижче", "Move down"],
    "admin.roleSectionsTitle": ["Какие разделы видит каждая роль", "Які розділи бачить кожна роль", "Which sections each role sees"],
    "admin.roleSectionsHint": [
      "Снимите галочку — раздел исчезнет из навигации у всех с этой ролью. Админ-панель всегда видна только главному админу.",
      "Зніміть галочку — розділ зникне з навігації в усіх із цією роллю. Адмін-панель завжди видна тільки головному адміну.",
      "Uncheck the box — the section disappears from navigation for everyone with that role. The Admin Panel is always visible only to the main admin.",
    ],
    "admin.roleColHeader": ["Роль", "Роль", "Role"],

    "admin.colorSchemeTitle": ["Цветовая схема", "Кольорова схема", "Color scheme"],
    "admin.colorSchemeHint": [
      "Общий тёмный фон везде одинаковый, меняется только акцентный цвет (заголовки, ссылки, кнопки). Применяется сразу всем в клане.",
      "Загальний темний фон скрізь однаковий, змінюється тільки акцентний колір (заголовки, посилання, кнопки). Застосовується одразу всім у клані.",
      "The overall dark background stays the same everywhere — only the accent color changes (headings, links, buttons). Applied to everyone in the clan at once.",
    ],
    "admin.customAccentTitle": ["Свой акцентный цвет", "Свій акцентний колір", "Custom accent color"],
    "admin.customAccentHint": [
      "Необязательно — точечно подменяет цвет акцента поверх выбранной схемы выше, если хочется свой конкретный оттенок.",
      "Необов'язково — точково підмінює колір акценту поверх обраної схеми вище, якщо хочеться свого конкретного відтінку.",
      "Optional — selectively overrides the accent color on top of the scheme chosen above, if you want your own specific shade.",
    ],
    "admin.colorLabel": ["Цвет", "Колір", "Color"],
    "admin.resetToSchemeBtn": ["Сбросить к схеме", "Скинути до схеми", "Reset to scheme"],
    "admin.nameAndLogoTitle": ["Название и лого", "Назва і лого", "Name and logo"],
    "admin.nameAndLogoHint": [
      "Подменяет заголовок «Кабинет клана» в шапке сайта и логине. Оставьте пустым, чтобы использовать значение по умолчанию.",
      "Підмінює заголовок «Кабінет клану» в шапці сайту і логіні. Залиште порожнім, щоб використовувати значення за замовчуванням.",
      "Overrides the “Clan Cabinet” title in the site header and login. Leave empty to use the default.",
    ],
    "admin.cabinetNameLabel": ["Название кабинета", "Назва кабінету", "Cabinet name"],
    "admin.logoUrlLabel": ["Ссылка на лого (URL)", "Посилання на лого (URL)", "Logo link (URL)"],
    "admin.uploadPhotoBtn": ["Загрузить фото", "Завантажити фото", "Upload photo"],
    "admin.removeBtn": ["Убрать", "Прибрати", "Remove"],
    "admin.saved": ["Сохранено.", "Збережено.", "Saved."],

    "admin.activeSharesTitle": ["Активные ссылки «Поделиться»", "Активні посилання «Поділитися»", "Active “Share” links"],
    "admin.activeSharesHint": [
      "Публичные ссылки на снимки отчётов (Посещаемость, Налоги) — живут 5 дней с момента создания, дальше пропадают сами. Здесь можно удалить ссылку раньше срока.",
      "Публічні посилання на знімки звітів (Відвідуваність, Податки) — живуть 5 днів з моменту створення, далі зникають самі. Тут можна видалити посилання раніше строку.",
      "Public links to report snapshots (Attendance, Taxes) — they live for 5 days from creation, then disappear on their own. You can delete a link early here.",
    ],
    "admin.colSection": ["Раздел", "Розділ", "Section"],
    "admin.colLink": ["Ссылка", "Посилання", "Link"],
    "admin.colCreatedAt": ["Создана", "Створено", "Created"],
    "admin.colExpires": ["Истекает", "Спливає", "Expires"],
    "admin.noActiveShares": ["Активных ссылок нет.", "Активних посилань немає.", "There are no active links."],

    "admin.accessDeniedTitle": ["⛔ Нет доступа", "⛔ Немає доступу", "⛔ Access denied"],
    "admin.accessDeniedHint": ["Эта страница только для главного админа.", "Ця сторінка тільки для головного адміна.", "This page is for the main admin only."],

    "admin.saveFailed": ["Не удалось сохранить: ", "Не вдалося зберегти: ", "Failed to save: "],
    "admin.amountMustBeNonNegative": ["Сумма должна быть числом ≥ 0.", "Сума має бути числом ≥ 0.", "The amount must be a number ≥ 0."],
    "admin.coefMustBeNonNegative": ["Коэффициент должен быть числом ≥ 0.", "Коефіцієнт має бути числом ≥ 0.", "The coefficient must be a number ≥ 0."],
    "admin.createUserFailed": ["Не удалось создать: ", "Не вдалося створити: ", "Failed to create: "],
    "admin.userCreated": ["Пользователь «{name}» создан.", "Користувача «{name}» створено.", "User “{name}” created."],
    "admin.saveNickFailed": ["Не удалось сохранить ник: ", "Не вдалося зберегти нік: ", "Failed to save nickname: "],
    "admin.changeRoleFailed": ["Не удалось изменить роль: ", "Не вдалося змінити роль: ", "Failed to change role: "],
    "admin.changePartyFailed": ["Не удалось изменить пати: ", "Не вдалося змінити паті: ", "Failed to change party: "],
    "admin.protectedBadge": ["🔒 Защищён", "🔒 Захищено", "🔒 Protected"],
    "admin.removeProtectionBtn": ["Снять защиту", "Зняти захист", "Remove protection"],
    "admin.removeProtectionTitle": ["Пароль, которым ставили защиту, или мастер-сид-фраза", "Пароль, яким ставили захист, або майстер-сід-фраза", "The password used to set protection, or the master seed phrase"],
    "admin.removeProtectionPrompt": ["Снять защиту с «{name}»? Введите пароль защиты (или сид-фразу):", "Зняти захист з «{name}»? Введіть пароль захисту (або сід-фразу):", "Remove protection from “{name}”? Enter the protection password (or seed phrase):"],
    "admin.removeProtectionFailed": ["Не удалось снять защиту: ", "Не вдалося зняти захист: ", "Failed to remove protection: "],
    "admin.protectBtn": ["🔒 Защитить", "🔒 Захистити", "🔒 Protect"],
    "admin.protectBtnTitle": ["Защитить свой аккаунт от удаления другими главными админами", "Захистити свій акаунт від видалення іншими головними адмінами", "Protect your account from deletion by other main admins"],
    "admin.setProtectionPrompt": [
      "Придумайте пароль для защиты своего аккаунта от удаления (запомните — он понадобится, чтобы снять защиту):",
      "Придумайте пароль для захисту свого акаунта від видалення (запам'ятайте — він знадобиться, щоб зняти захист):",
      "Come up with a password to protect your account from deletion (remember it — you'll need it to remove protection):",
    ],
    "admin.setProtectionFailed": ["Не удалось включить защиту: ", "Не вдалося увімкнути захист: ", "Failed to enable protection: "],
    "admin.deleteBtn": ["Удалить", "Видалити", "Delete"],
    "admin.confirmDeleteUser": ["Удалить пользователя «{name}»? Это необратимо.", "Видалити користувача «{name}»? Це незворотно.", "Delete user “{name}”? This is irreversible."],
    "admin.deleteProtectedPrompt": ["«{name}» защищён от удаления. Введите пароль защиты (или сид-фразу):", "«{name}» захищений від видалення. Введіть пароль захисту (або сід-фразу):", "“{name}” is protected from deletion. Enter the protection password (or seed phrase):"],
    "admin.deleteFailed": ["Не удалось удалить: ", "Не вдалося видалити: ", "Failed to delete: "],

    "admin.presetDefault": ["Классика", "Класика", "Classic"],
    "admin.presetAmber": ["Янтарь", "Бурштин", "Amber"],
    "admin.presetAzure": ["Лазурь", "Лазур", "Azure"],
    "admin.presetEmerald": ["Изумруд", "Смарагд", "Emerald"],

    "admin.unknownRole": ["Неизвестная роль", "Невідома роль", "Unknown role"],
    "admin.hiddenParty": ["Скрытая пати", "Прихована паті", "Hidden party"],
    "admin.noRole": ["Без роли", "Без ролі", "No role"],
    "admin.noParty": ["Без пати", "Без паті", "No party"],

    "panel.title": ["Панель скилов", "Панель скілів", "Skill Panel"],
    "panel.menuBtnTitle": ["Меню", "Меню", "Menu"],
    "panel.menuAddIcons": ["Добавить иконки", "Додати іконки", "Add icons"],
    "panel.menuAddMacro": ["➕ Добавить макрос", "➕ Додати макрос", "➕ Add macro"],
    "panel.menuExport": ["Экспорт в файл", "Експорт у файл", "Export to file"],
    "panel.menuImport": ["Импорт из файла", "Імпорт з файлу", "Import from file"],
    "panel.menuClearAll": ["Очистить панель класса", "Очистити панель класу", "Clear the class panel"],
    "panel.raceTitle": ["Раса", "Раса", "Race"],
    "panel.classTitle": ["Класс", "Клас", "Class"],
    "panel.shareBtn": ["Поделиться", "Поділитися", "Share"],
    "panel.shareBtnTitle": ["Скопировать ссылку на раскладку", "Скопіювати посилання на розкладку", "Copy a link to the layout"],
    "panel.arrowUpTitle": ["Открыть ряд выше", "Відкрити ряд вище", "Open the row above"],
    "panel.arrowDownTitle": ["Скрыть верхний ряд", "Сховати верхній ряд", "Hide the top row"],
    "panel.mainGripTitle": ["Перетащить панель (двойной клик — вернуть на место)", "Перетягнути панель (подвійний клік — повернути на місце)", "Drag the panel (double-click to reset position)"],
    "panel.floatsBtnTitle": ["Доп. панели 11–13: добавить / убрать", "Дод. панелі 11–13: додати / прибрати", "Extra panels 11–13: add / remove"],
    "panel.orientBtnTitle": ["Горизонтально / вертикально", "Горизонтально / вертикально", "Horizontal / vertical"],
    "panel.lockBtnTitle": ["Закрыть панель (замок)", "Закрити панель (замок)", "Lock the panel"],
    "panel.libCollapseExpandTitle": ["Развернуть панель иконок", "Розгорнути панель іконок", "Expand the icon panel"],
    "panel.libCollapseCollapseTitle": ["Свернуть панель иконок", "Згорнути панель іконок", "Collapse the icon panel"],
    "panel.libTrashBtnTitle": ["Показать/скрыть удаление иконок", "Показати/сховати видалення іконок", "Show/hide icon deletion"],
    "panel.myMacros": ["Мои макросы", "Мої макроси", "My macros"],

    "panel.addIconsTitle": ["Добавить иконки", "Додати іконки", "Add icons"],
    "panel.scopeClass": ["Для одного класса", "Для одного класу", "For one class"],
    "panel.scopeGlobal": ["Общая для всех классов", "Спільна для всіх класів", "Shared across all classes"],
    "panel.groupHeading": ["Группа", "Група", "Group"],
    "panel.newGroupNamePlaceholder": ["Название новой группы", "Назва нової групи", "New group name"],
    "panel.pickFilesBtn": ["Выбрать файлы…", "Вибрати файли…", "Choose files…"],
    "panel.newGroupOption": ["➕ Новая группа…", "➕ Нова група…", "➕ New group…"],

    "panel.newMacroTitle": ["Новый макрос", "Новий макрос", "New macro"],
    "panel.macroIntro": [
      "Макросы может создавать любой, кто открыл панель — они хранятся только у вас в браузере. А вот иконки для них выдаёт владелец панели.",
      "Макроси може створювати будь-хто, хто відкрив панель — вони зберігаються тільки у вас у браузері. А от іконки для них видає власник панелі.",
      "Anyone who opens the panel can create macros — they're stored only in your browser. But the icons for them are supplied by the panel's owner.",
    ],
    "panel.iconHeading": ["Иконка", "Іконка", "Icon"],
    "panel.addMacroIconBtn": ["+ Добавить иконку для макросов", "+ Додати іконку для макросів", "+ Add an icon for macros"],
    "panel.macroIconHint": [
      "Пополнить этот набор может только владелец панели — если нужной иконки нет, обратитесь к нему.",
      "Поповнити цей набір може тільки власник панелі — якщо потрібної іконки немає, зверніться до нього.",
      "Only the panel's owner can add to this set — if the icon you need isn't there, contact them.",
    ],
    "panel.nameHeading": ["Название", "Назва", "Name"],
    "panel.macroNamePlaceholder": ["Например: Бафф-сет", "Наприклад: Бафф-сет", "E.g.: Buff set"],
    "panel.macroTextHeading": ["Текст (до 12 строк, каждая до 25 символов)", "Текст (до 12 рядків, кожен до 25 символів)", "Text (up to 12 lines, up to 25 characters each)"],
    "panel.saveMacroBtn": ["Сохранить макрос", "Зберегти макрос", "Save macro"],
    "panel.macroViewDefaultTitle": ["Макрос", "Макрос", "Macro"],

    "panel.confirmDefaultTitle": ["Подтвердите", "Підтвердіть", "Confirm"],
    "panel.yes": ["Да", "Так", "Yes"],
    "panel.cancel": ["Отмена", "Скасувати", "Cancel"],
    "panel.copyTitleDefault": ["Скопируйте", "Скопіюйте", "Copy this"],
    "panel.copyBtn": ["Скопировать", "Скопіювати", "Copy"],
    "panel.close": ["Закрыть", "Закрити", "Close"],
    "panel.copyHint": [
      "Если кнопка не сработала — выделите текст выше и нажмите Ctrl+C (⌘+C на Mac).",
      "Якщо кнопка не спрацювала — виділіть текст вище і натисніть Ctrl+C (⌘+C на Mac).",
      "If the button didn't work — select the text above and press Ctrl+C (⌘+C on Mac).",
    ],

    "panel.helpBtnTitle": ["Руководство", "Посібник", "Guide"],
    "panel.helpTitle": ["Как пользоваться панелью", "Як користуватися панеллю", "How to use the panel"],
    "panel.helpCharsSummary": ["Персонажи", "Персонажі", "Characters"],
    "panel.helpCharsBody": [
      "<p>Сверху выбираете расу и класс. У каждого класса — своя панель и своя библиотека иконок: переключаетесь между персонажами, и всё остаётся на своих местах.</p>",
      "<p>Зверху обираєте расу і клас. У кожного класу — своя панель і своя бібліотека іконок: перемикаєтесь між персонажами, і все залишається на своїх місцях.</p>",
      "<p>Pick a race and class at the top. Each class has its own panel and its own icon library: switch between characters and everything stays right where it was.</p>",
    ],
    "panel.helpIconsSummary": ["Иконки и группы", "Іконки і групи", "Icons and groups"],
    "panel.helpIconsBody": [
      "<ul>" +
      "<li>Меню ☰ → «Добавить иконки»: выбираете «Для одного класса» или «Общая для всех классов», выбираете группу (существующую или создаёте новую по имени) и жмёте «Выбрать файлы…».</li>" +
      "<li>Группа «для одного класса» видна только на панели этого класса. Группа «общая для всех» появляется у каждого персонажа автоматически, без повторной загрузки.</li>" +
      "<li>Иконки показываются полоской из подписанных групп под панелью — у общих групп рядом с названием значок «общая».</li>" +
      "<li>Из группы перетащите иконку на любую ячейку — она там останется. Одну иконку можно ставить в несколько ячеек.</li>" +
      "<li>Файл из проводника можно бросить и сразу на ячейку — он попадёт и туда, и в группу «Иконки» текущего класса.</li>" +
      "<li>Иконку можно перетащить с одной ячейки на другую: пустая ячейка её примет, а если там уже есть иконка — они поменяются местами.</li>" +
      "<li>Перетащите иконку с ячейки в пустое место страницы — она уберётся с панели (в группе останется).</li>" +
      "<li>Крестик на иконке убирает её из группы, крестик у названия группы — удаляет всю группу (на уже расставленные ячейки это не влияет). Эти крестики, как и само добавление иконок, доступны только владельцу панели. У остальных их нет вообще.</li>" +
      "<li>У владельца внизу колонки с иконками есть кнопка 🗑 — по умолчанию крестики удаления скрыты, чтобы не мешали смотреть иконки; кнопка их показывает и прячет обратно.</li>" +
      "<li>Кнопка «‹» вверху колонки сворачивает её в узкую полоску (нажмите «›», чтобы развернуть обратно) — иконки при этом никуда не пропадают, просто скрыты из вида. Браузер запоминает, свёрнута она или нет.</li>" +
      "</ul>",
      "<ul>" +
      "<li>Меню ☰ → «Додати іконки»: обираєте «Для одного класу» або «Спільна для всіх класів», обираєте групу (наявну або створюєте нову за назвою) і тиснете «Вибрати файли…».</li>" +
      "<li>Група «для одного класу» видна тільки на панелі цього класу. Група «спільна для всіх» з'являється у кожного персонажа автоматично, без повторного завантаження.</li>" +
      "<li>Іконки показуються смугою з підписаних груп під панеллю — у спільних груп поруч із назвою значок «спільна».</li>" +
      "<li>З групи перетягніть іконку на будь-яку клітинку — вона там залишиться. Одну іконку можна ставити в кілька клітинок.</li>" +
      "<li>Файл із провідника можна кинути й одразу на клітинку — він потрапить і туди, і в групу «Іконки» поточного класу.</li>" +
      "<li>Іконку можна перетягнути з однієї клітинки на іншу: порожня клітинка її прийме, а якщо там уже є іконка — вони поміняються місцями.</li>" +
      "<li>Перетягніть іконку з клітинки в порожнє місце сторінки — вона прибереться з панелі (у групі залишиться).</li>" +
      "<li>Хрестик на іконці прибирає її з групи, хрестик біля назви групи — видаляє всю групу (на вже розставлені клітинки це не впливає). Ці хрестики, як і саме додавання іконок, доступні тільки власнику панелі. В інших їх немає взагалі.</li>" +
      "<li>У власника внизу колонки з іконками є кнопка 🗑 — за замовчуванням хрестики видалення сховані, щоб не заважали дивитися іконки; кнопка їх показує і ховає назад.</li>" +
      "<li>Кнопка «‹» вгорі колонки згортає її у вузьку смужку (натисніть «›», щоб розгорнути назад) — іконки при цьому нікуди не зникають, просто сховані з вигляду. Браузер пам'ятає, згорнута вона чи ні.</li>" +
      "</ul>",
      "<ul>" +
      "<li>Menu ☰ → “Add icons”: choose “For one class” or “Shared across all classes”, pick a group (existing or create a new one by name) and click “Choose files…”.</li>" +
      "<li>A “for one class” group is only visible on that class's panel. A “shared” group appears for every character automatically, with no need to re-upload.</li>" +
      "<li>Icons are shown as a strip of labeled groups below the panel — shared groups have a “shared” badge next to their name.</li>" +
      "<li>Drag an icon from a group onto any cell — it stays there. One icon can be placed on several cells.</li>" +
      "<li>You can also drop a file from your file explorer straight onto a cell — it lands there and in the current class's “Icons” group.</li>" +
      "<li>An icon can be dragged from one cell to another: an empty cell accepts it, and if that cell already has an icon, they swap places.</li>" +
      "<li>Drag an icon from a cell onto an empty spot on the page — it's removed from the panel (it stays in the group).</li>" +
      "<li>The × on an icon removes it from the group; the × next to a group's name deletes the whole group (already-placed cells aren't affected). These × buttons, like adding icons itself, are only available to the panel's owner. No one else has them at all.</li>" +
      "<li>The owner has a 🗑 button at the bottom of the icon column — deletion × marks are hidden by default so they don't get in the way of browsing icons; the button shows and hides them.</li>" +
      "<li>The “‹” button at the top of the column collapses it into a narrow strip (press “›” to expand it again) — the icons don't go anywhere, they're just hidden from view. The browser remembers whether it's collapsed.</li>" +
      "</ul>",
    ],
    "panel.helpMacrosSummary": ["Макросы", "Макроси", "Macros"],
    "panel.helpMacrosBody": [
      "<ul>" +
      "<li>☰ → «➕ Добавить макрос» — доступно каждому, кто открыл панель, и хранится только в его браузере.</li>" +
      "<li>Иконку для макроса выбираете из набора, который выдаёт владелец панели (кнопка «+ Добавить иконку для макросов» пополняет этот набор).</li>" +
      "<li>В самом макросе — до 12 строк текста, в каждой до 25 символов.</li>" +
      "<li>Готовые макросы показываются полоской «Мои макросы» под иконками — перетаскиваются на ячейки панели так же, как обычные иконки.</li>" +
      "<li>Клик по ячейке с макросом (не перетаскивание) показывает его текст.</li>" +
      "</ul>",
      "<ul>" +
      "<li>☰ → «➕ Додати макрос» — доступно кожному, хто відкрив панель, і зберігається тільки в його браузері.</li>" +
      "<li>Іконку для макросу обираєте з набору, який видає власник панелі (кнопка «+ Додати іконку для макросів» поповнює цей набір).</li>" +
      "<li>У самому макросі — до 12 рядків тексту, у кожному до 25 символів.</li>" +
      "<li>Готові макроси показуються смугою «Мої макроси» під іконками — перетягуються на клітинки панелі так само, як звичайні іконки.</li>" +
      "<li>Клік по клітинці з макросом (не перетягування) показує його текст.</li>" +
      "</ul>",
      "<ul>" +
      "<li>☰ → “➕ Add macro” — available to anyone who has the panel open, and stored only in their own browser.</li>" +
      "<li>You pick a macro icon from the set the panel's owner provides (the “+ Add an icon for macros” button adds to that set).</li>" +
      "<li>A macro itself holds up to 12 lines of text, up to 25 characters each.</li>" +
      "<li>Finished macros appear in the “My macros” strip below the icons — drag them onto panel cells just like regular icons.</li>" +
      "<li>Clicking a cell with a macro (not dragging it) shows its text.</li>" +
      "</ul>",
    ],
    "panel.helpKeysSummary": ["Клавиши", "Клавіші", "Keys"],
    "panel.helpKeysBody": [
      "<ul>" +
      "<li>Клик по бейджу в углу ячейки — панель ждёт нажатия. Нажмите любую клавишу (буква, цифра, F1–F12…), и она привяжется.</li>" +
      "<li>Нажмите ту же клавишу ещё раз на той же ячейке — бинд снимется, бейдж снова пустой.</li>" +
      "<li><span class=\"kbd\">Esc</span> — отменить выбор клавиши.</li>" +
      "</ul>",
      "<ul>" +
      "<li>Клік по бейджу в кутку клітинки — панель чекає на натискання. Натисніть будь-яку клавішу (літера, цифра, F1–F12…), і вона прив'яжеться.</li>" +
      "<li>Натисніть ту саму клавішу ще раз на тій самій клітинці — бінд зніметься, бейдж знову порожній.</li>" +
      "<li><span class=\"kbd\">Esc</span> — скасувати вибір клавіші.</li>" +
      "</ul>",
      "<ul>" +
      "<li>Click the badge in the corner of a cell — the panel waits for a keypress. Press any key (letter, digit, F1–F12…) and it gets bound.</li>" +
      "<li>Press the same key again on the same cell — the binding is removed, the badge goes empty again.</li>" +
      "<li><span class=\"kbd\">Esc</span> — cancel the key selection.</li>" +
      "</ul>",
    ],
    "panel.helpRowsSummary": ["Ряды и строки", "Ряди і рядки", "Rows and bars"],
    "panel.helpRowsBody": [
      "<ul>" +
      "<li>Всего у класса <b>10 строк</b> по 12 ячеек, на экране видно до <b>6 рядов</b>.</li>" +
      "<li>Кнопки «двойные стрелки» слева от нижнего ряда открывают ряд выше и скрывают верхний.</li>" +
      "<li>Маленькие стрелки ▲/▼ с номером слева от каждого ряда перелистывают этот ряд по строкам 1–10 (после 10 идёт снова 1). Сам ряд остаётся на месте, соседние ряды не меняются.</li>" +
      "</ul>",
      "<ul>" +
      "<li>Всього у класу <b>10 рядків</b> по 12 клітинок, на екрані видно до <b>6 рядів</b>.</li>" +
      "<li>Кнопки «подвійні стрілки» зліва від нижнього ряду відкривають ряд вище і ховають верхній.</li>" +
      "<li>Маленькі стрілки ▲/▼ з номером зліва від кожного ряду гортають цей ряд по рядках 1–10 (після 10 знову йде 1). Сам ряд лишається на місці, сусідні ряди не змінюються.</li>" +
      "</ul>",
      "<ul>" +
      "<li>A class has <b>10 bars</b> of 12 cells each in total; up to <b>6 rows</b> are visible on screen.</li>" +
      "<li>The “double arrow” buttons to the left of the bottom row open the row above and hide the top one.</li>" +
      "<li>The small ▲/▼ arrows with a number to the left of each row flip that row through bars 1–10 (after 10 it wraps back to 1). The row itself stays put — neighboring rows don't change.</li>" +
      "</ul>",
    ],
    "panel.helpFloatsSummary": ["Доп. панели 11–13", "Дод. панелі 11–13", "Extra panels 11–13"],
    "panel.helpFloatsBody": [
      "<ul>" +
      "<li>Кнопка <b>«</b> справа от панели добавляет плавающие панели — строки 11, 12 и 13, по одной за нажатие. Когда открыты все три, следующее нажатие убирает их.</li>" +
      "<li>Перетаскивайте их за ручку ≣ куда угодно — за край экрана они не уйдут.</li>" +
      "<li>Кнопка ▦ на панели меняет форму: 1×12 → 2×6 → 3×4 → 4×3 → 6×2 → 12×1.</li>" +
      "<li>Иконки и клавиши на них вешаются так же, как на основной панели. Перелистать эти строки нельзя.</li>" +
      "</ul>",
      "<ul>" +
      "<li>Кнопка <b>«</b> праворуч від панелі додає плаваючі панелі — рядки 11, 12 і 13, по одному за натискання. Коли відкриті всі три, наступне натискання прибирає їх.</li>" +
      "<li>Перетягуйте їх за ручку ≣ куди завгодно — за край екрана вони не підуть.</li>" +
      "<li>Кнопка ▦ на панелі змінює форму: 1×12 → 2×6 → 3×4 → 4×3 → 6×2 → 12×1.</li>" +
      "<li>Іконки і клавіші на них вішаються так само, як на основній панелі. Перегорнути ці рядки не можна.</li>" +
      "</ul>",
      "<ul>" +
      "<li>The <b>«</b> button to the right of the panel adds floating panels — bars 11, 12 and 13, one per click. Once all three are open, the next click removes them.</li>" +
      "<li>Drag them by the ≣ handle anywhere you like — they won't go off-screen.</li>" +
      "<li>The ▦ button on a panel changes its shape: 1×12 → 2×6 → 3×4 → 4×3 → 6×2 → 12×1.</li>" +
      "<li>Icons and keys attach to them the same way as on the main panel. These bars can't be flipped through.</li>" +
      "</ul>",
    ],
    "panel.helpMoveSummary": ["Перенос, поворот и замок", "Перенесення, поворот і замок", "Moving, rotating and locking"],
    "panel.helpMoveBody": [
      "<ul>" +
      "<li>Ручка <b>≣</b> в столбике кнопок — перетащить основную панель в любое место экрана. Двойной клик по ручке возвращает её на стандартное место.</li>" +
      "<li>Кнопка <b>⇄</b> ставит основную панель вертикально и обратно.</li>" +
      "<li>Кнопка <b>🔓/🔒</b> — замок: пока он закрыт, ничего нельзя добавить или убрать (иконки, клавиши, очистка). Перелистывание и перетаскивание панелей работают.</li>" +
      "</ul>",
      "<ul>" +
      "<li>Ручка <b>≣</b> у стовпчику кнопок — перетягнути основну панель в будь-яке місце екрана. Подвійний клік по ручці повертає її на стандартне місце.</li>" +
      "<li>Кнопка <b>⇄</b> ставить основну панель вертикально і назад.</li>" +
      "<li>Кнопка <b>🔓/🔒</b> — замок: поки він закритий, нічого не можна додати чи прибрати (іконки, клавіші, очищення). Перегортання і перетягування панелей працюють.</li>" +
      "</ul>",
      "<ul>" +
      "<li>The <b>≣</b> handle in the button column — drag the main panel anywhere on screen. Double-click the handle to reset it to its default spot.</li>" +
      "<li>The <b>⇄</b> button switches the main panel between vertical and horizontal.</li>" +
      "<li>The <b>🔓/🔒</b> button is a lock: while it's closed, nothing can be added or removed (icons, keys, clearing). Flipping through rows and dragging panels still work.</li>" +
      "</ul>",
    ],
    "panel.helpClearSummary": ["Очистка", "Очищення", "Clearing"],
    "panel.helpClearBody": [
      "<p>Правый клик по ячейке — убрать картинку, убрать клавишу или очистить ячейку целиком.</p>",
      "<p>Правий клік по клітинці — прибрати картинку, прибрати клавішу або очистити клітинку цілком.</p>",
      "<p>Right-click a cell to remove its picture, remove its key, or clear the cell entirely.</p>",
    ],
    "panel.helpShareSummary": ["Поделиться (одна ссылка, один класс)", "Поділитися (одне посилання, один клас)", "Sharing (one link, one class)"],
    "panel.helpShareBody": [
      "<ul>" +
      "<li>Кнопка «Поделиться» снизу слева копирует ссылку, внутри которой зашита вся раскладка текущего класса — картинки, клавиши и ряды.</li>" +
      "<li>Получатель открывает ссылку, подтверждает — и раскладка загружается ему в тот же класс, а картинки попадают в его библиотеку.</li>" +
      "<li>Чем больше картинок на панели, тем длиннее ссылка. Если мессенджер обрезает её — передайте раскладку файлом через ☰ Экспорт/Импорт.</li>" +
      "</ul>",
      "<ul>" +
      "<li>Кнопка «Поділитися» знизу зліва копіює посилання, всередині якого зашита вся розкладка поточного класу — картинки, клавіші і ряди.</li>" +
      "<li>Отримувач відкриває посилання, підтверджує — і розкладка завантажується йому в той самий клас, а картинки потрапляють у його бібліотеку.</li>" +
      "<li>Чим більше картинок на панелі, тим довше посилання. Якщо месенджер обрізає його — передайте розкладку файлом через ☰ Експорт/Імпорт.</li>" +
      "</ul>",
      "<ul>" +
      "<li>The “Share” button at the bottom left copies a link containing the current class's entire layout — pictures, keys and rows.</li>" +
      "<li>The recipient opens the link, confirms — and the layout loads into the same class for them, with the pictures landing in their library.</li>" +
      "<li>The more pictures on the panel, the longer the link. If a messenger app truncates it, send the layout as a file instead via ☰ Export/Import.</li>" +
      "</ul>",
    ],
    "panel.helpMenuSummary": ["Меню ☰ (сверху слева)", "Меню ☰ (зверху зліва)", "Menu ☰ (top left)"],
    "panel.helpMenuBody": [
      "<p>«Добавить иконки» — выбрать расу и класс, загрузить картинки умений. Экспорт всех классов в один файл, импорт из файла и очистка панели текущего класса. Экспорт нужен для бэкапа или переноса на другой компьютер — в остальном всё сохраняется автоматически.</p>",
      "<p>«Додати іконки» — обрати расу і клас, завантажити картинки умінь. Експорт усіх класів в один файл, імпорт з файлу і очищення панелі поточного класу. Експорт потрібен для бекапу або перенесення на інший комп'ютер — в іншому все зберігається автоматично.</p>",
      "<p>“Add icons” — pick a race and class, upload skill pictures. Export all classes to a single file, import from a file, and clear the current class's panel. Export is for backups or moving to another computer — otherwise everything saves automatically.</p>",
    ],
    "panel.helpThemeSummary": ["Тема", "Тема", "Theme"],
    "panel.helpThemeBody": [
      "<p>Кнопка ☾/☀ сверху справа переключает тёмную и светлую тему.</p>",
      "<p>Кнопка ☾/☀ зверху справа перемикає темну і світлу тему.</p>",
      "<p>The ☾/☀ button at the top right switches between dark and light theme.</p>",
    ],

    "panel.ctxClearImg": ["Убрать картинку", "Прибрати картинку", "Remove picture"],
    "panel.ctxClearKey": ["Убрать клавишу", "Прибрати клавішу", "Remove key"],
    "panel.ctxClearAll": ["Очистить ячейку", "Очистити клітинку", "Clear cell"],

    "panel.toastLocked": ["Панель закрыта — снимите замок", "Панель закрита — зніміть замок", "The panel is locked — unlock it first"],
    "panel.toastPressKey": ["Нажмите клавишу для привязки… (Esc — отмена)", "Натисніть клавішу для прив'язки… (Esc — скасувати)", "Press a key to bind it… (Esc to cancel)"],
    "panel.toastKeyUnbound": ["Клавиша «{key}» снята", "Клавішу «{key}» знято", "Key “{key}” unbound"],
    "panel.toastKeyBound": ["Клавиша «{key}» привязана", "Клавішу «{key}» прив'язано", "Key “{key}” bound"],
    "panel.toastPanelCleared": ["Панель очищена", "Панель очищено", "Panel cleared"],
    "panel.toastImported": ["Импортировано", "Імпортовано", "Imported"],
    "panel.toastImportFailed": ["Не удалось прочитать файл настроек", "Не вдалося прочитати файл налаштувань", "Failed to read the settings file"],
    "panel.toastCopied": ["Скопировано", "Скопійовано", "Copied"],
    "panel.toastIconRemovedFromPanel": ["Иконка убрана с панели", "Іконку прибрано з панелі", "Icon removed from the panel"],
    "panel.toastFloatsRemoved": ["Доп. панели убраны", "Дод. панелі прибрано", "Extra panels removed"],
    "panel.toastFloatAdded": ["Добавлена панель {n}", "Додано панель {n}", "Panel {n} added"],
    "panel.toastPanelReset": ["Панель вернулась на место", "Панель повернулась на місце", "Panel reset to its default position"],
    "panel.toastLockedChanges": ["Панель закрыта — изменения запрещены", "Панель закрита — зміни заборонені", "The panel is locked — changes are disabled"],
    "panel.toastUnlocked": ["Панель открыта", "Панель відкрита", "The panel is unlocked"],
    "panel.toastEnterGroupName": ["Введите название группы", "Введіть назву групи", "Enter a group name"],
    "panel.toastIconsAddedToGroup": ["Иконки добавлены в группу «{name}»", "Іконки додано в групу «{name}»", "Icons added to the “{name}” group"],
    "panel.toastEmptyPanel": ["Панель пустая — нечем делиться", "Панель порожня — нічим ділитися", "The panel is empty — nothing to share"],
    "panel.toastLayoutLoaded": ["Раскладка загружена", "Розкладку завантажено", "Layout loaded"],
    "panel.toastLayoutLinkFailed": ["Не удалось прочитать ссылку с раскладкой", "Не вдалося прочитати посилання з розкладкою", "Failed to read the layout link"],
    "panel.toastGroupDeleted": ["Группа удалена", "Групу видалено", "Group deleted"],
    "panel.toastIconRemovedFromGroup": ["Иконка убрана из группы", "Іконку прибрано з групи", "Icon removed from the group"],
    "panel.toastPickMacroIcon": ["Выберите иконку для макроса", "Виберіть іконку для макросу", "Pick an icon for the macro"],
    "panel.toastMacroSaved": ["Макрос «{name}» сохранён", "Макрос «{name}» збережено", "Macro “{name}” saved"],
    "panel.toastMacroDeleted": ["Макрос удалён", "Макрос видалено", "Macro deleted"],

    "panel.confirmDeleteGroup": ["Удалить группу «{name}» со всеми иконками?", "Видалити групу «{name}» з усіма іконками?", "Delete the group “{name}” along with all its icons?"],
    "panel.confirmClearPanel": ["Очистить панель класса «{class}»?", "Очистити панель класу «{class}»?", "Clear the panel for class “{class}”?"],
    "panel.confirmDeleteMacro": ["Удалить макрос «{name}»?", "Видалити макрос «{name}»?", "Delete the macro “{name}”?"],
    "panel.confirmLoadShared": [
      "Вам поделились раскладкой: {race} — {cls}. Загрузить её? Панель этого класса будет заменена.",
      "Вам поділились розкладкою: {race} — {cls}. Завантажити її? Панель цього класу буде замінено.",
      "A layout was shared with you: {race} — {cls}. Load it? This class's panel will be replaced.",
    ],
    "panel.deleteBtn": ["Удалить", "Видалити", "Delete"],
    "panel.clearBtn": ["Очистить", "Очистити", "Clear"],
    "panel.loadBtn": ["Загрузить", "Завантажити", "Load"],

    "panel.nextRowTitle": ["Следующая строка (1–{n})", "Наступний рядок (1–{n})", "Next bar (1–{n})"],
    "panel.prevRowTitle": ["Предыдущая строка (1–{n})", "Попередній рядок (1–{n})", "Previous bar (1–{n})"],
    "panel.deleteGroupTitle": ["Удалить группу со всеми иконками", "Видалити групу з усіма іконками", "Delete the group along with all its icons"],
    "panel.dragToCellTitle": ["Перетащите на ячейку панели", "Перетягніть на клітинку панелі", "Drag onto a panel cell"],
    "panel.removeIconFromGroupTitle": ["Убрать иконку из группы", "Прибрати іконку з групи", "Remove icon from the group"],
    "panel.globalBadge": ["общая", "спільна", "shared"],
    "panel.defaultGroupName": ["Группа", "Група", "Group"],
    "panel.defaultIconsGroupName": ["Иконки", "Іконки", "Icons"],
    "panel.dragFloatPanelTitle": ["Перетащить панель", "Перетягнути панель", "Drag the panel"],
    "panel.changeShapeTitle": ["Изменить форму (1×12, 2×6, 3×4…)", "Змінити форму (1×12, 2×6, 3×4…)", "Change shape (1×12, 2×6, 3×4…)"],
    "panel.macroDragTitle": ["{name} — перетащите на ячейку", "{name} — перетягніть на клітинку", "{name} — drag onto a cell"],
    "panel.deleteMacroTitle": ["Удалить макрос", "Видалити макрос", "Delete macro"],
    "panel.pickThisIconTitle": ["Выбрать эту иконку", "Вибрати цю іконку", "Pick this icon"],
    "panel.emptyMacro": ["(пусто)", "(порожньо)", "(empty)"],
    "panel.shareLinkTitle": ["Ссылка на раскладку (~{kb} КБ)", "Посилання на розкладку (~{kb} КБ)", "Layout link (~{kb} KB)"],

    "attendance.title": ["Журнал посещаемости", "Журнал відвідуваності", "Attendance Log"],
    "attendance.today": ["Сегодня", "Сьогодні", "Today"],
    "attendance.pullPrevWeekBtn": ["Подтянуть из прошлой недели", "Підтягнути з минулого тижня", "Pull from last week"],
    "attendance.openReportBtn": ["Посещаемость", "Відвідуваність", "Attendance"],
    "attendance.weekReportBtnTitle": ["Отчёт сразу за эту неделю", "Звіт одразу за цей тиждень", "Report for this week right away"],

    "attendance.searchByNickLabel": ["Поиск по нику", "Пошук за ніком", "Search by nickname"],
    "attendance.nickPlaceholder": ["Ник", "Нік", "Nickname"],
    "attendance.partyLabel": ["Пати", "Паті", "Party"],
    "attendance.allOption": ["Все", "Всі", "All"],
    "attendance.searchBtn": ["Поиск", "Пошук", "Search"],
    "attendance.copyNicksBtn": ["📋 Скопировать ники", "📋 Скопіювати ніки", "📋 Copy nicknames"],
    "attendance.copyNicksBtnTitle": ["Скопировать список ников (то, что сейчас видно)", "Скопіювати список ніків (те, що зараз видно)", "Copy the nickname list (whatever is currently visible)"],
    "attendance.shareBtn": ["Поделиться", "Поділитися", "Share"],
    "attendance.editPeriodBtn": ["Изменить период", "Змінити період", "Change period"],
    "attendance.backToDaysBtn": ["← К дням недели", "← До днів тижня", "← Back to the week's days"],
    "attendance.modePeriod": ["Период", "Період", "Period"],
    "attendance.modeDay": ["Один день", "Один день", "One day"],
    "attendance.fromLabel": ["С", "Від", "From"],
    "attendance.toLabel": ["По", "До", "To"],
    "attendance.showBtn": ["Показать", "Показати", "Show"],
    "attendance.dayLabel": ["Дата", "Дата", "Date"],
    "attendance.colNickname": ["Никнейм", "Нікнейм", "Nickname"],
    "attendance.colAttended": ["Посещено", "Відвідано", "Attended"],
    "attendance.colPercent": ["%", "%", "%"],
    "attendance.colMemberSince": ["В клане с", "У клані з", "In clan since"],
    "attendance.colTotal": ["Итого", "Разом", "Total"],
    "attendance.reportEmptyHint": ["Никого нет под этим фильтром за выбранный период.", "Нікого немає під цим фільтром за обраний період.", "No one matches this filter for the selected period."],

    "attendance.settingsBtn": ["Настройки", "Налаштування", "Settings"],
    "attendance.settingsTitle": ["Настройки посещаемости", "Налаштування відвідуваності", "Attendance settings"],
    "attendance.daysOfWeekSubhead": ["Дни недели", "Дні тижня", "Days of the week"],
    "attendance.daysOfWeekHint": ["Скрытые дни не показываются в списке — включайте только те, что реально нужны.", "Приховані дні не показуються у списку — вмикайте тільки ті, що реально потрібні.", "Hidden days aren't shown in the list — enable only the ones you actually need."],
    "attendance.reportTabsSubhead": ["Вкладки отчёта «Посещаемость»", "Вкладки звіту «Відвідуваність»", "“Attendance” report tabs"],
    "attendance.reportTabsHint": ["Выключенные вкладки не показываются в отчёте.", "Вимкнені вкладки не показуються у звіті.", "Disabled tabs aren't shown in the report."],
    "attendance.reportViewSubhead": ["Вид отчёта «Посещаемость»", "Вигляд звіту «Відвідуваність»", "“Attendance” report view"],
    "attendance.reportViewHint": ["Новый вид добавляет матрицу по дням и режим «один день» вместо обычной таблицы.", "Новий вигляд додає матрицю по днях і режим «один день» замість звичайної таблиці.", "The new view adds a day-by-day matrix and a “one day” mode instead of a plain table."],
    "attendance.enableNewViewLabel": ["Включить новый вид", "Увімкнути новий вигляд", "Enable the new view"],
    "attendance.tableColorSubhead": ["Цвет таблицы «Посещаемость»", "Колір таблиці «Відвідуваність»", "“Attendance” table color"],
    "attendance.tableColorHint": ["По умолчанию таблица светлая, как в референсе. Можно переключить на тёмную — под цвет остального сайта.", "За замовчуванням таблиця світла, як у референсі. Можна перемкнути на темну — під колір решти сайту.", "By default the table is light, matching the reference. You can switch it to dark, matching the rest of the site."],
    "attendance.darkTableLabel": ["Тёмная таблица", "Темна таблиця", "Dark table"],

    "attendance.shareLinkModalTitle": ["Ссылка на отчёт", "Посилання на звіт", "Link to the report"],
    "attendance.shareLinkHint": ["Доступна 5 дней, без пароля — увидит любой, у кого есть ссылка.", "Доступне 5 днів, без пароля — побачить будь-хто, у кого є посилання.", "Available for 5 days, no password — anyone with the link can see it."],
    "attendance.copyBtn": ["Скопировать", "Скопіювати", "Copy"],

    "attendance.helpBtnLabel": ["Как пользоваться", "Як користуватись", "How to use"],
    "attendance.helpTitle": ["Как пользоваться журналом посещаемости", "Як користуватись журналом відвідуваності", "How to use the attendance log"],
    "attendance.helpWeeksSummary": ["Недели и дни", "Тижні і дні", "Weeks and days"],
    "attendance.helpWeeksBody": [
      "<p>Каждая календарная неделя показывает семь карточек-дней. Переключайтесь между неделями стрелками ◀/▶ или кнопкой «Сегодня».</p>",
      "<p>Кожен календарний тиждень показує сім карток-днів. Перемикайтесь між тижнями стрілками ◀/▶ або кнопкою «Сьогодні».</p>",
      "<p>Every calendar week shows seven day cards. Switch between weeks with the ◀/▶ arrows or the “Today” button.</p>",
    ],
    "attendance.helpEventsSummary": ["Мероприятия и явка", "Заходи і явка", "Events and attendance"],
    "attendance.helpEventsBody": [
      "<p><b>Мероприятия.</b> Клик по карточке дня открывает окно со всеми мероприятиями этого дня и списками явки. Кнопка «+» на карточке добавляет новое мероприятие на этот день (только у главного админа/админа).</p>" +
      "<p><b>Явка.</b> Внутри мероприятия — «+ Добавить явку» (подробнее о загрузке скринов ниже). Крестик у ника убирает его из явки.</p>" +
      "<p>Удаление мероприятия (✕ в открытом окне дня) удаляет и всю явку по нему.</p>",
      "<p><b>Заходи.</b> Клік по картці дня відкриває вікно з усіма заходами цього дня і списками явки. Кнопка «+» на картці додає новий захід на цей день (тільки у головного адміна/адміна).</p>" +
      "<p><b>Явка.</b> Всередині заходу — «+ Додати явку» (детальніше про завантаження скринів нижче). Хрестик біля ніка прибирає його з явки.</p>" +
      "<p>Видалення заходу (✕ у відкритому вікні дня) видаляє і всю явку по ньому.</p>",
      "<p><b>Events.</b> Clicking a day card opens a window with all of that day's events and attendance lists. The “+” button on the card adds a new event for that day (main admin/admin only).</p>" +
      "<p><b>Attendance.</b> Inside an event — “+ Add attendance” (more on uploading screenshots below). The × next to a nickname removes it from attendance.</p>" +
      "<p>Deleting an event (✕ in the open day window) also deletes all its attendance.</p>",
    ],
    "attendance.helpUploadSummary": ["Загрузка скриншотов", "Завантаження скриншотів", "Uploading screenshots"],
    "attendance.helpUploadBody": [
      "<p><b>Загрузка.</b> Внутри мероприятия нажмите «+ Добавить явку», выберите до 9 скриншотов со списком участников — подойдёт, например, скрин окна группы клана с никами. Если на том же скрине есть ещё и таблица боя (килы, смерти, PvP/PvE урон) — эти цифры распознаются заодно и сами попадут в «Отчёты по мероприятиям», отдельно загружать их не нужно.</p>" +
      "<img src=\"assets/census-example.png\" alt=\"Пример подходящего скриншота — окно группы клана со списком участников\" />" +
      "<p>Перед сохранением проверьте распознанные ники — чипы с крестиком можно убрать, если что-то распозналось неверно, или дописать ник вручную. Затем нажмите «Сохранить».</p>",
      "<p><b>Завантаження.</b> Всередині заходу натисніть «+ Додати явку», оберіть до 9 скриншотів зі списком учасників — підійде, наприклад, скрин вікна групи клану з ніками. Якщо на тому ж скрині є ще й таблиця бою (кили, смерті, PvP/PvE урон) — ці цифри розпізнаються заодно і самі потраплять у «Звіти по заходах», окремо завантажувати їх не потрібно.</p>" +
      "<img src=\"assets/census-example.png\" alt=\"Приклад придатного скриншота — вікно групи клану зі списком учасників\" />" +
      "<p>Перед збереженням перевірте розпізнані ніки — чипи з хрестиком можна прибрати, якщо щось розпізналося невірно, або дописати нік вручну. Потім натисніть «Зберегти».</p>",
      "<p><b>Uploading.</b> Inside an event, click “+ Add attendance”, choose up to 9 screenshots with a member list — e.g. a screenshot of the clan party window with nicknames works fine. If the same screenshot also has a combat table (kills, deaths, PvP/PvE damage), those numbers are recognized too and land in “Event Reports” automatically — no need to upload them separately.</p>" +
      "<img src=\"assets/census-example.png\" alt=\"Example of a suitable screenshot — the clan party window with a member list\" />" +
      "<p>Before saving, check the recognized nicknames — chips with an × can be removed if something was misread, or you can add a nickname manually. Then click “Save”.</p>",
    ],
    "attendance.helpSettingsSummary": ["Настройки (только у админа)", "Налаштування (тільки у адміна)", "Settings (admin only)"],
    "attendance.helpSettingsBody": [
      "<ul>" +
      "<li>Скрыть/показать дни недели, на которые у клана никогда ничего не происходит.</li>" +
      "<li>Включить/выключить вкладки в отчёте «Посещаемость» — какие из них вообще нужны.</li>" +
      "<li>Включить новый вид отчёта «Посещаемость» (матрица по дням + режим «один день»).</li>" +
      "<li>Переключить таблицу «Посещаемость» между светлой (по умолчанию) и тёмной раскраской.</li>" +
      "</ul>",
      "<ul>" +
      "<li>Сховати/показати дні тижня, на які у клану ніколи нічого не відбувається.</li>" +
      "<li>Увімкнути/вимкнути вкладки у звіті «Відвідуваність» — які з них взагалі потрібні.</li>" +
      "<li>Увімкнути новий вигляд звіту «Відвідуваність» (матриця по днях + режим «один день»).</li>" +
      "<li>Перемкнути таблицю «Відвідуваність» між світлим (за замовчуванням) і темним забарвленням.</li>" +
      "</ul>",
      "<ul>" +
      "<li>Show/hide days of the week the clan never has anything happening on.</li>" +
      "<li>Enable/disable tabs in the “Attendance” report — which ones are actually needed.</li>" +
      "<li>Enable the new “Attendance” report view (day-by-day matrix + “one day” mode).</li>" +
      "<li>Switch the “Attendance” table between light (default) and dark coloring.</li>" +
      "</ul>",
    ],
    "attendance.helpPullSummary": ["Подтянуть из прошлой недели", "Підтягнути з минулого тижня", "Pull from last week"],
    "attendance.helpPullBody": [
      "<p><b>«Подтянуть из прошлой недели»</b> (в шапке рядом с «Сегодня») — копирует мероприятия из предыдущей недели в текущую (по тем же дням). Можно нажимать и на непустую неделю — старые мероприятия этой недели заменятся.</p>",
      "<p><b>«Підтягнути з минулого тижня»</b> (у шапці поруч із «Сьогодні») — копіює заходи з попереднього тижня в поточний (за тими самими днями). Можна натискати і на непорожній тиждень — старі заходи цього тижня заміняться.</p>",
      "<p><b>“Pull from last week”</b> (in the header next to “Today”) — copies events from the previous week into the current one (on the same days). You can click it on a non-empty week too — that week's old events get replaced.</p>",
    ],
    "attendance.helpReportSummary": ["Отчёт «Посещаемость»", "Звіт «Відвідуваність»", "“Attendance” report"],
    "attendance.helpReportBody": [
      "<p>Отчёт за произвольный период (даты «с»/«по», а не недели). Вкладки над таблицей сужают список: ходил/не ходил, новый/старый участник (по дате первого появления в переписи — «новый», если она в последние 7 дней), и сверка с налогами (кто не платит и не ходит / кто платит и ходит).</p>",
      "<p>Звіт за довільний період (дати «з»/«по», а не тижні). Вкладки над таблицею звужують список: ходив/не ходив, новий/старий учасник (за датою першої появи в переписі — «новий», якщо вона в останні 7 днів), і звірка з податками (хто не платить і не ходить / хто платить і ходить).</p>",
      "<p>A report for an arbitrary period (“from”/“to” dates, not weeks). The tabs above the table narrow the list: attended/didn't attend, new/old member (by the date first seen in the census — “new” if that's within the last 7 days), and a cross-check with taxes (who doesn't pay and doesn't attend / who pays and attends).</p>",
    ],
    "attendance.helpNewViewSummary": ["Новый вид отчёта", "Новий вигляд звіту", "The new report view"],
    "attendance.helpNewViewBody": [
      "<p>Включается в настройках. Добавляет переключатель «Период / Один день»: в «Периоде» таблица становится матрицей — по колонке на каждый день с мероприятием, ✓ если был; в «Одном дне» — два списка «Пришли» / «Не пришли» за выбранную дату. Пока новый вид выключен, отчёт выглядит как раньше — обычной таблицей.</p>",
      "<p>Вмикається в налаштуваннях. Додає перемикач «Період / Один день»: у «Періоді» таблиця стає матрицею — по колонці на кожен день із заходом, ✓ якщо був; в «Одному дні» — два списки «Прийшли» / «Не прийшли» за обрану дату. Поки новий вигляд вимкнено, звіт виглядає як раніше — звичайною таблицею.</p>",
      "<p>Enabled in settings. Adds a “Period / One day” switch: in “Period” the table becomes a matrix — one column per day with an event, ✓ if attended; in “One day” — two lists, “Arrived” / “Didn't arrive”, for the selected date. While the new view is off, the report looks as before — a plain table.</p>",
    ],

    "attendance.dayFull0": ["Понедельник", "Понеділок", "Monday"],
    "attendance.dayFull1": ["Вторник", "Вівторок", "Tuesday"],
    "attendance.dayFull2": ["Среда", "Середа", "Wednesday"],
    "attendance.dayFull3": ["Четверг", "Четвер", "Thursday"],
    "attendance.dayFull4": ["Пятница", "П'ятниця", "Friday"],
    "attendance.dayFull5": ["Суббота", "Субота", "Saturday"],
    "attendance.dayFull6": ["Воскресенье", "Неділя", "Sunday"],
    "attendance.dayShort0": ["Пн", "Пн", "Mon"],
    "attendance.dayShort1": ["Вт", "Вт", "Tue"],
    "attendance.dayShort2": ["Ср", "Ср", "Wed"],
    "attendance.dayShort3": ["Чт", "Чт", "Thu"],
    "attendance.dayShort4": ["Пт", "Пт", "Fri"],
    "attendance.dayShort5": ["Сб", "Сб", "Sat"],
    "attendance.dayShort6": ["Вс", "Нд", "Sun"],

    "attendance.filterAttendedOrPaid": ["Ходил / Платил", "Ходив / Платив", "Attended / Paid"],
    "attendance.filterAttended": ["Ходил", "Ходив", "Attended"],
    "attendance.filterNotAttended": ["Не ходил", "Не ходив", "Didn't attend"],
    "attendance.filterNewAttended": ["Новый + ходил", "Новий + ходив", "New + attended"],
    "attendance.filterNewNotAttended": ["Новый + не ходил", "Новий + не ходив", "New + didn't attend"],
    "attendance.filterOldAttended": ["Старый + ходил", "Старий + ходив", "Old + attended"],
    "attendance.filterOldNotAttended": ["Старый + не ходил", "Старий + не ходив", "Old + didn't attend"],
    "attendance.filterNoTaxNoAttend": ["Не платит и не ходит", "Не платить і не ходить", "Doesn't pay, doesn't attend"],
    "attendance.filterPaysAndAttends": ["Платит и ходит", "Платить і ходить", "Pays and attends"],

    "attendance.readPrevWeekFailed": ["Не удалось прочитать прошлую неделю: ", "Не вдалося прочитати минулий тиждень: ", "Failed to read last week: "],
    "attendance.noEventsPrevWeek": ["На прошлой неделе тоже нет мероприятий.", "На минулому тижні теж немає заходів.", "There are no events last week either."],
    "attendance.confirmReplaceWeekEvents": [
      "Заменить мероприятия этой недели на мероприятия из прошлой недели? Уже отмеченная явка на этой неделе будет удалена вместе с мероприятиями.",
      "Замінити заходи цього тижня на заходи з минулого тижня? Уже відмічена явка на цьому тижні буде видалена разом із заходами.",
      "Replace this week's events with last week's events? Attendance already marked this week will be deleted along with the events.",
    ],
    "attendance.clearCurrentWeekFailed": ["Не удалось очистить текущую неделю: ", "Не вдалося очистити поточний тиждень: ", "Failed to clear the current week: "],
    "attendance.copyEventsFailed": ["Не удалось скопировать мероприятия: ", "Не вдалося скопіювати заходи: ", "Failed to copy events: "],
    "attendance.pulledEventsCount": ["Подтянуто мероприятий: {n}.", "Підтягнуто заходів: {n}.", "Pulled events: {n}."],
    "attendance.noEventsHint": ["Мероприятий нет.", "Заходів немає.", "There are no events."],
    "attendance.addEventTitle": ["Добавить мероприятие", "Додати захід", "Add event"],
    "attendance.eventNamePlaceholder": ["Название мероприятия", "Назва заходу", "Event name"],
    "attendance.addBtn": ["Добавить", "Додати", "Add"],
    "attendance.deleteEventTitle": ["Удалить мероприятие", "Видалити захід", "Delete event"],
    "attendance.confirmDeleteEvent": ["Удалить мероприятие «{name}»? Явка по нему тоже удалится.", "Видалити захід «{name}»? Явка по ньому теж видалиться.", "Delete the event “{name}”? Its attendance will be deleted too."],
    "attendance.deleteEventFailed": ["Не удалось удалить: ", "Не вдалося видалити: ", "Failed to delete: "],
    "attendance.deleteEventNoPermission": ["Строка не удалилась — не хватает прав.", "Рядок не видалився — не вистачає прав.", "The row wasn't deleted — insufficient permissions."],

    "attendance.newLabel": ["новый", "новий", "new"],
    "attendance.newStandalone": ["Новый", "Новий", "New"],
    "attendance.attendedCount": ["Ходил ({n})", "Ходив ({n})", "Attended ({n})"],
    "attendance.paidSummary": ["Платил ({paid}) · Ходил и платил ({both}) · Итого платили ({total})", "Платив ({paid}) · Ходив і платив ({both}) · Разом платили ({total})", "Paid ({paid}) · Attended and paid ({both}) · Total paid ({total})"],
    "attendance.neitherCount": ["Не ходил и не платил ({n})", "Не ходив і не платив ({n})", "Didn't attend or pay ({n})"],
    "attendance.arrivedCount": ["Пришли ({n})", "Прийшли ({n})", "Arrived ({n})"],
    "attendance.notArrivedCount": ["Не пришли ({n})", "Не прийшли ({n})", "Didn't arrive ({n})"],

    "attendance.fillBothDates": ["Заполните обе даты.", "Заповніть обидві дати.", "Fill in both dates."],
    "attendance.fromAfterTo": ["Дата «с» позже даты «по».", "Дата «з» пізніша за дату «по».", "The “from” date is after the “to” date."],
    "attendance.pickDate": ["Выберите дату.", "Оберіть дату.", "Pick a date."],
    "attendance.shareOnlyPeriodMode": ["Поделиться можно только в режиме «Период» (таблица), не в режиме «Один день».", "Поділитися можна тільки в режимі «Період» (таблиця), не в режимі «Один день».", "You can only share in “Period” mode (table), not in “One day” mode."],
    "attendance.createLinkFailed": ["Не удалось создать ссылку: ", "Не вдалося створити посилання: ", "Failed to create the link: "],
    "attendance.resizeHandleTitle": ["Потяните, чтобы изменить ширину таблицы", "Потягніть, щоб змінити ширину таблиці", "Drag to resize the table"],
    "attendance.myPartyFallback": ["Моя пати", "Моя паті", "My party"],
    "attendance.paidPrefix": ["Платил (", "Платив (", "Paid ("],
    "attendance.closeParen": [")", ")", ")"],
    "attendance.copyFailedShort": ["Не удалось", "Не вдалося", "Failed"],
    "attendance.soloStatus": ["Соло", "Соло", "Solo"],
    "attendance.groupPrefix": ["Группа: ", "Група: ", "Group: "],

    "eventRoster.notMarkedHint": ["Явка ещё не отмечена.", "Явку ще не відмічено.", "Attendance isn't marked yet."],
    "eventRoster.addAttendanceBtn": ["+ Добавить явку", "+ Додати явку", "+ Add attendance"],
    "eventRoster.pickFilesBtn": ["Выбрать файлы…", "Вибрати файли…", "Choose files…"],
    "eventRoster.manualPlaceholder": ["Добавить ник вручную", "Додати нік вручну", "Add nickname manually"],
    "eventRoster.removeFromAttendanceTitle": ["Убрать из явки", "Прибрати з явки", "Remove from attendance"],
    "eventRoster.onlyFirst9Files": ["Взяты только первые 9 файлов.", "Взято тільки перші 9 файлів.", "Only the first 9 files were taken."],
    "eventRoster.recognizingScreen": ["Распознаю скрин {i} из {n}…", "Розпізнаю скрин {i} з {n}…", "Recognizing screenshot {i} of {n}…"],
    "eventRoster.screenError": ["Скрин {i}: {msg}", "Скрин {i}: {msg}", "Screenshot {i}: {msg}"],
    "eventRoster.doneRecognized": [
      "Готово, распознано {n} ник(ов) со статистикой — проверьте перед сохранением.",
      "Готово, розпізнано {n} нік(ів) зі статистикою — перевірте перед збереженням.",
      "Done — {n} nickname(s) recognized with stats, review before saving.",
    ],
    "eventRoster.saveFailed": ["Не удалось сохранить: ", "Не вдалося зберегти: ", "Failed to save: "],
    "eventRoster.batchSaveFailed": ["Не удалось сохранить метку скрина: ", "Не вдалося зберегти мітку скрина: ", "Failed to save the screenshot marker: "],
    "eventRoster.statsSaveFailed": ["Явка сохранена, но статистика — нет: ", "Явку збережено, але статистику — ні: ", "Attendance saved, but the stats weren't: "],

    "gearCheck.title": ["Проверка буста", "Перевірка бусту", "Gear Check"],
    "gearCheck.backBtnTitle": ["Выбрать другую группу", "Обрати іншу групу", "Choose another group"],
    "gearCheck.pickHint": [
      "Выберите группу, чтобы проверить буст только её участников, либо посмотрите тех, кто не состоит ни в одной группе.",
      "Оберіть групу, щоб перевірити буст тільки її учасників, або подивіться тих, хто не перебуває в жодній групі.",
      "Pick a group to check the gear of just its members, or view those who aren't in any group.",
    ],
    "gearCheck.soloBtn": ["Соло — участники без группы", "Соло — учасники без групи", "Solo — members without a group"],
    "gearCheck.soloLabel": ["Соло", "Соло", "Solo"],
    "gearCheck.avgPercentLabel": ["Средний процент буста: ", "Середній відсоток бусту: ", "Average gear %: "],
    "gearCheck.censusEmptyHint": [
      "В последней переписи нет участников — сначала заполните «Перепись клана».",
      "В останньому переписі немає учасників — спершу заповніть «Перепис клану».",
      "There are no members in the latest census — fill out “Clan Census” first.",
    ],
    "gearCheck.noSoloMembers": ["Участников без группы нет — все состоят в группах.", "Учасників без групи немає — всі перебувають у групах.", "There are no members without a group — everyone is in a group."],
    "gearCheck.noGroupMembers": ["В этой группе нет участников из последней переписи.", "У цій групі немає учасників з останнього перепису.", "This group has no members from the latest census."],
    "gearCheck.classValuesBtn": ["Значения по классам", "Значення по класах", "Values by class"],
    "gearCheck.editModeBtn": ["✎ Редактировать", "✎ Редагувати", "✎ Edit"],
    "gearCheck.editModeDoneBtn": ["✓ Готово", "✓ Готово", "✓ Done"],
    "gearCheck.addSectionBtn": ["+ Раздел", "+ Розділ", "+ Section"],
    "gearCheck.toolsBtnTitle": ["Инструменты", "Інструменти", "Tools"],
    "gearCheck.closeBtn": ["Закрыть", "Закрити", "Close"],
    "gearCheck.helpBtnLabel": ["Как пользоваться", "Як користуватись", "How to use"],
    "gearCheck.helpTitle": ["Как пользоваться проверкой буста", "Як користуватись перевіркою бусту", "How to use gear check"],
    "gearCheck.helpPickSummary": ["Выбор группы", "Вибір групи", "Choosing a group"],
    "gearCheck.helpPickBody": [
      "<p>Если в разделе «Группы» есть хотя бы одна группа, при входе сначала показывается выбор: карточка группы открывает таблицу только для её участников, кнопка «Соло» — для тех, кто не состоит ни в одной группе. Кнопка «← Выбрать другую группу» над таблицей возвращает к выбору. Если групп нет вообще, таблица сразу показывает всех.</p>",
      "<p>Якщо в розділі «Групи» є хоча б одна група, при вході спершу показується вибір: картка групи відкриває таблицю тільки для її учасників, кнопка «Соло» — для тих, хто не перебуває в жодній групі. Кнопка «← Обрати іншу групу» над таблицею повертає до вибору. Якщо груп немає взагалі, таблиця одразу показує всіх.</p>",
      "<p>If there's at least one group in “Groups”, entering the page first shows a picker: a group card opens the table for just its members, the “Solo” button — for those in no group. The “← Choose another group” button above the table returns to the picker. If there are no groups at all, the table shows everyone right away.</p>",
    ],
    "gearCheck.helpTableSummary": ["Таблица", "Таблиця", "Table"],
    "gearCheck.helpTableBody": [
      "<p>Участники берутся из последней «Переписи клана». Столбцы — пункты буста (Бафф, Зілля и т.д.), у каждого свой вес (число-бейдж в шапке). «Общие баллы» — сумма веса включённых пунктов, «Процент буста» — эти баллы от максимума по всем пунктам.</p>",
      "<p>Учасники беруться з останнього «Перепису клану». Стовпці — пункти бусту (Бафф, Зілля тощо), у кожного свою вагу (число-бейдж у шапці). «Загальні бали» — сума ваги увімкнених пунктів, «Відсоток бусту» — ці бали від максимуму по всіх пунктах.</p>",
      "<p>Members are taken from the latest “Clan Census”. Columns are gear items (Buff, Potion, etc.), each with its own weight (the number badge in the header). “Total points” is the sum of enabled items' weight, “Gear %” is those points against the maximum across all items.</p>",
    ],
    "gearCheck.helpCardSummary": ["Карточка участника (клик по строке)", "Картка учасника (клік по рядку)", "Member card (click a row)"],
    "gearCheck.helpCardBody": [
      "<p>Открывает панель справа: тумблеры включают/выключают пункты у этого участника. Баллы и процент пересчитываются сразу.</p>",
      "<p>Відкриває панель праворуч: тумблери вмикають/вимикають пункти в цього учасника. Бали і відсоток перераховуються одразу.</p>",
      "<p>Opens the panel on the right: toggles turn this member's items on/off. Points and percentage are recalculated immediately.</p>",
    ],
    "gearCheck.helpClassSummary": ["Класс участника", "Клас учасника", "Member class"],
    "gearCheck.helpClassBody": [
      "<p>Кнопка «⋮» справа от ника (у админа) открывает окно выбора класса — он показывается подписью под ником, а его иконка становится аватаркой участника. Отдельно загружать фото не нужно.</p>",
      "<p>Кнопка «⋮» праворуч від ніка (в адміна) відкриває вікно вибору класу — він показується підписом під ніком, а його іконка стає аватаркою учасника. Окремо завантажувати фото не потрібно.</p>",
      "<p>The “⋮” button to the right of a nickname (admin only) opens the class picker — it's shown as a caption under the nickname, and its icon becomes the member's avatar. There's no need to upload a photo separately.</p>",
    ],
    "gearCheck.helpColumnsSummary": ["Настройка столбцов (главный админ и админ)", "Налаштування стовпців (головний адмін і адмін)", "Configuring columns (main admin and admin)"],
    "gearCheck.helpColumnsBody": [
      "<p>Кнопка «+» в шапке таблицы, последним столбцом, добавляет новый пункт: имя, вес, потом можно загрузить картинку. Если разделов ещё нет, автоматически создастся раздел «Общая»; если разделов несколько — спросит, в какой добавить.</p>" +
      "<p>То же самое можно делать в панели справа: внизу кнопка «✎ Редактировать» показывает у разделов и пунктов кружок (скрыть/показать), карандаш (имя/вес/фото) и крестик (удалить совсем); «+ Раздел» тоже внизу. Пока «Редактировать» не нажат, панель чистая — видны только тумблеры.</p>" +
      "<p><b>Скрыть</b> — пункт пропадает из таблицы и не считается в баллах, но тумблеры участников по нему сохраняются: в любой момент можно снова показать, ничего не переделывая. <b>Удалить</b> — совсем, без возврата.</p>" +
      "<p><b>Склеить с предыдущим пунктом</b> (галочка в окне пункта) — соседние пункты одного раздела становятся одной колонкой: общий вес в шапке и один балл в строке участника, в панели — одна карточка со своими тумблерами. Склеивать можно и больше двух: отмечайте галочку у каждого следующего пункта цепочки.</p>" +
      "<p><b>Балл только если включено всё склеенное</b> — вторая галочка рядом. С ней группа даёт баллы, лишь когда у участника отмечены все её пункты; не хватает хотя бы одного — 0 баллов за всю группу. Без неё считается сумма того, что включено. Достаточно отметить у любого пункта группы.</p>",
      "<p>Кнопка «+» у шапці таблиці, останнім стовпцем, додає новий пункт: ім'я, вага, потім можна завантажити картинку. Якщо розділів ще немає, автоматично створиться розділ «Загальна»; якщо розділів декілька — запитає, в який додати.</p>" +
      "<p>Те саме можна робити в панелі праворуч: внизу кнопка «✎ Редагувати» показує в розділів і пунктів кружечок (сховати/показати), олівець (ім'я/вага/фото) і хрестик (видалити зовсім); «+ Розділ» теж внизу. Поки «Редагувати» не натиснуто, панель чиста — видно тільки тумблери.</p>" +
      "<p><b>Сховати</b> — пункт зникає з таблиці і не рахується в балах, але тумблери учасників по ньому зберігаються: у будь-який момент можна знову показати, нічого не переробляючи. <b>Видалити</b> — зовсім, без повернення.</p>" +
      "<p><b>Склеїти з попереднім пунктом</b> (галочка у вікні пункту) — сусідні пункти одного розділу стають однією колонкою: загальна вага в шапці і один бал у рядку учасника, у панелі — одна картка зі своїми тумблерами. Склеювати можна й більше двох: відмічайте галочку в кожного наступного пункту ланцюжка.</p>" +
      "<p><b>Бал тільки якщо увімкнено все склеєне</b> — друга галочка поруч. З нею група дає бали, лише коли в учасника відмічені всі її пункти; не вистачає хоча б одного — 0 балів за всю групу. Без неї рахується сума того, що увімкнено. Достатньо відмітити в будь-якого пункту групи.</p>",
      "<p>The “+” button in the table header, as the last column, adds a new item: name, weight, then you can upload a picture. If there are no sections yet, a “General” section is created automatically; if there are several, it asks which one to add to.</p>" +
      "<p>The same can be done in the panel on the right: the “✎ Edit” button at the bottom shows a circle (hide/show), a pencil (name/weight/photo), and an × (delete completely) next to sections and items; “+ Section” is at the bottom too. Until “Edit” is clicked, the panel is clean — only toggles are visible.</p>" +
      "<p><b>Hide</b> — the item disappears from the table and isn't counted in points, but members' toggles for it are kept: you can show it again at any time without redoing anything. <b>Delete</b> — permanently, no way back.</p>" +
      "<p><b>Merge with the previous item</b> (a checkbox in the item window) — adjacent items in the same section become one column: a combined weight in the header and a single score in a member's row, and one card with its own toggles in the panel. You can merge more than two: check the box on each following item in the chain.</p>" +
      "<p><b>Score only if everything merged is on</b> — a second checkbox next to it. With it, the group only gives points once all its items are checked for a member; missing even one means 0 points for the whole group. Without it, the sum of what's enabled is counted. Checking it on any item in the group is enough.</p>",
    ],

    "gearCheck.itemModalDefaultTitle": ["Пункт", "Пункт", "Item"],
    "gearCheck.itemEditTitle": ["Изменить пункт", "Змінити пункт", "Edit item"],
    "gearCheck.itemNewTitle": ["Новый пункт", "Новий пункт", "New item"],
    "gearCheck.nameLabel": ["Название", "Назва", "Name"],
    "gearCheck.namePlaceholder": ["Например, Бафф", "Наприклад, Бафф", "E.g., Buff"],
    "gearCheck.weightLabel": ["Вес (баллы)", "Вага (бали)", "Weight (points)"],
    "gearCheck.subtitleLabel": ["Подпись под названием", "Підпис під назвою", "Caption under the name"],
    "gearCheck.subtitlePlaceholder": ["Например, код баффа", "Наприклад, код баффа", "E.g., buff code"],
    "gearCheck.perClassCheckbox": ["Своя подпись для каждого класса", "Свій підпис для кожного класу", "Own caption per class"],
    "gearCheck.perClassHint": [
      "Пока отмечено — поле «Подпись под названием» выше не используется, показывается значение из «Значения по классам» для класса участника.",
      "Поки відмічено — поле «Підпис під назвою» вище не використовується, показується значення з «Значення по класах» для класу учасника.",
      "While checked, the “Caption under the name” field above isn't used — the value from “Values by class” for the member's class is shown instead.",
    ],
    "gearCheck.fullWidthCheckbox": ["Широкая ячейка (на всю строку)", "Широка клітинка (на весь рядок)", "Wide cell (full row)"],
    "gearCheck.mergeCheckbox": ["Склеить с предыдущим пунктом", "Склеїти з попереднім пунктом", "Merge with the previous item"],
    "gearCheck.mergeHint": [
      "Пункт срастётся с идущим перед ним пунктом того же раздела и подраздела: в таблице они станут одной колонкой с общим весом и одним баллом, в панели участника — одной карточкой со своими тумблерами.",
      "Пункт зростеться з тим, що йде перед ним, того ж розділу і підрозділу: у таблиці вони стануть однією колонкою із загальною вагою й одним балом, у панелі учасника — однією карткою зі своїми тумблерами.",
      "The item will merge with the one before it in the same section and subgroup: in the table they become one column with a combined weight and a single score, and one card with its own toggles in the member panel.",
    ],
    "gearCheck.mergeAllCheckbox": ["Балл только если включено всё склеенное", "Бал тільки якщо увімкнено все склеєне", "Score only if everything merged is on"],
    "gearCheck.mergeAllHint": [
      "Для склеенной группы: если у участника выключен хотя бы один пункт из неё, вся группа даёт 0 баллов. Без этой галочки считается сумма того, что включено. Отметить достаточно у любого пункта группы — действует на всю.",
      "Для склеєної групи: якщо в учасника вимкнено хоча б один пункт з неї, вся група дає 0 балів. Без цієї галочки рахується сума того, що увімкнено. Відмітити достатньо в будь-якого пункту групи — діє на всю.",
      "For a merged group: if a member has even one item from it turned off, the whole group gives 0 points. Without this checkbox, the sum of what's enabled is counted. Checking it on any item in the group is enough — it applies to the whole group.",
    ],
    "gearCheck.subgroupLabel": ["Подраздел внутри раздела (необязательно)", "Підрозділ усередині розділу (необов'язково)", "Subgroup within the section (optional)"],
    "gearCheck.subgroupPlaceholder": ["Например, Еліксири", "Наприклад, Еліксири", "E.g., Elixirs"],
    "gearCheck.subgroupHint": [
      "Пункты с одинаковым подразделом группируются под общей подписью, отдельно от остальных пунктов раздела.",
      "Пункти з однаковим підрозділом групуються під загальним підписом, окремо від решти пунктів розділу.",
      "Items with the same subgroup are grouped under a shared caption, separate from the rest of the section's items.",
    ],
    "gearCheck.pictureLabel": ["Картинка", "Картинка", "Picture"],
    "gearCheck.uploadBtn": ["Загрузить", "Завантажити", "Upload"],
    "gearCheck.removeBtn": ["Убрать", "Прибрати", "Remove"],
    "gearCheck.saveBtn": ["Сохранить", "Зберегти", "Save"],

    "gearCheck.classValuesTitle": ["Значения по классам", "Значення по класах", "Values by class"],
    "gearCheck.classValuesHint": [
      "Для пунктов с отметкой «Своя подпись для каждого класса»: у баффа — свой код, у тату — свои статы.",
      "Для пунктів з відміткою «Свій підпис для кожного класу»: у баффа — свій код, у тату — свої стати.",
      "For items marked “Own caption per class”: a buff has its own code, a tattoo has its own stats.",
    ],
    "gearCheck.itemLabel": ["Пункт", "Пункт", "Item"],
    "gearCheck.addClassPlaceholder": ["Добавить профессию", "Додати професію", "Add a class"],
    "gearCheck.addBtn": ["Добавить", "Додати", "Add"],

    "gearCheck.classLabel": ["Класс", "Клас", "Class"],
    "gearCheck.classSearchPlaceholder": ["Поиск класса...", "Пошук класу...", "Search class..."],

    "gearCheck.membersCountSuffix": [" участников", " учасників", " members"],
    "gearCheck.noMembersYet": ["Пока никого нет", "Поки нікого немає", "No one yet"],
    "gearCheck.soloBtnWithCount": ["Соло — участники без группы ({n})", "Соло — учасники без групи ({n})", "Solo — members without a group ({n})"],
    "gearCheck.colMembers": ["Участники", "Учасники", "Members"],
    "gearCheck.colTotalPoints": ["Общие баллы", "Загальні бали", "Total points"],
    "gearCheck.colBoostPercent": ["Процент буста", "Відсоток бусту", "Gear %"],
    "gearCheck.minBoostAppliedBadge": ["выдан мин.", "видано мін.", "min. applied"],
    "gearCheck.minBoostAppliedTitle": [
      "Ничего не отмечено — выдан минимальный % (Админ-панель → «ДКП»)",
      "Нічого не відмічено — видано мінімальний % (Адмін-панель → «ДКП»)",
      "Nothing checked — the minimum % was applied (Admin Panel → “DKP”)",
    ],
    "gearCheck.addColumnTitle": ["Добавить столбец", "Додати стовпець", "Add column"],
    "gearCheck.classMenuTitle": ["Класс", "Клас", "Class"],
    "gearCheck.hasValue": ["есть", "є", "yes"],
    "gearCheck.noValue": ["нет", "немає", "no"],
    "gearCheck.mergedAllRequiredHint": [" — балл только если есть всё", " — бал тільки якщо є все", " — score only if all are on"],

    "gearCheck.myPartyFallback": ["Моя пати", "Моя паті", "My party"],

    "gearCheck.noSectionsAdminHint": ["Разделов ещё нет — нажмите «+ Раздел» внизу.", "Розділів ще немає — натисніть «+ Розділ» внизу.", "There are no sections yet — click “+ Section” below."],
    "gearCheck.noSectionsHint": ["Разделы ещё не настроены.", "Розділи ще не налаштовано.", "Sections haven't been set up yet."],
    "gearCheck.addItemTitle": ["Добавить пункт", "Додати пункт", "Add item"],
    "gearCheck.renameSectionTitle": ["Переименовать раздел", "Перейменувати розділ", "Rename section"],
    "gearCheck.deleteSectionTitle": ["Удалить раздел", "Видалити розділ", "Delete section"],
    "gearCheck.noItemsHint": ["Пунктов нет.", "Пунктів немає.", "There are no items."],
    "gearCheck.addItemToSubgroupTitle": ["Добавить пункт в этот подраздел", "Додати пункт у цей підрозділ", "Add an item to this subgroup"],

    "gearCheck.fullyCounted": ["Засчитано полностью", "Зараховано повністю", "Fully counted"],
    "gearCheck.scoreOnlyIfAll": [
      "Балл только если включено всё (сейчас {on} из {total})",
      "Бал тільки якщо увімкнено все (зараз {on} з {total})",
      "Score only if everything is on (currently {on} of {total})",
    ],

    "gearCheck.hiddenTag": ["(скрыто)", "(сховано)", "(hidden)"],
    "gearCheck.showItemTitle": ["Показать пункт", "Показати пункт", "Show item"],
    "gearCheck.hideItemTitle": ["Скрыть пункт (данные не удаляются)", "Сховати пункт (дані не видаляються)", "Hide item (data isn't deleted)"],
    "gearCheck.editTitle": ["Изменить", "Змінити", "Edit"],
    "gearCheck.deleteForeverTitle": ["Удалить совсем", "Видалити зовсім", "Delete permanently"],
    "gearCheck.copyTitle": ["Скопировать", "Скопіювати", "Copy"],
    "gearCheck.noValueForClass": ["нет значения для этого класса", "немає значення для цього класу", "no value for this class"],
    "gearCheck.classNotSet": ["класс участника не задан", "клас учасника не задано", "the member's class isn't set"],

    "gearCheck.saveValueFailed": ["Не удалось сохранить: ", "Не вдалося зберегти: ", "Failed to save: "],
    "gearCheck.sectionNamePrompt": ["Название раздела:", "Назва розділу:", "Section name:"],
    "gearCheck.sectionRenamePrompt": ["Новое название раздела:", "Нова назва розділу:", "New section name:"],
    "gearCheck.confirmDeleteSection": ["Удалить раздел «{name}» со всеми его пунктами?", "Видалити розділ «{name}» з усіма його пунктами?", "Delete the section “{name}” along with all its items?"],
    "gearCheck.checkNameAndWeight": ["Проверьте название и вес.", "Перевірте назву і вагу.", "Check the name and weight."],
    "gearCheck.confirmDeleteItem": ["Удалить пункт «{name}»?", "Видалити пункт «{name}»?", "Delete the item “{name}”?"],
    "gearCheck.generalSectionName": ["Общая", "Загальна", "General"],
    "gearCheck.pickSectionPrompt": ["В какой раздел добавить столбец?\n{list}", "У який розділ додати стовпець?\n{list}", "Which section should the column be added to?\n{list}"],
    "gearCheck.noSuchSection": ["Нет такого раздела.", "Немає такого розділу.", "There's no such section."],

    "gearCheck.notSelectedM": ["Не выбран", "Не обрано", "Not selected"],
    "gearCheck.noClassesYetHint": [
      "Классы ещё не заданы ни одному участнику — впишите класс через «⋮» у ника в таблице, либо добавьте профессию вручную ниже.",
      "Класи ще не задані жодному учаснику — впишіть клас через «⋮» у ніка в таблиці, або додайте професію вручну нижче.",
      "No classes have been set for any member yet — set one via “⋮” next to a nickname in the table, or add a class manually below.",
    ],
    "gearCheck.classValuePlaceholder": ["Значение для «{cls}» (не название класса)", "Значення для «{cls}» (не назва класу)", "Value for “{cls}” (not the class name)"],
    "gearCheck.noPerClassItemsHint": [
      "Нет пунктов с отметкой «Своя подпись для каждого класса» — включите её в окне пункта (карандаш у пункта в разделах ниже).",
      "Немає пунктів з відміткою «Свій підпис для кожного класу» — увімкніть її у вікні пункту (олівець у пункту в розділах нижче).",
      "There are no items marked “Own caption per class” — enable it in the item window (the pencil next to an item in the sections below).",
    ],
    "gearCheck.saved": ["Сохранено.", "Збережено.", "Saved."],

    "reports.title": ["Отчёты по мероприятиям", "Звіти по заходах", "Event Reports"],
    "reports.weekLabel": ["Неделя", "Тиждень", "Week"],
    "reports.allTime": ["Всё время", "Весь час", "All time"],
    "reports.eventLabel": ["Мероприятие", "Захід", "Event"],
    "reports.partyLabel": ["Пати", "Паті", "Party"],
    "reports.groupByPartyBtn": ["Смотреть по пати", "Дивитись по паті", "View by party"],
    "reports.groupByPartyBtnTitle": [
      "Список ниже разобьётся на блоки по пати — как «Скрин N», только по реальной группе человека, а не по тому, с какого скрина он распознан. Кто не состоит ни в одной группе — отдельным блоком «Соло»",
      "Список нижче розіб'ється на блоки по паті — як «Скрин N», тільки по реальній групі людини, а не по тому, з якого скрину її розпізнано. Хто не перебуває в жодній групі — окремим блоком «Соло»",
      "The list below will split into blocks by party — like “Screenshot N”, but by the person's actual group rather than which screenshot they were recognized from. Anyone in no group gets a separate “Solo” block",
    ],
    "reports.emptyPeriodHint": ["За выбранный период данных нет.", "За обраний період даних немає.", "There's no data for the selected period."],
    "reports.splitterTitle": [
      "Потяните влево-вправо, чтобы изменить ширину панели. Двойной клик — вернуть как было.",
      "Потягніть вліво-вправо, щоб змінити ширину панелі. Подвійний клік — повернути як було.",
      "Drag left-right to resize the panel. Double-click to reset it.",
    ],
    "reports.tileKills": ["Всего убийств", "Всього вбивств", "Total kills"],
    "reports.tileDeaths": ["Всего смертей", "Всього смертей", "Total deaths"],
    "reports.tileKd": ["Ср. K:D", "Сер. K:D", "Avg K:D"],
    "reports.tilePvp": ["Всего PvP урона", "Всього PvP урону", "Total PvP damage"],
    "reports.tilePve": ["Всего PvE урона", "Всього PvE урону", "Total PvE damage"],
    "reports.tileActive": ["Всего активных", "Всього активних", "Total active"],

    "reports.cmpPartiesTitle": ["Сравнение пати", "Порівняння паті", "Party comparison"],
    "reports.cmpPartiesHint": [
      "Отметьте 2 и более пати — за тот же период, что выбран выше, в среднем на участника.",
      "Відмітьте 2 і більше паті — за той самий період, що обрано вище, в середньому на учасника.",
      "Check 2 or more parties — for the same period selected above, averaged per member.",
    ],
    "reports.colParty": ["Пати", "Паті", "Party"],
    "reports.colKills": ["Килы", "Кили", "Kills"],
    "reports.colDeaths": ["Смерти", "Смерті", "Deaths"],
    "reports.colKd": ["K:D", "K:D", "K:D"],
    "reports.colPvp": ["PvP", "PvP", "PvP"],
    "reports.colPve": ["PvE", "PvE", "PvE"],
    "reports.colPeople": ["Чел.", "Осіб", "People"],
    "reports.cmpPartiesEmpty": ["Отметьте хотя бы 2 пати, чтобы увидеть сравнение.", "Відмітьте хоча б 2 паті, щоб побачити порівняння.", "Check at least 2 parties to see the comparison."],

    "reports.cmpPeopleTitle": ["Сравнение людей", "Порівняння людей", "People comparison"],
    "reports.cmpPeopleHint": [
      "Наведите на человека в таблице слева и нажмите ⚖, чтобы добавить его в сравнение (2 и более) — сравнение появится само.",
      "Наведіть на людину в таблиці зліва і натисніть ⚖, щоб додати її в порівняння (2 і більше) — порівняння з'явиться само.",
      "Hover over a person in the table on the left and click ⚖ to add them to the comparison (2 or more) — the comparison appears automatically.",
    ],
    "reports.colNick": ["Ник", "Нік", "Nickname"],
    "reports.cmpPeopleEmptyDefault": ["Пока никто не выбран.", "Поки нікого не обрано.", "No one is selected yet."],

    "reports.groupLabelSettingsBtn": ["⚙ Метки пати", "⚙ Мітки паті", "⚙ Party labels"],
    "reports.groupLabelSettingsBtnTitle": ["Настройки меток пати", "Налаштування міток паті", "Party label settings"],
    "reports.groupLabelSettingsTitle": ["Метки пати на скринах явки", "Мітки паті на скринах явки", "Party labels on attendance screenshots"],
    "reports.groupLabelSettingsHint": [
      "Если среди ников, распознанных на скрине явки, минимум столько-то состоят в одной группе клана — блок подписывается её названием; иначе — названием ниже. Это правило пересчитывается на лету и задним числом переподписывает уже сохранённые скрины (кроме тех, что переименованы вручную).",
      "Якщо серед ніків, розпізнаних на скрині явки, мінімум стільки-то перебувають в одній групі клану — блок підписується її назвою; інакше — назвою нижче. Це правило перераховується на льоту і заднім числом перепідписує вже збережені скрини (окрім тих, що перейменовані вручну).",
      "If at least this many of the nicknames recognized on an attendance screenshot are in the same clan group, the block is labeled with that group's name; otherwise — with the name below. This rule is recalculated on the fly and retroactively relabels already-saved screenshots (except ones renamed manually).",
    ],
    "reports.minGroupCountLabel": ["Минимум ников из одной группы (макс. 9 на скрине)", "Мінімум ніків з однієї групи (макс. 9 на скрині)", "Minimum nicknames from one group (max 9 per screenshot)"],
    "reports.soloLabelLabel": ["Название, если группа не набралась", "Назва, якщо група не набралась", "Name if no group reaches the minimum"],
    "reports.saveBtn": ["Сохранить", "Зберегти", "Save"],

    "reports.weekOne": ["неделя", "тиждень", "week"],
    "reports.weekFew": ["недели", "тижні", "weeks"],
    "reports.weekMany": ["недель", "тижнів", "weeks"],
    "reports.weeksSelectedSuffix": [" выбрано", " обрано", " selected"],
    "reports.thisEventFallback": ["этого мероприятия", "цього заходу", "this event"],
    "reports.allTimeFallback": ["всего времени", "всього часу", "all time"],
    "reports.wholeWeekOption": ["Вся неделя", "Весь тиждень", "The whole week"],

    "reports.newClassSearchHead": ["Новая профессия — поиск", "Нова професія — пошук", "New class — search"],
    "reports.classSearchPlaceholder": ["Поиск класса...", "Пошук класу...", "Search class..."],
    "reports.backOption": ["← Назад", "← Назад", "← Back"],
    "reports.classForPeriodHead": ["Профессия — только для «{period}»", "Професія — тільки для «{period}»", "Class — only for “{period}”"],
    "reports.classSingleHead": ["Профессия одна", "Професія одна", "Only one class"],
    "reports.classNotSetHead": ["Профессия не задана", "Професію не задано", "No class set"],
    "reports.autoClassOption": ["Авто (основная профессия)", "Авто (основна професія)", "Auto (primary class)"],
    "reports.nowBadge": ["сейчас", "зараз", "now"],
    "reports.classSingleHint": ["Профессия одна — переключаться не между чем.", "Професія одна — перемикатися нема між чим.", "There's only one class — nothing to switch between."],
    "reports.addClassOption": ["Добавить профессию", "Додати професію", "Add a class"],
    "reports.saveFailed": ["Не удалось сохранить: ", "Не вдалося зберегти: ", "Failed to save: "],
    "reports.deleteFailed": ["Не удалось удалить: ", "Не вдалося видалити: ", "Failed to delete: "],

    "reports.soloDefaultLabel": ["Соло", "Соло", "Solo"],
    "reports.myPartyFallback": ["Моя пати", "Моя паті", "My party"],
    "reports.allOption": ["Все", "Всі", "All"],

    "reports.minCountRangeError": ["Минимум ников — целое число от 1 до 9.", "Мінімум ніків — ціле число від 1 до 9.", "The minimum must be a whole number from 1 to 9."],
    "reports.soloNameEmptyError": ["Название не может быть пустым.", "Назва не може бути порожньою.", "The name cannot be empty."],

    "reports.manualClassTitle": ["Профессия выбрана вручную — только для этого периода", "Професію обрано вручну — тільки для цього періоду", "Class chosen manually — only for this period"],
    "reports.defaultClassTitle": ["Профессия по умолчанию", "Професія за замовчуванням", "Default class"],
    "reports.changeClassTitle": ["Сменить профессию", "Змінити професію", "Change class"],
    "reports.removedBadge": ["удалён", "видалено", "removed"],
    "reports.removeFromCmpTitle": ["Убрать из сравнения", "Прибрати з порівняння", "Remove from comparison"],
    "reports.addToCmpTitle": ["Добавить в сравнение", "Додати до порівняння", "Add to comparison"],
    "reports.restoreBtn": ["Восстановить", "Відновити", "Restore"],
    "reports.deleteForeverBtn": ["Удалить навсегда", "Видалити назавжди", "Delete permanently"],
    "reports.confirmDeleteForever": [
      "Удалить {name} навсегда? Статистика будет стёрта без возможности восстановления.",
      "Видалити {name} назавжди? Статистику буде стерто без можливості відновлення.",
      "Delete {name} permanently? The stats will be erased with no way to recover them.",
    ],
    "reports.deleteBtn": ["Удалить", "Видалити", "Delete"],
    "reports.confirmDeleteFromReport": ["Удалить {name} из этого отчёта?", "Видалити {name} з цього звіту?", "Delete {name} from this report?"],

    "reports.screenLabel": ["Скрин {n}: {label}", "Скрин {n}: {label}", "Screenshot {n}: {label}"],
    "reports.noScreenBinding": ["Без привязки к скрину", "Без прив'язки до скрину", "Not linked to a screenshot"],
    "reports.renameBatchTitle": ["Переименовать метку скрина", "Перейменувати мітку скрину", "Rename the screenshot label"],
    "reports.okBtn": ["OK", "OK", "OK"],

    "reports.colComparison": ["Сравнение", "Порівняння", "Comparison"],
    "reports.radarLabelPvp": ["PvP урон", "PvP урон", "PvP damage"],
    "reports.radarLabelKills": ["Килы", "Кили", "Kills"],
    "reports.radarLabelDeaths": ["Смерти", "Смерті", "Deaths"],
    "reports.radarLabelKd": ["K:D", "K:D", "K:D"],
    "reports.radarLabelPve": ["PvE урон", "PvE урон", "PvE damage"],
    "reports.radarUnavailableHint": [
      "Сравнение доступно, если выбрана неделя или конкретное мероприятие.",
      "Порівняння доступне, якщо обрано тиждень або конкретний захід.",
      "Comparison is available once a week or a specific event is selected.",
    ],
    "reports.legendCurrentPeriod": ["Текущий период", "Поточний період", "Current period"],
    "reports.legendAverage": ["Среднее", "Середнє", "Average"],

    "reports.addMorePeopleHint": ["Добавьте ещё хотя бы одного человека — сравнение появится само.", "Додайте ще хоча б одну людину — порівняння з'явиться само.", "Add at least one more person — the comparison appears automatically."],

    "reports.weeklyEffTitle": ["Недельная эффективность", "Тижнева ефективність", "Weekly performance"],
    "reports.weeklyEffSub": ["Выбранная неделя vs среднее за всё время", "Обраний тиждень vs середнє за весь час", "Selected week vs the all-time average"],
    "reports.multiWeekEffTitle": ["Эффективность за несколько недель", "Ефективність за кілька тижнів", "Performance over several weeks"],
    "reports.multiWeekEffSub": ["{n} {weekWord} вместе vs средняя неделя", "{n} {weekWord} разом vs середній тиждень", "{n} {weekWord} combined vs an average week"],
    "reports.eventEffTitle": ["Эффективность мероприятия", "Ефективність заходу", "Event performance"],
    "reports.eventEffSub": ["Мероприятие vs среднее по всем мероприятиям", "Захід vs середнє по всіх заходах", "This event vs the average across all events"],
    "reports.overallTitle": ["Общая статистика", "Загальна статистика", "Overall stats"],
    "reports.overallSub": ["За всё время", "За весь час", "All time"],
  };

  function getLang(){
    const v = localStorage.getItem(LANG_KEY);
    return LANGS.includes(v) ? v : DEFAULT_LANG;
  }

  function locale(){
    return BCP47_LANG[getLang()] || BCP47_LANG[DEFAULT_LANG];
  }

  function t(key, fallback){
    const entry = DICT[key];
    if(entry){
      const idx = LANGS.indexOf(getLang());
      if(entry[idx] != null) return entry[idx];
      const ruIdx = LANGS.indexOf(DEFAULT_LANG);
      if(entry[ruIdx] != null) return entry[ruIdx];
    }
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
    // data-i18n-html="key" — как data-i18n, но innerHTML вместо textContent, для
    // текста с инлайн-разметкой (<b>, списки и т.п.) — словарь хранит готовый HTML
    root.querySelectorAll("[data-i18n-html]").forEach(el => {
      el.innerHTML = t(el.getAttribute("data-i18n-html"), el.getAttribute("data-i18n-fallback"));
    });
    document.querySelectorAll("[data-i18n-switch]").forEach(el => {
      el.classList.toggle("active", el.dataset.i18nSwitch === getLang());
    });
    document.documentElement.lang = HTML_LANG[getLang()] || "ru";
  }

  function setLang(code){
    if(!LANGS.includes(code)) return;
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

  window.L2I18n = { t, getLang, setLang, applyTranslations, renderSwitcher, locale };
  document.addEventListener("DOMContentLoaded", () => applyTranslations());
})();
