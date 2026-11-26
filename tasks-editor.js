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
    if (task.type === 'choice') {
      const kind = document.createElement('small');
      kind.textContent = 'Выбери правильный ответ';
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
  if (taskDraft.type === 'choice') {
    taskDraft.options = task ? task.options.map(option => ({ ...option })) : [newChoiceOption(), newChoiceOption()];
    taskDraft.method ??= 'click';
    taskDraft.check ??= 'instant';
    taskDraft.shuffle ??= false;
  }
  taskForm.reset();
  taskForm.elements.text.value = taskDraft.text;
  document.querySelector('#task-editor-title').textContent = taskDraft.type === 'choice'
    ? 'Выбери правильный ответ' : 'Устное задание';
  document.querySelector('#task-question-label').textContent = taskDraft.type === 'choice'
    ? 'Текст вопроса или инструкция' : 'Текст задания';
  const isChoice = taskDraft.type === 'choice';
  document.querySelector('#task-images-label').textContent = isChoice
    ? 'Добавить иллюстрации к вопросу (необязательно)' : 'Добавить картинки';
  document.querySelector('#task-images-help').hidden = !isChoice;
  if (isChoice) taskImagesInput.setAttribute('aria-describedby', 'task-images-help');
  else taskImagesInput.removeAttribute('aria-describedby');
  renderChoiceDraft();
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
    clearChoiceThumbs();
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
  if (!taskDraft.text.trim() && !taskDraft.images.length && !taskDraft.audio) {
    taskEditorStatus.textContent = 'Добавьте текст, картинку или аудио.';
    return;
  }
  if (taskDraft.type === 'choice' && !validateChoiceDraft()) return;
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
