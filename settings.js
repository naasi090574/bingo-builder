'use strict';

const victoryLabels = {
  horizontal: 'Горизонталь',
  vertical: 'Вертикаль',
  diagonal: 'Диагональ',
  line: 'Линия в любом направлении',
  full: 'Всё поле',
};

const taskOrderLabels = { random: 'Случайный', sequential: 'Последовательный' };

const defaultGameSettings = {
  title: 'Бинго',
  boardTitle: 'Бинго',
  showBoardTitle: 'yes',
  player1: 'Игрок 1',
  player2: 'Игрок 2',
  size: 4,
  order: 'random',
  victory: 'line',
  missedDraw: 'retry',
};

function readGameSettings(params) {
  const readText = (key, limit) =>
    params.get(key)?.trim().slice(0, limit) || defaultGameSettings[key];
  const size = Number(params.get('size'));
  const order = params.get('order');
  const victory = params.get('victory');

  const title = params.get('title')?.trim().slice(0, 60) ?? defaultGameSettings.title;
  return {
    title,
    boardTitle: params.get('boardTitle')?.trim().slice(0, 60) ?? title,
    showBoardTitle: params.get('showBoardTitle') === 'no' ? 'no' : 'yes',
    player1: readText('player1', 32),
    player2: readText('player2', 32),
    size: [2, 3, 4, 5].includes(size) ? size : defaultGameSettings.size,
    order: Object.hasOwn(taskOrderLabels, order) ? order : defaultGameSettings.order,
    victory: Object.hasOwn(victoryLabels, victory) ? victory : defaultGameSettings.victory,
    missedDraw: params.get('missedDraw') === 'pass' ? 'pass' : defaultGameSettings.missedDraw,
  };
}
