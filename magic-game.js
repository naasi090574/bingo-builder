'use strict';

function mountMagicTask(task, container, checkButton, mediaUrl, setReady, onAnswer, prompt) {
  const rounds = task.roundOrder === 'random' ? shuffle(task.rounds, Math.random) : task.rounds;
  const counter = document.createElement('p');
  counter.className = 'magic-counter';
  counter.setAttribute('role', 'status');
  const picture = document.createElement('button');
  picture.type = 'button';
  picture.className = 'magic-picture';
  const sparks = document.createElement('span');
  sparks.className = 'magic-sparks';
  sparks.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 10; index++) {
    const spark = document.createElement('span');
    spark.style.setProperty('--spark-angle', `${index * 36}deg`);
    spark.style.setProperty('--spark-delay', `${index % 3 * 20}ms`);
    sparks.append(spark);
  }
  const actions = document.createElement('div');
  actions.className = 'magic-actions';
  const repeat = document.createElement('button');
  repeat.type = 'button';
  repeat.className = 'task-action';
  repeat.textContent = 'Повторить превращение';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'task-action';
  next.textContent = 'Следующий раунд';
  actions.append(repeat, next);
  container.append(counter, picture, actions);

  const urls = new Map();
  let index = 0;

  function scene(round, after) {
    const layer = document.createElement('span');
    layer.className = after ? 'magic-scene magic-after-scene' : 'magic-scene magic-before-scene';
    if (!round.media) return layer;
    const blob = round.media.image;
    if (!urls.has(blob)) urls.set(blob, mediaUrl(blob));
    const copies = round.mode === (after ? 'multiply' : 'merge') ? round.count : 1;
    const columns = copies === 1 ? 1 : Math.ceil(Math.sqrt(copies * 1.45));
    layer.style.setProperty('--magic-columns', columns);
    layer.style.setProperty('--magic-rows', Math.ceil(copies / columns));
    layer.style.setProperty('--magic-size', `${magicUsesCopies(round.mode) ? 100 : (after ? round.afterSize : round.beforeSize)}%`);
    for (let count = 0; count < copies; count++) {
      const image = document.createElement('img');
      image.src = urls.get(blob);
      image.alt = '';
      image.draggable = false;
      layer.append(image);
    }
    return layer;
  }

  function update(transformed) {
    const instruction = transformed ? task.after : task.text;
    prompt.textContent = instruction;
    prompt.hidden = !instruction.trim();
    picture.classList.toggle('is-transformed', transformed);
    picture.setAttribute('aria-label', transformed ? 'Превращение выполнено' : 'Превратить изображение');
    picture.setAttribute('aria-disabled', String(transformed || !rounds[index].media));
    repeat.hidden = !transformed;
    next.hidden = !transformed || index === rounds.length - 1;
    setReady(transformed && index === rounds.length - 1);
  }

  function showRound() {
    const round = rounds[index];
    counter.textContent = `Раунд ${index + 1} из ${rounds.length}`;
    picture.classList.remove('has-sparkles');
    picture.replaceChildren(scene(round, false), scene(round, true), sparks);
    update(false);
  }

  picture.addEventListener('click', () => {
    if (picture.getAttribute('aria-disabled') === 'true') return;
    update(true);
    picture.classList.add('has-sparkles');
  });
  repeat.addEventListener('click', () => {
    picture.classList.remove('has-sparkles');
    update(false);
    picture.focus();
  });
  next.addEventListener('click', () => {
    index++;
    showRound();
    picture.focus();
  });
  checkButton.hidden = true;
  showRound();
}
