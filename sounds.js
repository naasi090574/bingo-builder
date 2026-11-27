'use strict';

const soundLibrary = {
  'Поощрение': {
    confirmation_001: 'Лёгкое одобрение', confirmation_002: 'Радостный сигнал', confirmation_004: 'Добрый ответ',
  },
  'Мягкие сигналы ошибки': {
    back_001: 'Тихий шаг назад', back_003: 'Мягкий отскок', error_001: 'Попробуй ещё',
  },
  'Волшебные звуки': {
    glass_001: 'Хрустальный звон', glass_003: 'Искорка', pluck_002: 'Волшебная струна',
  },
  'Щелчки и игровые эффекты': {
    click_001: 'Лёгкий щелчок', drop_001: 'Фишка на поле', tick_001: 'Тихий тик',
  },
  'Победа': {
    jingles_PIZZI03: 'Победная фраза', jingles_PIZZI07: 'Весёлый финал', jingles_STEEL07: 'Маленькая фанфара',
  },
  'Фоновая музыка': {
    peaceful_days: 'Спокойные дни', a_place_i_call_home: 'Дорога домой', upbeat_loop: 'Весёлый мотив',
  },
};

const soundEvents = {
  start: ['Начало игры', 'glass_001'],
  draw: ['Вытягивание карточки', 'click_001'],
  match: ['Правильный выбор картинки', 'confirmation_001'],
  miss: ['Неправильный выбор картинки', 'back_001'],
  taskOpen: ['Открытие задания', 'glass_003'],
  taskRight: ['Правильный ответ в задании', 'confirmation_002'],
  taskWrong: ['Неправильный ответ в задании', 'back_003'],
  taskComplete: ['Выполнение задания', 'confirmation_004'],
  token: ['Появление игровой фишки', 'drop_001'],
  turn: ['Переход хода', 'tick_001'],
  win: ['Победа игрока', 'jingles_PIZZI03'],
};

const musicTracks = soundLibrary['Фоновая музыка'];
const effectTracks = Object.assign({}, ...Object.values(soundLibrary).slice(0, -1));
const acceptedSoundFiles = '.mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg';

function soundVolume(value, fallback) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
}

function normalizeSoundSettings(data) {
  function track(saved, library, fallback, enabled, volume) {
    const upload = saved?.upload;
    const custom = upload?.file instanceof Blob && typeof upload.id === 'string'
      ? { id: upload.id, name: String(upload.name), file: upload.file } : null;
    const builtin = Object.hasOwn(library, saved?.builtin) ? saved.builtin : fallback;
    return {
      builtin, upload: custom,
      source: saved?.source === 'custom' && custom ? 'custom' : 'builtin',
      enabled: typeof saved?.enabled === 'boolean' ? saved.enabled : enabled,
      volume: soundVolume(saved?.volume, volume),
    };
  }

  return {
    muted: data?.muted === true,
    master: soundVolume(data?.master, 65),
    events: Object.fromEntries(Object.entries(soundEvents).map(([key, [, builtin]]) =>
      [key, track(data?.events?.[key], effectTracks, builtin, true, 55)])),
    music: {
      ...track(data?.music, musicTracks, 'peaceful_days', false, 25),
      loop: data?.music?.loop !== false,
      pauseOnTask: data?.music?.pauseOnTask !== false,
    },
  };
}

async function soundStorage(settings) {
  const database = await openCardDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('library', settings ? 'readwrite' : 'readonly');
    const store = transaction.objectStore('library');
    const request = settings ? store.put(settings, 'sounds') : store.get('sounds');
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
  });
}

function soundTrack(config) {
  return config.source === 'custom' ? config.upload : { id: config.builtin, file: null };
}

class SoundChannel {
  constructor() {
    this.audio = new Audio();
    this.trackId = null;
    this.objectUrl = null;
  }

  load(track) {
    if (this.trackId === track?.id) return;
    this.audio.pause();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = track?.file ? URL.createObjectURL(track.file) : null;
    this.trackId = track?.id;
    if (track) this.audio.src = this.objectUrl ?? `assets/audio/${track.id}.ogg`;
    else {
      this.audio.removeAttribute('src');
      this.audio.load();
    }
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }
}
