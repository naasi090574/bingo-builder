'use strict';

const editorAvatars = [null, null];
const avatarRows = [...document.querySelectorAll('[data-player-avatar]')].map(row => ({
  preview: row.querySelector('img'),
  input: row.querySelector('input'),
  label: row.querySelector('label span'),
  remove: row.querySelector('button'),
  status: row.querySelector('[role="status"]'),
}));

function renderEditorAvatar(player) {
  const { preview, label, remove, status } = avatarRows[player];
  if (preview.hasAttribute('src')) URL.revokeObjectURL(preview.src);
  const media = editorAvatars[player];
  if (media) preview.src = URL.createObjectURL(media.image);
  else preview.removeAttribute('src');
  preview.hidden = !media;
  remove.hidden = !media;
  label.textContent = media ? 'Заменить героя' : 'Загрузить героя';
  status.textContent = media?.name ?? '';
}

function restoreAvatars(avatars) {
  for (let player = 0; player < editorAvatars.length; player++) {
    editorAvatars[player] = avatars?.[player] ?? null;
    renderEditorAvatar(player);
  }
}

function broadcastAvatars() {
  const message = { type: 'bingo:avatars', avatars: editorAvatars };
  frame.contentWindow.postMessage(message, appearanceOrigin());
  for (const popup of appearancePopups) {
    if (!popup.closed) popup.postMessage(message, appearanceOrigin());
  }
}

avatarRows.forEach(({ input, remove, status }, player) => {
  function update(media) {
    editorAvatars[player] = media;
    renderEditorAvatar(player);
    broadcastAvatars();
    window.projectChanged?.();
  }
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    input.disabled = true;
    remove.disabled = true;
    try {
      const { image } = await readCardImage(file);
      update({ image, name: file.name });
    } catch {
      status.textContent = 'Не удалось загрузить изображение. Используйте PNG, JPEG или WebP.';
    } finally {
      input.disabled = false;
      remove.disabled = false;
    }
  });
  remove.addEventListener('click', () => update(null));
});

window.addEventListener('message', event => {
  if (event.origin !== window.origin || event.data?.type !== 'bingo:avatars-ready') return;
  if (event.source !== frame.contentWindow && !appearancePopups.has(event.source)) return;
  event.source.postMessage({ type: 'bingo:avatars', avatars: editorAvatars }, appearanceOrigin());
});
