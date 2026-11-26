'use strict';

const cardItems = document.querySelector('#card-items');
const libraryFeedback = document.querySelector('#library-feedback');
const manualArea = document.querySelector('#manual-cards');
const cardMode = document.querySelector('#card-mode');
const cardPlayer = document.querySelector('#card-player');
const manualGrid = document.querySelector('#manual-grid');
const manualCard = document.querySelector('#manual-card');
const cardEditor = document.querySelector('#card-editor');
const editForm = document.querySelector('#edit-card');
const editFeedback = document.querySelector('#card-editor-feedback');
const cancelEdit = document.querySelector('#cancel-card-edit');
const saveEdit = editForm.querySelector('button[type=submit]');
const uploadCards = document.querySelector('#upload-cards');
let library = initialCardLibrary();
let thumbnailUrls = new Map();
let selectedCell = 0;
let draggedCard;
let editedCard;

function currentCardSettings() {
  return readGameSettings(new FormData(form));
}

function notifyCardViews() {
  const message = { type: 'bingo:cards', library };
  frame.contentWindow.postMessage(message, appearanceOrigin());
  for (const popup of appearancePopups) {
    if (popup.closed) appearancePopups.delete(popup);
    else popup.postMessage(message, appearanceOrigin());
  }
}

let cardQueue = readCardLibrary().then(state => {
  library = state;
  renderLibrary();
}).catch(() => {
  libraryFeedback.textContent = 'Не удалось прочитать сохранённые карточки.';
  renderLibrary();
});

function queueCardAction(action) {
  const result = cardQueue.then(action);
  cardQueue = result.catch(() => {});
  return result;
}

async function saveCards(change) {
  library = await updateCardLibrary(change);
  renderLibrary();
  notifyCardViews();
}

function storageError() {
  libraryFeedback.textContent = 'Не удалось сохранить карточки. Проверьте доступное место и настройки хранилища браузера.';
}

function changeCards(change) {
  return queueCardAction(async () => {
    await saveCards(change);
    libraryFeedback.textContent = '';
  }).catch(storageError);
}

function newCardId() {
  return `card-${crypto.getRandomValues(new Uint32Array(4)).join('-')}`;
}

async function readCardImage(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const prefix = (...values) => values.every((value, index) => bytes[index] === value);
  const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  const png = prefix(137, 80, 78, 71, 13, 10, 26, 10);
  const jpeg = prefix(255, 216, 255);
  const webp = ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  if (!png && !jpeg && !webp) throw new Error('Допустимы изображения PNG, JPG, JPEG и WEBP.');
  const blob = file.slice(0, file.size, png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp');
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return blob;
  } catch {
    throw new Error('Не удалось прочитать изображение.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function thumbnail(card) {
  const preview = document.createElement('span');
  preview.className = 'library-thumbnail';
  if (card?.image) {
    const image = document.createElement('img');
    image.src = thumbnailUrls.get(card.id) ?? card.image;
    image.alt = '';
    image.draggable = false;
    preview.append(image);
  } else {
    preview.textContent = card?.text ?? '—';
  }
  return preview;
}

function libraryButton(text, label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'library-button';
  button.textContent = text;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', onClick);
  return button;
}

function moveCard(id, target) {
  if (id === target) return;
  changeCards(state => {
    const cards = [...state.cards];
    const from = cards.findIndex(card => card.id === id);
    const to = cards.findIndex(card => card.id === target);
    if (from < 0 || to < 0) return state;
    const [card] = cards.splice(from, 1);
    cards.splice(to, 0, card);
    return { ...state, cards };
  });
}

function renderCardRow(card, index) {
  const row = document.createElement('li');
  row.dataset.cardId = card.id;
  const grip = document.createElement('span');
  grip.className = 'card-grip';
  grip.textContent = '⠿';
  grip.title = 'Перетащить карточку';
  grip.setAttribute('aria-hidden', 'true');
  grip.draggable = true;
  grip.addEventListener('dragstart', event => {
    draggedCard = card.id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', card.id);
  });
  grip.addEventListener('dragend', () => {
    draggedCard = undefined;
    for (const item of cardItems.querySelectorAll('.card-drop-target')) item.classList.remove('card-drop-target');
  });
  row.addEventListener('dragover', event => {
    if (!draggedCard || draggedCard === card.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    row.classList.add('card-drop-target');
  });
  row.addEventListener('dragleave', event => {
    if (!row.contains(event.relatedTarget)) row.classList.remove('card-drop-target');
  });
  row.addEventListener('drop', event => {
    if (!draggedCard) return;
    event.preventDefault();
    row.classList.remove('card-drop-target');
    moveCard(draggedCard, card.id);
  });

  const label = document.createElement('span');
  label.className = 'library-name';
  label.textContent = card.label;
  const actions = document.createElement('div');
  actions.className = 'card-row-actions';
  const up = libraryButton('↑', `Поднять «${card.label}»`, () => moveCard(card.id, library.cards[index - 1].id));
  const down = libraryButton('↓', `Опустить «${card.label}»`, () => moveCard(card.id, library.cards[index + 1].id));
  up.disabled = index === 0;
  down.disabled = index === library.cards.length - 1;
  actions.append(up, down,
    libraryButton('Изменить', `Изменить «${card.label}»`, () => openCardEditor(card)),
    libraryButton('Удалить', `Удалить «${card.label}»`, () => changeCards(state => removeCard(state, card.id))));
  row.append(grip, thumbnail(card), label, actions);
  return row;
}

function removeCard(state, id) {
  const placements = Object.fromEntries(Object.entries(state.placements).map(([size, fields]) =>
    [size, fields.map(field => field.map(savedId => savedId === id ? null : savedId))]));
  return { ...state, cards: state.cards.filter(card => card.id !== id), placements };
}

function renderPlacement() {
  const { size, player1, player2 } = currentCardSettings();
  const count = size ** 2;
  selectedCell = Math.min(selectedCell, count - 1);
  const player = Number(cardPlayer.value);
  cardPlayer.replaceChildren(new Option(player1, '0'), new Option(player2, '1'));
  cardPlayer.value = String(player);

  cardMode.value = library.manual ? 'manual' : 'auto';
  manualArea.hidden = !library.manual;
  manualGrid.style.setProperty('--size', size);
  const occupied = libraryBoards(library, size)?.[player] ?? [];
  const cards = new Map(library.cards.map(card => [card.id, card]));
  manualGrid.replaceChildren(...Array.from({ length: count }, (_, index) => {
    const card = cards.get(occupied[index]);
    const button = libraryButton(String(index + 1),
      `Клетка ${index + 1}: ${card?.label ?? 'случайная карточка'}`,
      () => {
        selectedCell = index;
        renderPlacement();
        manualGrid.children[index].focus();
      });
    button.setAttribute('aria-pressed', String(index === selectedCell));
    if (card) button.replaceChildren(thumbnail(card));
    return button;
  }));
  document.querySelector('#manual-cell-number').textContent = String(selectedCell + 1);
  const selectedId = occupied[selectedCell];
  const unavailable = new Set(occupied);
  unavailable.delete(selectedId);
  manualCard.replaceChildren(new Option('Выбрать случайно', ''), ...library.cards
    .filter(card => !unavailable.has(card.id))
    .map(card => new Option(card.label, card.id)));
  manualCard.value = cards.has(selectedId) ? selectedId : '';

  const shortage = document.querySelector('#card-shortage');
  shortage.hidden = library.cards.length >= count;
  shortage.textContent = shortage.hidden ? '' : cardShortage(library.cards.length, size);
  document.querySelector('#shuffle-cards').disabled = !shortage.hidden;
}

function renderLibrary() {
  const previous = thumbnailUrls;
  thumbnailUrls = new Map(library.cards.filter(card => card.image instanceof Blob)
    .map(card => [card.id, URL.createObjectURL(card.image)]));
  cardItems.replaceChildren(...library.cards.map(renderCardRow));
  for (const url of previous.values()) URL.revokeObjectURL(url);
  document.querySelector('#card-count').textContent = String(library.cards.length);
  document.querySelector('#clear-cards').disabled = library.cards.length === 0;
  renderPlacement();
}

function updateCardEditorFields() {
  const type = editForm.elements.type.value;
  document.querySelector('#card-text-field').hidden = type === 'image';
  editForm.elements.text.required = type !== 'image';
  document.querySelector('#card-image-field').hidden = type === 'text';
  editForm.elements.image.required = type !== 'text' && !editedCard?.image;
}

function openCardEditor(card) {
  editedCard = card;
  editForm.reset();
  editForm.elements.label.value = card?.label ?? '';
  editForm.elements.type.value = card?.image ? (card.text ? 'caption' : 'image') : 'text';
  editForm.elements.text.value = card?.text ?? '';
  editFeedback.textContent = '';
  updateCardEditorFields();
  cardEditor.showModal();
}

uploadCards.addEventListener('change', () => {
  const files = [...uploadCards.files];
  uploadCards.value = '';
  if (!files.length) return;
  queueCardAction(async () => {
    const results = await Promise.allSettled(files.map(readCardImage));
    const added = results.flatMap((result, index) => result.status === 'fulfilled' ? [{
      id: newCardId(),
      label: files[index].name.replace(/\.[^.]+$/, '').slice(0, 100) || 'Изображение',
      image: result.value,
    }] : []);
    if (added.length) await saveCards(state => ({ ...state, cards: [...state.cards, ...added] }));
    const invalid = files.length - added.length;
    libraryFeedback.textContent = invalid
      ? `Добавлено: ${added.length}. Не удалось загрузить: ${invalid}. Проверьте формат (PNG, JPG, JPEG, WEBP).`
      : `Добавлено карточек: ${added.length}.`;
  }).catch(storageError);
});

document.querySelector('#add-text-card').addEventListener('click', () => openCardEditor());
cancelEdit.addEventListener('click', () => cardEditor.close());
cardEditor.addEventListener('cancel', event => {
  if (saveEdit.disabled) event.preventDefault();
});
editForm.elements.type.addEventListener('change', updateCardEditorFields);
editForm.addEventListener('submit', event => {
  event.preventDefault();
  const current = editedCard;
  const { label, type, text, image } = Object.fromEntries(new FormData(editForm));
  if (!label.trim() || (type !== 'image' && !text.trim())) {
    editFeedback.textContent = 'Введите название и текст карточки.';
    return;
  }
  saveEdit.disabled = true;
  cancelEdit.disabled = true;
  queueCardAction(async () => {
    const card = { id: current?.id ?? newCardId(), label: label.trim() };
    if (type !== 'text') {
      try {
        card.image = image.size ? await readCardImage(image) : current?.image;
        if (!card.image) throw new Error('Выберите изображение.');
      } catch (error) {
        editFeedback.textContent = error.message;
        return;
      }
    }
    if (type !== 'image') card.text = text.trim();
    await saveCards(state => ({
      ...state,
      cards: current ? state.cards.map(saved => saved.id === card.id ? card : saved) : [...state.cards, card],
    }));
    cardEditor.close();
  }).catch(() => {
    editFeedback.textContent = 'Не удалось сохранить карточку.';
  }).finally(() => {
    saveEdit.disabled = false;
    cancelEdit.disabled = false;
  });
});

document.querySelector('#clear-cards').addEventListener('click', () => {
  if (window.confirm('Удалить все карточки, включая исходный набор?')) {
    changeCards(state => ({ ...state, cards: [], placements: {} }));
  }
});
cardMode.addEventListener('change', () => {
  const manual = cardMode.value === 'manual';
  changeCards(state => ({ ...state, manual }));
});
cardPlayer.addEventListener('change', () => {
  selectedCell = 0;
  renderPlacement();
});
manualCard.addEventListener('change', () => {
  const id = manualCard.value || null;
  const player = Number(cardPlayer.value);
  const { size } = currentCardSettings();
  const index = selectedCell;
  changeCards(state => {
    const fields = (state.placements[size] ?? [[], []]).map(field => [...field]);
    if (id && (!state.cards.some(card => card.id === id) ||
      fields[player].some((savedId, slot) => savedId === id && slot !== index))) return state;
    fields[player][index] = id;
    return { ...state, placements: { ...state.placements, [size]: fields } };
  });
});
document.querySelector('#shuffle-cards').addEventListener('click', () => {
  queueCardAction(() => {
    if (library.cards.length < currentCardSettings().size ** 2) return;
    notifyCardViews();
    libraryFeedback.textContent = library.manual
      ? 'Свободные клетки перемешаны. Ручной выбор сохранён.'
      : 'Карточки перемешаны.';
  });
});
form.addEventListener('input', renderPlacement);
form.addEventListener('change', renderPlacement);
