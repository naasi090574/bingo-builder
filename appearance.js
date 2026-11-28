'use strict';

const appearanceFonts = {
  system: { label: 'Системный', css: 'system-ui, sans-serif' },
  sans: { label: 'Arial', css: 'Arial, sans-serif' },
  serif: { label: 'Georgia', css: 'Georgia, serif' },
  mono: { label: 'Courier New', css: '"Courier New", monospace' },
  gogono: { label: 'Gogono Cocoa Mochi Cyrillic', css: '"Gogono Cocoa Mochi Cyrillic", sans-serif' },
  itim: { label: 'Itim Cyrillic', css: '"Itim Cyrillic", sans-serif' },
  ruthless: { label: 'Ruthless Sketch Italic', css: '"Ruthless Sketch Italic", sans-serif' },
  solKol: { label: 'Sol Kol', css: '"Sol Kol", sans-serif' },
};

const labelStyles = {
  title: { label: 'Название игры', size: 34, min: 20, max: 80, color: '#f6f8ff' },
  player: { label: 'Имена игроков', size: 18, min: 12, max: 80, color: '#f6f8ff' },
  victory: { label: 'Условие победы', size: 14, min: 12, max: 80, color: '#adb9ce' },
  drawTitle: { label: 'Заголовок «Выпавшая карточка»', size: 20, min: 12, max: 80, color: '#f6f8ff' },
  text: { label: 'Вспомогательные надписи и сообщения', size: 16, min: 12, max: 80, color: '#adb9ce' },
  button: { label: 'Текст кнопок', size: 16, min: 12, max: 80, color: '#102822', colorKey: 'buttonText' },
  task: { label: 'Текст вопроса или инструкции', size: 32, min: 12, max: 120, color: '#f6f8ff' },
  taskAnswer: { label: 'Текст элементов ответа', size: 30, min: 12, max: 120, color: '#f6f8ff' },
  taskFeedback: { label: 'Сообщения о правильных и неправильных ответах', size: 18, min: 12, max: 120, color: '#f6f8ff' },
  taskControl: { label: 'Текст кнопок внутри окна задания', size: 18, min: 12, max: 120, color: '#102822' },
  choiceOption: { label: 'Текст вариантов', size: 18, min: 12, max: 32, color: '#f6f8ff' },
  choiceDrop: { label: 'Текст принимающей области', size: 16, min: 12, max: 28, color: '#adb9ce' },
  choiceCheck: { label: 'Текст кнопки «Проверить»', size: 18, min: 12, max: 32, color: '#102822' },
  sortingGroup: { label: 'Названия групп при сортировке', size: 22, min: 12, max: 120, color: '#f6f8ff' },
  sortingItem: { label: 'Текст элементов', size: 16, min: 10, max: 28, color: '#f6f8ff' },
  taskButton: { label: 'Текст кнопки «Задание выполнено»', size: 18, min: 12, max: 32, color: '#102822' },
  activeBadge: { label: 'Сейчас ходит', size: 14, min: 12, max: 22, color: '#6bf4c1' },
  idleBadge: { label: 'Ожидает ход', size: 14, min: 12, max: 22, color: '#d1daea' },
};

const gameLabelKeys = ['title', 'player', 'victory', 'drawTitle', 'text', 'button'];
const gameLabelEffects = {
  Spacing: { label: 'Межбуквенный интервал', initial: '0', min: -2, max: 10, step: .5 },
  Weight: { label: 'Начертание', initial: 'auto', choices: { auto: 'По умолчанию', normal: 'Обычное', bold: 'Жирное' } },
  Stroke: { label: 'Обводка', initial: 'off', choices: { off: 'Выключена', on: 'Включена' } },
  StrokeColor: { label: 'Цвет обводки', initial: '#000000' },
  StrokeWidth: { label: 'Толщина обводки', initial: '1', min: 0, max: 5, step: .5 },
  Shadow: { label: 'Тень', initial: 'off', choices: { off: 'Выключена', on: 'Включена' } },
  ShadowColor: { label: 'Цвет тени', initial: '#000000' },
  ShadowOpacity: { label: 'Непрозрачность тени', initial: '70', min: 0, max: 100, unit: '%' },
  ShadowX: { label: 'Горизонтальное смещение', initial: '1', min: -20, max: 20, step: .5 },
  ShadowY: { label: 'Вертикальное смещение', initial: '2', min: -20, max: 20, step: .5 },
  ShadowBlur: { label: 'Размытие тени', initial: '3', min: 0, max: 20, step: .5 },
};

const taskTypographyKeys = ['task', 'taskAnswer', 'sortingGroup', 'taskFeedback', 'taskControl'];
const individualTaskTypographyKeys = ['task', 'taskAnswer'];

function typographyValue(key, field, value) {
  if (field === 'Font') return Object.hasOwn(appearanceFonts, value) ? appearanceFonts[value].css : '';
  if (field === 'Color') return /^#[0-9a-f]{6}$/i.test(value) ? value : '';
  const size = Number(value);
  const { min, max } = labelStyles[key];
  return value != null && value !== '' && Number.isFinite(size)
    ? `${Math.max(min, Math.min(max, size)) / 16}rem` : '';
}

function labelColorKey(key, style) {
  return style.colorKey ?? `${key}Color`;
}

const choiceAppearanceGroups = {
  choiceOption: {
    title: 'Варианты ответа',
    fields: {
      Background: ['Цвет фона', '#26374b'],
      Opacity: ['Непрозрачность фона', '100', 100, '%'],
      Border: ['Цвет рамки', '#50617a'],
      BorderWidth: ['Толщина рамки', '1', 12, 'px'],
      Radius: ['Скругление', '12', 40, 'px'],
      Selected: ['Цвет выбора', '#aebcff'],
      Right: ['Цвет правильного ответа', '#6bf4c1'],
      Wrong: ['Цвет неправильного ответа', '#f19a9a'],
    },
  },
  choiceDrop: {
    title: 'Принимающая область',
    fields: {
      Background: ['Цвет фона', '#111c2d'],
      Opacity: ['Непрозрачность фона', '100', 100, '%'],
      Border: ['Цвет рамки', '#50617a'],
      BorderWidth: ['Толщина рамки', '2', 12, 'px'],
      Radius: ['Скругление', '14', 40, 'px'],
    },
  },
  choiceCheck: {
    title: 'Кнопка «Проверить»',
    fields: {
      Background: ['Цвет фона', '#6bf4c1'],
      Border: ['Цвет рамки', '#6bf4c1'],
      BorderWidth: ['Толщина рамки', '0', 12, 'px'],
      Radius: ['Скругление', '10', 40, 'px'],
    },
  },
};

const sortingAppearanceGroups = {
  sortingGroup: {
    title: 'Группы',
    fields: {
      Background: ['Цвет фона', '#111c2d'],
      Opacity: ['Непрозрачность фона', '100', 100, '%'],
      Border: ['Цвет рамки', '#50617a'],
      BorderWidth: ['Толщина рамки', '2', 12, 'px'],
      Radius: ['Скругление', '14', 40, 'px'],
    },
  },
  sortingItem: {
    title: 'Элементы',
    fields: {
      Background: ['Цвет фона', '#26374b'],
      Opacity: ['Непрозрачность фона', '100', 100, '%'],
      Border: ['Цвет рамки', '#50617a'],
      BorderWidth: ['Толщина рамки', '1', 12, 'px'],
      Radius: ['Скругление', '9', 40, 'px'],
      Right: ['Цвет правильного распределения', '#6bf4c1'],
      Wrong: ['Цвет ошибки', '#f19a9a'],
    },
  },
};

const interactiveAppearanceGroups = { ...choiceAppearanceGroups, ...sortingAppearanceGroups };

const defaultAppearance = {
  backgroundMode: 'default',
  backgroundColor: '#0d1422',
  boardColor: '#182235',
  boardOpacity: '100',
  boardDim: '25',
  boardBorder: '#34425a',
  boardBorderWidth: '1',
  boardBorderOpacity: '100',
  boardSize: '100',
  boardRadius: '20',
  cellColor: '#26374b',
  cellOpacity: '100',
  cellBorder: '#43546b',
  cellBorderWidth: '1',
  cellBorderOpacity: '100',
  imageSize: '94',
  cellRadius: '13',
  buttonColor: '#6bf4c1',
  activeBadgeBackground: '#304853',
  activeBadgeOpacity: '100',
  idleBadgeBackground: '#29354b',
  idleBadgeOpacity: '100',
  avatarSize: '56',
  avatarBorder: '#50617a',
  avatarBorderWidth: '2',
  avatarBackground: '#26374b',
  avatarOpacity: '100',
  avatarZoom: '100',
  drawPanelColor: '#182235',
  drawPanelOpacity: '100',
  drawPanelRadius: '20',
  drawPanelOffsetX: '0',
  drawPanelOffsetY: '0',
  drawPanelHeight: '100',
  drawSlotColor: '#111c2d',
  drawSlotOpacity: '100',
  drawSlotBorder: '#50617a',
  drawSlotWidth: '1',
  drawSlotBorderOpacity: '100',
  drawSlotRadius: '13',
  ...Object.fromEntries(gameLabelKeys.flatMap(key =>
    Object.entries(gameLabelEffects).map(([field, effect]) => [key + field, effect.initial]))),
  ...Object.fromEntries(Object.entries(labelStyles).flatMap(([key, style]) => [
    [`${key}Font`, 'system'],
    [`${key}Size`, String(style.size)],
    [labelColorKey(key, style), style.color],
  ])),
  ...Object.fromEntries(Object.entries(interactiveAppearanceGroups).flatMap(([prefix, { fields }]) =>
    Object.entries(fields).map(([key, [, initial]]) => [prefix + key, initial]))),
  activeColor: '#6bf4c1',
  taskBackground: '#182235',
  taskOpacity: '100',
  taskBorder: '#6bf4c1',
  taskBorderWidth: '1',
  taskRadius: '24',
  taskButtonBackground: '#6bf4c1',
  taskBackdrop: '80',
};

function appearanceOrigin() {
  return window.origin === 'null' ? '*' : window.origin;
}
