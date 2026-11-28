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

function updateAppearance(trackChange = true) {
  const values = Object.fromEntries(new FormData(appearanceForm));
  imageControls.hidden = values.backgroundMode !== 'image';
  backgroundColor.closest('label').hidden = values.backgroundMode !== 'color';
  removeBackground.disabled = !backgroundImage;
  for (const output of appearanceForm.querySelectorAll('output')) {
    const slider = document.getElementById(output.htmlFor.value);
    output.value = slider.value + slider.dataset.unit;
  }
  for (const group of appearanceForm.querySelectorAll('[data-label-effect]')) {
    group.hidden = values[group.dataset.labelEffect] !== 'on';
  }
  stage.classList.toggle('transparent-preview', values.backgroundMode === 'transparent');
  sendAppearance(frame.contentWindow, values);
  for (const popup of appearancePopups) {
    if (popup.closed) appearancePopups.delete(popup);
    else sendAppearance(popup, values);
  }
  if (trackChange) window.projectChanged?.();
}

function clearBackgroundImage() {
  imageRequest++;
  backgroundImage = null;
  imageVersion++;
  imageInput.value = '';
  imageInput.disabled = false;
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
  imageInput.disabled = true;
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
    if (request === imageRequest) imageInput.disabled = false;
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

function addInteractiveAppearance(selector, groups) {
  const parent = document.querySelector(selector);
  return Object.fromEntries(Object.entries(groups).map(([prefix, { title, fields }]) => {
    const group = document.createElement('details');
    group.className = 'appearance-group appearance-subgroup';
    const summary = document.createElement('summary');
    summary.textContent = title;
    const formFields = document.createElement('div');
    formFields.className = 'appearance-fields';
    formFields.innerHTML = Object.entries(fields).map(([field, [label, , max, unit]]) => {
      const key = prefix + field;
      if (!max) return `<label class="color-setting">${label}<input name="${key}" type="color"></label>`;
      return `<label class="range-setting"><span>${label}</span><output for="${key}"></output>
        <input id="${key}" name="${key}" type="range" min="0" max="${max}" data-unit="${unit === 'px' ? ' пкс' : unit}">
      </label>`;
    }).join('');
    group.append(summary, formFields);
    parent.append(group);
    return [prefix, group];
  }));
}

function typographyFields(key, idPrefix = '') {
  const style = labelStyles[key];
  const id = `${idPrefix}${key}Size`;
  const fonts = Object.entries(appearanceFonts).map(([id, font]) =>
    `<option value="${id}">${font.label}</option>`
  ).join('');
  return `
    <label>Шрифт <select name="${key}Font">${fonts}</select></label>
    <label class="range-setting"><span>Размер текста</span><output for="${id}"></output>
      <input id="${id}" name="${key}Size" type="range" min="${style.min}" max="${style.max}" data-unit=" пкс">
    </label>
    <label class="color-setting">Цвет текста<input type="color" name="${labelColorKey(key, style)}"></label>`;
}

function gameLabelEffectFields(key) {
  function field(name) {
    const { label, choices, min, max, step, unit } = gameLabelEffects[name];
    const id = key + name;
    if (choices) {
      const options = Object.entries(choices).map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
      return `<label>${label}<select name="${id}">${options}</select></label>`;
    }
    if (min === undefined) return `<label class="color-setting">${label}<input type="color" name="${id}"></label>`;
    return `<label class="range-setting"><span>${label}</span><output for="${id}"></output>
      <input type="range" id="${id}" name="${id}" min="${min}" max="${max}" step="${step ?? 1}" data-unit="${unit ?? ' пкс'}">
    </label>`;
  }
  return field('Spacing') + field('Weight') + ['Stroke', 'Shadow'].map(effect =>
    field(effect) + `<div class="label-effect-fields" data-label-effect="${key + effect}" hidden>${
      Object.keys(gameLabelEffects).filter(name => name !== effect && name.startsWith(effect)).map(field).join('')
    }</div>`).join('');
}

function addLabelControls(choiceGroups) {
  const typography = document.querySelector('#typography-settings');
  const turns = document.querySelector('#turn-settings');
  const task = document.querySelector('#task-appearance');
  for (const [key, style] of Object.entries(labelStyles)) {
    const turn = key === 'activeBadge' || key === 'idleBadge';
    const group = document.createElement('details');
    group.className = 'appearance-group appearance-subgroup';
    const summary = document.createElement('summary');
    summary.textContent = style.label;
    const fields = document.createElement('div');
    fields.className = 'appearance-fields';
    fields.innerHTML = typographyFields(key) + (gameLabelKeys.includes(key) ? gameLabelEffectFields(key) : '');
    if (key === 'task') {
      const help = document.createElement('p');
      help.className = 'task-field-help';
      help.textContent = 'Применяется к заданиям с общим оформлением. Чтобы применить эти параметры к конкретному заданию, включите «Использовать общие настройки» в его индивидуальном оформлении.';
      fields.append(help);
    }
    if (turn) {
      fields.insertAdjacentHTML('beforeend', `
        <label class="color-setting">Цвет фона<input type="color" name="${key}Background"></label>
        <label class="range-setting"><span>Непрозрачность фона</span><output for="${key}Opacity"></output>
          <input id="${key}Opacity" name="${key}Opacity" type="range" min="0" max="100" data-unit="%">
        </label>`);
    }
    group.append(summary, fields);
    const category = taskTypographyKeys.includes(key) || key === 'taskButton'
      ? task : choiceGroups[key] ?? (turn ? turns : typography);
    category.append(group);
  }
}

addLabelControls({
  ...addInteractiveAppearance('#choice-appearance', choiceAppearanceGroups),
  ...addInteractiveAppearance('#sorting-appearance', sortingAppearanceGroups),
});
resetAppearance();
