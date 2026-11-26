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
let cardLibrary = initialCardLibrary();
let gameImageUrls = [];
let receivedCardUpdate = false;

function applyCardLibrary(library) {
  if (!Array.isArray(library?.cards)) return;
  cardLibrary = library;
  restart();
}


function cardImage(card) {
  const image = document.createElement('img');
  image.src = card.image;
  image.alt = card.label;
  image.draggable = false;
  return image;
}

function cardContent(card) {
  if (!card.text) return cardImage(card);
  const content = document.createElement('span');
  content.className = card.image ? 'card-content has-caption' : 'card-content';
  if (card.image) content.append(cardImage(card));
  const text = document.createElement('span');
  text.className = 'card-text';
  text.textContent = card.text;
  text.title = card.text;
  text.style.setProperty('--text-scale', Math.min(0.48, 2 / Math.sqrt(card.text.length)));
  content.append(text);
  return content;
}

function renderBoard(cells, player) {
  const { outcome } = game;
  const active = (outcome?.winner ?? game.player) === player;
  const won = outcome?.winner === player;
  const tied = outcome?.winner === null;
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
  badge.className = won || tied ? 'badge winner-badge' : 'badge';
  badge.textContent = tied ? 'Ничья' : won ? 'Бинго!' : active ? 'Сейчас ходит' : 'Ожидает ход';
  heading.append(title, badge);

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.setProperty('--size', game.size);
  cells.forEach((cell, index) => {
    const button = document.createElement('button');
    button.className = 'cell';
    button.type = 'button';
    button.disabled = !active || !game.drawn || cell.marked || Boolean(outcome);
    if (cell.marked) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = '✓';
      chip.setAttribute('aria-hidden', 'true');
      button.setAttribute('aria-label', 'Закрыто фишкой');
      button.append(chip);
    } else {
      button.dataset.cardId = cell.card.id;
      button.append(cardContent(cell.card));
    }
    button.classList.toggle('winning', Boolean((won || tied) && outcome.cells.includes(index)));
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
  const displayedCard = game.drawn ?? game.lastMiss;
  drawSlot.replaceChildren(displayedCard ? cardContent(displayedCard) : placeholder);
  drawButton.disabled = !game.canDraw;
  if (game.outcome) {
    const { winner } = game.outcome;
    status.textContent = winner === null ? 'Ничья! Оба игрока закрыли всё поле.'
      : `Победа — ${playerNames[winner]}!`;
  } else if (game.lastMiss) {
    status.textContent = `Совпадения нет. Ход переходит игроку «${playerNames[game.player]}».`;
  } else if (!game.drawn) {
    status.textContent = `${playerNames[game.player]}, достань карточку.`;
  } else {
    status.textContent = searchMessage();
  }
}

function searchMessage(wrong = false) {
  if (game.drawn.text) {
    if (game.canDraw) return 'Этой карточки нет на твоём поле. Достань следующую.';
    return wrong ? 'Попробуй ещё раз. Найди такую же карточку.' : 'Найди такую же карточку на своём поле.';
  }
  if (game.canDraw) return 'Этой картинки нет на твоём поле. Достань следующую.';
  return wrong ? 'Попробуй ещё раз. Найди такую же картинку.' : 'Найди такую же картинку на своём поле.';
}

function choose(button, player, index) {
  const result = game.choose(player, index);
  if (result === 'wrong') {
    button.classList.remove('shake');
    void button.offsetWidth;
    button.classList.add('shake');
    status.textContent = searchMessage(true);
  }
  if (result === 'task') {
    taskText.textContent = game.pending.text;
    task.showModal();
  }
}

function restart() {
  if (task.open) task.close();
  for (const url of gameImageUrls) URL.revokeObjectURL(url);
  gameImageUrls = [];
  const { size, order, victory, missedDraw } = settings;
  const reset = document.querySelector('#reset');
  const uniqueCount = uniqueCards(cardLibrary.cards).length;
  reset.disabled = uniqueCount < size ** 2;
  if (reset.disabled) {
    game = null;
    boards.replaceChildren();
    drawSlot.replaceChildren();
    drawButton.disabled = true;
    status.textContent = cardShortage(uniqueCount, size);
    return;
  }
  const cards = cardLibrary.cards.map(card => {
    if (!(card.image instanceof Blob)) return card;
    const image = URL.createObjectURL(card.image);
    gameImageUrls.push(image);
    return { ...card, image };
  });
  game = new BingoGame({
    ...bingoContent, cards, size, taskOrder: order, missedDraw, placements: libraryBoards(cardLibrary, size),
  }, victory);
  render();
}

drawButton.addEventListener('click', () => {
  if (!game?.draw()) return;
  render();
  if (!game.canDraw) boards.querySelector('.active .cell:not(:disabled)')?.focus();
});

task.addEventListener('cancel', event => event.preventDefault());
document.querySelector('#complete').addEventListener('click', () => {
  if (!game) return;
  game.completeTask();
  task.close();
  render();
  (game.outcome ? document.querySelector('#reset') : drawButton).focus();
});
document.querySelector('#reset').addEventListener('click', restart);
document.title = settings.title;
document.querySelector('#game-title').textContent = settings.title;
document.querySelector('#victory-rule').textContent = victoryLabels[settings.victory];
const cardSource = window.parent !== window ? window.parent : window.opener;
window.addEventListener('message', event => {
  if (!cardSource || event.source !== cardSource || event.origin !== window.origin) return;
  if (event.data?.type !== 'bingo:cards') return;
  receivedCardUpdate = true;
  applyCardLibrary(event.data.library);
});
readCardLibrary().then(library => {
  if (!receivedCardUpdate) applyCardLibrary(library);
}).catch(() => {
  if (!receivedCardUpdate) restart();
});
