export const bucket = 'game-publications';
export const maxFile = 50_000_000;
export const maxTotal = 100_000_000;
export const maxAssets = 500;
export const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const localId = /^[A-Za-z0-9_-]{1,100}$/;
const mediaType = /^(?:image\/(?:png|jpeg|webp|gif|avif|svg\+xml)|audio\/(?:mpeg|wav|ogg|webm|mp4|flac|aac)|application\/octet-stream)$/;
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Cache-Control': 'no-store',
};

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function checkAssets(assets) {
  if (!Array.isArray(assets) || assets.length > maxAssets) fail(400, 'Слишком много медиафайлов.');
  let total = 0;
  for (const entry of assets) {
    if (!entry || !mediaType.test(entry.type) || !Number.isInteger(entry.size) || entry.size <= 0 || entry.size > maxFile) {
      fail(400, 'Проверьте формат и размер медиафайла. Максимум 50 МБ на файл.');
    }
    total += entry.size;
  }
  if (total > maxTotal) fail(400, 'Размер публикации превышает 100 МБ.');
}

function checkManifest(manifest, count) {
  if (!manifest || manifest.format !== 'bingo-publication' || manifest.version !== 1 ||
      ![2, 3, 4, 5].includes(manifest.data?.settings?.size) || !Array.isArray(manifest.data.cards?.cards) ||
      !Array.isArray(manifest.data.tasks) || !manifest.data.appearance?.values ||
      !manifest.data.tokens || !manifest.data.sounds) fail(400, 'Формат проекта не поддерживается.');
  const used = new Set();
  const queue = [manifest.data];
  while (queue.length) {
    const node = queue.pop();
    if (!node || typeof node !== 'object') continue;
    if (Object.hasOwn(node, '$asset')) {
      const index = node.$asset;
      if (!Number.isInteger(index) || index < 0 || index >= count) fail(400, 'В проекте есть неверная ссылка на файл.');
      used.add(index);
    } else {
      for (const [key, value] of Object.entries(node)) {
        if (['__proto__', 'prototype', 'constructor', '$media'].includes(key)) fail(400, 'Формат проекта не поддерживается.');
        queue.push(value);
      }
    }
  }
  if (used.size !== count) fail(400, 'Список файлов проекта не совпадает с содержимым.');
}

function metadata(row) {
  return row ? { id: row.id, published: row.published, updated: row.updated_at, generation: row.generation } : null;
}

export function publicationHandler(kind, dependencies) {
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      if (kind === 'read') {
        if (request.method !== 'GET') return reply({ error: 'Метод не поддерживается.' }, 405);
        const id = new URL(request.url).searchParams.get('id');
        if (!id || !uuid.test(id)) return reply({ error: 'Игра не найдена.' }, 404);
        const row = await dependencies.findPublished(id);
        if (!row?.published) return reply({ error: 'Игра не найдена или снята с публикации.' }, 404);
        const paths = row.manifest.assets.map((_, index) => `${row.id}/${row.revision}/${index}`);
        const urls = await dependencies.signDownloads(paths);
        return reply({ manifest: row.manifest, urls });
      }
      if (request.method !== 'POST') return reply({ error: 'Метод не поддерживается.' }, 405);
      const user = await dependencies.authenticate(request.headers.get('Authorization'));
      if (!user) return reply({ error: 'Войдите как владелец редактора.' }, 401);
      if (!dependencies.ownerId || user.id !== dependencies.ownerId) {
        return reply({ error: 'Публикация доступна только владельцу редактора.' }, 403);
      }
      if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') {
        return reply({ error: 'Ожидается JSON.' }, 415);
      }
      const input = await request.text();
      if (input.length > 4_000_000) fail(413, 'Слишком большой JSON проекта.');
      let body;
      try { body = JSON.parse(input); } catch { fail(400, 'Неверный JSON.'); }
      if (!body || typeof body.localId !== 'string' || !localId.test(body.localId)) fail(400, 'Неверный проект.');
      let row = await dependencies.findOwned(user.id, body.localId);
      switch (body.action) {
        case 'status': return reply({ publication: metadata(row) });
        case 'prepare': {
          checkAssets(body.assets);
          row ??= await dependencies.create(user.id, body.localId);
          const revision = crypto.randomUUID();
          const uploads = await dependencies.signUploads(body.assets.map((_, i) => `${row.id}/${revision}/${i}`));
          return reply({ publication: metadata(row), revision, uploads });
        }
        case 'commit': {
          checkAssets(body.manifest?.assets);
          checkManifest(body.manifest, body.manifest.assets.length);
          if (!row || !uuid.test(body.revision ?? '') || body.generation !== row.generation || row.revision === body.revision) {
            fail(409, 'Состояние публикации изменилось. Начните публикацию заново.');
          }
          const files = body.manifest.assets;
          if (!await dependencies.checkFiles(`${row.id}/${body.revision}`, files)) fail(400, 'Загружены не все файлы проекта.');
          const result = await dependencies.compareAndSet(row, {
            manifest: body.manifest, revision: body.revision, published: true,
          });
          if (!result) fail(409, 'Состояние публикации изменилось. Начните публикацию заново.');
          return reply({ publication: metadata(result) });
        }
        case 'unpublish': {
          if (!row) return reply({ publication: null });
          const result = await dependencies.compareAndSet(row, { published: false });
          if (!result) fail(409, 'Состояние публикации изменилось. Повторите действие.');
          return reply({ publication: metadata(result) });
        }
        default: return reply({ error: 'Неизвестное действие.' }, 400);
      }
    } catch (error) {
      if (error.status) return reply({ error: error.message }, error.status);
      console.error('Publication operation failed', error.name ?? 'Error');
      return reply({ error: 'Сервис публикации временно недоступен.' }, 503);
    }
  };
}
