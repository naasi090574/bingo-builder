'use strict';

const sortingDraft = document.querySelector('#sorting-draft');
const sortingMethod = document.querySelector('#sorting-method');
const sortingCheck = document.querySelector('#sorting-check');
const sortingShuffle = document.querySelector('#sorting-shuffle');
const groupsDraft = document.querySelector('#sorting-groups-draft');
const itemsDraft = document.querySelector('#sorting-items-draft');
const addGroup = document.querySelector('#sorting-add-group');
const addItem = document.querySelector('#sorting-add-item');

function newSortingGroup() {
  return { id: newTaskId(), text: '', media: null };
}

function newSortingItem() {
  return { text: '', media: null, groupId: '' };
}

function initializeSortingDraft(task) {
  taskDraft.groups = task ? task.groups.map(group => ({ ...group })) : [newSortingGroup(), newSortingGroup()];
  taskDraft.items = task ? task.items.map(item => ({ ...item })) : [newSortingItem(), newSortingItem()];
  taskDraft.method ??= 'drag';
  taskDraft.check ??= 'instant';
  taskDraft.shuffle ??= false;
}

function updateSortingGroupSelectors() {
  [...itemsDraft.querySelectorAll('select')].forEach((select, index) => {
    select.replaceChildren(new Option('Выберите группу', ''), ...taskDraft.groups.map((group, groupIndex) =>
      new Option(group.text.trim() || group.media?.name || `Группа ${groupIndex + 1}`, group.id)));
    select.value = taskDraft.items[index].groupId;
  });
}

function sortingRow(entry, index, list, isGroup) {
  const row = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = isGroup ? `Группа ${index + 1}` : `Элемент ${index + 1}`;
  const label = document.createElement('label');
  label.textContent = isGroup ? 'Название группы' : 'Текст элемента';
  const input = document.createElement('input');
  input.value = entry.text;
  input.addEventListener('input', () => {
    entry.text = input.value;
    if (isGroup) updateSortingGroupSelectors();
  });
  label.append(input);
  row.append(legend, label);
  if (!isGroup) {
    const groupLabel = document.createElement('label');
    groupLabel.textContent = 'Правильная группа';
    const select = document.createElement('select');
    select.addEventListener('change', () => { entry.groupId = select.value; });
    groupLabel.append(select);
    row.append(groupLabel);
  }
  row.append(taskOptionImageField(entry.media, isGroup ? 'Картинка группы' : 'Картинка элемента',
    media => { entry.media = media; }, undefined, renderSortingDraft));
  const actions = document.createElement('div');
  actions.className = 'library-actions';
  for (const [delta, text, verb] of [[-1, '↑', 'Поднять'], [1, '↓', 'Опустить']]) {
    const button = libraryButton(text, `${verb}: ${legend.textContent}`, () => {
      const next = index + delta;
      [list[index], list[next]] = [list[next], list[index]];
      renderSortingDraft();
    });
    button.disabled = !list[index + delta];
    actions.append(button);
  }
  if (!isGroup) {
    const duplicate = libraryButton('Дублировать', `Дублировать: ${legend.textContent}`, () => {
      list.splice(index + 1, 0, { ...entry });
      renderSortingDraft();
    });
    duplicate.disabled = list.length >= 20;
    actions.append(duplicate);
  }
  const remove = libraryButton('Удалить', `Удалить: ${legend.textContent}`, () => {
    list.splice(index, 1);
    if (isGroup) {
      for (const item of taskDraft.items) if (item.groupId === entry.id) item.groupId = '';
    }
    renderSortingDraft();
  });
  remove.disabled = list.length <= 2;
  actions.append(remove);
  row.append(actions);
  return row;
}

function renderSortingDraft() {
  sortingDraft.hidden = taskDraft.type !== 'sorting';
  if (sortingDraft.hidden) {
    groupsDraft.replaceChildren();
    itemsDraft.replaceChildren();
    return;
  }
  clearTaskOptionThumbs();
  sortingMethod.value = taskDraft.method;
  sortingCheck.value = taskDraft.check;
  sortingShuffle.checked = taskDraft.shuffle;
  groupsDraft.replaceChildren(...taskDraft.groups.map((group, i) => sortingRow(group, i, taskDraft.groups, true)));
  itemsDraft.replaceChildren(...taskDraft.items.map((item, i) => sortingRow(item, i, taskDraft.items, false)));
  updateSortingGroupSelectors();
  addGroup.disabled = taskDraft.groups.length >= 4;
  addItem.disabled = taskDraft.items.length >= 20;
}

function validateSortingDraft() {
  if (taskDraft.groups.length < 2 || taskDraft.groups.length > 4 ||
      taskDraft.items.length < 2 || taskDraft.items.length > 20) {
    taskEditorStatus.textContent = 'Нужно от 2 до 4 групп и от 2 до 20 элементов.';
    return false;
  }
  if (taskDraft.groups.some(group => !group.text.trim() && !group.media)) {
    taskEditorStatus.textContent = 'Добавьте название или картинку для каждой группы.';
    return false;
  }
  if (taskDraft.items.some(item => !item.text.trim() && !item.media)) {
    taskEditorStatus.textContent = 'Добавьте текст или картинку для каждого элемента.';
    return false;
  }
  const groupIds = new Set(taskDraft.groups.map(group => group.id));
  if (taskDraft.items.some(item => !groupIds.has(item.groupId))) {
    taskEditorStatus.textContent = 'Укажите правильную группу для каждого элемента.';
    return false;
  }
  return true;
}

document.querySelector('#add-sorting-task').addEventListener('click', () => openTaskEditor(null, 'sorting'));
sortingMethod.addEventListener('change', () => { taskDraft.method = sortingMethod.value; });
sortingCheck.addEventListener('change', () => { taskDraft.check = sortingCheck.value; });
sortingShuffle.addEventListener('change', () => { taskDraft.shuffle = sortingShuffle.checked; });
addGroup.addEventListener('click', () => {
  if (taskDraft.groups.length < 4) taskDraft.groups.push(newSortingGroup());
  renderSortingDraft();
});
addItem.addEventListener('click', () => {
  if (taskDraft.items.length < 20) taskDraft.items.push(newSortingItem());
  renderSortingDraft();
});
