'use strict';

// Preserve room for the boards and the drawn card when several labels are enlarged at once.
const labelFitTargets = [
  ['#game-title', 0.18], ['.board-heading h2', 0.16], ['.winner-badge', 0.10],
  ['.game-rules label', 0.12], ['.game-rules select', 0.09],
  ['#draw-title', 0.15], ['#status', 0.23], ['#draw', 0.13], ['#reset', 0.11], ['.placeholder', 0.09],
];
const labelFitLandscape = matchMedia('(min-aspect-ratio: 17/10)');
const labelProbe = document.createElement('span');
labelProbe.setAttribute('aria-hidden', 'true');
Object.assign(labelProbe.style, {
  position: 'fixed', visibility: 'hidden', inset: '0 auto auto 0',
  display: 'block', pointerEvents: 'none', overflowWrap: 'anywhere',
});
document.body.append(labelProbe);

function fitGameLabels() {
  const targets = labelFitTargets.flatMap(([selector, limit]) =>
    [...document.querySelectorAll(selector)].map(element => ({ element, limit })));
  for (const { element } of targets) {
    element.style.removeProperty('--fit-size');
    element.style.removeProperty('--fit-spacing');
    element.style.removeProperty('--fit-stroke-width');
  }
  if (!labelFitLandscape.matches) return;

  for (const { element, limit } of targets) {
    const select = element instanceof HTMLSelectElement;
    labelProbe.textContent = select ? element.selectedOptions[0]?.text : element.textContent;
    if (!labelProbe.textContent) continue;
    const style = getComputedStyle(element);
    const size = parseFloat(style.fontSize);
    const inset = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const width = element.clientWidth - inset - (select ? size : 0);
    if (!(size > 0 && width > 0)) continue;
    const lineHeight = parseFloat(style.lineHeight) / size || 1.2;
    const spacing = parseFloat(style.letterSpacing) || 0;
    Object.assign(labelProbe.style, {
      fontFamily: style.fontFamily, fontWeight: style.fontWeight, fontSynthesis: style.fontSynthesis,
      whiteSpace: select ? 'nowrap' : 'normal',
      width: select ? 'max-content' : `${width}px`,
    });
    const height = element.matches('.placeholder')
      ? element.parentElement.clientHeight : innerHeight * limit;
    const fits = fontSize => {
      labelProbe.style.fontSize = `${fontSize}px`;
      labelProbe.style.letterSpacing = `${spacing * fontSize / size}px`;
      labelProbe.style.lineHeight = String(lineHeight);
      const bounds = labelProbe.getBoundingClientRect();
      return bounds.height <= height && (!select || bounds.width <= width + size - fontSize);
    };
    if (fits(size)) continue;
    let low = 4;
    let high = size;
    while (high - low > .25) {
      const middle = (low + high) / 2;
      if (fits(middle)) low = middle;
      else high = middle;
    }
    element.style.setProperty('--fit-size', `${low}px`);
    element.style.setProperty('--fit-spacing', `${spacing * low / size}px`);
    element.style.setProperty('--fit-stroke-width', `${parseFloat(style.webkitTextStrokeWidth) * low / size}px`);
  }
}

const drawPanel = document.querySelector('.draw-panel');
const drawTable = drawPanel.parentElement;
const drawPanelControls = [drawPanel.querySelector('#draw-title'), drawPanel.querySelector('#draw'),
  drawPanel.querySelector('.status')];

function fitDrawPanel() {
  drawPanel.style.removeProperty('height');
  drawPanel.style.removeProperty('translate');
  if (!labelFitLandscape.matches) return;

  const style = getComputedStyle(drawPanel);
  const offsetX = parseFloat(style.getPropertyValue('--draw-panel-x')) || 0;
  const offsetY = parseFloat(style.getPropertyValue('--draw-panel-y')) || 0;
  const heightPercent = parseFloat(style.getPropertyValue('--draw-panel-height')) || 100;
  if (!offsetX && !offsetY && heightPercent === 100) return;

  const bounds = drawPanel.getBoundingClientRect();
  const boardsRight = drawTable.querySelector('.boards').getBoundingClientRect().right;
  const selectBottom = document.querySelector('#victory-rule').getBoundingClientRect().bottom;
  const minY = Math.min(0, selectBottom + 4 - bounds.top);
  const screenBottom = document.documentElement.clientHeight - 2;
  const minHeight = drawPanelControls.reduce((height, element) => height + element.offsetHeight, 0) +
    3 * parseFloat(style.rowGap) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) +
    parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) + 24;
  const x = Math.max(Math.min(0, boardsRight + 2 - bounds.left),
    Math.min(offsetX, document.documentElement.clientWidth - bounds.right - 2));
  const y = Math.max(minY, Math.min(offsetY, Math.max(0, screenBottom - bounds.top - minHeight)));
  const height = Math.min(screenBottom - bounds.top - y, Math.max(minHeight, bounds.height * heightPercent / 100));
  drawPanel.style.height = `${height}px`;
  drawPanel.style.translate = `${x}px ${y}px`;
}

let pendingLabelFit = 0;
function scheduleGameLabelFit() {
  if (pendingLabelFit) return;
  pendingLabelFit = requestAnimationFrame(() => {
    pendingLabelFit = 0;
    fitGameLabels();
    fitDrawPanel();
  });
}
new MutationObserver(scheduleGameLabelFit).observe(document.querySelector('.shell'), {
  subtree: true, childList: true, characterData: true,
});
window.addEventListener('resize', scheduleGameLabelFit);
document.fonts.addEventListener('loadingdone', scheduleGameLabelFit);
document.querySelector('#victory-rule').addEventListener('change', scheduleGameLabelFit);
scheduleGameLabelFit();
