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
