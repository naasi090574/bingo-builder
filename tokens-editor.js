'use strict';

const tokensSection = document.querySelector('#token-settings');
const sharedTokens = document.querySelector('#shared-tokens');
const tokenStatus = document.querySelector('#token-status');
const tokenPlayers = document.querySelector('#token-players');
const tokenImageTypes = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';
let editedTokens = normalizeTokenSettings();
let tokenWrite = Promise.resolve();

function broadcastTokens(target = frame.contentWindow) {
  target.postMessage({ type: 'bingo:tokens', settings: editedTokens }, appearanceOrigin());
}

function saveTokens() {
  broadcastTokens();
  for (const popup of appearancePopups) {
    if (popup.closed) appearancePopups.delete(popup);
    else broadcastTokens(popup);
  }
  const snapshot = normalizeTokenSettings(editedTokens);
  tokenWrite = tokenWrite.then(() => tokenStorage('readwrite', snapshot)).catch(() => {
    tokenStatus.hidden = false;
    tokenStatus.textContent = 'Не удалось сохранить настройки фишек.';
  });
}

function tokenOptionList(options) {
  return Object.entries(options).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
}

function makeTokenPlayer(index) {
  const panel = document.createElement('fieldset');
  panel.className = 'token-player';
  panel.innerHTML = `
    <legend></legend>
    <div class="token-controls">
      <label>Фишка <select data-token-field="shape">${tokenOptionList({
        ...Object.fromEntries(Object.entries(tokenShapes).map(([shape, [label]]) => [shape, label])),
        custom: 'Своё изображение',
      })}</select></label>
      <label>Цвет <input data-token-field="color" type="color"></label>
      <label class="range-setting"><span>Размер</span><output for="token-size-${index}"></output>
        <input id="token-size-${index}" data-token-field="size" type="range" min="10" max="100">
      </label>
      <label class="range-setting"><span>Непрозрачность</span><output for="token-opacity-${index}"></output>
        <input id="token-opacity-${index}" data-token-field="opacity" type="range" min="0" max="100">
      </label>
      <label>Размещение <select data-token-field="placement">${tokenOptionList(tokenPlacements)}</select></label>
      <label>Угол <select data-token-field="corner">${tokenOptionList(tokenCorners)}</select></label>
      <label>Анимация <select data-token-field="animation">${tokenOptionList(tokenAnimations)}</select></label>
      <div class="token-media">
        <label class="secondary image-picker">Загрузить или заменить изображение<input type="file" accept="${tokenImageTypes}"></label>
        <button type="button" class="library-button" data-remove-token>Удалить изображение</button>
      </div>
    </div>
    <div class="token-preview">
      <div class="token-sample" role="img" aria-label="Образец игровой ячейки"></div>
      <button type="button" class="library-button" data-play-token>Проиграть появление</button>
    </div>`;
  tokenPlayers.append(panel);
  const controls = [...panel.querySelectorAll('[data-token-field]')];
  const shape = panel.querySelector('[data-token-field="shape"]');
  const file = panel.querySelector('input[type="file"]');
  const remove = panel.querySelector('[data-remove-token]');
  const play = panel.querySelector('[data-play-token]');
  const sample = panel.querySelector('.token-sample');
  const legend = panel.querySelector('legend');
  let currentImage;
  let imageUrl;

  function render(animate = false) {
    const config = editedTokens.players[index];
    if (config.image !== currentImage) {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      currentImage = config.image;
      imageUrl = currentImage ? URL.createObjectURL(currentImage) : undefined;
    }
    panel.hidden = index === 1 && editedTokens.shared;
    const settings = readGameSettings(new FormData(form));
    legend.textContent = editedTokens.shared ? 'Фишка для обоих игроков' : settings[`player${index + 1}`];
    shape.querySelector('[value="custom"]').disabled = !config.image;
    for (const input of controls) {
      const key = input.dataset.tokenField;
      input.value = config[key];
      if (input.type === 'range') input.previousElementSibling.value = `${input.value}%`;
    }
    panel.querySelector('[data-token-field="corner"]').closest('label').hidden = config.placement !== 'corner';
    panel.querySelector('[data-token-field="color"]').closest('label').hidden = config.shape === 'custom';
    remove.hidden = !config.image;
    play.disabled = config.animation === 'none';
    const chip = createToken(config, imageUrl, animate);
    if (config.placement === 'replace') sample.replaceChildren(chip);
    else {
      const card = document.createElement('img');
      card.src = bingoContent.cards[0].image;
      card.alt = '';
      sample.replaceChildren(card, chip);
    }
  }

  panel.addEventListener('input', event => {
    const input = event.target;
    const key = input.dataset.tokenField;
    if (!key) return;
    editedTokens.players[index][key] = input.type === 'range' ? Number(input.value) : input.value;
    render(key === 'animation');
    saveTokens();
  });
  file.addEventListener('change', async () => {
    const selected = file.files[0];
    file.value = '';
    if (!selected) return;
    file.disabled = true;
    remove.disabled = true;
    tokenStatus.hidden = true;
    try {
      const { image } = await readCardImage(selected);
      Object.assign(editedTokens.players[index], { image, shape: 'custom' });
      render();
      saveTokens();
    } catch (error) {
      tokenStatus.textContent = error.message;
      tokenStatus.hidden = false;
    } finally {
      file.disabled = false;
      remove.disabled = false;
    }
  });
  remove.addEventListener('click', () => {
    const config = editedTokens.players[index];
    if (config.shape === 'custom') config.shape = defaultToken.shape;
    config.image = null;
    render();
    saveTokens();
  });
  play.addEventListener('click', () => render(true));
  return render;
}

const renderTokenPlayers = [0, 1].map(makeTokenPlayer);
function renderTokenEditor() {
  sharedTokens.checked = editedTokens.shared;
  for (const render of renderTokenPlayers) render();
}

sharedTokens.addEventListener('change', () => {
  editedTokens.shared = sharedTokens.checked;
  renderTokenEditor();
  saveTokens();
});
form.addEventListener('input', renderTokenEditor);
form.addEventListener('change', renderTokenEditor);
window.addEventListener('message', event => {
  if (event.origin !== window.origin || event.data?.type !== 'bingo:tokens-ready') return;
  if (event.source === frame.contentWindow || appearancePopups.has(event.source)) {
    tokenRead.then(() => broadcastTokens(event.source));
  }
});

tokensSection.inert = true;
renderTokenEditor();
const tokenRead = tokenStorage('readonly').then(settings => {
  editedTokens = normalizeTokenSettings(settings);
  renderTokenEditor();
}).catch(() => {
  tokenStatus.hidden = false;
  tokenStatus.textContent = 'Не удалось загрузить настройки фишек.';
}).finally(() => {
  tokensSection.inert = false;
});
