'use strict';

const appearanceSource = window.parent !== window ? window.parent : window.opener;
let activeImageVersion;
let activeImageUrl;

const appearanceColors = {
  backgroundColor: '--chosen-background',
  boardColor: '--chosen-board',
  cellColor: '--chosen-cell',
  activeBadgeBackground: '--active-badge-background',
  idleBadgeBackground: '--idle-badge-background',
  drawPanelColor: '--draw-panel-color',
  drawSlotColor: '--draw-slot-color',
  drawSlotBorder: '--draw-slot-border',
  buttonColor: '--chosen-button',
  activeColor: '--chosen-active',
};

const appearanceScales = {
  boardOpacity: ['--board-fill', 0, 100, '%'],
  boardSize: ['--board-width', 65, 100, '%'],
  boardRadius: ['--board-radius', 0, 40, 'px'],
  cellOpacity: ['--cell-fill', 0, 100, '%'],
  imageSize: ['--image-size', 25, 100, '%'],
  cellRadius: ['--cell-radius', 0, 40, 'px'],
  activeBadgeOpacity: ['--active-badge-fill', 0, 100, '%'],
  idleBadgeOpacity: ['--idle-badge-fill', 0, 100, '%'],
  drawPanelOpacity: ['--draw-panel-fill', 0, 100, '%'],
  drawPanelRadius: ['--draw-panel-radius', 0, 40, 'px'],
  drawSlotOpacity: ['--draw-slot-fill', 0, 100, '%'],
  drawSlotWidth: ['--draw-slot-width', 0, 12, 'px'],
  drawSlotRadius: ['--draw-slot-radius', 0, 40, 'px'],
};

function applyAppearance({ values, image, imageVersion }) {
  if (!values || typeof values !== 'object') return;
  const { body } = document;
  const set = (key, property, value) => {
    if (value && values[key] !== defaultAppearance[key]) body.style.setProperty(property, value);
    else body.style.removeProperty(property);
  };

  const setColor = (key, property) =>
    set(key, property, /^#[0-9a-f]{6}$/i.test(values[key]) ? values[key] : '');
  const setScale = (key, property, min, max, unit) => {
    const value = Number(values[key]);
    set(key, property, Number.isFinite(value) ? Math.max(min, Math.min(max, value)) + unit : '');
  };

  for (const [key, property] of Object.entries(appearanceColors)) setColor(key, property);
  for (const [key, range] of Object.entries(appearanceScales)) setScale(key, ...range);
  for (const [key, style] of Object.entries(labelStyles)) {
    const fontKey = `${key}Font`;
    const font = Object.hasOwn(appearanceFonts, values[fontKey]) && appearanceFonts[values[fontKey]].css;
    set(fontKey, `--label-${key}-font`, font);
    const sizeKey = `${key}Size`;
    const size = Number(values[sizeKey]);
    set(sizeKey, `--label-${key}-size`, Number.isFinite(size)
      ? `${Math.max(style.min, Math.min(style.max, size)) / 16}rem` : '');
    setColor(labelColorKey(key, style), `--label-${key}-color`);
  }

  if (imageVersion !== activeImageVersion) {
    if (activeImageUrl) URL.revokeObjectURL(activeImageUrl);
    activeImageUrl = image instanceof Blob ? URL.createObjectURL(image) : null;
    activeImageVersion = imageVersion;
    if (activeImageUrl) body.style.setProperty('--chosen-image', `url("${activeImageUrl}")`);
    else body.style.removeProperty('--chosen-image');
  }
  body.dataset.background = values.backgroundMode;

}

if (appearanceSource) {
  window.addEventListener('message', event => {
    if (event.source !== appearanceSource || event.origin !== window.origin) return;
    if (event.data?.type === 'bingo:appearance') applyAppearance(event.data);
  });
  appearanceSource.postMessage({ type: 'bingo:appearance-ready' }, appearanceOrigin());
}
