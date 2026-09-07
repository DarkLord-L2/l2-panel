-- «Налоги»: настраиваемый шаблон готового текста для копирования одной кнопкой
-- («📋 Скопировать отчёт») вместо ручной сборки сообщения для Telegram/Discord
-- каждую неделю. Плейсхолдеры подставляются числами текущей недели — см.
-- taxes.html (buildTaxReportText). NULL — используется дефолтный шаблон в коде.
alter table public.tax_settings add column if not exists report_template text;
