'use strict';

function initialTaskLibrary() {
  return bingoContent.tasks.map((text, index) => ({ id: `example-${index}`, type: 'oral', text, images: [], audio: null }));
}

async function readTaskLibrary() {
  const database = await openCardDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction('tasks').objectStore('tasks').get('current');
    request.onsuccess = () => resolve(request.result ?? initialTaskLibrary());
    request.onerror = () => reject(request.error);
  });
}

async function updateTaskLibrary(update) {
  const database = await openCardDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('tasks', 'readwrite');
    const store = transaction.objectStore('tasks');
    let tasks;
    const request = store.get('current');
    request.onsuccess = () => {
      try {
        tasks = update(request.result ?? initialTaskLibrary());
        store.put(tasks, 'current');
      } catch (error) {
        reject(error);
        transaction.abort();
      }
    };
    transaction.oncomplete = () => resolve(tasks);
    transaction.onabort = () => reject(transaction.error);
  });
}

function sameMemoryItem(first, second) {
  return first.text.trim() === second.text.trim() && (
    (!first.media && !second.media) ||
    Boolean(first.media?.imageKey && first.media.imageKey === second.media?.imageKey) ||
    Boolean(first.media?.image && first.media.image === second.media?.image)
  );
}

function validMemoryChain(items) {
  return Array.isArray(items) && items.length >= 2 &&
    items.every(item => item.text.trim() || item.media) &&
    items.some(item => !sameMemoryItem(item, items[0]));
}

function oddTaskRounds(task) {
  return task.rounds ?? [{ options: task.options, followUp: task.followUp ?? '' }];
}
