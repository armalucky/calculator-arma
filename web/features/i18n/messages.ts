export type Language = 'ru' | 'en';

interface StartupMessages {
  pageTitle: string;
  language: string;
  title: string;
  description: string;
  status: string;
  loading: string;
  loadError: string;
  next: string;
  desktop: string;
  stage: string;
}

export const messages: Record<Language, StartupMessages> = {
  ru: {
    pageTitle: 'LuckyMap · Веб-версия',
    language: 'Язык',
    title: 'Веб-версия в разработке',
    description: 'Здесь появится LuckyMap с картой, игровыми расчётами и сохранением ваших точек в браузере.',
    status: 'Каталог карты и игровых таблиц загружен',
    loading: 'Загрузка каталога ресурсов…',
    loadError: 'Не удалось загрузить каталог. Перезагрузите страницу, чтобы повторить.',
    next: 'Игровая логика перенесена и проверена по ПК-версии. Следующий этап — интерактивная карта. Интерфейс расчётов и сохранения пока недоступны.',
    desktop: 'До завершения переноса пользуйтесь программой LuckyMap для Windows.',
    stage: 'Этап 5 · Игровая логика',
  },
  en: {
    pageTitle: 'LuckyMap · Web version',
    language: 'Language',
    title: 'Web version in development',
    description: 'LuckyMap is coming to your browser, with its map, game calculations and locally saved points.',
    status: 'Map and game table catalog loaded',
    loading: 'Loading resource catalog…',
    loadError: 'Could not load the catalog. Reload the page to retry.',
    next: 'Game logic has been ported and checked against the desktop version. Next: the interactive map. Calculation controls and saves are not available yet.',
    desktop: 'Keep using LuckyMap for Windows while the web version is being built.',
    stage: 'Step 5 · Game logic',
  },
};
