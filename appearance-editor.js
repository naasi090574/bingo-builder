'use strict';

const appearancePopups = new Set();
const imageInput = document.querySelector('#background-image');
const imageControls = document.querySelector('#background-image-controls');
const removeBackground = document.querySelector('#remove-background');
const backgroundStatus = document.querySelector('#background-status');
const backgroundMode = appearanceForm.elements.backgroundMode;
const backgroundColor = appearanceForm.elements.backgroundColor;
let backgroundImage = null;
let imageRequest = 0;
let imageVersion = 0;

function sendAppearance(target, values) {
  target.postMessage({ type: 'bingo:appearance', values, image: backgroundImage, imageVersion }, appearanceOrigin());
}

function updateAppearance() {
  const values = Object.fromEntries(new FormData(appearanceForm));
  imageControls.hidden = values.backgroundMode !== 'image';
  backgroundColor.closest('label').hidden = values.backgroundMode !== 'color';
  removeBackground.disabled = !backgroundImage;
  for (const output of appearanceForm.querySelectorAll('output')) {
    const slider = document.getElementById(output.htmlFor.value);
    output.value = slider.value + slider.dataset.unit;
  }
  stage.classList.toggle('transparent-preview', values.backgroundMode === 'transparent');
  sendAppearance(frame.contentWindow, values);
  for (const popup of appearancePopups) {
    if (popup.closed) appearancePopups.delete(popup);
    else sendAppearance(popup, values);
  }
}

function clearBackgroundImage() {
  imageRequest++;
  backgroundImage = null;
  imageVersion++;
  imageInput.value = '';
  backgroundStatus.textContent = '';
}

function resetAppearance() {
  for (const [key, value] of Object.entries(defaultAppearance)) {
    appearanceForm.elements[key].value = value;
  }
  clearBackgroundImage();
  updateAppearance();
}

appearanceForm.addEventListener('input', event => {
  if (event.target !== imageInput) updateAppearance();
});
appearanceForm.addEventListener('submit', event => event.preventDefault());
appearanceForm.addEventListener('reset', event => {
  event.preventDefault();
  resetAppearance();
});

imageInput.addEventListener('change', async () => {
  const file = imageInput.files[0];
  if (!file) return;
  const request = ++imageRequest;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (request !== imageRequest) return;
    backgroundImage = file;
    imageVersion++;
    backgroundStatus.textContent = file.name;
    updateAppearance();
  } catch {
    if (request === imageRequest) {
      imageInput.value = '';
      backgroundStatus.textContent = 'Не удалось открыть изображение.';
    }
  } finally {
    URL.revokeObjectURL(url);
  }
});

removeBackground.addEventListener('click', () => {
  clearBackgroundImage();
  updateAppearance();
});

window.addEventListener('message', event => {
  if (event.origin !== window.origin || event.data?.type !== 'bingo:appearance-ready') return;
  if (event.source !== frame.contentWindow && !appearancePopups.has(event.source)) return;
  sendAppearance(event.source, Object.fromEntries(new FormData(appearanceForm)));
});

launch.addEventListener('click', event => {
  // Keep an editor connection for live styling of this same-origin game.
  const popup = window.open(launch.href, '_blank');
  if (!popup) return;
  event.preventDefault();
  appearancePopups.add(popup);
});

function addLabelControls() {
  const typography = document.querySelector('#typography-settings');
  const turns = document.querySelector('#turn-settings');
  const task = document.querySelector('#task-appearance');
  const fonts = Object.entries(appearanceFonts).map(([id, font]) =>
    `<option value="${id}">${font.label}</option>`
  ).join('');
  for (const [key, style] of Object.entries(labelStyles)) {
    const turn = key === 'activeBadge' || key === 'idleBadge';
    const group = document.createElement('details');
    group.className = 'appearance-group appearance-subgroup';
    const summary = document.createElement('summary');
    summary.textContent = style.label;
    const fields = document.createElement('div');
    fields.className = 'appearance-fields';
    fields.innerHTML = `
      <label>Шрифт <select name="${key}Font">${fonts}</select></label>
      <label class="range-setting"><span>Размер текста</span><output for="${key}Size"></output>
        <input id="${key}Size" name="${key}Size" type="range" min="${style.min}" max="${style.max}" data-unit=" пкс">
      </label>
      <label class="color-setting">Цвет текста<input type="color" name="${labelColorKey(key, style)}"></label>`;
    if (turn) {
      fields.insertAdjacentHTML('beforeend', `
        <label class="color-setting">Цвет фона<input type="color" name="${key}Background"></label>
        <label class="range-setting"><span>Непрозрачность фона</span><output for="${key}Opacity"></output>
          <input id="${key}Opacity" name="${key}Opacity" type="range" min="0" max="100" data-unit="%">
        </label>`);
    }
    group.append(summary, fields);
    const category = key === 'task' || key === 'taskButton' ? task : turn ? turns : typography;
    category.append(group);
  }
}

addLabelControls();
resetAppearance();
