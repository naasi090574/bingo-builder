'use strict';

const appearanceSource = window.parent !== window ? window.parent : window.opener;
let activeImageVersion;
let activeImageUrl;

const appearanceColors = {
  backgroundColor: '--chosen-background',
  boardColor: '--chosen-board',
  cellColor: '--chosen-cell',
  titleColor: '--chosen-title-color',
  textColor: '--chosen-text-color',
  buttonColor: '--chosen-button',
  buttonText: '--chosen-button-text',
  activeColor: '--chosen-active',
};

const appearanceScales = {
  boardOpacity: ['--board-fill', 0, 100, '%'],
  boardSize: ['--board-width', 65, 100, '%'],
  boardRadius: ['--board-radius', 0, 40, 'px'],
  cellOpacity: ['--cell-fill', 0, 100, '%'],
  imageSize: ['--image-size', 25, 100, '%'],
  cellRadius: ['--cell-radius', 0, 40, 'px'],
  titleSize: ['--chosen-title-size', 20, 48, 'px'],
  textSize: ['--chosen-text-size', 12, 22, 'px'],
};

function applyAppearance({ values, image, imageVersion }) {
  if (!values || typeof values !== 'object') return;
  const { body } = document;
  const set = (key, property, value) => {
    if (value && values[key] !== defaultAppearance[key]) body.style.setProperty(property, value);
    else body.style.removeProperty(property);
  };

  for (const [key, property] of Object.entries(appearanceColors)) {
    set(key, property, /^#[0-9a-f]{6}$/i.test(values[key]) ? values[key] : '');
  }
  for (const [key, [property, min, max, unit]] of Object.entries(appearanceScales)) {
    const value = Number(values[key]);
    set(key, property, Number.isFinite(value) ? Math.max(min, Math.min(max, value)) + unit : '');
  }
  set('titleFont', '--chosen-title-font', Object.hasOwn(appearanceFonts, values.titleFont) && appearanceFonts[values.titleFont]);
  set('textFont', '--chosen-text-font', Object.hasOwn(appearanceFonts, values.textFont) && appearanceFonts[values.textFont]);

  if (imageVersion !== activeImageVersion) {
    if (activeImageUrl) URL.revokeObjectURL(activeImageUrl);
    activeImageUrl = image instanceof Blob ? URL.createObjectURL(image) : null;
    activeImageVersion = imageVersion;
    if (activeImageUrl) body.style.setProperty('--chosen-image', `url("${activeImageUrl}")`);
    else body.style.removeProperty('--chosen-image');
  }
  body.dataset.background = values.backgroundMode;
  body.toggleAttribute('data-custom-layout',
    values.textFont !== defaultAppearance.textFont ||
    Number(values.textSize) > Number(defaultAppearance.textSize) ||
    Number(values.boardSize) < Number(defaultAppearance.boardSize));
}

if (appearanceSource) {
  window.addEventListener('message', event => {
    if (event.source !== appearanceSource || event.origin !== window.origin) return;
    if (event.data?.type === 'bingo:appearance') applyAppearance(event.data);
  });
  appearanceSource.postMessage({ type: 'bingo:appearance-ready' }, appearanceOrigin());
}
if (window.parent === window) {
  function fitLandscape() {
    const scale = Math.min(1, innerWidth / 1280, innerHeight / 720);
    document.body.classList.toggle('landscape-game', innerWidth >= innerHeight * 1.7);
    document.body.style.setProperty('--landscape-scale', scale);
  }
  window.addEventListener('resize', fitLandscape);
  fitLandscape();
}
