'use strict';

const appearanceFonts = {
  system: 'system-ui, sans-serif',
  sans: 'Arial, sans-serif',
  serif: 'Georgia, serif',
  mono: '"Courier New", monospace',
};

const defaultAppearance = {
  backgroundMode: 'default',
  backgroundColor: '#0d1422',
  boardColor: '#182235',
  boardOpacity: '100',
  boardSize: '100',
  boardRadius: '20',
  cellColor: '#26374b',
  cellOpacity: '100',
  imageSize: '80',
  cellRadius: '13',
  titleFont: 'system',
  titleSize: '34',
  titleColor: '#f6f8ff',
  textFont: 'system',
  textSize: '16',
  textColor: '#f6f8ff',
  buttonColor: '#6bf4c1',
  buttonText: '#102822',
  activeColor: '#6bf4c1',
};

function appearanceOrigin() {
  return window.origin === 'null' ? '*' : window.origin;
}
