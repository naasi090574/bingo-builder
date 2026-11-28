'use strict';

function shuffledMemoryIndices(items) {
  const order = shuffle(items.map((_, index) => index), Math.random);
  if (order.every((index, position) => sameMemoryItem(items[index], items[position]))) {
    const different = order.findIndex(index => !sameMemoryItem(items[index], items[order[0]]));
    if (different > 0) [order[0], order[different]] = [order[different], order[0]];
  }
  return order;
}

function mountMemoryTask(content, container, checkButton, mediaUrl, setReady, onAnswer, prompt) {
  const chains = content.chainOrder === 'random' ? shuffle(content.chains, Math.random) : content.chains;
  const counter = document.createElement('p');
  counter.className = 'memory-counter';
  counter.setAttribute('role', 'status');
  const stage = document.createElement('div');
  stage.className = 'memory-stage';
  stage.style.setProperty('--memory-image-scale', content.imageSize / 100);
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'task-action memory-next';
  container.append(counter, stage, next);
  let index = 0;
  let recalling = false;
  let disposeSequence;

  function instruction(value) {
    prompt.textContent = value;
    prompt.hidden = !value.trim();
  }

  function layout(items, grids) {
    const columns = Math.min(items.length, Math.max(2, Math.ceil(Math.sqrt(items.length * 2))));
    stage.style.setProperty('--memory-columns', columns);
    stage.style.setProperty('--memory-rows', Math.ceil(items.length / columns) * grids);
  }

  function memorize() {
    disposeSequence?.();
    disposeSequence = undefined;
    recalling = false;
    const items = chains[index];
    instruction(content.text);
    setReady(false);
    checkButton.hidden = true;
    counter.textContent = `Цепочка ${index + 1} из ${chains.length}`;
    layout(items, 1);
    const strip = document.createElement('ol');
    strip.className = 'memory-strip';
    for (const item of items) {
      const card = document.createElement('li');
      card.className = 'choice-option sequence-card';
      if (item.media) {
        const image = document.createElement('img');
        image.src = mediaUrl(item.media.image);
        image.alt = item.text.trim() ? '' : item.media.name;
        card.append(image);
      }
      if (item.text.trim()) {
        const text = document.createElement('span');
        text.textContent = item.text;
        card.append(text);
      }
      strip.append(card);
    }
    stage.replaceChildren(strip);
    next.textContent = 'Я запомнил!';
    next.hidden = false;
  }

  function recall() {
    recalling = true;
    const items = chains[index];
    instruction(content.recall);
    layout(items, 2);
    stage.replaceChildren();
    next.hidden = true;
    disposeSequence = mountSequenceTask({ type: 'sequence', method: 'drag', check: 'batch', items },
      stage, checkButton, mediaUrl, correct => {
        setReady(correct && index === chains.length - 1);
        next.hidden = !correct || index === chains.length - 1;
        if (correct) {
          layout(items, 1);
          next.textContent = 'Следующая цепочка';
          (next.hidden ? document.querySelector('#complete') : next).focus();
        }
      }, onAnswer, { poolOrder: shuffledMemoryIndices(items), equivalentItems: sameMemoryItem });
    stage.querySelector('.sequence-card')?.focus();
  }

  next.addEventListener('click', () => {
    if (recalling) {
      index++;
      memorize();
      next.focus();
    } else recall();
  });
  memorize();
  return () => disposeSequence?.();
}
