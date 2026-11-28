'use strict';

function mountChoiceTask(task, container, checkButton, mediaUrl, setReady, onAnswer) {
  const options = task.shuffle ? shuffle(task.options, Math.random) : task.options;
  const odd = task.type === 'odd';
  const dragMode = !odd && task.method === 'drag';
  const batch = task.check === 'batch';
  const selected = new Set();
  const wrong = new Set();
  const timers = new Map();
  const buttons = [];
  let dragged;
  let touch;
  let suppressClick = false;
  let completed = false;

  const layout = document.createElement('div');
  layout.className = dragMode ? 'choice-layout is-drag' : 'choice-layout';
  const pool = document.createElement('div');
  pool.className = 'choice-options';
  pool.dataset.count = String(options.length);
  pool.setAttribute('role', 'group');
  pool.setAttribute('aria-label', 'Варианты ответа');
  pool.style.setProperty('--choice-columns', options.length > 4 ? Math.ceil(options.length / 2) : options.length);
  if (odd && options.length > 10) {
    const columns = Math.ceil(Math.sqrt(options.length * 1.6));
    pool.dataset.many = '';
    pool.style.setProperty('--choice-columns', columns);
    pool.style.setProperty('--odd-option-rows', Math.ceil(options.length / columns));
  }
  layout.append(pool);

  let drop;
  let received;
  if (dragMode) {
    drop = document.createElement('div');
    drop.className = 'choice-drop';
    drop.setAttribute('role', 'group');
    drop.setAttribute('aria-label', 'Принимающая область');
    if (task.dropImage) {
      const image = document.createElement('img');
      image.src = mediaUrl(task.dropImage.image);
      image.alt = '';
      image.draggable = false;
      drop.append(image);
    }
    const hint = document.createElement('p');
    hint.textContent = 'Перетащи сюда';
    drop.append(hint);
    received = document.createElement('div');
    received.className = 'choice-received';
    drop.append(received);
    layout.append(drop);
  }
  const feedback = document.createElement('p');
  feedback.className = 'choice-feedback';
  feedback.setAttribute('role', 'status');
  container.append(layout, feedback);
  const followUpText = odd ? task.followUp?.trim() : '';
  const followUp = followUpText ? document.createElement('p') : null;
  if (followUp) {
    followUp.className = 'task-text odd-follow-up';
    followUp.textContent = followUpText;
    followUp.hidden = true;
    followUp.setAttribute('role', 'status');
    container.append(followUp);
  }

  function update() {
    buttons.forEach((button, index) => {
      const chosen = selected.has(index);
      const parent = dragMode && chosen ? received : pool;
      const focused = document.activeElement === button;
      if (button.parentNode !== parent) {
        const next = [...parent.children].find(sibling => Number(sibling.dataset.option) > index);
        parent.insertBefore(button, next ?? null);
        if (focused) button.focus({ preventScroll: true });
      }
      button.setAttribute('aria-pressed', String(chosen));
      if (odd) button.setAttribute('aria-disabled', String(completed));
      button.classList.toggle('is-right', (completed || !batch) && chosen && options[index].correct);
      button.classList.toggle('is-wrong', wrong.has(index));
      if (dragMode) button.title = chosen ? 'Вернуть вариант' : 'Переместить вариант';
    });
    checkButton.disabled = completed || !selected.size;
    if (odd) checkButton.hidden = !batch || completed;
  }

  function flash(index) {
    wrong.add(index);
    clearTimeout(timers.get(index));
    timers.set(index, setTimeout(() => {
      wrong.delete(index);
      timers.delete(index);
      selected.delete(index);
      update();
    }, 620));
  }

  function verify() {
    if (odd && completed) return;
    const incorrect = batch ? [...selected].filter(index => !options[index].correct) : [];
    const allCorrect = !incorrect.length && options.every((option, index) => !option.correct || selected.has(index));
    if (batch) onAnswer(allCorrect);
    if (incorrect.length) {
      for (const index of incorrect) flash(index);
      feedback.textContent = 'Попробуй ещё раз.';
    } else if (allCorrect) {
      completed = true;
      if (odd) {
        timers.forEach(clearTimeout);
        timers.clear();
        wrong.clear();
      }
      feedback.textContent = followUp ? '' : 'Верно!';
      if (followUp) followUp.hidden = false;
      setReady(true);
    } else if (batch) {
      feedback.textContent = odd ? 'Найдены не все лишние элементы.' : 'Выбраны не все правильные ответы.';
    }
    update();
  }

  function select(index, moveToDrop) {
    if (selected.has(index) === moveToDrop) return;
    if (completed) {
      if (odd || moveToDrop) return;
      completed = false;
      setReady(false);
    }
    feedback.textContent = '';
    clearTimeout(timers.get(index));
    timers.delete(index);
    wrong.delete(index);
    const instantMistake = !batch && moveToDrop && !options[index].correct;
    if (!moveToDrop) selected.delete(index);
    else if (!odd || !instantMistake) selected.add(index);
    if (!batch && moveToDrop) onAnswer(!instantMistake);
    if (instantMistake) {
      flash(index);
      feedback.textContent = 'Попробуй ещё раз.';
      update();
    } else if (!batch && moveToDrop) verify();
    else update();
  }

  function bindDrop(target, moveToDrop) {
    target.addEventListener('dragover', event => {
      if (dragged === undefined) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    target.addEventListener('drop', event => {
      if (dragged === undefined) return;
      event.preventDefault();
      select(dragged, moveToDrop);
      dragged = undefined;
    });
  }

  options.forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-option';
    button.dataset.option = String(index);
    if (option.media) {
      const image = document.createElement('img');
      image.src = mediaUrl(option.media.image);
      image.alt = option.text.trim() ? '' : option.media.name;
      image.draggable = false;
      button.append(image);
    }
    if (option.text.trim()) {
      const text = document.createElement('span');
      text.textContent = option.text;
      button.append(text);
    }
    button.addEventListener('click', () => {
      if (suppressClick) return;
      select(index, !selected.has(index));
    });
    if (dragMode) {
      button.draggable = true;
      button.addEventListener('dragstart', event => {
        dragged = index;
        event.dataTransfer.setData('text/plain', String(index));
        event.dataTransfer.effectAllowed = 'move';
      });
      button.addEventListener('dragend', () => { dragged = undefined; });
      button.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'mouse' && event.isPrimary) {
          touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
          button.setPointerCapture(event.pointerId);
        }
      });
      button.addEventListener('pointerup', event => {
        if (touch?.id !== event.pointerId) return;
        const moved = Math.hypot(touch.x - event.clientX, touch.y - event.clientY) > 12;
        touch = undefined;
        if (!moved) return;
        const target = document.elementFromPoint(event.clientX, event.clientY);
        if (drop.contains(target)) select(index, true);
        else if (pool.contains(target)) select(index, false);
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 0);
      });
      button.addEventListener('pointercancel', () => { touch = undefined; });
    }
    buttons.push(button);
    pool.append(button);
  });

  if (dragMode) {
    bindDrop(drop, true);
    bindDrop(pool, false);
  }
  checkButton.hidden = !batch;
  checkButton.addEventListener('click', verify);
  update();
  return () => {
    timers.forEach(clearTimeout);
    checkButton.removeEventListener('click', verify);
  };
}

function mountOddTask(task, container, checkButton, mediaUrl, setReady, onAnswer) {
  const rounds = oddTaskRounds(task);
  const counter = document.createElement('p');
  counter.className = 'odd-round-counter';
  counter.setAttribute('role', 'status');
  const stage = document.createElement('div');
  stage.className = 'odd-round-stage';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'task-action odd-next-round';
  next.textContent = 'Следующий раунд';
  container.append(counter, stage, next);

  let index = 0;
  let disposeRound;
  const urls = new Map();
  function roundMediaUrl(blob) {
    if (!urls.has(blob)) urls.set(blob, mediaUrl(blob));
    return urls.get(blob);
  }

  function showRound() {
    disposeRound?.();
    stage.replaceChildren();
    next.hidden = true;
    setReady(false);
    counter.textContent = `Раунд ${index + 1} из ${rounds.length}`;
    const { options, followUp } = rounds[index];
    disposeRound = mountChoiceTask({ ...task, options, followUp }, stage, checkButton, roundMediaUrl, correct => {
      const final = index === rounds.length - 1;
      next.hidden = !correct || final;
      setReady(correct && final);
      if (!next.hidden) next.focus();
    }, onAnswer);
  }

  next.addEventListener('click', () => {
    index++;
    showRound();
    stage.querySelector('button')?.focus();
  });
  showRound();
  return () => disposeRound?.();
}
