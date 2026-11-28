'use strict';

const memoryDraft = document.querySelector('#memory-draft');
const memoryChains = document.querySelector('#memory-chains');
const memoryRecall = document.querySelector('#memory-recall');
const memoryOrder = document.querySelector('#memory-order');
const memorySize = document.querySelector('#memory-size');
const memorySizeValue = document.querySelector('#memory-size-value');

function newMemoryChain() {
  return [newSequenceItem(), newSequenceItem()];
}

function initializeMemoryDraft(task) {
  taskDraft.chains = task ? task.chains.map(items => items.map(item => ({ ...item }))) : [newMemoryChain()];
  taskDraft.recall = task?.recall ?? 'Восстанови порядок элементов.';
  taskDraft.chainOrder = task?.chainOrder ?? 'sequential';
  taskDraft.imageSize = task?.imageSize ?? 100;
  if (!task) taskDraft.text = 'Рассмотри и запомни порядок элементов.';
}

function memoryListActions(list, index, noun, minimum, duplicate = false) {
  const actions = document.createElement('div');
  actions.className = 'library-actions';
  for (const [offset, symbol, label] of [[-1, '↑', 'Поднять'], [1, '↓', 'Опустить']]) {
    const next = index + offset;
    const button = libraryButton(symbol, `${label} ${noun} ${index + 1}`, () => {
      [list[index], list[next]] = [list[next], list[index]];
      renderMemoryDraft();
    });
    button.disabled = !list[next];
    actions.append(button);
  }
  if (duplicate) actions.append(libraryButton('Дублировать', `Дублировать ${noun} ${index + 1}`, () => {
    list.splice(index + 1, 0, list[index].map(item => ({ ...item })));
    renderMemoryDraft();
  }));
  const remove = libraryButton('Удалить', `Удалить ${noun} ${index + 1}`, () => {
    list.splice(index, 1);
    renderMemoryDraft();
  });
  remove.disabled = list.length <= minimum;
  actions.append(remove);
  return actions;
}

function renderMemoryDraft() {
  memoryDraft.hidden = taskDraft.type !== 'memory';
  memoryChains.replaceChildren();
  if (memoryDraft.hidden) return;
  clearTaskOptionThumbs();
  memoryRecall.value = taskDraft.recall;
  memoryOrder.value = taskDraft.chainOrder;
  memorySize.value = taskDraft.imageSize;
  memorySizeValue.value = `${memorySize.value}%`;
  taskDraft.chains.forEach((items, chainIndex) => {
    const chain = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = `Цепочка ${chainIndex + 1}`;
    chain.append(legend, memoryListActions(taskDraft.chains, chainIndex, 'цепочку', 1, true));
    items.forEach((item, index) => {
      const row = document.createElement('fieldset');
      const caption = document.createElement('legend');
      caption.textContent = `Элемент ${index + 1}`;
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.value = item.text;
      input.addEventListener('input', () => { item.text = input.value; });
      label.append('Текст элемента', input);
      row.append(caption, label, taskOptionImageField(item.media, 'Добавить картинку элемента',
        (media, imageKey) => { item.media = media ? { ...media, imageKey } : null; },
        index + 1, renderMemoryDraft), memoryListActions(items, index, 'элемент', 2));
      chain.append(row);
    });
    chain.append(libraryButton('Добавить элемент', `Добавить элемент в цепочку ${chainIndex + 1}`, () => {
      items.push(newSequenceItem());
      renderMemoryDraft();
    }));
    memoryChains.append(chain);
  });
}

function validateMemoryDraft() {
  const invalid = taskDraft.chains.findIndex(items => !validMemoryChain(items));
  if (invalid === -1) return true;
  taskEditorStatus.textContent = `Цепочка ${invalid + 1}: заполните все элементы. Минимум два должны отличаться.`;
  return false;
}

document.querySelector('#add-memory-task').addEventListener('click', () => openTaskEditor(null, 'memory'));
document.querySelector('#memory-add-chain').addEventListener('click', () => {
  taskDraft.chains.push(newMemoryChain());
  renderMemoryDraft();
});
memoryRecall.addEventListener('input', () => { taskDraft.recall = memoryRecall.value; });
memoryOrder.addEventListener('change', () => { taskDraft.chainOrder = memoryOrder.value; });
memorySize.addEventListener('input', () => {
  taskDraft.imageSize = Number(memorySize.value);
  memorySizeValue.value = `${memorySize.value}%`;
});
