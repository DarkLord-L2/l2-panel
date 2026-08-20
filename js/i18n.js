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
    "payout.hint": [
      "На каждом скрине «Журнала посещаемости» первым в списке участников всегда стоит лидер пати — отсюда и берётся привязка «кто с каким лидером сколько раз был в одной группе». Помогает лидеру решить, кому и сколько передать при личной раздаче денег/дропа.",
      "На кожному скрині «Журналу відвідуваності» першим у списку учасників завжди стоїть лідер паті — звідси і береться прив'язка «хто з яким лідером скільки разів був в одній групі». Допомагає лідеру вирішити, кому і скільки передати при особистій роздачі грошей/дропу.",
      "On every “Attendance Log” screenshot the party leader is always the first entry — that's how “who was in whose party how many times” is tracked. Helps a leader decide who to pay out and how much when splitting money/loot in person.",
    ],
    "payout.fromLabel": ["С", "Від", "From"],
    "payout.toLabel": ["По", "До", "To"],
    "payout.leaderLabel": ["Пати-лидер", "Паті-лідер", "Party leader"],
    "payout.noDateHint": [
      "Даты не заданы — показывается статистика за всё время.",
      "Дати не задані — показується статистика за весь час.",
      "No dates set — showing all-time statistics.",
    ],
    "payout.colNick": ["Ник", "Нік", "Nickname"],
    "payout.colTogether": ["Раз вместе", "Разів разом", "Times together"],
    "payout.colShare": ["Доля от раздач", "Частка від роздач", "Share of payouts"],
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
    "dkp.partyPageHint": [
      "Тот же расчёт, что в «ДКП Соло», только по пати целиком: начальные баллы — суммарная явка всех участников пати, % буста и коэффициент — их среднее по пати, голда делится между пати пропорционально финальным баллам.",
      "Той самий розрахунок, що в «ДКП Соло», тільки по паті цілком: початкові бали — сумарна явка всіх учасників паті, % бусту і коефіцієнт — їх середнє по паті, голда ділиться між паті пропорційно фінальним балам.",
      "Same calculation as “DKP Solo”, but for the whole party: initial points are the party's total attendance, boost % and coefficient are the party's average, gold is split between parties proportionally to final points.",
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
