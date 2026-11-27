const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

class TestAudio extends EventTarget {
  src = '';
  paused = true;
  ended = false;
  muted = false;
  volume = 1;
  currentTime = 0;

  play() {
    this.paused = false;
    this.ended = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }

  stopAtEnd() {
    this.paused = true;
    this.ended = true;
    this.dispatchEvent(new Event('ended'));
  }

  removeAttribute() { this.src = ''; }
  load() {}
}

function createMixer() {
  const context = vm.createContext({
    Blob, Audio: TestAudio, document: new EventTarget(), taskAudio: new TestAudio(),
  });
  context.document.querySelectorAll = () => [];
  for (const file of ['sounds.js', 'sounds-game.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  }
  return code => vm.runInContext(code, context);
}

test('six groups each provide three distinct local Ogg files', () => {
  const run = createMixer();
  const groups = JSON.parse(run('JSON.stringify(Object.values(soundLibrary).map(Object.keys))'));
  assert.equal(groups.length, 6);
  for (const group of groups) assert.equal(group.length, 3);
  assert.equal(new Set(groups.flat()).size, 18);
  for (const track of groups.flat()) {
    const bytes = fs.readFileSync(path.join(root, 'assets', 'audio', `${track}.ogg`));
    assert.equal(bytes.subarray(0, 4).toString(), 'OggS');
  }
  assert.equal(run('normalizeSoundSettings().music.enabled'), false);
});

test('music requires a gesture, waits for consecutive effects and pauses for narration', () => {
  const run = createMixer();
  run(`
    initGameSounds();
    const enabled = normalizeSoundSettings();
    enabled.music.enabled = true;
    enabled.music.pauseOnTask = false;
    applyGameSounds(enabled);
  `);
  assert.equal(run('gameMusic.audio.paused'), true);
  assert.equal(run('gameMusic.audio.src'), '');
  run('audioUnlocked = true; refreshMusic();');
  assert.equal(run('gameMusic.audio.paused'), false);
  run("playGameSounds('match', 'taskOpen'); playGameSounds('taskRight');");
  for (const id of ['confirmation_001', 'glass_003', 'confirmation_002']) {
    assert.equal(run('gameEffects.trackId'), id);
    assert.equal(run('gameMusic.audio.paused'), true);
    run('gameEffects.audio.stopAtEnd();');
  }
  assert.equal(run('gameMusic.audio.paused'), false);

  run("setTaskSoundOpen(true); taskAudio.play(); playGameSounds('taskWrong');");
  assert.equal(run('gameEffects.audio.paused && gameMusic.audio.paused'), true);
  run('taskAudio.stopAtEnd();');
  assert.equal(run('gameMusic.audio.paused'), false);
  run('applyGameSounds({...enabled, music: {...enabled.music, pauseOnTask: true}});');
  assert.equal(run('gameMusic.audio.paused'), true);
  run('setTaskSoundOpen(false);');
  assert.equal(run('gameMusic.audio.paused'), false);
  run('applyGameSounds({...enabled, muted: true});');
  assert.equal(run('taskAudio.muted && gameEffects.audio.paused && gameMusic.audio.paused'), true);
});

test('the game-only sound button preserves narration, settings and restored gains', () => {
  const run = createMixer();
  run(`
    initGameSounds();
    const authored = normalizeSoundSettings({ master: 73, music: { enabled: true, volume: 27 } });
    applyGameSounds(authored);
    audioUnlocked = true;
    playGameSounds('draw', 'match');
    toggleGameSound();
  `);
  assert.equal(run('gameAudioMuted() && gameEffects.audio.paused && gameMusic.audio.paused'), true);
  assert.equal(run('pendingEffects.length'), 0);
  assert.equal(run('taskAudio.volume'), .73);
  assert.equal(run('taskAudio.muted'), false);
  run("taskAudio.play(); playGameSounds('win');");
  assert.equal(run('!taskAudio.paused && gameEffects.audio.paused'), true);
  run('toggleGameSound();');
  assert.equal(run('gameMusic.audio.paused'), true);
  run('taskAudio.stopAtEnd();');
  assert.equal(run('gameMusic.audio.paused'), false);
  assert.equal(run('gameMusic.audio.volume'), .73 * .27);
  assert.equal(run('JSON.stringify(gameSoundSettings) === JSON.stringify(authored)'), true);
});
