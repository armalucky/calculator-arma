export const mapMessages = {
  ru: {
    heading: 'Бахмут', subtitle: 'Игровая карта · Arma Reforger', modes: 'Действие на карте',
    move: 'Обзор', position: 'Позиция A', target: 'Цель B',
    a: 'A1 · Позиция', b: 'B · Цель', format: 'Формат', exact: 'X / Z, метры', cell: 'Клетка', coordinates: 'Координаты', apply: 'Задать',
    layers: 'Слои карты', roads: 'Дороги', buildings: 'Здания', grid: 'Сетка', names: 'Названия',
    all: 'Вся карта', pair: 'К точкам', reset: 'Сброс A/B', plus: 'Приблизить', minus: 'Отдалить',
    points: 'Точки сценария', select: 'Выбрать точку', use: 'Назначить точку', noPoint: 'Не задана',
    help: 'Колесо — масштаб · Правая / средняя кнопка — перемещение · Стрелки и Home — при фокусе карты',
    loading: 'Загрузка карты…', error: 'Не удалось загрузить карту. Проверьте соединение и повторите.', retry: 'Повторить',
    tileError: 'Часть деталей не загружена. Показана обзорная подложка.',
    local: 'Точки пока не сохраняются после перезагрузки страницы.',
    cursor: 'Курсор', length: 'Расстояние A–B', metres: 'м', stage: 'Arma Reforger · Локальное сохранение и перенос JSON',
  },
  en: {
    heading: 'Bakhmut', subtitle: 'Game map · Arma Reforger', modes: 'Map action',
    move: 'Pan', position: 'Position A', target: 'Target B',
    a: 'A1 · Position', b: 'B · Target', format: 'Format', exact: 'X / Z, metres', cell: 'Grid cell', coordinates: 'Coordinates', apply: 'Set',
    layers: 'Map layers', roads: 'Roads', buildings: 'Buildings', grid: 'Grid', names: 'Names',
    all: 'Whole map', pair: 'Show A/B', reset: 'Clear A/B', plus: 'Zoom in', minus: 'Zoom out',
    points: 'Scenario points', select: 'Select a point', use: 'Assign point', noPoint: 'Not set',
    help: 'Wheel: zoom · Right / middle drag: pan · Arrow keys and Home: while map is focused',
    loading: 'Loading map…', error: 'Could not load the map. Check your connection and retry.', retry: 'Retry',
    tileError: 'Some details could not load. Showing the overview underneath.',
    local: 'Points are not saved when you reload the page yet.',
    cursor: 'Cursor', length: 'A–B distance', metres: 'm', stage: 'Arma Reforger · Local saves and JSON transfer',
  },
};
export function coordinateError(message: string, language: 'ru' | 'en'): string {
  if (language === 'ru') return message;
  const errors: Record<string, string> = {
    'Введите две координаты через пробел.': 'Enter two coordinates separated by a space.',
    'Координаты должны быть числами.': 'Coordinates must be numbers.',
    'Номер клетки — целое число от 000 до 102.': 'Grid numbers must be integers from 000 to 102.',
    'Точка должна быть в пределах карты: 0–10240 м.': 'The point must be within the map: 0–10240 metres.',
  };
  return errors[message] ?? 'Check the coordinates and try again.';
}
