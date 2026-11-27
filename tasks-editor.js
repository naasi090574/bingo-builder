'use strict';

const taskItems = document.querySelector('#task-items');
const taskLibraryStatus = document.querySelector('#task-library-status');
const taskEditor = document.querySelector('#task-editor');
const taskForm = document.querySelector('#edit-task');
const taskEditorStatus = document.querySelector('#task-editor-status');
const taskImagesInput = document.querySelector('#task-images-input');
const taskAudioInput = document.querySelector('#task-audio-input');
const taskDraftImages = document.querySelector('#task-draft-images');
const taskAudioName = document.querySelector('#task-audio-name');
const removeTaskAudio = document.querySelector('#remove-task-audio');
const individualTaskAppearance = document.querySelector('#individual-task-appearance');
const individualTypographyFields = individualTaskTypographyKeys.map(key => {
  const group = document.createElement('fieldset');
  group.className = 'appearance-fields';
  const legend = document.createElement('legend');
  legend.textContent = labelStyles[key].label;
  const inherit = document.createElement('label');
  inherit.className = 'choice-checkbox';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  inherit.append(checkbox, 'Использовать общие настройки');
  const fields = document.createElement('div');
  fields.className = 'appearance-fields';
  fields.innerHTML = typographyFields(key, 'individual-');
  const controls = [...fields.querySelectorAll('input, select')];
  const output = fields.querySelector('output');
  const range = fields.querySelector('input[type="range"]');
  function update() {
    fields.hidden = checkbox.checked;
    output.value = range.value + range.dataset.unit;
    const typography = { ...taskDraft.typography };
    if (checkbox.checked) delete typography[key];
    else typography[key] = Object.fromEntries(controls.map(control =>
      [control.name.slice(key.length), control.value]));
    taskDraft.typography = Object.keys(typography).length ? typography : undefined;
  }
  group.append(legend, inherit, fields);
  group.addEventListener('input', update);
  individualTaskAppearance.append(group);
  return { key, checkbox, fields, controls, output, range };
});

function renderIndividualTaskAppearance() {
  individualTaskAppearance.open = false;
  for (const { key, checkbox, fields, controls, output, range } of individualTypographyFields) {
    const saved = taskDraft.typography?.[key];
    checkbox.checked = !saved;
    fields.hidden = checkbox.checked;
    for (const control of controls) {
      control.value = saved?.[control.name.slice(key.length)] ?? appearanceForm.elements[control.name].value;
    }
    output.value = range.value + range.dataset.unit;
  }
}

const interactiveTaskTitles = {
  choice: 'Выбери правильный ответ',
  odd: 'Найди лишнее',
  sorting: 'Рассортируй по группам',
  pairs: 'Соедини пары',
  sequence: 'Восстанови последовательность',
  compose: 'Собери слово или предложение',
};
let taskDraft;
let taskList = [];
let taskDraftBusy = false;
let taskThumbUrls = [];

let taskQueue = readTaskLibrary().then(tasks => {
  taskList = tasks;
  renderTasks();
}).catch(() => {
  taskLibraryStatus.textContent = 'Не удалось загрузить задания.';
});

function saveTaskList(update) {
  const write = taskQueue.then(async () => {
    taskList = await updateTaskLibrary(update);
    renderTasks();
    const message = { type: 'bingo:tasks', tasks: taskList };
    frame.contentWindow.postMessage(message, appearanceOrigin());
    for (const popup of appearancePopups) {
      if (popup.closed) appearancePopups.delete(popup);
      else popup.postMessage(message, appearanceOrigin());
    }
  });
  taskQueue = write.catch(() => {});
  return write;
}

function updateTasks(update) {
  saveTaskList(update).catch(() => {
    taskLibraryStatus.textContent = 'Не удалось сохранить изменения.';
  });
}

function newTaskId() {
  return `task-${crypto.getRandomValues(new Uint32Array(4)).join('-')}`;
}

function moveTask(id, direction) {
  updateTasks(tasks => {
    const index = tasks.findIndex(task => task.id === id);
    const next = index + direction;
    if (index < 0 || !tasks[next]) return tasks;
    [tasks[index], tasks[next]] = [tasks[next], tasks[index]];
    return tasks;
  });
}

function duplicateTask(id) {
  updateTasks(tasks => {
    const index = tasks.findIndex(task => task.id === id);
    if (index >= 0) tasks.splice(index + 1, 0, { ...tasks[index], id: newTaskId() });
    return tasks;
  });
}

function renderTasks() {
  taskLibraryStatus.textContent = taskList.length ? ''
    : 'Список пуст. В игре будет доступна кнопка подтверждения хода.';
  const fragment = document.createDocumentFragment();
  taskList.forEach((task, index) => {
    const row = document.createElement('li');
    const title = document.createElement('p');
    const text = task.text.replace(/\s+/g, ' ').trim();
    title.textContent = text ? (text.length > 100 ? `${text.slice(0, 100)}…` : text)
      : [task.images.length ? `Изображений: ${task.images.length}` : '', task.audio ? 'Аудио' : '']
        .filter(Boolean).join(' · ');
    const actions = document.createElement('div');
    actions.className = 'library-actions';
    const button = (label, action) => libraryButton(label, `${label} задание ${index + 1}`, action);
    const up = libraryButton('↑', `Поднять задание ${index + 1}`, () => moveTask(task.id, -1));
    const down = libraryButton('↓', `Опустить задание ${index + 1}`, () => moveTask(task.id, 1));
    up.disabled = index === 0;
    down.disabled = index === taskList.length - 1;
    actions.append(up, down,
      button('Просмотреть', () => {
        document.querySelector('.preview').scrollIntoView({ block: 'nearest' });
        frame.contentWindow.postMessage({ type: 'bingo:preview-task', task }, appearanceOrigin());
      }),
      button('Изменить', () => openTaskEditor(task)),
      button('Дублировать', () => duplicateTask(task.id)),
      button('Удалить', () => updateTasks(tasks => tasks.filter(saved => saved.id !== task.id))));
    if (Object.hasOwn(interactiveTaskTitles, task.type)) {
      const kind = document.createElement('small');
      kind.textContent = interactiveTaskTitles[task.type];
      row.append(kind);
    }
    row.append(title, actions);
    fragment.append(row);
  });
  taskItems.replaceChildren(fragment);
}

function clearTaskThumbs() {
  for (const url of taskThumbUrls) URL.revokeObjectURL(url);
  taskThumbUrls = [];
}

function renderTaskDraftMedia() {
  clearTaskThumbs();
  taskDraftImages.replaceChildren(...taskDraft.images.map((item, index) => {
    const row = document.createElement('li');
    const image = document.createElement('img');
    const url = URL.createObjectURL(item.image);
    taskThumbUrls.push(url);
    image.src = url;
    image.alt = item.name;
    const replace = document.createElement('input');
    replace.type = 'file';
    replace.accept = taskImagesInput.accept;
    replace.hidden = true;
    replace.addEventListener('change', () => {
      const file = replace.files[0];
      if (file) runTaskDraftAction(async () => {
        const { image } = await readCardImage(file);
        taskDraft.images[index] = { image, name: file.name };
        renderTaskDraftMedia();
      });
    });
    row.append(image, replace,
      libraryButton('Заменить', `Заменить картинку ${index + 1}`, () => replace.click()),
      libraryButton('Удалить', `Удалить картинку ${index + 1}`, () => {
        taskDraft.images.splice(index, 1);
        renderTaskDraftMedia();
      }));
    return row;
  }));
  taskAudioName.textContent = taskDraft.audio?.name ?? '';
  removeTaskAudio.hidden = !taskDraft.audio;
}

function openTaskEditor(task, type = 'oral') {
  taskDraft = task ? { ...task, images: [...task.images] }
    : { id: newTaskId(), type, text: '', images: [], audio: null };
  if (isChoiceDraft(taskDraft.type)) {
    taskDraft.options = task ? task.options.map(option => ({ ...option })) : [newChoiceOption(), newChoiceOption()];
    taskDraft.method ??= 'click';
    taskDraft.check ??= 'instant';
    taskDraft.shuffle ??= false;
  }
  if (taskDraft.type === 'sorting') initializeSortingDraft(task);
  if (taskDraft.type === 'pairs') initializePairsDraft(task);
  if (isSequenceDraft(taskDraft.type)) initializeSequenceDraft(task);
  taskForm.reset();
  taskForm.elements.text.value = taskDraft.text;
  renderIndividualTaskAppearance();
  const isInteractive = Object.hasOwn(interactiveTaskTitles, taskDraft.type);
  document.querySelector('#task-editor-title').textContent = isInteractive
    ? interactiveTaskTitles[taskDraft.type] : 'Устное задание';
  document.querySelector('#task-question-label').textContent = isInteractive ? 'Текст вопроса или инструкция' : 'Текст задания';
  document.querySelector('#task-images-label').textContent = isInteractive
    ? 'Добавить иллюстрации к вопросу (необязательно)' : 'Добавить картинки';
  document.querySelector('#task-images-help').hidden = !isInteractive;
  if (isInteractive) taskImagesInput.setAttribute('aria-describedby', 'task-images-help');
  else taskImagesInput.removeAttribute('aria-describedby');
  renderChoiceDraft();
  renderSortingDraft();
  renderPairsDraft();
  renderSequenceDraft();
  taskEditorStatus.textContent = '';
  renderTaskDraftMedia();
  taskEditor.showModal();
}

async function runTaskDraftAction(action) {
  if (taskDraftBusy) return;
  taskDraftBusy = true;
  const controls = [...taskForm.elements].filter(control => !control.disabled);
  for (const control of controls) control.disabled = true;
  taskEditorStatus.textContent = '';
  try {
    await action();
  } catch (error) {
    taskEditorStatus.textContent = error.message || 'Не удалось обработать задание.';
  } finally {
    taskDraftBusy = false;
    for (const control of controls) control.disabled = false;
  }
}

async function validateTaskAudio(file) {
  const url = URL.createObjectURL(file);
  const audio = new Audio();
  try {
    await new Promise((resolve, reject) => {
      audio.onloadedmetadata = resolve;
      audio.onerror = () => reject(new Error('Браузер не смог открыть аудиофайл.'));
      audio.preload = 'metadata';
      audio.src = url;
    });
  } finally {
    audio.removeAttribute('src');
    audio.load();
    URL.revokeObjectURL(url);
  }
}

document.querySelector('#add-task').addEventListener('click', () => openTaskEditor());
document.querySelector('#cancel-task-edit').addEventListener('click', () => taskEditor.close());
taskEditor.addEventListener('cancel', event => {
  if (taskDraftBusy) event.preventDefault();
});
taskEditor.addEventListener('close', () => {
  if (!taskEditor.open) {
    clearTaskThumbs();
    clearTaskOptionThumbs();
  }
});

taskImagesInput.addEventListener('change', () => {
  const files = [...taskImagesInput.files];
  taskImagesInput.value = '';
  if (!files.length) return;
  runTaskDraftAction(async () => {
    let failed = 0;
    for (const file of files) {
      try {
        const { image } = await readCardImage(file);
        taskDraft.images.push({ image, name: file.name });
      } catch {
        failed++;
      }
    }
    renderTaskDraftMedia();
    if (failed) taskEditorStatus.textContent = `Не удалось загрузить картинок: ${failed}. Поддерживаются PNG, JPEG и WebP.`;
  });
});
taskAudioInput.addEventListener('change', () => {
  const file = taskAudioInput.files[0];
  taskAudioInput.value = '';
  if (!file) return;
  runTaskDraftAction(async () => {
    await validateTaskAudio(file);
    taskDraft.audio = { file, name: file.name };
    renderTaskDraftMedia();
  });
});
removeTaskAudio.addEventListener('click', () => {
  taskDraft.audio = null;
  renderTaskDraftMedia();
});

taskForm.addEventListener('submit', event => {
  event.preventDefault();
  taskDraft.text = taskForm.elements.text.value;
  if (!['sorting', 'pairs', 'sequence', 'odd', 'compose'].includes(taskDraft.type)
    && !taskDraft.text.trim() && !taskDraft.images.length && !taskDraft.audio) {
    taskEditorStatus.textContent = 'Добавьте текст, картинку или аудио.';
    return;
  }
  if (isChoiceDraft(taskDraft.type) && !validateChoiceDraft()) return;
  if (taskDraft.type === 'sorting' && !validateSortingDraft()) return;
  if (taskDraft.type === 'pairs' && !validatePairsDraft()) return;
  if (isSequenceDraft(taskDraft.type) && !validateSequenceDraft()) return;
  const task = taskDraft;
  runTaskDraftAction(async () => {
    try {
      await saveTaskList(tasks => {
        const index = tasks.findIndex(saved => saved.id === task.id);
        if (index < 0) tasks.push(task);
        else tasks[index] = task;
        return tasks;
      });
    } catch {
      throw new Error('Не удалось сохранить задание.');
    }
    taskEditor.close();
  });
});
