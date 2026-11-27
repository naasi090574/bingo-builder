'use strict';

function mountSequenceTask(task, container, checkButton, mediaUrl, setReady) {
  const drag = task.method === 'drag';
  const batch = task.check === 'batch';
  const items = task.items;
  const indices = items.map((_, index) => index);
  const order = shuffle(indices, Math.random);
  if (order.every((index, position) => index === position)) order.push(order.shift());
  const positions = indices.map(() => null);
  const urls = items.map(item => item.media ? mediaUrl(item.media.image) : null);
  let selected = null;
  let wrong = [];
  let completed = false;
  let feedbackTimer;
  let pointer;
  let ghost;
  let hovered;

  const board = document.createElement('div');
  board.className = drag ? 'sequence-board is-drag' : 'sequence-board';
  board.classList.toggle('has-pictures', urls.some(Boolean));
  board.style.setProperty('--sequence-preferred-columns', items.length <= 5 ? items.length : Math.ceil(items.length / 2));
  board.dataset.rows = items.length <= 5 ? '1' : '2';
  const feedback = document.createElement('p');
  feedback.className = 'choice-feedback';
  feedback.setAttribute('role', 'status');

  function matches(index, position) {
    if (index === position) return true;
    if (index === null) return false;
    const expected = items[position];
    const actual = items[index];
    const sameImage = (!actual.media && !expected.media)
      || (actual.media?.imageKey && actual.media.imageKey === expected.media?.imageKey);
    return sameImage && actual.text.trim() === expected.text.trim();
  }

  function makeCard(index, position = null) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-option sequence-card';
    button.dataset.item = index;
    const item = items[index];
    if (urls[index]) {
      const image = document.createElement('img');
      image.src = urls[index];
      image.alt = item.text.trim() ? '' : item.media.name;
      image.draggable = false;
      button.append(image);
    }
    if (item.text.trim()) {
      const text = document.createElement('span');
      text.textContent = item.text;
      button.append(text);
    }
    if (!drag && position !== null) {
      const number = document.createElement('span');
      number.className = 'sequence-number';
      number.textContent = position + 1;
      button.append(number);
    }
    if (wrong.includes(index)) button.classList.add('is-wrong');
    if (completed) button.classList.add('is-right');
    button.setAttribute('aria-pressed', String(drag ? selected === index : position !== null));
    button.setAttribute('aria-disabled', String(completed));
    if (position !== null) {
      button.setAttribute('aria-label', `${position + 1}. ${item.text.trim() || item.media.name}`);
    }
    return button;
  }

  function grid(className) {
    const element = document.createElement('div');
    element.className = `sequence-grid ${className}`;
    return element;
  }

  function render() {
    const active = board.contains(document.activeElement) ? document.activeElement : null;
    const pool = grid('sequence-pool');
    pool.dataset.return = '';
    pool.setAttribute('role', 'group');
    pool.setAttribute('aria-label', 'Элементы последовательности');
    if (!drag || !completed) {
      for (const index of completed ? positions : order) {
        const position = positions.indexOf(index);
        if (drag && position >= 0) continue;
        pool.append(makeCard(index, position < 0 ? null : position));
      }
    }
    if (drag) {
      const slots = grid('sequence-slots');
      slots.setAttribute('role', 'group');
      slots.setAttribute('aria-label', 'Порядок элементов');
      positions.forEach((index, position) => {
        const slot = document.createElement('div');
        slot.className = 'sequence-slot';
        slot.dataset.slot = position;
        if (index !== null) slot.append(makeCard(index, position));
        else {
          const empty = document.createElement('button');
          empty.type = 'button';
          empty.className = 'sequence-empty';
          empty.setAttribute('aria-label', `Ячейка ${position + 1}`);
          slot.append(empty);
        }
        const number = document.createElement('span');
        number.className = 'sequence-number';
        number.setAttribute('aria-hidden', 'true');
        number.textContent = position + 1;
        slot.append(number);
        slots.append(slot);
      });
      if (completed) board.replaceChildren(slots);
      else {
        const returnButton = document.createElement('button');
        returnButton.className = 'sequence-return';
        returnButton.type = 'button';
        returnButton.dataset.return = '';
        returnButton.textContent = 'Вернуть в список';
        returnButton.hidden = selected === null || !positions.includes(selected);
        board.replaceChildren(pool, slots, returnButton);
      }
    } else board.replaceChildren(pool);
    if (active?.dataset.item !== undefined) {
      board.querySelector(`[data-item="${active.dataset.item}"]`)?.focus({ preventScroll: true });
    } else if (active?.parentElement?.dataset.slot !== undefined) {
      board.querySelector(`[data-slot="${active.parentElement.dataset.slot}"] button`)?.focus({ preventScroll: true });
    }
    checkButton.hidden = !batch || completed;
    checkButton.disabled = positions.includes(null);
    setReady(completed);
  }

  function reportMistake(indices) {
    wrong = indices;
    feedback.textContent = 'Попробуй ещё раз.';
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      wrong = [];
      for (const card of board.querySelectorAll('.is-wrong')) card.classList.remove('is-wrong');
    }, 650);
  }

  function verify() {
    if (positions.includes(null)) return;
    const misplaced = positions.filter((index, position) => !matches(index, position));
    if (misplaced.length) reportMistake(misplaced);
    else {
      completed = true;
      feedback.textContent = 'Верно!';
    }
  }

  function change() {
    feedback.textContent = '';
    wrong = [];
    clearTimeout(feedbackTimer);
  }

  function choose(index) {
    const current = positions.indexOf(index);
    const next = positions.indexOf(null);
    change();
    if (current >= 0) {
      if (batch) {
        positions.splice(current, 1);
        positions.push(null);
      } else positions.fill(null, current);
    } else if (!batch && !matches(index, next)) reportMistake([index]);
    else positions[next] = index;
    if (!batch) verify();
    render();
  }

  function move(index, destination) {
    const source = positions.indexOf(index);
    selected = null;
    if (source !== destination) {
      change();
      if (source >= 0) positions[source] = destination < 0 ? null : positions[destination];
      if (destination >= 0) positions[destination] = index;
      if (!batch) {
        const misplaced = [source, destination].filter(position => position >= 0
          && positions[position] !== null && !matches(positions[position], position));
        if (misplaced.length) reportMistake(misplaced.map(position => positions[position]));
        verify();
      }
    }
    render();
  }

  board.addEventListener('click', event => {
    if (completed) return;
    const card = event.target.closest('[data-item]');
    const slot = event.target.closest('[data-slot]');
    if (!drag) {
      if (card) choose(Number(card.dataset.item));
    } else if (selected !== null && slot && selected !== Number(card?.dataset.item)) {
      move(selected, Number(slot.dataset.slot));
    } else if (selected !== null && event.target.closest('[data-return]') && !card) {
      move(selected, -1);
    } else if (card) {
      const index = Number(card.dataset.item);
      selected = selected === index ? null : index;
      render();
    }
  });

  if (drag) {
    function targetAt(event) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-slot], [data-return]');
      return board.contains(target) ? target : null;
    }

    function endPointer() {
      pointer = null;
      ghost?.remove();
      ghost = null;
      hovered?.classList.remove('is-target');
      hovered = null;
    }

    board.addEventListener('pointerdown', event => {
      const card = event.target.closest('[data-item]');
      if (completed || !card || event.button !== 0 || !event.isPrimary) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, card };
    });
    board.addEventListener('pointermove', event => {
      if (pointer?.id !== event.pointerId) return;
      if (!ghost) {
        if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 8) return;
        const bounds = pointer.card.getBoundingClientRect();
        ghost = pointer.card.cloneNode(true);
        ghost.classList.add('sequence-ghost');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.tabIndex = -1;
        delete ghost.dataset.item;
        ghost.style.width = `${bounds.width}px`;
        ghost.style.height = `${bounds.height}px`;
        board.append(ghost);
        board.setPointerCapture(event.pointerId);
      }
      ghost.style.left = `${event.clientX}px`;
      ghost.style.top = `${event.clientY}px`;
      hovered?.classList.remove('is-target');
      hovered = targetAt(event);
      hovered?.classList.add('is-target');
    });
    board.addEventListener('pointerup', event => {
      if (pointer?.id !== event.pointerId) return;
      const target = ghost ? targetAt(event) : null;
      const index = Number(pointer.card.dataset.item);
      endPointer();
      if (target) move(index, Number(target.dataset.slot ?? -1));
    });
    board.addEventListener('pointerleave', () => { if (!ghost) endPointer(); });
    board.addEventListener('pointercancel', endPointer);
    board.addEventListener('lostpointercapture', endPointer);
  }

  function check() {
    verify();
    render();
  }

  container.append(board, feedback);
  checkButton.addEventListener('click', check);
  render();
  return () => {
    clearTimeout(feedbackTimer);
    checkButton.removeEventListener('click', check);
  };
}
