'use strict';

const gameEffects = new SoundChannel();
const gameMusic = new SoundChannel();
let gameSoundSettings = normalizeSoundSettings();
let pendingEffects = [];
let currentEffect = null;
let audioUnlocked = false;
let startSoundPending = true;
let taskSoundOpen = false;
let gamePlaybackMuted;
let soundButtons = [];

function gameAudioMuted() {
  return gamePlaybackMuted ?? gameSoundSettings.muted;
}

function syncSoundButtons() {
  const muted = gameAudioMuted();
  for (const button of soundButtons) {
    button.setAttribute('aria-pressed', String(muted));
    button.title = muted ? 'Включить звук' : 'Выключить звук';
  }
}

function toggleGameSound() {
  gamePlaybackMuted = !gameAudioMuted();
  if (gamePlaybackMuted) stopGameEffects();
  syncSoundButtons();
  refreshMusic();
}

function playbackGain() {
  return gameAudioMuted() ? 0 : gameSoundSettings.master / 100;
}

function masterGain() {
  return gameSoundSettings.muted ? 0 : gameSoundSettings.master / 100;
}

function narrationPlaying() {
  return !taskAudio.paused && !taskAudio.ended && !taskAudio.muted && taskAudio.volume > 0;
}

function refreshMusic() {
  const { music } = gameSoundSettings;
  const audio = gameMusic.audio;
  audio.volume = playbackGain() * music.volume / 100;
  audio.loop = music.loop;
  if (!music.enabled) gameMusic.load(null);
  else if (audioUnlocked) gameMusic.load(soundTrack(music));
  if (!audioUnlocked || !music.enabled || !audio.volume || currentEffect || narrationPlaying()
    || (taskSoundOpen && music.pauseOnTask)) {
    audio.pause();
  } else if (audio.paused && (!audio.ended || audio.loop)) {
    audio.play().catch(() => {});
  }
}

function advanceEffect(finished) {
  if (finished !== currentEffect) return;
  currentEffect = pendingEffects.shift() ?? null;
  if (!currentEffect) {
    refreshMusic();
    return;
  }
  const effect = currentEffect;
  const audio = gameEffects.audio;
  gameMusic.audio.pause();
  gameEffects.stop();
  gameEffects.load(soundTrack(effect));
  audio.volume = playbackGain() * effect.volume / 100;
  audio.play().catch(() => advanceEffect(effect));
}

function stopGameEffects() {
  pendingEffects = [];
  currentEffect = null;
  gameEffects.stop();
}

function playGameSounds(...events) {
  if (!audioUnlocked || !playbackGain() || narrationPlaying()) return;
  const applicable = events.map(event => gameSoundSettings.events[event])
    .filter(config => config?.enabled && config.volume);
  if (!applicable.length) return;
  pendingEffects.push(...applicable);
  if (!currentEffect) advanceEffect(null);
}

function startGameSounds(...events) {
  if (startSoundPending) {
    startSoundPending = false;
    playGameSounds('start', ...events);
  } else playGameSounds(...events);
}

function resetGameSounds() {
  startSoundPending = true;
  stopGameEffects();
  if (gameMusic.audio.ended) gameMusic.stop();
  refreshMusic();
}

function setTaskSoundOpen(open) {
  taskSoundOpen = open;
  refreshMusic();
}

function applyGameSounds(data) {
  gameSoundSettings = normalizeSoundSettings(data);
  stopGameEffects();
  taskAudio.muted = gameSoundSettings.muted;
  taskAudio.volume = masterGain();
  syncSoundButtons();
  refreshMusic();
}

gameEffects.audio.addEventListener('ended', () => {
  if (currentEffect && gameEffects.audio.ended) advanceEffect(currentEffect);
});
gameEffects.audio.addEventListener('error', () => {
  if (currentEffect && gameEffects.audio.error) advanceEffect(currentEffect);
});

function initGameSounds() {
  soundButtons = [...document.querySelectorAll('.game-sound')];
  for (const slot of document.querySelectorAll('[data-sound-control]')) {
    const button = soundButtons[0].cloneNode(true);
    slot.replaceWith(button);
    soundButtons.push(button);
  }
  for (const button of soundButtons) button.addEventListener('click', toggleGameSound);
  syncSoundButtons();
  function unlock(event) {
    if (!event.isTrusted) return;
    audioUnlocked = true;
    refreshMusic();
  }
  for (const event of ['click', 'keydown']) document.addEventListener(event, unlock, { capture: true });
  function syncNarration() {
    if (gameSoundSettings.muted && !taskAudio.muted) taskAudio.muted = true;
    if (taskAudio.volume > masterGain()) taskAudio.volume = masterGain();
    if (narrationPlaying()) stopGameEffects();
    refreshMusic();
  }
  for (const event of ['play', 'pause', 'ended', 'volumechange']) {
    taskAudio.addEventListener(event, syncNarration);
  }
  taskAudio.volume = masterGain();
}
