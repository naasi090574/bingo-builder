'use strict';

const boards = document.querySelector('#boards');
const drawSlot = document.querySelector('#draw-slot');
const drawButton = document.querySelector('#draw');
const status = document.querySelector('#status');
const settings = readGameSettings(new URLSearchParams(window.location.search));
const playerNames = [settings.player1, settings.player2];
const task = document.querySelector('#task');
const taskText = document.querySelector('#task-text');
let game;

function cardImage(card) {
  const image = document.createElement('img');
  image.src = card.image;
  image.alt = card.label;
  image.draggable = false;
  return image;
}

function renderBoard(cells, player) {
  const active = game.player === player;
  const won = active && game.winning.length > 0;
  const board = document.createElement('section');
  board.className = `board player-${player + 1}`;
  board.classList.toggle('active', active);
  board.setAttribute('aria-labelledby', `player-${player + 1}`);

  const heading = document.createElement('div');
  heading.className = 'board-heading';
  const title = document.createElement('h2');
  title.id = `player-${player + 1}`;
  title.textContent = playerNames[player];
  const badge = document.createElement('span');
  badge.className = won ? 'badge winner-badge' : 'badge';
  badge.textContent = won ? 'Бинго!' : active ? 'Сейчас ходит' : 'Ожидает ход';
  heading.append(title, badge);

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.setProperty('--size', game.size);
  cells.forEach((cell, index) => {
    const button = document.createElement('button');
    button.className = 'cell';
    button.type = 'button';
    button.disabled = !active || !game.drawn || cell.marked || won;
    if (cell.marked) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = '✓';
      chip.setAttribute('aria-hidden', 'true');
      button.setAttribute('aria-label', 'Закрыто фишкой');
      button.append(chip);
    } else {
      button.append(cardImage(cell.card));
    }
    button.classList.toggle('winning', Boolean(won && game.winning.includes(index)));
    button.addEventListener('click', () => choose(button, player, index));
    grid.append(button);
  });
  const cellsArea = document.createElement('div');
  cellsArea.className = 'board-cells';
  cellsArea.append(grid);
  board.append(heading, cellsArea);
  return board;
}

function render() {
  boards.replaceChildren(...game.boards.map(renderBoard));
  const placeholder = document.createElement('span');
  placeholder.className = 'placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.textContent = '?';
  drawSlot.replaceChildren(game.drawn ? cardImage(game.drawn) : placeholder);
  drawButton.disabled = !game.canDraw;
  if (game.winning.length) {
    status.textContent = `Победа — ${playerNames[game.player]}!`;
  } else if (!game.drawn) {
    status.textContent = `${playerNames[game.player]}, достань карточку.`;
  } else if (game.canDraw) {
    status.textContent = 'Этой картинки нет на твоём поле. Достань следующую.';
  } else {
    status.textContent = 'Найди такую же картинку на своём поле.';
  }
}

function choose(button, player, index) {
  const result = game.choose(player, index);
  if (result === 'wrong') {
    button.classList.remove('shake');
    void button.offsetWidth;
    button.classList.add('shake');
    status.textContent = game.canDraw
      ? 'Этой картинки нет на твоём поле. Достань следующую.'
      : 'Попробуй ещё раз. Найди такую же картинку.';
  }
  if (result === 'task') {
    taskText.textContent = game.pending.text;
    task.showModal();
  }
}

function restart() {
  game = new BingoGame({ ...bingoContent, size: settings.size, taskOrder: settings.order }, settings.victory);
  render();
}

drawButton.addEventListener('click', () => {
  if (!game.draw()) return;
  render();
  if (!game.canDraw) boards.querySelector('.active .cell:not(:disabled)')?.focus();
});

task.addEventListener('cancel', event => event.preventDefault());
document.querySelector('#complete').addEventListener('click', () => {
  game.completeTask();
  task.close();
  render();
  (game.winning.length ? document.querySelector('#reset') : drawButton).focus();
});
document.querySelector('#reset').addEventListener('click', restart);
document.title = settings.title;
document.querySelector('#game-title').textContent = settings.title;
document.querySelector('#victory-rule').textContent = victoryLabels[settings.victory];
restart();
