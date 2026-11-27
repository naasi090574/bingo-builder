const test = require('node:test');
const assert = require('node:assert/strict');

const owner = '12345';
const publicationId = '12345678-1234-5678-9012-123456789012';
const copyId = '22345678-1234-5678-9012-123456789012';
const localId = 'local-project-1';

async function fixture() {
  const { publicationHandler } = await import('../supabase/functions/_shared/publication.mjs');
  const rows = new Map();
  const uploads = new Set();
  const dependencies = {
    ownerId: owner,
    authenticate: token => token === 'Bearer owner' ? { id: owner }
      : token === 'Bearer stranger' ? { id: 'stranger' } : null,
    findOwned: (_, id) => rows.get(id),
    findPublished: id => [...rows.values()].find(row => row.id === id),
    create(_, id) {
      const row = { id: rows.size ? copyId : publicationId, local_id: id, published: false, generation: 0 };
      rows.set(id, row);
      return row;
    },
    compareAndSet(row, changes) {
      if (rows.get(row.local_id)?.generation !== row.generation) return null;
      const next = { ...row, ...changes, generation: row.generation + 1 };
      rows.set(row.local_id, next);
      return next;
    },
    checkFiles: (prefix, files) => files.every((_, index) => uploads.has(`${prefix}/${index}`)),
    signUploads: paths => paths,
    signDownloads: paths => paths.map(path => `signed:${path}`),
  };
  const writer = publicationHandler('write', dependencies);
  const reader = publicationHandler('read', dependencies);
  return {
    rows, uploads,
    write: (body, token = 'owner') => writer(new Request('https://test/publish', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId, ...body }),
    })),
    read: id => reader(new Request(`https://test/read?id=${id}`)),
  };
}

const assets = [{ size: 140, type: 'image/png' }];
function manifest(size) {
  return {
    format: 'bingo-publication', version: 1, assets,
    data: {
      settings: { size }, appearance: { values: {}, background: { $asset: 0 } },
      cards: { cards: [] }, tasks: [], tokens: {}, sounds: {},
    },
  };
}

test('unauthenticated and non-owner writes are denied before accessing data', async () => {
  const { write, rows, read } = await fixture();
  for (const action of ['status', 'prepare', 'commit', 'unpublish']) {
    assert.equal((await write({ action }, 'invalid')).status, 401);
    assert.equal((await write({ action }, 'stranger')).status, 403);
  }
  assert.equal(rows.size, 0);
  assert.equal((await read('not-a-uuid')).status, 404);
});

test('publish, update, concurrent change, unpublish and republish preserve the stable link', async () => {
  const { write, read, uploads } = await fixture();
  const prepare = async (id = localId) => (await write({ action: 'prepare', localId: id, assets })).json();
  const commit = (prepareResult, size, id = localId) => write({
    action: 'commit', localId: id, revision: prepareResult.revision,
    generation: prepareResult.publication.generation, manifest: manifest(size),
  });
  assert.equal((await write({ action: 'prepare', assets: [{ size: 50_000_001, type: 'image/png' }] })).status, 400);
  const first = await prepare();
  const conflicting = await prepare();
  assert.equal(first.publication.id, publicationId);
  assert.equal((await read(publicationId)).status, 404);
  assert.equal((await commit(first, 4)).status, 400);
  uploads.add(first.uploads[0]);
  assert.equal((await commit(first, 4)).status, 200);
  uploads.add(conflicting.uploads[0]);
  assert.equal((await commit(conflicting, 2)).status, 409);
  assert.equal((await (await read(publicationId)).json()).manifest.data.settings.size, 4);

  const update = await prepare();
  uploads.add(update.uploads[0]);
  assert.equal((await commit(update, 3)).status, 200);
  const response = await read(publicationId);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const released = await response.json();
  assert.equal(released.manifest.data.settings.size, 3);
  assert.deepEqual(released.urls, [`signed:${update.uploads[0]}`]);
  assert.equal(released.owner_id, undefined);
  const copy = await prepare('local-project-2');
  uploads.add(copy.uploads[0]);
  assert.equal((await commit(copy, 2, 'local-project-2')).status, 200);
  assert.equal(copy.publication.id, copyId);
  assert.equal((await (await read(copyId)).json()).manifest.data.settings.size, 2);
  assert.equal((await write({ action: 'unpublish' })).status, 200);
  assert.equal((await read(publicationId)).status, 404);
  assert.equal((await read(copyId)).status, 200);
  const again = await prepare();
  assert.equal(again.publication.id, publicationId);
  uploads.add(again.uploads[0]);
  assert.equal((await commit(again, 5)).status, 200);
  assert.equal((await read(publicationId)).status, 200);
});
