'use strict';

const pairsDraft = document.querySelector('#pairs-draft');
const pairsMethod = document.querySelector('#pairs-method');
const pairsCheck = document.querySelector('#pairs-check');
const pairsShuffle = document.querySelector('#pairs-shuffle');
const pairsItemsDraft = document.querySelector('#pairs-items-draft');
const pairsAddItem = document.querySelector('#pairs-add-item');

function newTaskPair() {
  return Array.from({ length: 2 }, () => ({ text: '', media: null }));
}

function initializePairsDraft(task) {
  taskDraft.pairs = task ? task.pairs.map(pair => pair.map(item => ({ ...item })))
    : [newTaskPair(), newTaskPair()];
  taskDraft.method ??= 'click';
  taskDraft.check ??= 'instant';
  taskDraft.shuffle ??= true;
}

function renderPairsDraft() {
  pairsDraft.hidden = taskDraft.type !== 'pairs';
  if (pairsDraft.hidden) {
    pairsItemsDraft.replaceChildren();
    return;
  }
  clearTaskOptionThumbs();
  pairsMethod.value = taskDraft.method;
  pairsCheck.value = taskDraft.check;
  pairsShuffle.checked = taskDraft.shuffle;
  pairsItemsDraft.replaceChildren(...taskDraft.pairs.map((pair, index) => {
    const row = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = `Пара ${index + 1}`;
    const sides = document.createElement('div');
    sides.className = 'pairs-draft-sides';
    pair.forEach((item, side) => {
      const entry = document.createElement('div');
      const sideLabel = side ? 'Справа' : 'Слева';
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.value = item.text;
      input.addEventListener('input', () => { item.text = input.value; });
      label.append(sideLabel, input);
      entry.append(label, taskOptionImageField(item.media, `Добавить картинку: ${sideLabel.toLowerCase()}`,
        media => { item.media = media; }, undefined, renderPairsDraft));
      sides.append(entry);
    });
    const remove = libraryButton('Удалить пару', `Удалить пару ${index + 1}`, () => {
      taskDraft.pairs.splice(index, 1);
      renderPairsDraft();
    });
    remove.disabled = taskDraft.pairs.length <= 2;
    row.append(legend, sides, remove);
    return row;
  }));
  pairsAddItem.disabled = taskDraft.pairs.length >= 8;
}

function validatePairsDraft() {
  if (taskDraft.pairs.flat().every(item => item.text.trim() || item.media)) return true;
  taskEditorStatus.textContent = 'Добавьте текст или картинку для обеих сторон каждой пары.';
  return false;
}

document.querySelector('#add-pairs-task').addEventListener('click', () => openTaskEditor(null, 'pairs'));
pairsMethod.addEventListener('change', () => { taskDraft.method = pairsMethod.value; });
pairsCheck.addEventListener('change', () => { taskDraft.check = pairsCheck.value; });
pairsShuffle.addEventListener('change', () => { taskDraft.shuffle = pairsShuffle.checked; });
pairsAddItem.addEventListener('click', () => {
  if (taskDraft.pairs.length >= 8) return;
  taskDraft.pairs.push(newTaskPair());
  renderPairsDraft();
});
