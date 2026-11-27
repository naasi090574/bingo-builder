'use strict';

function mountSortingTask(task, container, checkButton, mediaUrl, setReady, onAnswer) {
  const items = task.shuffle ? shuffle(task.items, Math.random) : task.items;
  const positions = Array(items.length).fill(null);
  const wrong = new Map();
  const zones = new Map();
  const batch = task.check === 'batch';
  const drag = task.method === 'drag';
  let selected = null;
  let completed = false;
  let pointer;
  let hovered;
  let suppressClick = false;

  const board = document.createElement('div');
  board.className = drag ? 'sorting-board is-drag' : 'sorting-board';
  board.dataset.count = String(items.length);
  board.classList.toggle('is-compact', task.groups.length === 2 && items.length <= 4);
  const pool = document.createElement('section');
  pool.className = 'sorting-zone sorting-pool';
  const poolLabel = document.createElement('button');
  poolLabel.type = 'button';
  poolLabel.className = 'sorting-return';
  poolLabel.textContent = 'Вернуть в список';
  pool.setAttribute('aria-label', 'Нераспределённые элементы');
  pool.append(poolLabel);
  const groups = document.createElement('div');
  groups.className = 'sorting-groups';
  groups.style.setProperty('--sorting-groups', task.groups.length);
  const feedback = document.createElement('p');
  feedback.className = 'choice-feedback sorting-feedback';
  feedback.setAttribute('role', 'status');
  board.append(pool, groups, feedback);
  container.append(board);

  function appendContent(element, entry) {
    if (entry.media) {
      const image = document.createElement('img');
      image.src = mediaUrl(entry.media.image);
      image.alt = entry.text.trim() ? '' : entry.media.name;
      image.draggable = false;
      element.append(image);
    }
    if (entry.text.trim()) {
      const text = document.createElement('span');
      text.textContent = entry.text;
      element.append(text);
    }
  }

  function addZone(element, target) {
    const contents = document.createElement('div');
    contents.className = 'sorting-contents';
    element.append(contents);
    zones.set(element, { target, contents });
    element.addEventListener('click', event => {
      if (!event.target.closest('.sorting-item') && selected !== null) move(selected, target);
    });
    return contents;
  }

  const unassigned = addZone(pool, null);
  const assigned = new Map(task.groups.map(group => {
    const element = document.createElement('section');
    element.className = 'sorting-zone sorting-group';
    element.setAttribute('aria-label', group.text.trim() || group.media?.name || 'Группа');
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'sorting-group-label';
    appendContent(label, group);
    element.append(label);
    groups.append(element);
    return [group.id, addZone(element, group.id)];
  }));

  function update() {
    buttons.forEach((button, index) => {
      const destination = positions[index] === null ? unassigned : assigned.get(positions[index]);
      if (button.parentElement !== destination) {
        const focused = document.activeElement === button;
        const next = [...destination.children].find(other => Number(other.dataset.item) > index);
        destination.insertBefore(button, next ?? null);
        if (focused) button.focus({ preventScroll: true });
      }
      button.setAttribute('aria-pressed', String(index === selected));
      button.classList.toggle('is-right', (!batch || completed) && positions[index] === items[index].groupId);
      button.classList.toggle('is-wrong', wrong.has(index));
    });
    for (const { contents } of zones.values()) {
      const count = contents.childElementCount;
      const limit = contents === unassigned ? 10 : 5;
      contents.style.setProperty('--sorting-columns', Math.min(limit, Math.max(1, count)));
      contents.classList.toggle('is-dense', count > (contents === unassigned ? 10 : 8));
    }
    poolLabel.hidden = selected === null || positions[selected] === null;
    checkButton.disabled = completed || positions.every(position => position === null);
  }

  function clearWrong(index) {
    clearTimeout(wrong.get(index));
    wrong.delete(index);
  }

  function flash(index) {
    clearWrong(index);
    wrong.set(index, setTimeout(() => {
      wrong.delete(index);
      update();
    }, 650));
  }

  function verify() {
    if (completed) return;
    const misplaced = positions.map((target, index) => target !== null && target !== items[index].groupId);
    if (batch) {
      onAnswer(!misplaced.some(Boolean) && !positions.includes(null));
      misplaced.forEach((bad, index) => { if (bad) flash(index); });
      if (misplaced.some(Boolean)) feedback.textContent = 'Попробуй ещё раз.';
      else if (positions.includes(null)) feedback.textContent = 'Распредели все элементы.';
    }
    if (!misplaced.some(Boolean) && !positions.includes(null)) {
      feedback.textContent = 'Верно!';
      completed = true;
      setReady(true);
    }
    update();
  }

  function move(index, target) {
    if (positions[index] === target) {
      selected = null;
      update();
      return;
    }
    if (completed) {
      completed = false;
      setReady(false);
    }
    selected = null;
    positions[index] = target;
    clearWrong(index);
    feedback.textContent = '';
    if (!batch && target !== null) onAnswer(target === items[index].groupId);
    if (!batch && target !== null && target !== items[index].groupId) {
      flash(index);
      feedback.textContent = 'Попробуй ещё раз.';
    }
    if (batch) update();
    else verify();
  }

  function zoneAt(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest('.sorting-zone');
    return zones.has(element) ? element : null;
  }

  function clearPointer() {
    pointer = undefined;
    hovered?.classList.remove('is-target');
    hovered = null;
  }

  const buttons = items.map((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sorting-item';
    button.dataset.item = String(index);
    appendContent(button, item);
    button.addEventListener('click', () => {
      if (suppressClick) return;
      selected = selected === index ? null : index;
      update();
    });
    if (drag) {
      button.addEventListener('pointerdown', event => {
        if (event.button !== 0 || !event.isPrimary) return;
        pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
        button.setPointerCapture(event.pointerId);
      });
      button.addEventListener('pointermove', event => {
        if (pointer?.id !== event.pointerId) return;
        if (!pointer.moved && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 8) return;
        pointer.moved = true;
        const destination = zoneAt(event);
        if (destination === hovered) return;
        hovered?.classList.remove('is-target');
        hovered = destination;
        hovered?.classList.add('is-target');
      });
      button.addEventListener('pointerup', event => {
        if (pointer?.id !== event.pointerId) return;
        const destination = pointer.moved ? zoneAt(event) : null;
        if (pointer.moved) {
          suppressClick = true;
          setTimeout(() => { suppressClick = false; }, 0);
        }
        clearPointer();
        if (destination) move(index, zones.get(destination).target);
      });
      button.addEventListener('pointercancel', clearPointer);
    }
    unassigned.append(button);
    return button;
  });
  checkButton.hidden = !batch;
  checkButton.addEventListener('click', verify);
  update();
  return () => {
    wrong.forEach(clearTimeout);
    clearPointer();
    checkButton.removeEventListener('click', verify);
  };
}
