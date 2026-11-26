'use strict';

function initialCardLibrary() {
  return { cards: bingoContent.cards, manual: false, placements: {} };
}

function cardIdentity(card) {
  if (card.image) return card.imageKey ? `image:${card.imageKey}` : `id:${card.id}`;
  return card.text ? `text:${card.text.normalize('NFC').trim().replace(/\s+/g, ' ')}` : `id:${card.id}`;
}

function uniqueCards(cards) {
  const identities = new Set();
  return cards.filter(card => {
    const key = cardIdentity(card);
    if (identities.has(key)) return false;
    identities.add(key);
    return true;
  });
}

function distinctPlacements(field, cards) {
  const used = new Set();
  return field.map(id => {
    const card = cards.get(id);
    if (!card || used.has(cardIdentity(card))) return null;
    used.add(cardIdentity(card));
    return id;
  });
}

async function imageFingerprint(source) {
  const url = source instanceof Blob ? URL.createObjectURL(source) : source;
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const dimensions = `${canvas.width}x${canvas.height}`;
    if (!crypto.subtle) {
      // Keep local HTTP installations usable without SubtleCrypto.
      let left = 2166136261;
      let right = 0x9e3779b9;
      for (const byte of data) {
        left = Math.imul(left ^ byte, 16777619);
        right = Math.imul(right + byte, 0x85ebca6b) ^ (right >>> 13);
      }
      return `${dimensions}:${left >>> 0}:${right >>> 0}`;
    }
    const digest = await crypto.subtle.digest('SHA-256', data);
    return `${dimensions}:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  } finally {
    if (source instanceof Blob) URL.revokeObjectURL(url);
  }
}

async function identifyLibraryImages(library) {
  const cards = [];
  for (const card of library.cards) {
    if (card.image && !card.imageKey) {
      const imageKey = await imageFingerprint(card.image).catch(() => null);
      cards.push(imageKey ? { ...card, imageKey } : card);
    } else {
      cards.push(card);
    }
  }
  return { ...library, cards };
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
  const library = await new Promise((resolve, reject) => {
    const request = database.transaction('library').objectStore('library').get('current');
    request.onsuccess = () => resolve(request.result ?? initialCardLibrary());
    request.onerror = () => reject(request.error);
  });
  return identifyLibraryImages(library);
}

async function updateCardLibrary(update, knownLibrary) {
  const knownKeys = new Map(knownLibrary.cards.map(card => [card.id, card.imageKey]));
  const database = await openCardDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('library', 'readwrite');
    const store = tx.objectStore('library');
    let next;
    const request = store.get('current');
    request.onsuccess = () => {
      try {
        const library = request.result ?? initialCardLibrary();
        const cards = library.cards.map(card => !card.imageKey && knownKeys.get(card.id)
          ? { ...card, imageKey: knownKeys.get(card.id) }
          : card);
        next = update({ ...library, cards });
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
  if (!library.manual) return undefined;
  const cards = new Map(library.cards.map(card => [card.id, card]));
  return library.placements[size]?.map(field => distinctPlacements(field, cards));
}

function cardShortage(count, size) {
  return `Для поля ${size} × ${size} нужно ${size ** 2} уникальных карточек. Не хватает: ${size ** 2 - count}.`;
}
