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
let taskOptionThumbUrls = [];

function isChoiceDraft(type) {
  return type === 'choice' || type === 'odd';
}

function choiceOptionLimit() {
  return taskDraft.type === 'odd' ? 10 : 8;
}

function newChoiceOption() {
  return { text: '', correct: false, media: null };
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
  oddFollowUp.value = taskDraft.followUp ?? '';
  choiceMethod.value = taskDraft.method;
  choiceCheckMode.value = taskDraft.check;
  choiceShuffle.checked = taskDraft.shuffle;
  choiceDropDraft.hidden = odd || taskDraft.method !== 'drag';
  choiceDropDraft.replaceChildren(...(choiceDropDraft.hidden ? [] : [
    taskOptionImageField(taskDraft.dropImage, 'Картинка принимающей области', image => { taskDraft.dropImage = image; }),
  ]));
  choiceDraftOptions.replaceChildren(...taskDraft.options.map((option, index) => {
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
        [taskDraft.options[index], taskDraft.options[next]] = [taskDraft.options[next], taskDraft.options[index]];
        renderChoiceDraft();
      });
      button.disabled = !taskDraft.options[index + delta];
      return button;
    };
    const remove = libraryButton('Удалить вариант', `Удалить вариант ${index + 1}`, () => {
      taskDraft.options.splice(index, 1);
      renderChoiceDraft();
    });
    remove.disabled = taskDraft.options.length <= 2;
    actions.append(move(-1, '↑', 'Поднять'), move(1, '↓', 'Опустить'), remove);
    row.append(legend, textLabel, correctLabel,
      taskOptionImageField(option.media, 'Добавить картинку ответа', image => { option.media = image; }, index + 1),
      actions);
    return row;
  }));
  choiceAddOption.disabled = taskDraft.options.length >= choiceOptionLimit();
}

function validateChoiceDraft() {
  if (taskDraft.options.some(option => !option.text.trim() && !option.media)) {
    taskEditorStatus.textContent = 'Добавьте текст или картинку для каждого варианта.';
    return false;
  }
  if (!taskDraft.options.some(option => option.correct)) {
    taskEditorStatus.textContent = taskDraft.type === 'odd'
      ? 'Отметьте хотя бы один лишний элемент.' : 'Отметьте хотя бы один правильный вариант.';
    return false;
  }
  return true;
}

document.querySelector('#add-odd-task').addEventListener('click', () => openTaskEditor(null, 'odd'));
oddFollowUp.addEventListener('input', () => { taskDraft.followUp = oddFollowUp.value; });
document.querySelector('#add-choice-task').addEventListener('click', () => openTaskEditor(null, 'choice'));
choiceMethod.addEventListener('change', () => {
  taskDraft.method = choiceMethod.value;
  renderChoiceDraft();
});
choiceCheckMode.addEventListener('change', () => { taskDraft.check = choiceCheckMode.value; });
choiceShuffle.addEventListener('change', () => { taskDraft.shuffle = choiceShuffle.checked; });
choiceAddOption.addEventListener('click', () => {
  if (taskDraft.options.length >= choiceOptionLimit()) return;
  taskDraft.options.push(newChoiceOption());
  renderChoiceDraft();
});
