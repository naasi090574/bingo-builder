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

resetAppearance();
