'use strict';

const sequenceDraft = document.querySelector('#sequence-draft');
const sequenceMethod = document.querySelector('#sequence-method');
const sequenceCheck = document.querySelector('#sequence-check');
const sequenceItemsDraft = document.querySelector('#sequence-items-draft');
const sequenceAddItem = document.querySelector('#sequence-add-item');
const sequenceOrderHelp = document.querySelector('#sequence-order-help');
const composeShuffle = document.querySelector('#compose-shuffle');
const composeFollowUp = document.querySelector('#compose-follow-up');

function isSequenceDraft(type) {
  return type === 'sequence' || type === 'compose';
}

function sequenceItemLimit() {
  return taskDraft.type === 'compose' ? 20 : 10;
}

function newSequenceItem() {
  return { text: '', media: null };
}

function initializeSequenceDraft(task) {
  taskDraft.items = task ? task.items.map(item => ({ ...item })) : [newSequenceItem(), newSequenceItem()];
  taskDraft.method ??= 'drag';
  taskDraft.check ??= 'instant';
}

function renderSequenceDraft() {
  sequenceDraft.hidden = !isSequenceDraft(taskDraft.type);
  if (sequenceDraft.hidden) {
    sequenceItemsDraft.replaceChildren();
    return;
  }
  const compose = taskDraft.type === 'compose';
  clearTaskOptionThumbs();
  document.querySelector('#compose-shuffle-field').hidden = !compose;
  document.querySelector('#compose-follow-up-field').hidden = !compose;
  sequenceMethod.querySelector('[value="click"]').textContent = compose ? 'Нажатие' : 'Нажатие по порядку';
  composeShuffle.checked = taskDraft.shuffle ?? true;
  composeFollowUp.value = taskDraft.followUp ?? '';
  sequenceOrderHelp.textContent = compose
    ? 'Расположите основные элементы в порядке ответа. Отметьте элементы, которые в него не входят.'
    : 'Расположите элементы в правильном порядке. В игре они будут перемешаны.';
  sequenceMethod.value = taskDraft.method;
  sequenceCheck.value = taskDraft.check;
  sequenceItemsDraft.replaceChildren(...taskDraft.items.map((item, index, items) => {
    const row = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = `Элемент ${index + 1}`;
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.value = item.text;
    input.addEventListener('input', () => { item.text = input.value; });
    label.append('Текст элемента', input);
    const actions = document.createElement('div');
    actions.className = 'library-actions';
    function move(offset, symbol, name) {
      const next = index + offset;
      const button = libraryButton(symbol, `${name} элемент ${index + 1}`, () => {
        [items[index], items[next]] = [items[next], items[index]];
        renderSequenceDraft();
        sequenceItemsDraft.children[next].querySelector('input').focus();
      });
      button.disabled = !items[next];
      return button;
    }
    const remove = libraryButton('Удалить элемент', `Удалить элемент ${index + 1}`, () => {
      items.splice(index, 1);
      renderSequenceDraft();
    });
    remove.disabled = items.length <= 2;
    actions.append(move(-1, '↑', 'Поднять'), move(1, '↓', 'Опустить'), remove);
    row.append(legend, label);
    if (compose) {
      const extraLabel = document.createElement('label');
      extraLabel.className = 'choice-checkbox';
      const extra = document.createElement('input');
      extra.type = 'checkbox';
      extra.checked = Boolean(item.extra);
      extra.addEventListener('change', () => { item.extra = extra.checked; });
      extraLabel.append(extra, 'Лишний элемент');
      row.append(extraLabel);
    }
    row.append(taskOptionImageField(item.media, 'Добавить картинку элемента',
      (media, imageKey) => { item.media = media ? { ...media, imageKey } : null; },
      index + 1, renderSequenceDraft), actions);
    return row;
  }));
  sequenceAddItem.disabled = taskDraft.items.length >= sequenceItemLimit();
}

function validateSequenceDraft() {
  if (taskDraft.items.some(item => !item.text.trim() && !item.media)) {
    taskEditorStatus.textContent = 'Добавьте текст или картинку для каждого элемента.';
    return false;
  }
  if (taskDraft.type === 'compose' && taskDraft.items.every(item => item.extra)) {
    taskEditorStatus.textContent = 'Оставьте хотя бы один элемент в правильном ответе.';
    return false;
  }
  return true;
}

document.querySelector('#add-compose-task').addEventListener('click', () => openTaskEditor(null, 'compose'));
composeShuffle.addEventListener('change', () => { taskDraft.shuffle = composeShuffle.checked; });
composeFollowUp.addEventListener('input', () => { taskDraft.followUp = composeFollowUp.value; });
document.querySelector('#add-sequence-task').addEventListener('click', () => openTaskEditor(null, 'sequence'));
sequenceMethod.addEventListener('change', () => { taskDraft.method = sequenceMethod.value; });
sequenceCheck.addEventListener('change', () => { taskDraft.check = sequenceCheck.value; });
sequenceAddItem.addEventListener('click', () => {
  if (taskDraft.items.length >= sequenceItemLimit()) return;
  taskDraft.items.push(newSequenceItem());
  renderSequenceDraft();
});
