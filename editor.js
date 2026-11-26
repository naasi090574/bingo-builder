'use strict';

const sections = {
  settings: {
    description: 'Посмотрите, с какими правилами запускается текущая версия «Бинго».',
    status: 'Настройки появятся на следующем этапе. Условие победы можно выбрать в самой игре перед первой карточкой.',
  },
  appearance: {
    description: 'Здесь будут настройки цветов, фона и оформления игровых полей.',
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
const status = document.querySelector('#section-status');
const summary = document.querySelector('#game-summary');

function showSection() {
  const hash = window.location.hash.slice(1);
  const section = Object.hasOwn(sections, hash) ? hash : 'settings';
  const { description: copy, status: note } = sections[section];
  for (const link of links) {
    if (link.hash === `#${section}`) {
      link.setAttribute('aria-current', 'location');
      title.textContent = link.lastChild.textContent.trim();
    } else {
      link.removeAttribute('aria-current');
    }
  }
  description.textContent = copy;
  status.textContent = note ?? 'Раздел пока недоступен для редактирования.';
  summary.hidden = section !== 'settings';
}

document.querySelector('#field-size').textContent = `${bingoContent.size} × ${bingoContent.size}`;
window.addEventListener('hashchange', showSection);
showSection();
