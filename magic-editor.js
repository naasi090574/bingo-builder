'use strict';

const magicDraft = document.querySelector('#magic-draft');
const magicRounds = document.querySelector('#magic-rounds');
const magicAfter = document.querySelector('#magic-after');
const magicOrder = document.querySelector('#magic-order');

function newMagicRound() {
  return { mode: 'multiply', media: null, count: 4, beforeSize: 85, afterSize: 40 };
}

function initializeMagicDraft(task) {
  taskDraft.rounds = task ? task.rounds.map(round => ({ ...round })) : [newMagicRound()];
  taskDraft.after = task?.after ?? 'Что получилось? Назови.';
  taskDraft.roundOrder = task?.roundOrder ?? 'sequential';
  if (!task) taskDraft.text = 'Назови предметы и нажми на картинку.';
}

function magicRange(round, field, name, min, max, unit = '') {
  const label = document.createElement('label');
  label.textContent = name;
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min;
  slider.max = max;
  slider.value = round[field];
  const output = document.createElement('output');
  output.value = slider.value + unit;
  slider.addEventListener('input', () => {
    round[field] = Number(slider.value);
    output.value = slider.value + unit;
  });
  label.append(slider, output);
  return label;
}

function renderMagicDraft() {
  magicDraft.hidden = taskDraft.type !== 'magic';
  magicRounds.replaceChildren();
  if (magicDraft.hidden) return;
  clearTaskOptionThumbs();
  magicAfter.value = taskDraft.after;
  magicOrder.value = taskDraft.roundOrder;
  const rounds = taskDraft.rounds;
  rounds.forEach((round, index) => {
    const row = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = `Раунд ${index + 1}`;
    const label = document.createElement('label');
    label.textContent = 'Режим превращения';
    const select = document.createElement('select');
    select.append(...Object.entries(magicModes).map(([value, name]) => new Option(name, value)));
    select.value = round.mode;
    select.addEventListener('change', () => {
      round.mode = select.value;
      if (round.mode === 'grow' && round.beforeSize >= round.afterSize) {
        [round.beforeSize, round.afterSize] = [40, 85];
      } else if (round.mode === 'shrink' && round.beforeSize <= round.afterSize) {
        [round.beforeSize, round.afterSize] = [85, 40];
      }
      renderMagicDraft();
      magicRounds.children[index].querySelector('select').focus();
    });
    label.append(select);
    const actions = document.createElement('div');
    actions.className = 'library-actions';
    for (const [offset, symbol, name] of [[-1, '↑', 'Поднять'], [1, '↓', 'Опустить']]) {
      const target = index + offset;
      const button = libraryButton(symbol, `${name} раунд ${index + 1}`, () => {
        [rounds[index], rounds[target]] = [rounds[target], rounds[index]];
        renderMagicDraft();
      });
      button.disabled = !rounds[target];
      actions.append(button);
    }
    actions.append(libraryButton('Дублировать', `Дублировать раунд ${index + 1}`, () => {
      rounds.splice(index + 1, 0, { ...round });
      renderMagicDraft();
    }));
    const remove = libraryButton('Удалить', `Удалить раунд ${index + 1}`, () => {
      rounds.splice(index, 1);
      renderMagicDraft();
    });
    remove.disabled = rounds.length === 1;
    actions.append(remove);
    row.append(legend, label,
      taskOptionImageField(round.media, 'Загрузить изображение', media => { round.media = media; },
        undefined, renderMagicDraft));
    if (magicUsesCopies(round.mode)) row.append(magicRange(round, 'count', 'Количество предметов', 2, 24));
    else row.append(magicRange(round, 'beforeSize', 'Исходный размер', 15, 100, '%'),
      magicRange(round, 'afterSize', 'Конечный размер', 15, 100, '%'));
    row.append(actions);
    magicRounds.append(row);
  });
}

function validateMagicDraft() {
  const invalid = taskDraft.rounds.findIndex(round => !validMagicRound(round));
  if (invalid === -1) return true;
  const round = taskDraft.rounds[invalid];
  const error = !round.media ? 'загрузите изображение.' : round.mode === 'shrink'
    ? 'конечный размер должен быть меньше исходного.' : 'конечный размер должен быть больше исходного.';
  taskEditorStatus.textContent = `Раунд ${invalid + 1}: ${error}`;
  return false;
}

document.querySelector('#add-magic-task').addEventListener('click', () => openTaskEditor(null, 'magic'));
document.querySelector('#magic-add-round').addEventListener('click', () => {
  taskDraft.rounds.push(newMagicRound());
  renderMagicDraft();
});
magicAfter.addEventListener('input', () => { taskDraft.after = magicAfter.value; });
magicOrder.addEventListener('change', () => { taskDraft.roundOrder = magicOrder.value; });
