'use strict';

function mountRevealTask(task, container, checkButton, mediaUrl, setReady) {
  const previewRound = previewingTask && Number.isInteger(task.previewRound)
    && task.previewRound >= 0 && task.previewRound < task.rounds.length ? task.previewRound : undefined;
  const rounds = task.roundOrder === 'random' && previewRound === undefined ? shuffle(task.rounds, Math.random) : task.rounds;
  const counter = document.createElement('p');
  counter.className = 'reveal-counter';
  counter.setAttribute('role', 'status');
  const question = document.createElement('p');
  question.className = 'task-text reveal-question';
  taskAudio.before(question);
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'reveal-card';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'task-action reveal-next';
  next.textContent = 'Далее';
  container.append(counter, card, next);
  checkButton.hidden = true;

  let index = previewRound ?? 0;
  let opened = false;
  const urls = new Map();

  function urlFor(blob) {
    if (!urls.has(blob)) urls.set(blob, mediaUrl(blob));
    return urls.get(blob);
  }

  function face(media, side) {
    const layer = document.createElement('span');
    layer.className = `reveal-face reveal-${side}`;
    layer.setAttribute('aria-hidden', 'true');
    if (media) {
      const image = document.createElement('img');
      image.src = urlFor(media.image);
      image.alt = '';
      image.draggable = false;
      layer.append(image);
    } else if (side === 'cover') {
      layer.classList.add('is-standard');
      layer.textContent = '?';
    }
    return layer;
  }

  function setOpen(value) {
    opened = value;
    card.classList.toggle('is-open', opened);
    card.setAttribute('aria-pressed', String(opened));
    card.setAttribute('aria-label', opened ? 'Закрыть изображение' : 'Открыть изображение');
    card.disabled = !rounds[index].answer;
    const final = index === rounds.length - 1;
    next.hidden = !opened || final;
    setReady(opened && final);
  }

  function showRound() {
    const round = rounds[index];
    counter.textContent = `Раунд ${index + 1} из ${rounds.length}`;
    question.textContent = round.riddle;
    question.hidden = !round.showRiddle || !round.riddle.trim();
    taskAudio.pause();
    if (round.audio) taskAudio.src = urlFor(round.audio.file);
    else taskAudio.removeAttribute('src');
    taskAudio.hidden = !round.audio;
    taskAudio.load();
    card.replaceChildren(face(round.cover, 'cover'), face(round.answer, 'answer'));
    setOpen(false);
  }

  card.addEventListener('click', () => setOpen(!opened));
  next.addEventListener('click', () => {
    index++;
    showRound();
    card.focus();
  });
  showRound();
  return () => question.remove();
}
