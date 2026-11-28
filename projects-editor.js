'use strict';

const projectSection = document.querySelector('#project-library');
const projectToolbar = document.querySelector('#project-toolbar');
const projectStatus = document.querySelector('#project-status');
const projectSearch = document.querySelector('#project-search');
const projectSort = document.querySelector('#project-sort');
const projectCards = document.querySelector('#saved-projects');
const projectImport = document.querySelector('#import-project');
const workspace = document.querySelector('.workspace');
const projectDate = new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' });
let activeProjectId = null;
let projectDirty = false;
let projectsReady = false;
let projectBusy = false;
let autosaveQueued = false;
let autosavePending = false;
let autosaveFailed = false;
let draftWrite = Promise.resolve();
let savedProjects = [];
let projectThumbnailUrls = [];

function captureProject() {
  return {
    settings: readEditorGameSettings(),
    avatars: [...editorAvatars],
    appearance: { values: Object.fromEntries(new FormData(appearanceForm)), background: backgroundImage },
    cards: library,
    tasks: taskList,
    tokens: normalizeTokenSettings(editedTokens),
    sounds: normalizeSoundSettings(editedSounds),
  };
}

function draftFor(data, id = activeProjectId, dirty = projectDirty) {
  return { id, dirty, data };
}

function projectError(error) {
  if (error?.name === 'QuotaExceededError') {
    projectStatus.textContent = 'В хранилище браузера не хватает места. Скачайте черновик и освободите место.';
  } else {
    projectStatus.textContent = error?.message === invalidProject().message ? error.message
      : 'Не удалось выполнить операцию. Проверьте доступность и свободное место хранилища браузера.';
  }
}

function projectChanged() {
  if (!projectsReady) return;
  projectDirty = true;
  if (autosaveQueued) return;
  autosaveQueued = true;
  autosavePending = true;
  draftWrite = draftWrite.then(async () => {
    autosaveQueued = false;
    try {
      await writeProjectDraft(draftFor(captureProject()));
      autosaveFailed = false;
      if (!autosaveQueued && !projectBusy) projectStatus.textContent = 'Черновик сохранён автоматически.';
    } catch (error) {
      autosaveFailed = true;
      projectError(error);
    } finally {
      autosavePending = autosaveQueued;
    }
  });
}

function publishProjectSettings() {
  applySettings();
  updateAppearance(false);
  notifyCardViews();
  notifyTaskViews();
  broadcastTokens();
  broadcastSounds();
  broadcastAvatars();
  for (const popup of appearancePopups) {
    popup.postMessage({ type: 'bingo:preview-settings', search: new URL(launch.href).search }, appearanceOrigin());
    broadcastTokens(popup);
    broadcastSounds(popup);
  }
}

function restoreProject(draft) {
  activeProjectId = draft.id;
  projectDirty = draft.dirty;
  const { data } = draft;
  const { showBoardTitle, ...settings } = data.settings;
  for (const [name, value] of Object.entries(settings)) form.elements[name].value = value;
  form.elements.showBoardTitle.checked = showBoardTitle !== 'no';
  restoreAvatars(data.avatars);
  for (const [name, fallback] of Object.entries(defaultAppearance)) {
    appearanceForm.elements[name].value = data.appearance.values[name] ?? fallback;
  }
  clearBackgroundImage();
  backgroundImage = data.appearance.background;
  if (backgroundImage) backgroundStatus.textContent = backgroundImage.name || 'Изображение проекта';
  library = data.cards;
  selectedCell = 0;
  renderLibrary();
  taskList = data.tasks;
  renderTasks();
  editedTokens = normalizeTokenSettings(data.tokens);
  renderTokenEditor();
  stopAudition();
  editedSounds = normalizeSoundSettings(data.sounds);
  renderSoundEditor();
  publishProjectSettings();
}

function makeProject(data, id = `project-${crypto.getRandomValues(new Uint32Array(4)).join('-')}`) {
  return { id, modified: Date.now(), data };
}

async function openProjectDraft(draft, imported) {
  await replaceProjectDraft(draft, imported);
  restoreProject(draft);
  autosaveFailed = false;
  window.location.hash = 'settings';
  projectStatus.textContent = imported ? 'Проект импортирован.' : 'Проект открыт.';
}

function projectOperation(action) {
  if (!projectsReady || projectBusy) return;
  if (document.querySelector('#token-settings input[type=file]:disabled, #sound-settings input[type=file]:disabled, #background-image:disabled, .avatar-editor-row input:disabled')) {
    projectStatus.textContent = 'Дождитесь окончания загрузки файла.';
    return;
  }
  projectBusy = true;
  workspace.inert = true;
  projectToolbar.inert = true;
  Promise.all([cardQueue, taskQueue, tokenWrite, soundWrite])
    .then(() => draftWrite).then(action).catch(projectError).finally(() => {
      projectBusy = false;
      workspace.inert = false;
      projectToolbar.inert = false;
    });
}

function discardProjectChanges() {
  return !projectDirty || confirm('Есть несохранённые изменения. Продолжить без сохранения проекта?');
}

function askProjectName(initial) {
  const answer = prompt('Название проекта', initial);
  return answer?.trim().slice(0, 60);
}

async function saveCurrentProject(asCopy) {
  const data = captureProject();
  if (asCopy) {
    const title = askProjectName(data.settings.title);
    if (!title) return;
    data.settings.title = title;
  }
  const project = makeProject(data, asCopy || !activeProjectId ? undefined : activeProjectId);
  await saveProjectSnapshot(project, draftFor(data, project.id, false));
  activeProjectId = project.id;
  projectDirty = false;
  autosaveFailed = false;
  form.elements.title.value = data.settings.title;
  applySettings();
  projectStatus.textContent = 'Проект сохранён.';
  await refreshProjectLibrary();
}

function projectThumbnail(project) {
  const { appearance, cards } = project.data;
  const imageCard = cards.cards.find(card => card.image);
  const source = (appearance.values.backgroundMode === 'image' ? appearance.background : null) ?? imageCard?.image;
  const thumbnail = document.createElement('div');
  thumbnail.className = 'project-thumbnail';
  if (appearance.values.backgroundMode === 'color') thumbnail.style.backgroundColor = appearance.values.backgroundColor;
  if (source) {
    const image = document.createElement('img');
    if (source instanceof Blob) {
      image.src = URL.createObjectURL(source);
      projectThumbnailUrls.push(image.src);
    } else image.src = source;
    image.alt = '';
    thumbnail.append(image);
  } else {
    const initials = document.createElement('span');
    initials.textContent = project.data.settings.title.slice(0, 2).toLocaleUpperCase('ru');
    initials.setAttribute('aria-hidden', 'true');
    thumbnail.append(initials);
  }
  return thumbnail;
}

async function downloadProject(data) {
  const url = URL.createObjectURL(await exportProjectFile(data));
  const link = document.createElement('a');
  link.href = url;
  const filename = data.settings.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');
  link.download = `${filename || 'bingo'}.bingo.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderProjectCard(project) {
  const { id, modified, data } = project;
  const { title, size } = data.settings;
  const card = document.createElement('article');
  card.className = 'project-card';
  const heading = document.createElement('h2');
  heading.textContent = title || 'Без названия';
  const metadata = document.createElement('p');
  const date = document.createElement('time');
  date.dateTime = new Date(modified).toISOString();
  date.textContent = projectDate.format(modified);
  metadata.append(`${size} × ${size} · `, date);
  const actions = document.createElement('div');
  actions.className = 'library-actions';
  const button = (label, action) => libraryButton(label, `${label}: ${title}`, () => projectOperation(action));
  const launchGame = document.createElement('a');
  launchGame.className = 'secondary';
  launchGame.href = `game.html?project=${encodeURIComponent(id)}`;
  launchGame.target = '_blank';
  launchGame.rel = 'noopener';
  launchGame.textContent = 'Запустить игру';
  actions.append(
    button('Редактировать', async () => {
      if (activeProjectId === id || discardProjectChanges()) {
        if (activeProjectId !== id) await openProjectDraft(draftFor(data, id, false));
        else window.location.hash = 'settings';
      }
    }),
    launchGame,
    libraryButton('Опубликовать / обновить', `Опубликовать / обновить: ${title}`, () => openPublication(id, true)),
    button('Создать копию', async () => {
      const copy = structuredClone(data);
      copy.settings.title = `${title.slice(0, 51)} — копия`;
      await writeProject(makeProject(copy));
      await refreshProjectLibrary();
      projectStatus.textContent = 'Копия сохранена в «Моих играх».';
    }),
    button('Переименовать', async () => {
      const updatedTitle = askProjectName(title);
      if (!updatedTitle || updatedTitle === title) return;
      const updated = { ...data, settings: { ...data.settings, title: updatedTitle } };
      const replacement = makeProject(updated, id);
      if (id === activeProjectId) {
        const current = captureProject();
        current.settings.title = updatedTitle;
        await saveProjectSnapshot(replacement, draftFor(current));
        form.elements.title.value = updatedTitle;
        applySettings();
      } else await writeProject(replacement);
      await refreshProjectLibrary();
    }),
    button('Скачать файл проекта', () => downloadProject(data)),
    button('Удалить', async () => {
      if (!confirm(`Удалить игру «${title}» из библиотеки?`)) return;
      await deleteProject(id);
      if (id === activeProjectId) {
        activeProjectId = null;
        projectDirty = true;
      }
      await refreshProjectLibrary();
      projectStatus.textContent = 'Проект удалён из библиотеки.';
    }),
  );
  card.append(projectThumbnail(project), heading, metadata, actions);
  return card;
}

function renderProjectLibrary() {
  projectThumbnailUrls.forEach(url => URL.revokeObjectURL(url));
  projectThumbnailUrls = [];
  const query = projectSearch.value.trim().toLocaleLowerCase('ru');
  const projects = savedProjects.filter(({ data }) => data.settings.title.toLocaleLowerCase('ru').includes(query));
  projects.sort((first, second) => projectSort.value === 'title'
    ? first.data.settings.title.localeCompare(second.data.settings.title, 'ru')
    : second.modified - first.modified);
  projectCards.replaceChildren(...projects.map(renderProjectCard));
  document.querySelector('#project-empty').textContent = projects.length ? ''
    : query ? 'Игры с таким названием не найдены.' : 'Здесь появятся сохранённые игры.';
}

async function refreshProjectLibrary() {
  savedProjects = await readProjects();
  window.refreshPublicationProjects?.();
  renderProjectLibrary();
}

document.querySelector('#new-project').addEventListener('click', () => projectOperation(async () => {
  if (discardProjectChanges()) {
    await openProjectDraft(draftFor(freshProjectData(), null, false));
    projectStatus.textContent = 'Создан новый проект.';
  }
}));
document.querySelector('#save-project').addEventListener('click', () => projectOperation(() => saveCurrentProject(false)));
document.querySelector('#save-project-as').addEventListener('click', () => projectOperation(() => saveCurrentProject(true)));
document.querySelector('#open-project').addEventListener('click', () => {
  window.location.hash = 'projects';
  showSection();
  projectSearch.focus();
});
document.querySelector('#export-draft').addEventListener('click', () => projectOperation(() => downloadProject(captureProject())));
projectImport.addEventListener('change', () => {
  const file = projectImport.files[0];
  projectImport.value = '';
  if (!file) return;
  projectOperation(async () => {
    const data = await importProjectFile(file);
    if (!discardProjectChanges()) return;
    const project = makeProject(data);
    await openProjectDraft(draftFor(data, project.id, false), project);
    await refreshProjectLibrary();
  });
});
projectSearch.addEventListener('input', renderProjectLibrary);
projectSort.addEventListener('change', renderProjectLibrary);
form.addEventListener('input', projectChanged);
form.addEventListener('change', projectChanged);
window.addEventListener('beforeunload', event => {
  if (autosavePending || autosaveFailed) {
    event.preventDefault();
    event.returnValue = true;
  }
});

const projectsLoaded = Promise.all([cardQueue, taskQueue, tokenRead, soundRead, readProjectDraft()])
  .then(async ([, , , , draft]) => {
    if (draft) {
      // Card and task edits commit to their stores before marking the draft dirty.
      restoreProject({ ...draft, data: { ...draft.data, cards: library, tasks: taskList } });
      if (draft.dirty) projectStatus.textContent = 'Черновик восстановлен.';
    } else if (await hasLegacyProjectChanges()) {
      projectDirty = true;
      await writeProjectDraft(draftFor(captureProject()));
      projectStatus.textContent = 'Черновик восстановлен.';
    }
    await refreshProjectLibrary();
  }).catch(projectError).finally(() => {
    projectsReady = true;
    workspace.inert = false;
    projectToolbar.inert = false;
  });
workspace.inert = true;
projectToolbar.inert = true;
