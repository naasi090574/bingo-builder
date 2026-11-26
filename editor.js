'use strict';

const sections = {
  settings: {
    description: 'Изменения сразу применяются в предпросмотре и начинают новую партию.',
  },
  appearance: {
    description: 'Оформление применяется сразу, сохраняя текущую партию.',
  },
  cards: {
    description: `Карточек с картинками в текущем наборе — ${bingoContent.cards.length}. Здесь можно будет собрать свой набор.`,
  },
  tasks: {
    description: `Устных заданий в текущем наборе — ${bingoContent.tasks.length}. Здесь можно будет добавить свои задания и вопросы.`,
  },
  tokens: {
    description: 'Сейчас правильные ответы отмечаются круглыми фишками с галочкой. Здесь можно будет изменить их вид.',
  },
  sound: {
    description: 'Здесь можно будет добавить звуки вытягивания карточки, установки фишки и победы.',
  },
  projects: {
    description: 'Здесь можно будет сохранить проект и вернуться к нему позже.',
  },
  genially: {
    description: 'Здесь можно будет подготовить игру для встраивания в презентацию Genially.',
  },
};

const links = document.querySelectorAll('.sidebar a');
const title = document.querySelector('#editor-title');
const description = document.querySelector('#section-description');
const availability = document.querySelector('.availability');
const form = document.querySelector('#game-settings');
const appearanceForm = document.querySelector('#appearance-settings');
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
  availability.hidden = section === 'settings' || section === 'appearance';
  appearanceForm.hidden = section !== 'appearance';
  form.hidden = section !== 'settings';
}

function applySettings(delay = 0) {
  const settings = readGameSettings(new FormData(form));
  const params = new URLSearchParams(Object.entries(settings).filter(([key, value]) =>
    value !== defaultGameSettings[key]
  ));
  const address = params.size ? `game.html?${params}` : 'game.html';
  launch.setAttribute('href', address);
  clearTimeout(previewTimer);
  const updatePreview = () => {
    const src = `${address}#preview`;
    if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
  };
  if (delay) {
    previewTimer = setTimeout(updatePreview, delay);
  } else {
    updatePreview();
  }
}

function fitPreview() {
  stage.style.setProperty('--preview-scale', stage.clientWidth / frame.width);
}

form.addEventListener('input', event => applySettings(event.target.matches('input') ? 300 : 0));
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
