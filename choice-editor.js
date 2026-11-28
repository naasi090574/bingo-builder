'use strict';

const choiceDraft = document.querySelector('#choice-draft');
const choiceMethodField = document.querySelector('#choice-method-field');
const oddFollowUp = document.querySelector('#odd-follow-up');
const oddFollowUpField = document.querySelector('#odd-follow-up-field');
const choiceMethod = document.querySelector('#choice-method');
const choiceCheckMode = document.querySelector('#choice-check-mode');
const choiceShuffle = document.querySelector('#choice-shuffle');
const choiceDropDraft = document.querySelector('#choice-drop-draft');
const choiceDraftOptions = document.querySelector('#choice-draft-options');
const choiceAddOption = document.querySelector('#choice-add-option');
const oddRoundControls = document.querySelector('#odd-round-controls');
const oddRoundSelect = document.querySelector('#odd-round');
const oddRemoveRound = document.querySelector('#odd-remove-round');
const oddEarlierRound = document.querySelector('#odd-earlier-round');
const oddLaterRound = document.querySelector('#odd-later-round');
let oddRoundIndex = 0;
let taskOptionThumbUrls = [];

function isChoiceDraft(type) {
  return type === 'choice' || type === 'odd';
}

function choiceOptionLimit() {
  return taskDraft.type === 'odd' ? Infinity : 8;
}

function newChoiceOption() {
  return { text: '', correct: false, media: null };
}

function emptyOddRound() {
  return { options: [newChoiceOption(), newChoiceOption()], followUp: '' };
}

function copyOddRound(round) {
  return { followUp: round.followUp ?? '', options: round.options.map(option => ({ ...option })) };
}

function initializeChoiceDraft(task) {
  if (taskDraft.type === 'odd') {
    taskDraft.rounds = task ? oddTaskRounds(task).map(copyOddRound) : [emptyOddRound()];
    delete taskDraft.options;
    delete taskDraft.followUp;
    oddRoundIndex = 0;
  } else {
    taskDraft.options = task ? task.options.map(option => ({ ...option })) : [newChoiceOption(), newChoiceOption()];
  }
}

function activeChoiceOptions() {
  return taskDraft.type === 'odd' ? taskDraft.rounds[oddRoundIndex].options : taskDraft.options;
}

function clearTaskOptionThumbs() {
  for (const url of taskOptionThumbUrls) URL.revokeObjectURL(url);
  taskOptionThumbUrls = [];
}

function taskOptionImageField(media, label, update, answerNumber, render = renderChoiceDraft) {
  const group = document.createElement('div');
  group.className = 'choice-draft-media';
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = taskImagesInput.accept;
  input.hidden = true;
  input.addEventListener('change', () => {
    const file = input.files[0];
    input.value = '';
    if (file) runTaskDraftAction(async () => {
      const { image, imageKey } = await readCardImage(file);
      update({ image, name: file.name }, imageKey);
      render();
    });
  });
  if (media) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(media.image);
    taskOptionThumbUrls.push(img.src);
    img.alt = media.name;
    group.append(img);
  }
  const uploadLabel = media ? 'Заменить картинку' : label;
  const uploadName = answerNumber ? `${uploadLabel} (вариант ${answerNumber})` : label;
  group.append(input, libraryButton(uploadLabel, uploadName, () => input.click()));
  const removeName = answerNumber ? `Удалить картинку ответа (вариант ${answerNumber})` : `Удалить: ${label}`;
  if (media) group.append(libraryButton('Удалить картинку', removeName, () => {
    update(null);
    render();
  }));
  return group;
}

function renderChoiceDraft() {
  clearTaskOptionThumbs();
  choiceDraft.hidden = !isChoiceDraft(taskDraft.type);
  if (choiceDraft.hidden) {
    choiceDraftOptions.replaceChildren();
    choiceDropDraft.replaceChildren();
    return;
  }
  const odd = taskDraft.type === 'odd';
  choiceMethodField.hidden = odd;
  oddFollowUpField.hidden = !odd;
  oddRoundControls.hidden = !odd;
  if (odd) {
    const rounds = taskDraft.rounds;
    oddRoundSelect.replaceChildren(...rounds.map((_, index) =>
      new Option(`Раунд ${index + 1} из ${rounds.length}`, String(index))));
    oddRoundSelect.value = String(oddRoundIndex);
    oddFollowUp.value = rounds[oddRoundIndex].followUp;
    oddRemoveRound.disabled = rounds.length === 1;
    oddEarlierRound.disabled = oddRoundIndex === 0;
    oddLaterRound.disabled = oddRoundIndex === rounds.length - 1;
  }
  choiceMethod.value = taskDraft.method;
  choiceCheckMode.value = taskDraft.check;
  choiceShuffle.checked = taskDraft.shuffle;
  choiceDropDraft.hidden = odd || taskDraft.method !== 'drag';
  choiceDropDraft.replaceChildren(...(choiceDropDraft.hidden ? [] : [
    taskOptionImageField(taskDraft.dropImage, 'Картинка принимающей области', image => { taskDraft.dropImage = image; }),
  ]));
  const options = activeChoiceOptions();
  choiceDraftOptions.replaceChildren(...options.map((option, index) => {
    const row = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = `Вариант ${index + 1}`;

    const textLabel = document.createElement('label');
    textLabel.textContent = 'Текст варианта';
    const input = document.createElement('input');
    input.value = option.text;
    input.addEventListener('input', () => { option.text = input.value; });
    textLabel.append(input);

    const correctLabel = document.createElement('label');
    correctLabel.className = 'choice-checkbox';
    const correct = document.createElement('input');
    correct.type = 'checkbox';
    correct.checked = option.correct;
    correct.addEventListener('change', () => { option.correct = correct.checked; });
    correctLabel.append(correct, odd ? 'Лишний элемент' : 'Правильный ответ');

    const actions = document.createElement('div');
    actions.className = 'library-actions';
    const move = (delta, text, label) => {
      const button = libraryButton(text, `${label} вариант ${index + 1}`, () => {
        const next = index + delta;
        [options[index], options[next]] = [options[next], options[index]];
        renderChoiceDraft();
      });
      button.disabled = !options[index + delta];
      return button;
    };
    const remove = libraryButton('Удалить вариант', `Удалить вариант ${index + 1}`, () => {
      options.splice(index, 1);
      renderChoiceDraft();
    });
    remove.disabled = options.length <= 2;
    actions.append(move(-1, '↑', 'Поднять'), move(1, '↓', 'Опустить'), remove);
    row.append(legend, textLabel, correctLabel,
      taskOptionImageField(option.media, 'Добавить картинку ответа', image => { option.media = image; }, index + 1),
      actions);
    return row;
  }));
  choiceAddOption.disabled = options.length >= choiceOptionLimit();
}

function validateChoiceDraft() {
  const odd = taskDraft.type === 'odd';
  const rounds = odd ? taskDraft.rounds : [{ options: taskDraft.options }];
  for (const [index, { options }] of rounds.entries()) {
    const missingContent = options.some(option => !option.text.trim() && !option.media);
    const missingAnswer = !options.some(option => option.correct);
    if (!missingContent && !missingAnswer) continue;
    if (odd) {
      oddRoundIndex = index;
      renderChoiceDraft();
    }
    const message = missingContent ? 'Добавьте текст или картинку для каждого варианта.'
      : (odd ? 'Отметьте хотя бы один лишний элемент.' : 'Отметьте хотя бы один правильный вариант.');
    taskEditorStatus.textContent = odd ? `Раунд ${index + 1}. ${message}` : message;
    return false;
  }
  return true;
}

document.querySelector('#add-odd-task').addEventListener('click', () => openTaskEditor(null, 'odd'));
oddFollowUp.addEventListener('input', () => { taskDraft.rounds[oddRoundIndex].followUp = oddFollowUp.value; });
oddRoundSelect.addEventListener('change', () => {
  oddRoundIndex = Number(oddRoundSelect.value);
  renderChoiceDraft();
});
document.querySelector('#odd-add-round').addEventListener('click', () => {
  taskDraft.rounds.push(emptyOddRound());
  oddRoundIndex = taskDraft.rounds.length - 1;
  renderChoiceDraft();
});
document.querySelector('#odd-duplicate-round').addEventListener('click', () => {
  const rounds = taskDraft.rounds;
  rounds.splice(oddRoundIndex + 1, 0, copyOddRound(rounds[oddRoundIndex]));
  oddRoundIndex++;
  renderChoiceDraft();
});
oddRemoveRound.addEventListener('click', () => {
  taskDraft.rounds.splice(oddRoundIndex, 1);
  oddRoundIndex = Math.min(oddRoundIndex, taskDraft.rounds.length - 1);
  renderChoiceDraft();
});
function moveOddRound(offset) {
  const rounds = taskDraft.rounds;
  const next = oddRoundIndex + offset;
  [rounds[oddRoundIndex], rounds[next]] = [rounds[next], rounds[oddRoundIndex]];
  oddRoundIndex = next;
  renderChoiceDraft();
}
oddEarlierRound.addEventListener('click', () => moveOddRound(-1));
oddLaterRound.addEventListener('click', () => moveOddRound(1));
document.querySelector('#add-choice-task').addEventListener('click', () => openTaskEditor(null, 'choice'));
choiceMethod.addEventListener('change', () => {
  taskDraft.method = choiceMethod.value;
  renderChoiceDraft();
});
choiceCheckMode.addEventListener('change', () => { taskDraft.check = choiceCheckMode.value; });
choiceShuffle.addEventListener('change', () => { taskDraft.shuffle = choiceShuffle.checked; });
choiceAddOption.addEventListener('click', () => {
  const options = activeChoiceOptions();
  if (options.length >= choiceOptionLimit()) return;
  options.push(newChoiceOption());
  renderChoiceDraft();
});
