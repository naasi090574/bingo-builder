'use strict';

function publicationEndpoint(path) {
  const { url, publishableKey } = publicationConfig;
  if (!url || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    throw new Error('Настройте URL Supabase и публичный ключ.');
  }
  const origin = new URL(url);
  if (origin.protocol !== 'https:' || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Укажите HTTPS-адрес проекта Supabase.');
  }
  return new URL(path, origin);
}

async function publicationRequest(path, { token, body } = {}) {
  const headers = { apikey: publicationConfig.publishableKey };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(publicationEndpoint(path), {
    method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store',
    redirect: 'error',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = path.startsWith('/auth/') ? 'Не удалось войти. Проверьте адрес и пароль.'
      : result.error || 'Сервис публикации временно недоступен.';
    throw Object.assign(new Error(message), { status: response.status });
  }
  return result;
}

function checkedStorageUrl(value) {
  const url = new URL(value);
  if (url.origin !== publicationEndpoint('/').origin || !url.pathname.startsWith('/storage/v1/object/')) {
    throw new Error('Сервис вернул неверный адрес медиафайла.');
  }
  return url;
}

function publicationManifest(data) {
  const files = [];
  const index = new Map();
  function pack(value) {
    if (value instanceof Blob) {
      if (!index.has(value)) {
        index.set(value, files.length);
        files.push(value);
      }
      const entry = { $asset: index.get(value) };
      if (value instanceof File) {
        entry.name = value.name;
        entry.lastModified = value.lastModified;
      }
      return entry;
    }
    if (value instanceof Uint8ClampedArray) return { $pixels: Array.from(value) };
    if (Array.isArray(value)) return value.map(pack);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, pack(item)]));
    }
    return value;
  }
  const packed = pack(data);
  const assets = files.map(file => {
    const mime = file.type.split(';')[0].toLowerCase();
    // Some browsers report alternative MIME spellings for audio recordings.
    const type = { 'audio/x-wav': 'audio/wav', 'audio/mp3': 'audio/mpeg',
      'audio/x-m4a': 'audio/mp4', 'audio/x-flac': 'audio/flac' }[mime] ?? (mime || 'application/octet-stream');
    return { size: file.size, type };
  });
  return { files, manifest: { format: 'bingo-publication', version: 1, data: packed, assets } };
}

async function transferMedia(entries, transfer) {
  const result = [];
  for (let offset = 0; offset < entries.length; offset += 6) {
    result.push(...await Promise.all(entries.slice(offset, offset + 6).map((entry, index) => transfer(entry, offset + index))));
  }
  return result;
}

async function uploadPublishedProject(project, token, progress) {
  const { files, manifest } = publicationManifest(project.data);
  const command = fields => publicationRequest('/functions/v1/publish-game', {
    token, body: { localId: project.id, ...fields },
  });
  const prepared = await command({ action: 'prepare', assets: manifest.assets });
  let count = 0;
  await transferMedia(files, async (file, index) => {
    const body = new FormData();
    body.append('cacheControl', '0');
    body.append('', file.slice(0, file.size, manifest.assets[index].type));
    const response = await fetch(checkedStorageUrl(prepared.uploads[index]), {
      method: 'PUT', body, redirect: 'error', headers: { 'x-upsert': 'false' },
    });
    if (!response.ok) throw new Error('Не удалось загрузить один из медиафайлов.');
    progress(++count, files.length);
  });
  return command({
    action: 'commit', revision: prepared.revision, generation: prepared.publication.generation, manifest,
  });
}

async function readPublishedProject(id) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) throw new Error('Неверная ссылка на игру.');
  const { manifest, urls } = await publicationRequest(`/functions/v1/read-game?id=${encodeURIComponent(id)}`);
  if (manifest?.format !== 'bingo-publication' || manifest.version !== 1 ||
      !Array.isArray(manifest.assets) || !Array.isArray(urls) || urls.length !== manifest.assets.length ||
      urls.length > 500) throw invalidProject();
  const files = await transferMedia(urls, async (url, index) => {
    const response = await fetch(checkedStorageUrl(url), { redirect: 'error' });
    if (!response.ok) throw new Error('Не удалось загрузить медиа игры. Обновите страницу.');
    const blob = await response.blob();
    if (blob.size !== manifest.assets[index].size) throw invalidProject();
    return blob.slice(0, blob.size, manifest.assets[index].type);
  });
  function unpack(value) {
    if (Array.isArray(value)) return value.map(unpack);
    if (!value || typeof value !== 'object') return value;
    if (Object.hasOwn(value, '$asset')) {
      const blob = files[value.$asset];
      if (!Number.isInteger(value.$asset) || !blob) throw invalidProject();
      return typeof value.name === 'string' ? new File([blob], value.name, {
        type: blob.type, lastModified: value.lastModified,
      }) : blob;
    }
    if (Object.hasOwn(value, '$pixels')) return Uint8ClampedArray.from(value.$pixels);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unpack(item)]));
  }
  return validateProjectData(unpack(manifest.data));
}
