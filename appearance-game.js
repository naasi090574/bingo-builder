'use strict';

const appearanceSource = window.parent !== window ? window.parent : window.opener;
let activeImageVersion;
let activeImageUrl;

const appearanceColors = {
  backgroundColor: '--chosen-background',
  boardColor: '--chosen-board',
  cellColor: '--chosen-cell',
  boardBorder: '--board-border-color',
  cellBorder: '--cell-border-color',
  activeBadgeBackground: '--active-badge-background',
  idleBadgeBackground: '--idle-badge-background',
  drawPanelColor: '--draw-panel-color',
  drawSlotColor: '--draw-slot-color',
  drawSlotBorder: '--draw-slot-border',
  buttonColor: '--chosen-button',
  activeColor: '--chosen-active',
  taskBackground: '--task-background',
  taskBorder: '--task-border',
  taskButtonBackground: '--task-button-background',
};

const appearanceScales = {
  boardOpacity: ['--board-fill', 0, 100, '%'],
  boardDim: ['--board-dim', 0, 80, '%'],
  boardBorderWidth: ['--board-border-width', 0, 10, 'px'],
  boardBorderOpacity: ['--board-border-opacity', 0, 100, '%'],
  cellBorderWidth: ['--cell-border-width', 0, 10, 'px'],
  cellBorderOpacity: ['--cell-border-opacity', 0, 100, '%'],
  boardSize: ['--board-width', 65, 100, '%'],
  boardRadius: ['--board-radius', 0, 40, 'px'],
  cellOpacity: ['--cell-fill', 0, 100, '%'],
  imageSize: ['--image-size', 25, 100, '%'],
  cellRadius: ['--cell-radius', 0, 40, 'px'],
  activeBadgeOpacity: ['--active-badge-fill', 0, 100, '%'],
  idleBadgeOpacity: ['--idle-badge-fill', 0, 100, '%'],
  drawPanelOpacity: ['--draw-panel-fill', 0, 100, '%'],
  drawPanelRadius: ['--draw-panel-radius', 0, 40, 'px'],
  drawPanelOffsetX: ['--draw-panel-x', -24, 24, 'px'],
  drawPanelOffsetY: ['--draw-panel-y', -80, 80, 'px'],
  drawPanelHeight: ['--draw-panel-height', 60, 115, '%'],
  drawSlotOpacity: ['--draw-slot-fill', 0, 100, '%'],
  drawSlotWidth: ['--draw-slot-width', 0, 10, 'px'],
  drawSlotBorderOpacity: ['--draw-slot-border-opacity', 0, 100, '%'],
  drawSlotRadius: ['--draw-slot-radius', 0, 40, 'px'],
  taskOpacity: ['--task-opacity', 0, 100, '%'],
  taskBorderWidth: ['--task-border-width', 0, 16, 'px'],
  taskRadius: ['--task-radius', 0, 48, 'px'],
  taskBackdrop: ['--task-backdrop', 0, 100, '%'],
};

function applyGameLabelEffects(style, values) {
  for (const key of gameLabelKeys) {
    const prefix = `--label-${key}-`;
    const read = field => values[key + field] ?? gameLabelEffects[field].initial;
    const range = field => {
      const { min, max, initial } = gameLabelEffects[field];
      const value = Number(read(field));
      return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : Number(initial);
    };
    const length = field => `${range(field) / 16}rem`;
    const color = field => /^#[\da-f]{6}$/i.test(read(field)) ? read(field) : gameLabelEffects[field].initial;
    const decorative = ['gogono', 'itim', 'ruthless', 'solKol'].includes(values[key + 'Font']);
    const weight = read('Weight');
    if (decorative || weight === 'normal' || weight === 'bold') {
      style.setProperty(prefix + 'weight', decorative || weight === 'normal' ? '400' : '700');
    } else style.removeProperty(prefix + 'weight');
    style.setProperty(prefix + 'spacing', length('Spacing'));
    style.setProperty(prefix + 'stroke-width', read('Stroke') === 'on' ? length('StrokeWidth') : '0');
    style.setProperty(prefix + 'stroke-color', color('StrokeColor'));
    style.setProperty(prefix + 'shadow', read('Shadow') === 'on'
      ? `${length('ShadowX')} ${length('ShadowY')} ${length('ShadowBlur')} color-mix(in srgb, ${color('ShadowColor')} ${range('ShadowOpacity')}%, transparent)`
      : 'none');
  }
}

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
  for (const [prefix, { fields }] of Object.entries(interactiveAppearanceGroups)) {
    for (const [field, [, , max, unit]] of Object.entries(fields)) {
      const key = prefix + field;
      if (max) setScale(key, `--${key}`, 0, max, unit);
      else setColor(key, `--${key}`);
    }
  }
  for (const [key, style] of Object.entries(labelStyles)) {
    for (const field of ['Font', 'Size', 'Color']) {
      const setting = field === 'Color' ? labelColorKey(key, style) : key + field;
      set(setting, `--label-${key}-${field.toLowerCase()}`, typographyValue(key, field, values[setting]));
    }
  }

  if (imageVersion !== activeImageVersion) {
    if (activeImageUrl) URL.revokeObjectURL(activeImageUrl);
    activeImageUrl = image instanceof Blob ? URL.createObjectURL(image) : null;
    activeImageVersion = imageVersion;
    if (activeImageUrl) body.style.setProperty('--chosen-image', `url("${activeImageUrl}")`);
    else body.style.removeProperty('--chosen-image');
  }
  applyGameLabelEffects(body.style, values);
  body.dataset.background = values.backgroundMode;
  window.scheduleGameLabelFit?.();

}

if (appearanceSource && !new URLSearchParams(window.location.search).has('published')) {
  window.addEventListener('message', event => {
    if (event.source !== appearanceSource || event.origin !== window.origin) return;
    if (event.data?.type === 'bingo:appearance') applyAppearance(event.data);
  });
  appearanceSource.postMessage({ type: 'bingo:appearance-ready' }, appearanceOrigin());
}
