'use strict';

const revealDraft = document.querySelector('#reveal-draft');
const revealRounds = document.querySelector('#reveal-rounds');
const revealOrder = document.querySelector('#reveal-order');
let revealPreviewIndex = 0;

function newRevealRound() {
  return { riddle: '', showRiddle: true, answer: null, cover: null, audio: null };
}

function initializeRevealDraft(task) {
  revealPreviewIndex = 0;
  taskDraft.rounds = task ? task.rounds.map(round => ({ ...round })) : [newRevealRound()];
  taskDraft.roundOrder = task?.roundOrder ?? 'sequential';
  if (!task) taskDraft.text = 'Отгадай загадку и нажми на карточку.';
}

function sendRevealPreview(content, open = true) {
  frame.contentWindow.postMessage({ type: 'bingo:reveal-draft', task: content, open }, appearanceOrigin());
}

function refreshRevealDraftPreview() {
  if (!taskEditor.open || taskDraft.type !== 'reveal' || !individualTaskAppearance.open) return;
  sendRevealPreview({ ...taskDraft, text: taskForm.elements.text.value, previewRound: revealPreviewIndex });
}

function revealAudioField(round, index) {
  const group = document.createElement('div');
  group.className = 'library-actions';
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = taskAudioInput.accept;
  input.hidden = true;
  input.addEventListener('change', () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    runTaskDraftAction(async () => {
      await validateTaskAudio(file);
      round.audio = { file, name: file.name };
      renderRevealDraft();
    });
  });
  const label = round.audio ? 'Заменить аудио' : 'Добавить аудио';
  group.append(input, libraryButton(label, `${label} в раунде ${index + 1}`, () => input.click()));
  if (round.audio) {
    const name = document.createElement('span');
    name.textContent = round.audio.name;
    group.append(name, libraryButton('Удалить аудио', `Удалить аудио в раунде ${index + 1}`, () => {
      round.audio = null;
      renderRevealDraft();
    }));
  }
  return group;
}

function renderRevealDraft() {
  revealDraft.hidden = taskDraft.type !== 'reveal';
  revealRounds.replaceChildren();
  if (revealDraft.hidden) return;
  clearTaskOptionThumbs();
  revealOrder.value = taskDraft.roundOrder;
  const rounds = taskDraft.rounds;
  revealPreviewIndex = Math.min(revealPreviewIndex, rounds.length - 1);
  rounds.forEach((round, index) => {
    const row = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = `Раунд ${index + 1}`;
    const label = document.createElement('label');
    const riddle = document.createElement('textarea');
    riddle.rows = 3;
    riddle.value = round.riddle;
    riddle.addEventListener('input', () => {
      round.riddle = riddle.value;
      refreshRevealDraftPreview();
    });
    label.append('Текст загадки или вопроса', riddle);
    const visibility = document.createElement('label');
    visibility.className = 'choice-checkbox';
    const show = document.createElement('input');
    show.type = 'checkbox';
    show.checked = round.showRiddle;
    show.addEventListener('change', () => {
      round.showRiddle = show.checked;
      refreshRevealDraftPreview();
    });
    visibility.append(show, 'Показывать текст загадки');

    const actions = document.createElement('div');
    actions.className = 'library-actions';
    for (const [offset, symbol, name] of [[-1, '↑', 'Поднять'], [1, '↓', 'Опустить']]) {
      const target = index + offset;
      const button = libraryButton(symbol, `${name} раунд ${index + 1}`, () => {
        [rounds[index], rounds[target]] = [rounds[target], rounds[index]];
        renderRevealDraft();
      });
      button.disabled = !rounds[target];
      actions.append(button);
    }
    actions.append(libraryButton('Дублировать', `Дублировать раунд ${index + 1}`, () => {
      rounds.splice(index + 1, 0, { ...round });
      renderRevealDraft();
    }));
    const remove = libraryButton('Удалить', `Удалить раунд ${index + 1}`, () => {
      rounds.splice(index, 1);
      renderRevealDraft();
    });
    remove.disabled = rounds.length === 1;
    actions.append(remove);
    row.append(legend, label, visibility, revealAudioField(round, index));
    for (const [field, caption] of [['answer', 'Изображение-отгадка'], ['cover', 'Закрывающее изображение (необязательно)']]) {
      const group = document.createElement('div');
      const heading = document.createElement('p');
      heading.textContent = caption;
      group.append(heading, taskOptionImageField(round[field], `Загрузить: ${caption}`,
        media => { round[field] = media; }, undefined, renderRevealDraft));
      row.append(group);
    }
    row.append(actions);
    row.addEventListener('focusin', () => {
      if (revealPreviewIndex === index) return;
      revealPreviewIndex = index;
      refreshRevealDraftPreview();
    });
    revealRounds.append(row);
  });
  refreshRevealDraftPreview();
}

function validateRevealDraft() {
  const missing = taskDraft.rounds.findIndex(round => !round.answer);
  if (missing === -1) return true;
  taskEditorStatus.textContent = `Раунд ${missing + 1}: загрузите изображение-отгадку.`;
  return false;
}

document.querySelector('#add-reveal-task').addEventListener('click', () => openTaskEditor(null, 'reveal'));
document.querySelector('#reveal-live-preview').addEventListener('click', () => {
  if (individualTaskAppearance.open) refreshRevealDraftPreview();
  else individualTaskAppearance.open = true;
});
document.querySelector('#reveal-add-round').addEventListener('click', () => {
  taskDraft.rounds.push(newRevealRound());
  renderRevealDraft();
});
revealOrder.addEventListener('change', () => {
  taskDraft.roundOrder = revealOrder.value;
  refreshRevealDraftPreview();
});
taskForm.elements.text.addEventListener('input', refreshRevealDraftPreview);
