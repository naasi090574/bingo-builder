'use strict';

const tokenShapes = {
  check: ['Галочка', '<circle cx="12" cy="12" r="12"/><path d="m6.8 12 3.4 3.3 7-7" fill="none" stroke="#16243b" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>'],
  star: ['Звезда', '<path d="m12 1 3.2 6.7 7.4 1-5.3 5.2 1.3 7.4-6.6-3.5-6.6 3.5 1.3-7.4L1.4 8.7l7.4-1Z"/>'],
  circle: ['Кружок', '<circle cx="12" cy="12" r="11"/>'],
  heart: ['Сердечко', '<path d="M12 22C9 19.5 1 14.8 1 7.7 1 1.7 9 .2 12 5.3c3-5.1 11-3.6 11 2.4C23 14.8 15 19.5 12 22Z"/>'],
  flower: ['Цветок', '<path d="M12 7C6.5-2 2 7 7.2 10c-9-1-6.9 9 1.1 5.6-3.6 8.9 8.7 8.9 7.3 0 7.6 5.2 10.2-6.5 2.1-6.1C23.9 3.1 13.8-1.7 12 7Z"/><circle cx="12" cy="12" r="2.4" fill="#16243b"/>'],
  snowflake: ['Снежинка', '<path d="M12 1v22M2.5 6.5l19 11m-19 0 19-11M8 3l4 4 4-4m-8 18 4-4 4 4M2.5 11 8 9.7 6.8 4.4m10.4 15.2L16 14.3l5.5-1.3m0-2L16 9.7l1.2-5.3M6.8 19.6 8 14.3 2.5 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'],
  coin: ['Монетка', '<circle cx="12" cy="12" r="11.5"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="#16243b" stroke-width="1.1"/><path d="m8.7 10 3.3-2v8m-3 0h6" fill="none" stroke="#16243b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'],
  trophy: ['Кубок', '<path d="M6 2h12v2h4v3a6 6 0 0 1-5.4 6A6.1 6.1 0 0 1 13.5 15v4h4v3h-11v-3h4v-4a6.1 6.1 0 0 1-3.1-2A6 6 0 0 1 2 7V4h4zm0 4H4v1a4 4 0 0 0 2.4 3.6C6.1 9.4 6 7.8 6 6Zm12 0c0 1.8-.1 3.4-.4 4.6A4 4 0 0 0 20 7V6Z"/>'],
};

const tokenPlacements = { replace: 'Вместо картинки', overlay: 'Поверх картинки', corner: 'В углу картинки' };
const tokenCorners = { 'top-left': 'Верхний левый', 'top-right': 'Верхний правый', 'bottom-left': 'Нижний левый', 'bottom-right': 'Нижний правый' };
const tokenAnimations = { none: 'Без анимации', fade: 'Плавное появление', grow: 'Увеличение', spin: 'Вращение', jump: 'Прыжок' };
const defaultToken = {
  shape: 'check', image: null, color: '#6bf4c1', size: 62, opacity: 100,
  placement: 'replace', corner: 'top-right', animation: 'none',
};

function normalizeTokenSettings(settings) {
  const option = (value, options, fallback) => Object.hasOwn(options, value) ? value : fallback;
  const range = (value, min, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(100, value)) : fallback;
  return {
    shared: settings?.shared !== false,
    players: [0, 1].map(index => {
      const data = settings?.players?.[index] ?? {};
      const image = data.image instanceof Blob ? data.image : null;
      return {
        shape: data.shape === 'custom' && image ? 'custom' : option(data.shape, tokenShapes, defaultToken.shape),
        image,
        color: /^#[\da-f]{6}$/i.test(data.color) ? data.color : defaultToken.color,
        size: range(data.size, 10, defaultToken.size),
        opacity: range(data.opacity, 0, defaultToken.opacity),
        placement: option(data.placement, tokenPlacements, defaultToken.placement),
        corner: option(data.corner, tokenCorners, defaultToken.corner),
        animation: option(data.animation, tokenAnimations, defaultToken.animation),
      };
    }),
  };
}

function playerToken(settings, player) {
  return settings.players[settings.shared ? 0 : player];
}

function createToken(config, imageUrl, animate = false) {
  const token = document.createElement('span');
  token.className = 'chip';
  token.dataset.shape = config.shape;
  token.dataset.placement = config.placement;
  if (config.placement === 'corner') token.dataset.corner = config.corner;
  if (animate && config.animation !== 'none') token.dataset.animation = config.animation;
  token.setAttribute('aria-hidden', 'true');
  token.style.setProperty('--token-size', `${config.size}%`);
  token.style.setProperty('--token-opacity', config.opacity / 100);
  token.style.setProperty('--token-color', config.color);
  if (config.shape === 'custom') {
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = '';
    image.draggable = false;
    token.append(image);
  } else {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = tokenShapes[config.shape][1];
    token.append(svg);
  }
  return token;
}

function tokenStorage(mode, settings) {
  return openCardDatabase().then(database => new Promise((resolve, reject) => {
    const transaction = database.transaction('library', mode);
    const store = transaction.objectStore('library');
    const request = mode === 'readonly' ? store.get('tokens') : store.put(settings, 'tokens');
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
  }));
}
