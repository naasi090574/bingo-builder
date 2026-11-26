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
  title: { label: 'Название игры', size: 34, min: 20, max: 48, color: '#f6f8ff' },
  player: { label: 'Имена игроков', size: 18, min: 12, max: 22, color: '#f6f8ff' },
  victory: { label: 'Условие победы', size: 14, min: 12, max: 22, color: '#adb9ce' },
  drawTitle: { label: 'Заголовок «Выпавшая карточка»', size: 20, min: 12, max: 22, color: '#f6f8ff' },
  text: { label: 'Вспомогательные надписи и сообщения', size: 16, min: 12, max: 22, color: '#adb9ce' },
  button: { label: 'Текст кнопок', size: 16, min: 12, max: 22, color: '#102822', colorKey: 'buttonText' },
  task: { label: 'Текст заданий', size: 32, min: 16, max: 38, color: '#f6f8ff' },
  activeBadge: { label: 'Сейчас ходит', size: 14, min: 12, max: 22, color: '#6bf4c1' },
  idleBadge: { label: 'Ожидает ход', size: 14, min: 12, max: 22, color: '#d1daea' },
};

function labelColorKey(key, style) {
  return style.colorKey ?? `${key}Color`;
}

const defaultAppearance = {
  backgroundMode: 'default',
  backgroundColor: '#0d1422',
  boardColor: '#182235',
  boardOpacity: '100',
  boardSize: '100',
  boardRadius: '20',
  cellColor: '#26374b',
  cellOpacity: '100',
  imageSize: '94',
  cellRadius: '13',
  buttonColor: '#6bf4c1',
  activeBadgeBackground: '#304853',
  activeBadgeOpacity: '100',
  idleBadgeBackground: '#29354b',
  idleBadgeOpacity: '100',
  drawPanelColor: '#182235',
  drawPanelOpacity: '100',
  drawPanelRadius: '20',
  drawSlotColor: '#111c2d',
  drawSlotOpacity: '100',
  drawSlotBorder: '#50617a',
  drawSlotWidth: '1',
  drawSlotRadius: '13',
  ...Object.fromEntries(Object.entries(labelStyles).flatMap(([key, style]) => [
    [`${key}Font`, 'system'],
    [`${key}Size`, String(style.size)],
    [labelColorKey(key, style), style.color],
  ])),
  activeColor: '#6bf4c1',
};

function appearanceOrigin() {
  return window.origin === 'null' ? '*' : window.origin;
}
