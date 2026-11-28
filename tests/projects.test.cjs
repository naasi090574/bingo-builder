const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class MemoryFileReader {
  async readAsDataURL(blob) {
    this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;
    this.onload();
  }
}

const context = vm.createContext({ Blob, File, URLSearchParams, atob, assert, FileReader: MemoryFileReader });
for (const file of ['content.js', 'settings.js', 'cards.js', 'tasks.js', 'appearance.js', 'tokens.js', 'sounds.js', 'projects.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}

test('project files preserve image and audio bytes, names, settings and manual placements', async () => {
  await vm.runInContext(`(async () => {
    const data = freshProjectData();
    const image = new File(['image payload'], 'фон.png', { type: 'image/png', lastModified: 42 });
    const audio = new File(['audio payload'], 'голос.ogg', { type: 'audio/ogg' });
    data.settings.victory = 'vertical';
    data.settings.size = 3;
    data.appearance.values.backgroundMode = 'image';
    data.appearance.background = image;
    data.cards = {
      ...data.cards, manual: true, placements: { 3: [['apple'], []], 4: [['pear'], []] },
      cards: [...data.cards.cards, { id: 'uploaded', label: 'Своё', image, imageSample: new Uint8ClampedArray([255, 4]) }],
    };
    data.tasks[0] = { ...data.tasks[0], audio: { name: audio.name, file: audio }, images: [{ name: image.name, image }] };
    data.tokens = normalizeTokenSettings({ shared: false, players: [{ shape: 'custom', image, animation: 'jump' }] });
    const sounds = data.sounds;
    sounds.events.draw.source = 'custom';
    sounds.events.draw.upload = { id: 'clip', name: audio.name, file: audio };
    const restored = await importProjectFile(await exportProjectFile(data));
    assert.equal(restored.settings.victory, 'vertical');
    assert.equal(restored.settings.size, 3);
    assert.equal(restored.cards.cards.length, data.cards.cards.length);
    assert.equal(JSON.stringify(restored.cards.placements), JSON.stringify(data.cards.placements));
    assert.equal(restored.appearance.background.name, 'фон.png');
    assert.equal(restored.appearance.background.lastModified, 42);
    assert.equal(await restored.appearance.background.text(), 'image payload');
    assert.equal(restored.tokens.players[0].animation, 'jump');
    assert.equal(await restored.tokens.players[0].image.text(), 'image payload');
    assert.equal(await restored.tasks[0].audio.file.text(), 'audio payload');
    assert.equal(await restored.sounds.events.draw.upload.file.text(), 'audio payload');
    assert.equal(restored.cards.cards.at(-1).imageSample instanceof Uint8ClampedArray, true);
    assert.equal(restored.cards.cards.at(-1).imageSample[0], 255);
  })()`, context);
});

test('unknown project versions and malformed tasks fail validation before import', async () => {
  await vm.runInContext(`(async () => {
    await assert.rejects(importProjectFile(new Blob(['{"format":"bingo-builder","version":99}'])), /повреждён/);
    const data = freshProjectData();
    data.tasks[0] = { ...data.tasks[0], type: 'pairs', pairs: [[{ text: 'Неполная пара' }]] };
    await assert.rejects(importProjectFile(await exportProjectFile(data)), /повреждён/);
  })()`, context);
});

test('label effects survive project export, with defaults for older appearance data', async () => {
  await vm.runInContext(`(async () => {
    const data = freshProjectData();
    const values = data.appearance.values;
    for (const field of Object.keys(gameLabelEffects)) delete values['player' + field];
    Object.assign(values, {
      titleSize: '80', titleSpacing: '2.5', titleWeight: 'normal',
      titleStroke: 'on', titleStrokeColor: '#123456', titleStrokeWidth: '5',
      titleShadow: 'on', titleShadowColor: '#abcdef', titleShadowOpacity: '60',
      titleShadowX: '-3.5', titleShadowY: '7', titleShadowBlur: '2',
    });
    const restored = await importProjectFile(await exportProjectFile(data));
    for (const field of Object.keys(gameLabelEffects)) {
      assert.equal(restored.appearance.values['title' + field], values['title' + field]);
      assert.equal(restored.appearance.values['player' + field], gameLabelEffects[field].initial);
    }
    assert.equal(restored.appearance.values.titleSize, '80');
  })()`, context);
});

test('board dimming and frame settings round-trip independently of fill opacity', async () => {
  await vm.runInContext(`(async () => {
    const data = freshProjectData();
    const values = data.appearance.values;
    const settings = {
      boardDim: '80', boardBorder: '#ff0000', boardBorderWidth: '0', boardBorderOpacity: '40',
      cellBorder: '#00ff00', cellBorderWidth: '10', cellBorderOpacity: '0',
      drawSlotBorder: '#0000ff', drawSlotWidth: '5', drawSlotBorderOpacity: '60',
      boardOpacity: '20', cellOpacity: '50', drawSlotOpacity: '70',
    };
    Object.assign(values, settings);
    const restored = await importProjectFile(await exportProjectFile(data));
    for (const [name, value] of Object.entries(settings)) {
      assert.equal(restored.appearance.values[name], value);
      delete values[name];
    }
    const legacy = await importProjectFile(await exportProjectFile(data));
    assert.equal(legacy.appearance.values.boardDim, '25');
    assert.equal(legacy.appearance.values.boardBorderWidth, '1');
    assert.equal(legacy.appearance.values.cellBorderOpacity, '100');
    assert.equal(legacy.appearance.values.drawSlotBorderOpacity, '100');
  })()`, context);
});

test('memory chains round-trip with media and require a visibly different order', async () => {
  await vm.runInContext(`(async () => {
    const data = freshProjectData();
    const image = new File(['image payload'], 'кот.png', { type: 'image/png' });
    const cat = { text: 'Кот', media: { image, name: image.name, imageKey: 'cat' } };
    data.tasks = [{
      id: 'memory', type: 'memory', text: 'Запомни', recall: 'Восстанови', chainOrder: 'random',
      imageSize: 65, chains: [[cat, { text: 'Кит' }, cat], [{ text: 'Сова' }, cat]],
      images: [], audio: null,
    }];
    const [restored] = (await importProjectFile(await exportProjectFile(data))).tasks;
    assert.equal(restored.recall, 'Восстанови');
    assert.equal(restored.chainOrder, 'random');
    assert.equal(restored.imageSize, 65);
    assert.equal(restored.chains[0].length, 3);
    assert.equal(await restored.chains[1][1].media.image.text(), 'image payload');
    data.tasks[0].chains = [[cat, { ...cat }]];
    await assert.rejects(importProjectFile(await exportProjectFile(data)), /повреждён/);
  })()`, context);
});
