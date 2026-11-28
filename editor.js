'use strict';

const sections = {
  settings: {
    description: 'Изменения сразу применяются в предпросмотре и начинают новую партию.',
  },
  appearance: {
    description: 'Оформление применяется сразу, сохраняя текущую партию.',
  },
  cards: {
    description: 'Соберите набор для игры. Изменения набора и заполнения начинают новую партию.',
  },
  tasks: {
    description: 'Добавьте устное задание, вопрос с выбором ответа или сортировку по группам. Порядок списка используется в последовательном режиме.',
  },
  tokens: {
    description: 'Настройте фишки игроков и проверьте их на образце ячейки.',
  },
  sound: {
    description: 'Выберите эффекты для игровых событий и настройте фоновую музыку.',
  },
  projects: {
    description: 'Откройте сохранённую игру, создайте копию или перенесите проект с помощью файла.',
  },
  genially: {
    description: 'Опубликуйте сохранённую игру и скопируйте код для вставки в Genially.',
  },
};

const links = document.querySelectorAll('.sidebar a');
const title = document.querySelector('#editor-title');
const description = document.querySelector('#section-description');
const availability = document.querySelector('.availability');
const form = document.querySelector('#game-settings');
const appearanceForm = document.querySelector('#appearance-settings');
const cardsSection = document.querySelector('#card-library');
const tasksSection = document.querySelector('#task-library');
const launch = document.querySelector('.launch');
const stage = document.querySelector('.preview-stage');
const frame = stage.querySelector('iframe');
let previewTimer;

function showSection() {
  const hash = window.location.hash.slice(1);
  const section = Object.hasOwn(sections, hash) ? hash : 'settings';
  const { description: copy } = sections[section];
  for (const link of links) {
    if (link.hash === `#${section}`) {
      link.setAttribute('aria-current', 'location');
      title.textContent = link.lastChild.textContent.trim();
    } else {
      link.removeAttribute('aria-current');
    }
  }
  description.textContent = copy;
  availability.hidden = ['settings', 'appearance', 'cards', 'tasks', 'tokens', 'sound', 'projects', 'genially'].includes(section);
  cardsSection.hidden = section !== 'cards';
  tasksSection.hidden = section !== 'tasks';
  document.querySelector('#token-settings').hidden = section !== 'tokens';
  document.querySelector('#sound-settings').hidden = section !== 'sound';
  document.querySelector('#project-library').hidden = section !== 'projects';
  appearanceForm.hidden = section !== 'appearance';
  document.querySelector('#publication-section').hidden = section !== 'genially';
  form.hidden = section !== 'settings';
}

function readEditorGameSettings() {
  const values = new FormData(form);
  values.set('showBoardTitle', form.elements.showBoardTitle.checked ? 'yes' : 'no');
  return readGameSettings(values);
}

function applySettings(delay = 0) {
  const settings = readEditorGameSettings();
  const params = new URLSearchParams(Object.entries(settings).filter(([key, value]) =>
    key !== 'title' && value !== defaultGameSettings[key]
  ));
  const address = params.size ? `game.html?${params}` : 'game.html';
  launch.setAttribute('href', address);
  clearTimeout(previewTimer);
  if (delay) {
    previewTimer = setTimeout(sendPreviewSettings, delay);
  } else {
    sendPreviewSettings();
  }
}

function sendPreviewSettings() {
  frame.contentWindow.postMessage({
    type: 'bingo:preview-settings',
    search: new URL(launch.href).search,
  }, appearanceOrigin());
}

window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow || event.origin !== window.origin) return;
  if (event.data?.type === 'bingo:settings-ready') sendPreviewSettings();
});

function fitPreview() {
  stage.style.setProperty('--preview-scale', stage.clientWidth / frame.width);
}

form.addEventListener('input', event => {
  const instant = ['boardTitle', 'showBoardTitle'].includes(event.target.name);
  applySettings(!instant && event.target.matches('input') ? 300 : 0);
});
form.addEventListener('change', () => applySettings());
form.addEventListener('submit', event => {
  event.preventDefault();
  applySettings();
});
new ResizeObserver(fitPreview).observe(stage);
fitPreview();
applySettings();
window.addEventListener('hashchange', showSection);
showSection();
