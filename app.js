'use strict';

const boards = document.querySelector('#boards');
const drawSlot = document.querySelector('#draw-slot');
const drawButton = document.querySelector('#draw');
const status = document.querySelector('#status');
const victoryRule = document.querySelector('#victory-rule');
let settings = readGameSettings(new URLSearchParams(window.location.search));
const playerNames = [settings.player1, settings.player2];
const task = document.querySelector('#task');
const taskText = document.querySelector('#task-text');
const taskBody = document.querySelector('#task-body');
const taskImages = document.querySelector('#task-images');
const taskAudio = document.querySelector('#task-audio');
const choiceArea = document.querySelector('#task-choice');
const taskComplete = document.querySelector('#complete');
const taskPreviewClose = document.querySelector('#close-task-preview');
const interactiveTasks = {
  choice: { label: 'Выбери правильный ответ', mount: mountChoiceTask },
  odd: { label: 'Найди лишнее', mount: mountChoiceTask },
  sorting: { label: 'Рассортируй по группам', mount: mountSortingTask },
  pairs: { label: 'Соедини пары', mount: mountPairsTask },
  sequence: { label: 'Восстанови последовательность', mount: mountSequenceTask },
  compose: { label: 'Собери слово или предложение', mount: mountSequenceTask },
};
const choiceCheckButton = document.querySelector('#check-choice');
let disposeInteractiveTask;
let taskUrls = [];
let previewingTask = false;
let interactiveTask = false;
let taskReady = false;
let gameTasks = initialTaskLibrary();
let receivedTaskUpdate = false;
const turnNotice = document.querySelector('#turn-notice');
const nextPlayer = document.querySelector('#next-player');
let turnTimer;
let game;
let gameLibraryReady = false;
let cardLibrary = initialCardLibrary();
let gameImageUrls = [];
let receivedCardUpdate = false;
let tokenSettings = normalizeTokenSettings();
let tokenImageUrls = [];
let receivedTokenUpdate = false;
let receivedSoundUpdate = false;

function applyTokens(settings) {
  tokenSettings = normalizeTokenSettings(settings);
  for (const url of tokenImageUrls) if (url) URL.revokeObjectURL(url);
  tokenImageUrls = [0, 1].map(player => {
    const { shape, image } = playerToken(tokenSettings, player);
    return shape === 'custom' ? URL.createObjectURL(image) : null;
  });
  if (game) render();
}

function applyCardLibrary(library) {
  if (!Array.isArray(library?.cards)) return;
  cardLibrary = library;
  gameLibraryReady = true;
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

function renderBoard(cells, player, newMark) {
  const { outcome } = game;
  const active = turnNotice.hidden && (outcome?.winner ?? game.player) === player;
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
      const config = playerToken(tokenSettings, player);
      if (config.placement !== 'replace') button.append(cardContent(cell.card));
      const animate = newMark?.player === player && newMark.index === index;
      button.append(createToken(config, tokenImageUrls[player], animate));
      button.setAttribute('aria-label', `Закрыто фишкой: ${cell.card.label || cell.card.text}`);
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

function render(newMark) {
  boards.replaceChildren(...game.boards.map((cells, player) => renderBoard(cells, player, newMark)));
  const placeholder = document.createElement('span');
  placeholder.className = 'placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.textContent = '?';
  const displayedCard = game.drawn ?? game.lastMiss;
  drawSlot.replaceChildren(displayedCard ? cardContent(displayedCard) : placeholder);
  drawButton.disabled = !turnNotice.hidden || !game.canDraw;
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

function renderAfterMove(previousPlayer, newMark) {
  if (game.outcome || previousPlayer === game.player) {
    render(newMark);
    return;
  }
  nextPlayer.textContent = `Ходит ${playerNames[game.player]}`;
  turnNotice.hidden = false;
  render(newMark);
  turnTimer = setTimeout(() => {
    turnNotice.hidden = true;
    render();
    drawButton.focus();
  }, 1500);
}

function searchMessage(wrong = false) {
  const available = game.hasOpenCard(game.drawn);
  if (game.drawn.text) {
    if (!available) return 'Этой карточки нет на твоём поле. Достань следующую.';
    return wrong ? 'Попробуй ещё раз. Найди такую же карточку.' : 'Найди такую же карточку на своём поле.';
  }
  if (!available) return 'Этой картинки нет на твоём поле. Достань следующую.';
  return wrong ? 'Попробуй ещё раз. Найди такую же картинку.' : 'Найди такую же картинку на своём поле.';
}

function clearTaskMedia() {
  disposeInteractiveTask?.();
  disposeInteractiveTask = undefined;
  choiceArea.replaceChildren();
  choiceArea.hidden = true;
  choiceCheckButton.hidden = true;
  const type = task.dataset.interactiveType;
  if (type) {
    task.classList.remove(`has-${type}`);
    delete task.dataset.interactiveType;
  }
  taskAudio.pause();
  if (taskAudio.hasAttribute('src')) {
    taskAudio.removeAttribute('src');
    taskAudio.load();
  }
  taskImages.replaceChildren();
  for (const url of taskUrls) URL.revokeObjectURL(url);
  taskUrls = [];
}

function taskMediaUrl(blob) {
  const url = URL.createObjectURL(blob);
  taskUrls.push(url);
  return url;
}

function applyIndividualTaskTypography(typography) {
  for (const key of individualTaskTypographyKeys) {
    for (const field of ['Font', 'Size', 'Color']) {
      const property = `--individual-${key}-${field.toLowerCase()}`;
      const value = typographyValue(key, field, typography?.[key]?.[field]);
      if (value) task.style.setProperty(property, value);
      else task.style.removeProperty(property);
    }
  }
}

function showTask(content, preview = false) {
  clearTaskMedia();
  previewingTask = preview;
  setTaskSoundOpen(true);
  applyIndividualTaskTypography(content?.typography);
  taskText.textContent = typeof content === 'string' ? content : content?.text ?? '';
  taskText.hidden = !taskText.textContent.trim();
  for (const item of content?.images ?? []) {
    const image = document.createElement('img');
    image.src = taskMediaUrl(item.image);
    image.alt = item.name;
    taskImages.append(image);
  }
  taskImages.hidden = !taskImages.childElementCount;
  if (content?.audio) {
    taskAudio.src = taskMediaUrl(content.audio.file);
  }
  taskAudio.hidden = !content?.audio;
  const type = content?.type;
  if (type === 'compose') choiceArea.before(taskAudio);
  else if (taskAudio.parentElement === taskBody) taskBody.after(taskAudio);
  const interactive = Object.hasOwn(interactiveTasks, type) ? interactiveTasks[type] : null;
  interactiveTask = Boolean(interactive);
  if (interactive) {
    task.dataset.interactiveType = type;
    task.classList.add(`has-${type}`);
  }
  task.setAttribute('aria-label', interactive?.label ?? 'Устное задание');
  setTaskReady(!interactiveTask);
  if (interactive) {
    choiceArea.hidden = false;
    disposeInteractiveTask = interactive.mount(content, choiceArea, choiceCheckButton, taskMediaUrl, setTaskReady,
      correct => playGameSounds(correct ? 'taskRight' : 'taskWrong'));
  }
  taskBody.hidden = taskText.hidden && taskImages.hidden && choiceArea.hidden;
  if (!task.open) task.showModal();
  taskBody.scrollTop = 0;
}

function replaceGameTasks(tasks) {
  gameTasks = tasks;
  if (game) {
    game.tasks = tasks;
    game.taskDeck = [];
  }
}

function choose(button, player, index) {
  const result = game.choose(player, index);
  if (result === 'wrong') {
    button.classList.remove('shake');
    void button.offsetWidth;
    button.classList.add('shake');
    status.textContent = searchMessage(true);
    playGameSounds('miss');
  }
  if (result === 'task') {
    showTask(game.pending.task);
    playGameSounds('match', 'taskOpen');
  }
}

function restart() {
  resetGameSounds();
  clearTimeout(turnTimer);
  turnNotice.hidden = true;
  if (task.open && !previewingTask) task.close();
  for (const url of gameImageUrls) URL.revokeObjectURL(url);
  gameImageUrls = [];
  const { size, order, victory, missedDraw } = settings;
  const reset = document.querySelector('#reset');
  const uniqueCount = uniqueCards(cardLibrary.cards).length;
  reset.disabled = uniqueCount < size ** 2;
  victoryRule.disabled = reset.disabled;
  renderVictoryRule(victory);
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
    ...bingoContent, cards, tasks: gameTasks, size, taskOrder: order, missedDraw, placements: libraryBoards(cardLibrary, size),
  }, victory);
  render();
}

drawButton.addEventListener('click', () => {
  const player = game?.player;
  if (!turnNotice.hidden || !game?.draw()) return;
  startGameSounds('draw', ...(player !== game.player ? ['turn'] : []));
  renderAfterMove(player);
  if (!game.canDraw) boards.querySelector('.active .cell:not(:disabled)')?.focus();
});

task.addEventListener('cancel', event => {
  if (!previewingTask) event.preventDefault();
});
task.addEventListener('close', () => {
  if (!task.open) {
    clearTaskMedia();
    setTaskSoundOpen(false);
  }
});
function setTaskReady(ready) {
  taskReady = ready;
  taskComplete.hidden = !ready;
  taskComplete.disabled = !ready;
  taskPreviewClose.hidden = !(previewingTask && interactiveTask && !ready);
}

function finishTask() {
  if (!task.open || !taskReady) return;
  if (previewingTask) {
    task.close();
    return;
  }
  if (!game?.pending) return;
  const player = game.player;
  const { index } = game.pending;
  game.completeTask();
  taskAudio.pause();
  task.close();
  const resultSound = game.outcome ? (game.outcome.winner !== null ? ['win'] : [])
    : player !== game.player ? ['turn'] : [];
  playGameSounds('taskComplete', 'token', ...resultSound);
  renderAfterMove(player, { player, index });
  if (game.outcome) document.querySelector('#reset').focus();
}
taskComplete.addEventListener('click', finishTask);
taskPreviewClose.addEventListener('click', () => {
  if (previewingTask) task.close();
});
document.querySelector('#reset').addEventListener('click', () => {
  restart();
  if (game) startGameSounds();
});
initGameSounds();
function renderVictoryRule(mode) {
  const custom = mode !== 'line' && mode !== 'full';
  victoryRule.options[0].textContent = custom ? victoryLabels[mode] : '';
  victoryRule.value = custom ? '' : mode;
  victoryRule.title = victoryLabels[mode];
}

victoryRule.addEventListener('change', () => {
  if (!game || !['line', 'full'].includes(victoryRule.value)) return;
  const previousOutcome = game.outcome;
  game.setVictoryMode(victoryRule.value);
  renderVictoryRule(game.mode);
  if (game.outcome) {
    clearTimeout(turnTimer);
    turnNotice.hidden = true;
    if (game.outcome.winner !== null && game.outcome.winner !== previousOutcome?.winner) playGameSounds('win');
  }
  render();
});

function renderGameSettings() {
  playerNames[0] = settings.player1;
  playerNames[1] = settings.player2;
  document.title = settings.title;
  document.querySelector('#game-title').textContent = settings.title;
  renderVictoryRule(settings.victory);
}

function applyPreviewSettings(search) {
  const updated = readGameSettings(new URLSearchParams(search));
  if (Object.keys(updated).every(key => updated[key] === settings[key])) return;
  settings = updated;
  if (task.open) task.close();
  renderGameSettings();
  if (gameLibraryReady) restart();
}

renderGameSettings();
const cardSource = window.parent !== window ? window.parent : window.opener;
window.addEventListener('message', event => {
  if (!cardSource || event.source !== cardSource || event.origin !== window.origin) return;
  if (window.parent !== window && event.data?.type === 'bingo:preview-settings' &&
      typeof event.data.search === 'string') {
    applyPreviewSettings(event.data.search);
  }
  if (event.data?.type === 'bingo:tokens') {
    receivedTokenUpdate = true;
    applyTokens(event.data.settings);
  }
  if (event.data?.type === 'bingo:sounds') {
    receivedSoundUpdate = true;
    applyGameSounds(event.data.settings);
  }
  if (event.data?.type === 'bingo:cards') {
    receivedCardUpdate = true;
    applyCardLibrary(event.data.library);
  }
  if (event.data?.type === 'bingo:tasks' && Array.isArray(event.data.tasks)) {
    receivedTaskUpdate = true;
    replaceGameTasks(event.data.tasks);
  }
  if (event.data?.type === 'bingo:preview-task' && (!task.open || previewingTask)) {
    showTask(event.data.task, true);
    playGameSounds('taskOpen');
  }
});
if (window.parent !== window) {
  window.parent.postMessage({ type: 'bingo:settings-ready' },
    window.origin === 'null' ? '*' : window.origin);
}
cardSource?.postMessage({ type: 'bingo:tokens-ready' }, window.origin === 'null' ? '*' : window.origin);
tokenStorage('readonly').then(settings => {
  if (!receivedTokenUpdate) applyTokens(settings);
}).catch(() => {});
cardSource?.postMessage({ type: 'bingo:sounds-ready' }, window.origin === 'null' ? '*' : window.origin);
soundStorage().then(settings => {
  if (!receivedSoundUpdate) applyGameSounds(settings);
}).catch(() => {});
const loadTasks = readTaskLibrary().then(tasks => {
  if (!receivedTaskUpdate) replaceGameTasks(tasks);
}).catch(() => {});
Promise.all([readCardLibrary(), loadTasks]).then(([library]) => {
  if (!receivedCardUpdate) applyCardLibrary(library);
}).catch(() => {
  if (!receivedCardUpdate) applyCardLibrary(initialCardLibrary());
});
