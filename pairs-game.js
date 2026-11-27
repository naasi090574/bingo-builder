'use strict';

function mountPairsTask(task, container, checkButton, mediaUrl, setReady, onAnswer) {
  const batch = task.check === 'batch';
  const drawLine = task.method === 'line';
  const indices = task.pairs.map((_, index) => index);
  const connections = new Map();
  const correct = new Set();
  const rejected = new Map();
  const buttons = [[], []];
  let selected = null;
  let gesture = null;
  let feedbackTimer;

  const board = document.createElement('div');
  board.className = drawLine ? 'pairs-board is-line' : 'pairs-board';
  board.style.setProperty('--pair-count', indices.length);
  if (task.pairs.some(pair => pair.some(item => item.media))) board.classList.add('has-pictures');

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const lines = document.createElementNS(svgNamespace, 'svg');
  lines.classList.add('pair-lines');
  lines.setAttribute('aria-hidden', 'true');

  const feedback = document.createElement('p');
  feedback.className = 'choice-feedback';
  feedback.setAttribute('role', 'status');
  const ready = () => correct.size === indices.length;

  function endpoint(side, index) {
    const rect = buttons[side][index].getBoundingClientRect();
    return { x: side === 0 ? rect.right : rect.left, y: rect.top + rect.height / 2 };
  }

  function renderLines() {
    const bounds = board.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    lines.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    lines.replaceChildren();
    function stroke(from, to, state) {
      const line = document.createElementNS(svgNamespace, 'line');
      line.classList.add(state);
      line.setAttribute('x1', from.x - bounds.left);
      line.setAttribute('y1', from.y - bounds.top);
      line.setAttribute('x2', to.x - bounds.left);
      line.setAttribute('y2', to.y - bounds.top);
      lines.append(line);
    }
    for (const [left, right] of connections) {
      stroke(endpoint(0, left), endpoint(1, right), correct.has(left) ? 'is-right' : 'is-pending');
    }
    for (const [left, right] of rejected) {
      stroke(endpoint(0, left), endpoint(1, right), 'is-wrong');
    }
    if (gesture) stroke(endpoint(gesture.side, gesture.index), gesture.point, 'is-pending');
  }

  function render() {
    for (const side of [0, 1]) {
      buttons[side].forEach((button, index) => {
        const fixed = correct.has(index);
        const linked = [...connections].some(pair => pair[side] === index);
        const wrong = [...rejected].some(pair => pair[side] === index);
        button.classList.toggle('is-right', fixed);
        button.classList.toggle('is-wrong', wrong);
        const active = selected?.side === side && selected.index === index;
        button.classList.toggle('is-selected', active);
        button.setAttribute('aria-pressed', String(linked || active));
        button.setAttribute('aria-disabled', String(fixed));
      });
    }
    checkButton.hidden = !batch || ready();
    checkButton.disabled = connections.size === correct.size;
    setReady(ready());
    renderLines();
  }

  function rejectPairs(pairs) {
    clearTimeout(feedbackTimer);
    rejected.clear();
    for (const [left, right] of pairs) rejected.set(left, right);
    feedback.textContent = 'Попробуй соединить ещё раз.';
    feedbackTimer = setTimeout(() => {
      rejected.clear();
      feedback.textContent = '';
      render();
    }, 650);
  }

  function evaluate(entries) {
    const wrong = [];
    for (const [left, right] of entries) {
      if (left === right) correct.add(left);
      else {
        connections.delete(left);
        wrong.push([left, right]);
      }
    }
    if (entries.length) onAnswer(!wrong.length);
    if (wrong.length) rejectPairs(wrong);
    if (ready()) {
      clearTimeout(feedbackTimer);
      rejected.clear();
      feedback.textContent = 'Верно!';
    }
  }

  function connect(from, to) {
    if (from.side === to.side || correct.has(from.index) || correct.has(to.index)) return;
    const [left, right] = from.side === 0 ? [from.index, to.index] : [to.index, from.index];
    const unchanged = connections.get(left) === right;
    for (const [source, target] of rejected) {
      if (source === left || target === right) rejected.delete(source);
    }
    if (!rejected.size && !ready()) feedback.textContent = '';
    for (const [source, target] of connections) {
      if (source === left || target === right) connections.delete(source);
    }
    if (!unchanged) {
      connections.set(left, right);
      if (!batch) evaluate([[left, right]]);
    }
  }

  function select(side, index) {
    if (correct.has(index)) return;
    if (selected && selected.side !== side) {
      connect(selected, { side, index });
      selected = null;
    } else {
      selected = selected?.index === index && selected.side === side ? null : { side, index };
    }
    render();
  }

  for (const side of [0, 1]) {
    const column = document.createElement('div');
    column.className = 'pairs-column';
    const order = task.shuffle ? shuffle(indices, Math.random) : indices;
    for (const index of order) {
      const item = task.pairs[index][side];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pair-item';
      button.dataset.side = side;
      button.dataset.index = index;
      if (item.media) {
        const image = document.createElement('img');
        image.src = mediaUrl(item.media.image);
        image.alt = item.text.trim() ? '' : item.media.name;
        button.append(image);
      }
      if (item.text.trim()) {
        const text = document.createElement('span');
        text.textContent = item.text;
        button.append(text);
      }
      button.addEventListener('click', event => {
        if (!drawLine || event.detail === 0) select(side, index);
      });
      column.append(button);
      buttons[side][index] = button;
    }
    board.append(column);
  }

  if (drawLine) {
    function targetAt(element) {
      const button = element?.closest('.pair-item');
      if (!button || !board.contains(button)) return null;
      return { side: Number(button.dataset.side), index: Number(button.dataset.index) };
    }

    board.addEventListener('pointerdown', event => {
      const target = targetAt(event.target);
      if (!target || event.button !== 0 || gesture || correct.has(target.index)) return;
      selected = null;
      gesture = { ...target, pointer: event.pointerId, point: { x: event.clientX, y: event.clientY } };
      board.setPointerCapture(event.pointerId);
      render();
    });
    board.addEventListener('pointermove', event => {
      if (gesture?.pointer !== event.pointerId) return;
      gesture.point = { x: event.clientX, y: event.clientY };
      renderLines();
    });
    board.addEventListener('pointerup', event => {
      if (gesture?.pointer !== event.pointerId) return;
      const target = targetAt(document.elementFromPoint(event.clientX, event.clientY));
      if (target) connect(gesture, target);
      gesture = null;
      render();
    });
    board.addEventListener('lostpointercapture', event => {
      if (gesture?.pointer !== event.pointerId) return;
      gesture = null;
      render();
    });
  }

  function check() {
    selected = null;
    evaluate([...connections].filter(([index]) => !correct.has(index)));
    render();
  }

  board.append(lines);
  container.append(board, feedback);
  checkButton.addEventListener('click', check);
  const resize = new ResizeObserver(renderLines);
  resize.observe(board);
  for (const button of buttons.flat()) resize.observe(button);
  render();
  return () => {
    resize.disconnect();
    clearTimeout(feedbackTimer);
    checkButton.removeEventListener('click', check);
  };
}
