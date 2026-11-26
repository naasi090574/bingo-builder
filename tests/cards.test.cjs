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

test('both miss rules finish at every size and victory condition, including repeated deck cycles', () => {
  vm.runInContext(`
    for (const size of [2, 3, 4, 5]) {
      const count = size ** 2;
      const cards = Array.from({ length: 2 * count }, (_, index) => ({ id: String(index) }));
      const placements = [cards.slice(0, count), cards.slice(count)].map(field => field.map(card => card.id));
      for (const mode of ['horizontal', 'vertical', 'diagonal', 'line', 'full']) {
        for (const missedDraw of ['retry', 'pass']) {
          for (const random of [() => 0, () => 0.99, Math.random]) {
            const game = new BingoGame({ size, cards, placements, missedDraw, tasks: ['Задание'] }, mode, random);
            let draws = 0;
            while (!game.outcome) {
              const player = game.player;
              assert.ok(++draws <= cards.length * (4 * count), 'the deck must make progress');
              const drawn = game.draw();
              assert.ok(drawn);
              const target = game.boards[player].findIndex(cell => cell.card.id === drawn.id && !cell.marked);
              if (target < 0) {
                assert.equal(game.player, missedDraw === 'pass' ? 1 - player : player);
                assert.equal(game.lastMiss, missedDraw === 'pass' ? drawn : null);
                assert.ok(game.canDraw);
                continue;
              }
              assert.equal(game.player, player);
              assert.equal(game.canDraw, false);
              assert.equal(game.choose(player, target), 'task');
              game.completeTask();
              const cells = winningCells(game.boards[player], size, mode);
              if (cells.length && missedDraw === 'retry' && mode === 'full' && player === 0) {
                assert.equal(game.outcome, null);
                assert.equal(game.player, 1);
              } else if (cells.length) {
                assert.ok(game.outcome);
                assert.equal(game.outcome.winner, missedDraw === 'retry' && mode === 'full' ? null : player);
              }
            }
            assert.equal(game.canDraw, false);
            assert.equal(game.draw(), null);
          }
        }
      }
    }
  `, context);
});

test('a full-board lead wins after the second player finishes short, and a covered draw passes the turn', () => {
  vm.runInContext(`
    const cards = Array.from({ length: 4 }, (_, index) => ({ id: String(index) }));
    const game = new BingoGame({ size: 2, cards, tasks: ['Задание'] }, 'full');
    for (const cell of game.boards[0].slice(0, 3)) cell.marked = true;
    game.drawn = game.boards[0][3].card;
    assert.equal(game.choose(0, 3), 'task');
    game.completeTask();
    assert.equal(game.outcome, null);
    assert.equal(game.player, 1);
    game.drawn = game.boards[1][0].card;
    assert.equal(game.choose(1, 0), 'task');
    game.completeTask();
    assert.equal(game.outcome.winner, 0);

    const pass = new BingoGame({ size: 2, cards, missedDraw: 'pass' });
    const covered = pass.boards[0][0];
    covered.marked = true;
    pass.decks[0].push(covered.card);
    assert.equal(pass.draw(), covered.card);
    assert.equal(pass.player, 1);
    assert.equal(pass.drawn, null);
    assert.equal(pass.choose(1, 0), 'ignored');
    assert.ok(pass.canDraw);
  `, context);
});

test('a resampled copy shares an image identity when dealing and matching', () => {
  vm.runInContext(`{
    const original = { id: 'original', image: 'original.png', imageKey: 'original', imageSample: [20, 0, 0, 255] };
    const resized = { id: 'resized', image: 'resized.png', imageKey: 'resized', imageSample: [21, 0, 0, 255] };
    const other = [60, 100, 140].map(value => ({
      id: String(value), image: value + '.png', imageKey: String(value), imageSample: [value, 0, 0, 255],
    }));
    assert.equal(sameCardContent(original, resized), true);
    assert.equal(sameCardContent(original, other[0]), false);
    const recolored = { ...resized, imageKey: 'recolored', imageSample: [28, 0, 0, 255] };
    assert.equal(sameCardContent(original, recolored), false);
    const game = new BingoGame({
      size: 2, cards: [original, resized, ...other],
      placements: [['original', 'resized'], ['resized']], tasks: ['Задание'],
    });
    for (const field of game.boards) {
      assert.equal(new Set(field.map(({card}) => cardIdentity(card))).size, 4);
    }
    game.drawn = game.boards[0][0].card;
    game.player = 1;
    assert.equal(game.canDraw, false);
    assert.equal(game.choose(1, 0), 'task');
  }`, context);
});
