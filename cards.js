'use strict';

function initialCardLibrary() {
  return { cards: bingoContent.cards, manual: false, placements: {} };
}

let cardDatabase;

function openCardDatabase() {
  cardDatabase ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('bingo-builder-cards', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('library');
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        cardDatabase = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      cardDatabase = undefined;
      reject(request.error);
    };
  });
  return cardDatabase;
}

async function readCardLibrary() {
  const database = await openCardDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction('library').objectStore('library').get('current');
    request.onsuccess = () => resolve(request.result ?? initialCardLibrary());
    request.onerror = () => reject(request.error);
  });
}

async function updateCardLibrary(update) {
  const database = await openCardDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('library', 'readwrite');
    const store = tx.objectStore('library');
    let next;
    const request = store.get('current');
    request.onsuccess = () => {
      try {
        next = update(request.result ?? initialCardLibrary());
        store.put(next, 'current');
      } catch (error) {
        reject(error);
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(next);
    tx.onabort = () => reject(tx.error);
  });
}

function libraryBoards(library, size) {
  return library.manual ? library.placements[size] : undefined;
}

function cardShortage(count, size) {
  return `Для поля ${size} × ${size} нужно ${size ** 2} карточек. Не хватает: ${size ** 2 - count}.`;
}
