'use strict';

const projectFormat = 'bingo-builder';
const projectVersion = 1;

function projectTransaction(stores, mode, work) {
  return openCardDatabase().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction(stores, mode);
    transaction.onabort = () => reject(transaction.error);
    transaction.oncomplete = () => resolve(request?.result);
    let request;
    try {
      request = work(transaction);
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  }));
}

function normalizeStoredProject(project) {
  if (project) project.data.settings = readGameSettings(new URLSearchParams(project.data.settings));
  return project;
}

function readProject(id) {
  return projectTransaction(['projects'], 'readonly', tx => tx.objectStore('projects').get(id)).then(normalizeStoredProject);
}

function readProjects() {
  return projectTransaction(['projects'], 'readonly', tx => tx.objectStore('projects').getAll())
    .then(projects => projects.map(normalizeStoredProject));
}

function writeProject(project) {
  return projectTransaction(['projects'], 'readwrite', tx => tx.objectStore('projects').put(project));
}

function deleteProject(id) {
  return projectTransaction(['projects', 'draft'], 'readwrite', tx => {
    tx.objectStore('projects').delete(id);
    const store = tx.objectStore('draft');
    const request = store.get('current');
    request.onsuccess = () => {
      if (request.result?.id === id) store.put({ ...request.result, id: null, dirty: true }, 'current');
    };
  });
}

function readProjectDraft() {
  return projectTransaction(['draft'], 'readonly', tx => tx.objectStore('draft').get('current')).then(normalizeStoredProject);
}

async function hasLegacyProjectChanges() {
  const database = await openCardDatabase();
  const transaction = database.transaction(['library', 'tasks']);
  const library = transaction.objectStore('library');
  const tasks = transaction.objectStore('tasks');
  const counts = ['current', 'tokens', 'sounds'].map(key => library.count(key));
  counts.push(tasks.count('current'));
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(counts.some(request => request.result > 0));
    transaction.onabort = () => reject(transaction.error);
  });
}

function writeProjectDraft(draft) {
  return projectTransaction(['draft'], 'readwrite', tx => tx.objectStore('draft').put(draft, 'current'));
}

function saveProjectSnapshot(project, draft) {
  return projectTransaction(['projects', 'draft'], 'readwrite', tx => {
    tx.objectStore('projects').put(project);
    tx.objectStore('draft').put(draft, 'current');
  });
}

function replaceProjectDraft(draft, imported = null) {
  const stores = ['draft', 'library', 'tasks'];
  if (imported) stores.push('projects');
  return projectTransaction(stores, 'readwrite', tx => {
    const { data } = draft;
    const library = tx.objectStore('library');
    library.put(data.cards, 'current');
    library.put(data.tokens, 'tokens');
    library.put(data.sounds, 'sounds');
    tx.objectStore('tasks').put(data.tasks, 'current');
    tx.objectStore('draft').put(draft, 'current');
    if (imported) tx.objectStore('projects').put(imported);
  });
}

function freshProjectData() {
  return {
    settings: { ...defaultGameSettings },
    avatars: [null, null],
    appearance: { values: { ...defaultAppearance }, background: null },
    cards: initialCardLibrary(),
    tasks: initialTaskLibrary(),
    tokens: normalizeTokenSettings(),
    sounds: normalizeSoundSettings(),
  };
}

function mediaAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function packProjectData(value) {
  if (value instanceof Blob) {
    const media = { $media: await mediaAsDataUrl(value), type: value.type };
    if (value instanceof File) {
      media.name = value.name;
      media.lastModified = value.lastModified;
    }
    return media;
  }
  if (value instanceof Uint8ClampedArray) return { $pixels: Array.from(value) };
  if (Array.isArray(value)) return Promise.all(value.map(packProjectData));
  if (value && typeof value === 'object') {
    return Object.fromEntries(await Promise.all(Object.entries(value)
      .map(async ([key, item]) => [key, await packProjectData(item)])));
  }
  return value;
}

function unpackProjectData(value) {
  if (Array.isArray(value)) return value.map(unpackProjectData);
  if (!value || typeof value !== 'object') return value;
  if (Object.hasOwn(value, '$media')) {
    if (typeof value.$media !== 'string' || typeof value.type !== 'string') throw invalidProject();
    const binary = atob(value.$media);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return typeof value.name === 'string'
      ? new File([bytes], value.name, { type: value.type, lastModified: value.lastModified })
      : new Blob([bytes], { type: value.type });
  }
  if (Object.hasOwn(value, '$pixels')) {
    if (!Array.isArray(value.$pixels) || !value.$pixels.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
      throw invalidProject();
    }
    return Uint8ClampedArray.from(value.$pixels);
  }
  if (['__proto__', 'prototype', 'constructor'].some(key => Object.hasOwn(value, key))) throw invalidProject();
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unpackProjectData(item)]));
}

function invalidProject() {
  return new Error('Файл проекта повреждён или имеет неподдерживаемый формат.');
}

function validateProjectData(data) {
  const text = value => typeof value === 'string';
  const textEntry = value => value && text(value.text) && (!value.media || imageEntry(value.media));
  const imageEntry = value => value && text(value.name) && value.image instanceof Blob;
  const list = (items, check) => Array.isArray(items) && items.every(check);
  const knownImages = new Set(bingoContent.cards.map(card => card.image));
  if (!data?.settings || !data.appearance?.values || !data.cards || !data.tokens || !data.sounds
      || !list(data.cards.cards, card => card && text(card.id) && text(card.label)
        && (!card.text || text(card.text))
        && (card.image instanceof Blob || knownImages.has(card.image) || (!card.image && card.text)))
      || (data.appearance.background && !(data.appearance.background instanceof Blob))) throw invalidProject();

  const taskDetails = {
    oral: () => true,
    choice: task => list(task.options, textEntry) && task.options.length >= 2 && task.options.some(option => option.correct),
    odd: task => {
      const rounds = oddTaskRounds(task);
      return list(rounds, round => round && text(round.followUp ?? '') &&
        list(round.options, textEntry) &&
        round.options.length >= 2 && round.options.some(option => option.correct)) && rounds.length > 0;
    },
    sorting: task => list(task.items, item => textEntry(item) && task.groups.some(group => group.id === item.groupId))
      && task.items.length >= 2,
    pairs: task => list(task.pairs, pair => list(pair, textEntry) && pair.length === 2) && task.pairs.length >= 2,
    reveal: task => ['sequential', 'random'].includes(task.roundOrder) &&
      list(task.rounds, round => round && text(round.riddle) && typeof round.showRiddle === 'boolean' &&
        imageEntry(round.answer) && (!round.cover || imageEntry(round.cover)) &&
        (!round.audio || (text(round.audio.name) && round.audio.file instanceof Blob))) && task.rounds.length > 0,
    magic: task => text(task.after) && ['sequential', 'random'].includes(task.roundOrder)
      && list(task.rounds, round => validMagicRound(round) && imageEntry(round.media)) && task.rounds.length > 0,
    memory: task => text(task.recall) && ['sequential', 'random'].includes(task.chainOrder)
      && Number.isFinite(task.imageSize) && task.imageSize >= 25 && task.imageSize <= 100
      && list(task.chains, chain => list(chain, textEntry) && validMemoryChain(chain)) && task.chains.length > 0,
    sequence: task => list(task.items, textEntry) && task.items.length >= 2,
    compose: task => list(task.items, textEntry) && task.items.length >= 2 && task.items.some(item => !item.extra),
  };
  if (!list(data.tasks, task => task && text(task.id) && text(task.text)
      && list(task.images, imageEntry) && (!task.audio || (text(task.audio.name) && task.audio.file instanceof Blob))
      && (!task.dropImage || imageEntry(task.dropImage))
      && (!task.followUp || text(task.followUp))
      && Object.hasOwn(taskDetails, task.type)
      && (task.type !== 'sorting' || (list(task.groups, group => textEntry(group) && text(group.id)) && task.groups.length >= 2))
      && taskDetails[task.type](task))) throw invalidProject();

  if (data.avatars !== undefined && (!list(data.avatars, avatar => avatar === null || imageEntry(avatar)) ||
      data.avatars.length !== 2)) throw invalidProject();
  data.avatars ??= [null, null];
  data.settings = readGameSettings(new URLSearchParams(data.settings));
  data.appearance.values = Object.fromEntries(Object.entries(defaultAppearance).map(([key, fallback]) =>
    [key, typeof data.appearance.values[key] === 'string' ? data.appearance.values[key] : fallback]));
  data.tokens = normalizeTokenSettings(data.tokens);
  data.sounds = normalizeSoundSettings(data.sounds);
  return data;
}

async function exportProjectFile(data) {
  const packed = await packProjectData(data);
  return new Blob([JSON.stringify({ format: projectFormat, version: projectVersion, data: packed })],
    { type: 'application/json' });
}

async function importProjectFile(file) {
  try {
    const archive = JSON.parse(await file.text());
    if (archive.format !== projectFormat || archive.version !== projectVersion) throw invalidProject();
    return validateProjectData(unpackProjectData(archive.data));
  } catch {
    throw invalidProject();
  }
}
