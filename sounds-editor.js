'use strict';

const soundSection = document.querySelector('#sound-settings');
const soundStatus = document.querySelector('#sound-status');
const masterSound = soundSection.querySelector('#master-sound');
const muteSound = soundSection.querySelector('#mute-sound');
const sampleSound = new SoundChannel();
let editedSounds = normalizeSoundSettings();
let soundWrite = Promise.resolve();
let soundResetVersion = 0;
let audition;

function broadcastSounds(target = frame.contentWindow) {
  target.postMessage({ type: 'bingo:sounds', settings: editedSounds }, appearanceOrigin());
}

function saveSounds() {
  broadcastSounds();
  for (const popup of appearancePopups) {
    if (popup.closed) appearancePopups.delete(popup);
    else broadcastSounds(popup);
  }
  window.projectChanged?.();
  const snapshot = normalizeSoundSettings(editedSounds);
  soundWrite = soundWrite.then(() => soundStorage(snapshot)).catch(() => {
    soundStatus.textContent = 'Не удалось сохранить звуковые настройки.';
  });
}

function stopAudition() {
  if (audition) {
    audition.stop.disabled = true;
    audition = undefined;
  }
  sampleSound.stop();
  sampleSound.load(null);
}

sampleSound.audio.addEventListener('ended', stopAudition);

function soundOptionGroups(background) {
  const groups = background ? { 'Фоновая музыка': musicTracks }
    : Object.fromEntries(Object.entries(soundLibrary).slice(0, -1));
  return Object.entries(groups).map(([group, tracks]) =>
    `<optgroup label="${group}">${Object.entries(tracks).map(([name, label]) =>
      `<option value="${name}">${label}</option>`).join('')}</optgroup>`).join('');
}

function createSoundEditor(key, heading, background = false) {
  const panel = document.createElement('details');
  panel.className = 'appearance-group';
  panel.dataset.sound = key;
  panel.innerHTML = `
    <summary>${heading}</summary>
    <div class="appearance-fields">
      <label class="sound-toggle"><input type="checkbox" data-field="enabled"> ${background ? 'Включить музыку' : 'Включить звук'}</label>
      <label>Запись<select data-field="source">
        ${soundOptionGroups(background)}
        <option value="custom">Свой аудиофайл</option>
      </select></label>
      <div class="sound-upload">
        <label class="secondary image-picker">Загрузить или заменить аудио<input type="file" accept="${acceptedSoundFiles}"></label>
        <span data-file-name></span>
        <button class="library-button" type="button" data-remove>Удалить аудио</button>
      </div>
      <label class="sound-range"><span>Громкость</span><output for="sound-${key}-volume"></output>
        <input id="sound-${key}-volume" data-field="volume" type="range" min="0" max="100">
      </label>
      ${background ? `
        <label class="sound-toggle"><input type="checkbox" data-field="loop"> Воспроизводить циклически</label>
        <label class="sound-toggle"><input type="checkbox" data-field="pauseOnTask"> Приостанавливать на время задания</label>
      ` : ''}
      <div class="library-actions">
        <button class="library-button" type="button" data-listen>Прослушать</button>
        <button class="library-button" type="button" data-stop disabled>Остановить</button>
      </div>
    </div>`;
  document.querySelector('#sound-events').append(panel);
  const getConfig = () => background ? editedSounds.music : editedSounds.events[key];
  const fields = [...panel.querySelectorAll('[data-field]')];
  const file = panel.querySelector('input[type=file]');
  const fileName = panel.querySelector('[data-file-name]');
  const remove = panel.querySelector('[data-remove]');
  const stop = panel.querySelector('[data-stop]');
  const output = panel.querySelector('output');

  function render() {
    const config = getConfig();
    for (const input of fields) {
      const field = input.dataset.field;
      if (input.type === 'checkbox') input.checked = config[field];
      else input.value = field === 'source' && config.source === 'builtin' ? config.builtin : config[field];
    }
    panel.querySelector('[value=custom]').disabled = !config.upload;
    fileName.textContent = config.upload?.name ?? '';
    remove.hidden = !config.upload;
    output.value = `${config.volume}%`;
  }

  panel.addEventListener('input', event => {
    const input = event.target;
    const field = input.dataset.field;
    if (!field) return;
    const config = getConfig();
    if (field === 'source') {
      config.source = input.value === 'custom' ? 'custom' : 'builtin';
      if (config.source === 'builtin') config.builtin = input.value;
      if (audition?.stop === stop) stopAudition();
    } else {
      config[field] = input.type === 'checkbox' ? input.checked : Number(input.value);
    }
    render();
    if (audition?.stop === stop) sampleSound.audio.volume = config.volume / 100 * editedSounds.master / 100;
    saveSounds();
  });

  file.addEventListener('change', async () => {
    const selected = file.files[0];
    file.value = '';
    if (!selected) return;
    const version = soundResetVersion;
    file.disabled = true;
    remove.disabled = true;
    soundStatus.textContent = '';
    try {
      if (!/\.(mp3|wav|ogg)$/i.test(selected.name)) throw new Error('Допустимые форматы: MP3, WAV и OGG.');
      await validateTaskAudio(selected);
      if (version !== soundResetVersion) return;
      if (audition?.stop === stop) stopAudition();
      Object.assign(getConfig(), {
        upload: { id: newTaskId(), name: selected.name, file: selected },
        source: 'custom',
      });
      render();
      saveSounds();
    } catch (error) {
      if (version === soundResetVersion) soundStatus.textContent = error.message;
    } finally {
      file.disabled = false;
      remove.disabled = false;
    }
  });

  remove.addEventListener('click', () => {
    if (audition?.stop === stop) stopAudition();
    Object.assign(getConfig(), { upload: null, source: 'builtin' });
    render();
    saveSounds();
  });

  panel.querySelector('[data-listen]').addEventListener('click', () => {
    stopAudition();
    const config = getConfig();
    const track = soundTrack(config);
    sampleSound.load(track);
    sampleSound.audio.volume = config.volume / 100 * editedSounds.master / 100;
    const playing = { stop };
    audition = playing;
    stop.disabled = false;
    soundStatus.textContent = '';
    // An interrupted play() must not stop a more recent audition of the same file.
    sampleSound.audio.play().catch(() => {
      if (audition !== playing) return;
      stopAudition();
      soundStatus.textContent = 'Не удалось воспроизвести аудио.';
    });
  });
  stop.addEventListener('click', stopAudition);
  return render;
}

const renderSoundPanels = [
  ...Object.entries(soundEvents).map(([key, [label]]) => createSoundEditor(key, label)),
  createSoundEditor('music', 'Фоновая музыка', true),
];

function renderSoundEditor() {
  muteSound.checked = editedSounds.muted;
  masterSound.value = editedSounds.master;
  masterSound.previousElementSibling.value = `${editedSounds.master}%`;
  for (const render of renderSoundPanels) render();
}

masterSound.addEventListener('input', () => {
  editedSounds.master = Number(masterSound.value);
  stopAudition();
  renderSoundEditor();
  saveSounds();
});
muteSound.addEventListener('change', () => {
  editedSounds.muted = muteSound.checked;
  saveSounds();
});
soundSection.querySelector('#reset-sounds').addEventListener('click', () => {
  soundResetVersion++;
  stopAudition();
  editedSounds = normalizeSoundSettings();
  soundStatus.textContent = '';
  renderSoundEditor();
  saveSounds();
});
window.addEventListener('hashchange', () => {
  if (soundSection.hidden) stopAudition();
});
window.addEventListener('message', event => {
  if (event.origin !== window.origin || event.data?.type !== 'bingo:sounds-ready') return;
  if (event.source === frame.contentWindow || appearancePopups.has(event.source)) {
    soundRead.then(() => broadcastSounds(event.source));
  }
});

soundSection.inert = true;
renderSoundEditor();
const soundRead = soundStorage().then(settings => {
  editedSounds = normalizeSoundSettings(settings);
  renderSoundEditor();
}).catch(() => {
  soundStatus.textContent = 'Не удалось загрузить звуковые настройки.';
}).finally(() => {
  soundSection.inert = false;
});
