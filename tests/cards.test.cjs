const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = vm.createContext({ assert });
for (const file of ['cards.js', 'game.js']) {
  const filename = path.join(__dirname, '..', file);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
}

test('each board has unique card content in auto and manual deals, including redeals', () => {
  vm.runInContext(`
    for (const size of [2, 3, 4, 5]) {
      const cards = Array.from({ length: size ** 2 }, (_, index) => ({
        id: String(index), image: 'image', imageKey: String(index),
      }));
      const duplicate = { ...cards[0], id: 'duplicate', label: 'Другой файл' };
      cards.push(duplicate);
      for (const placements of [undefined, [['0', 'duplicate'], ['duplicate', '0']]]) {
        for (let attempt = 0; attempt < 50; attempt++) {
          const game = new BingoGame({ size, cards, placements, tasks: ['Задание'] });
          for (const board of game.boards) {
            assert.equal(board.length, size ** 2);
            assert.equal(new Set(board.map(cell => cardIdentity(cell.card))).size, size ** 2);
          }
          assert.equal(game.cardsInPlay.length, size ** 2);
          if (placements) {
            assert.equal(game.boards[0][0].card.id, '0');
            assert.equal(game.boards[1][0].card.id, 'duplicate');
            game.player = 1;
            game.drawn = cards[0];
            assert.equal(game.choose(1, 0), 'task');
          }
        }
      }
      assert.throws(() => new BingoGame({ size, cards: cards.slice(1, -1).concat(cards[1]) }), /Не хватает: 1/);
    }
  `, context);
});
