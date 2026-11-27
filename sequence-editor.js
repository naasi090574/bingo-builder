'use strict';

const sequenceDraft = document.querySelector('#sequence-draft');
const sequenceMethod = document.querySelector('#sequence-method');
const sequenceCheck = document.querySelector('#sequence-check');
const sequenceItemsDraft = document.querySelector('#sequence-items-draft');
const sequenceAddItem = document.querySelector('#sequence-add-item');

function newSequenceItem() {
  return { text: '', media: null };
}

function initializeSequenceDraft(task) {
  taskDraft.items = task ? task.items.map(item => ({ ...item })) : [newSequenceItem(), newSequenceItem()];
  taskDraft.method ??= 'drag';
  taskDraft.check ??= 'instant';
}

function renderSequenceDraft() {
  sequenceDraft.hidden = taskDraft.type !== 'sequence';
  if (sequenceDraft.hidden) {
    sequenceItemsDraft.replaceChildren();
    return;
  }
  clearTaskOptionThumbs();
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
    row.append(legend, label, taskOptionImageField(item.media, 'Добавить картинку элемента',
      (media, imageKey) => { item.media = media ? { ...media, imageKey } : null; },
      index + 1, renderSequenceDraft), actions);
    return row;
  }));
  sequenceAddItem.disabled = taskDraft.items.length >= 10;
}

function validateSequenceDraft() {
  if (taskDraft.items.every(item => item.text.trim() || item.media)) return true;
  taskEditorStatus.textContent = 'Добавьте текст или картинку для каждого элемента.';
  return false;
}

document.querySelector('#add-sequence-task').addEventListener('click', () => openTaskEditor(null, 'sequence'));
sequenceMethod.addEventListener('change', () => { taskDraft.method = sequenceMethod.value; });
sequenceCheck.addEventListener('change', () => { taskDraft.check = sequenceCheck.value; });
sequenceAddItem.addEventListener('click', () => {
  if (taskDraft.items.length >= 10) return;
  taskDraft.items.push(newSequenceItem());
  renderSequenceDraft();
});
