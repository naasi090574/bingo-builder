'use strict';

function initialCardLibrary() {
  return { cards: bingoContent.cards, manual: false, placements: {} };
}

function cardIdentity(card) {
  if (card.image) {
    const key = card.imageGroup ?? card.imageKey;
    return key ? `image:${key}` : `id:${card.id}`;
  }
  return card.text ? `text:${card.text.normalize('NFC').trim().replace(/\s+/g, ' ')}` : `id:${card.id}`;
}

function sameCardContent(first, second) {
  if (cardIdentity(first) === cardIdentity(second)) return true;
  if (!first.image || !second.image) return false;
  if (first.imageKey && first.imageKey === second.imageKey) return true;
  const left = first.imageSample;
  const right = second.imageSample;
  if (!first.imageKey || !second.imageKey || !left || !right || left.length !== right.length) return false;

  const aspect = card => {
    const [width, height] = card.imageKey.split(':', 1)[0].split('x').map(Number);
    return width / height;
  };
  if (Math.abs(Math.log(aspect(first) / aspect(second))) > .03) return false;

  let difference = 0;
  let changed = 0;
  let visible = 0;
  const colorShift = [0, 0, 0, 0];
  for (let index = 0; index < left.length; index += 4) {
    if (Math.max(left[index + 3], right[index + 3]) < 24) continue;
    visible += 4;
    for (let channel = index; channel < index + 4; channel++) {
      const shift = left[channel] - right[channel];
      colorShift[channel - index] += shift;
      const delta = Math.abs(shift);
      if (delta > 52) return false;
      if (delta > 14) changed++;
      difference += delta;
    }
  }
  // Compare visible picture details so empty margins cannot drown out differences.
  return difference <= visible * 3 && changed <= visible * .025 &&
    colorShift.every(shift => Math.abs(shift) <= (visible / 4) * 2.5);
}

function groupCardImages(cards) {
  const representatives = [];
  return cards.map(card => {
    if (!card.imageKey) return card;
    const { imageGroup, ...original } = card;
    const match = representatives.find(other => sameCardContent(other, original));
    if (match) return { ...original, imageGroup: match.imageKey };
    representatives.push(original);
    return original;
  });
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

async function withDecodedImage(source, useImage) {
  const url = source instanceof Blob ? URL.createObjectURL(source) : source;
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return await useImage(image);
  } finally {
    if (source instanceof Blob) URL.revokeObjectURL(url);
  }
}

function imageCanvas(image, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

async function fingerprintPixels({ canvas, context }, sampleSource) {
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const dimensions = `${canvas.width}x${canvas.height}`;
  const sample = document.createElement('canvas');
  sample.width = sample.height = 32;
  const sampleContext = sample.getContext('2d');
  sampleContext.imageSmoothingQuality = 'high';
  sampleContext.drawImage(sampleSource, 0, 0, 32, 32);
  const imageSample = sampleContext.getImageData(0, 0, 32, 32).data;
  for (let index = 0; index < imageSample.length; index += 4) {
    const alpha = imageSample[index + 3] / 255;
    for (let channel = 0; channel < 3; channel++) imageSample[index + channel] *= alpha;
  }
  if (!crypto.subtle) {
    // Keep local HTTP installations usable without SubtleCrypto.
    let left = 2166136261;
    let right = 0x9e3779b9;
    for (const byte of data) {
      left = Math.imul(left ^ byte, 16777619);
      right = Math.imul(right + byte, 0x85ebca6b) ^ (right >>> 13);
    }
    return { imageKey: `${dimensions}:${left >>> 0}:${right >>> 0}`, imageSample };
  }
  const digest = await crypto.subtle.digest('SHA-256', data);
  const imageKey = `${dimensions}:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  return { imageKey, imageSample };
}

function imageFingerprint(source) {
  return withDecodedImage(source, image => fingerprintPixels(imageCanvas(image), image));
}

function optimizeCardImage(blob) {
  return withDecodedImage(blob, async image => {
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const pixels = imageCanvas(image, scale);
    const metadata = await fingerprintPixels(pixels, image);
    // Keep small WebP files as-is to avoid recompressing them.
    if (scale === 1 && blob.type === 'image/webp' && blob.size <= 100 * 1024) {
      return { image: blob, ...metadata };
    }
    const encoded = await new Promise(resolve => pixels.canvas.toBlob(resolve, 'image/webp', 0.94));
    if (!encoded && scale < 1) throw new Error('Не удалось уменьшить изображение.');
    const optimized = encoded && (scale < 1 || encoded.size < blob.size) ? encoded : blob;
    return { image: optimized, ...metadata };
  });
}

async function readCardImage(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const prefix = (...values) => values.every((value, index) => bytes[index] === value);
  const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  const png = prefix(137, 80, 78, 71, 13, 10, 26, 10);
  const jpeg = prefix(255, 216, 255);
  const webp = ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  if (!png && !jpeg && !webp) throw new Error('Допустимы изображения PNG, JPG, JPEG и WEBP.');
  const blob = file.slice(0, file.size, png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp');
  try {
    return await optimizeCardImage(blob);
  } catch {
    throw new Error('Не удалось прочитать изображение.');
  }
}

async function identifyLibraryImages(library) {
  const cards = [];
  for (const card of library.cards) {
    if (card.image && !card.imageSample) {
      const properties = await imageFingerprint(card.image).catch(() => null);
      cards.push(properties ? { ...card, ...properties } : card);
    } else {
      cards.push(card);
    }
  }
  return { ...library, cards: groupCardImages(cards) };
}

let cardDatabase;

function openCardDatabase() {
  cardDatabase ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('bingo-builder-cards', 2);
    request.onupgradeneeded = event => {
      if (event.oldVersion === 0) request.result.createObjectStore('library');
      request.result.createObjectStore('tasks');
    };
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
  const knownCards = new Map(knownLibrary.cards.map(card => [card.id, card]));
  const database = await openCardDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('library', 'readwrite');
    const store = tx.objectStore('library');
    let next;
    const request = store.get('current');
    request.onsuccess = () => {
      try {
        const library = request.result ?? initialCardLibrary();
        const cards = library.cards.map(card => {
          const known = knownCards.get(card.id);
          return !card.imageSample && known?.imageSample && (!card.imageKey || card.imageKey === known.imageKey)
            ? { ...card, imageKey: known.imageKey, imageSample: known.imageSample }
            : card;
        });
        next = update({ ...library, cards: groupCardImages(cards) });
        next = { ...next, cards: groupCardImages(next.cards) };
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
