'use strict';

function mountChoiceTask(task, container, checkButton, mediaUrl, setReady) {
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
    if (incorrect.length) {
      for (const index of incorrect) flash(index);
      feedback.textContent = 'Попробуй ещё раз.';
    } else if (options.every((option, index) => !option.correct || selected.has(index))) {
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
