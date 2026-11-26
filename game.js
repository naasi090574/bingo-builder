'use strict';

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function winningCells(board, size, mode) {
  if (mode === 'full') {
    return board.every(cell => cell.marked) ? board.map((_, index) => index) : [];
  }
  const indices = Array.from({ length: size }, (_, index) => index);
  const lines = [];
  if (mode === 'horizontal' || mode === 'line') {
    lines.push(...indices.map(row => indices.map(column => row * size + column)));
  }
  if (mode === 'vertical' || mode === 'line') {
    lines.push(...indices.map(column => indices.map(row => row * size + column)));
  }
  if (mode === 'diagonal' || mode === 'line') {
    lines.push(
      indices.map(index => index * (size + 1)),
      indices.map(index => index * size + size - 1 - index),
    );
  }
  return lines.find(line => line.every(index => board[index].marked)) ?? [];
}

class BingoGame {
  constructor(content, mode = 'line', random = Math.random) {
    this.size = content.size;
    this.mode = mode;
    this.random = random;
    this.tasks = content.tasks;
    this.taskOrder = content.taskOrder;
    this.passOnMiss = content.missedDraw === 'pass';
    const pool = uniqueCards(content.cards);
    if (pool.length < this.size ** 2) throw new RangeError(cardShortage(pool.length, this.size));
    const cardById = new Map(content.cards.map(card => [card.id, card]));
    this.boards = Array.from({ length: 2 }, (_, player) => {
      const used = new Set();
      const assigned = content.placements?.[player] ?? [];
      const count = this.size ** 2;
      const slots = Array.from({ length: count }, (_, index) => {
        const card = cardById.get(assigned[index]);
        if (!card || used.has(cardIdentity(card))) return null;
        used.add(cardIdentity(card));
        return card;
      });
      const available = shuffle(pool.filter(card => !used.has(cardIdentity(card))), random);
      return slots.map(card => ({ card: card ?? available.pop(), marked: false }));
    });
    this.cardsInPlay = uniqueCards(this.boards.flat().map(cell => cell.card));
    this.player = 0;
    this.drawn = null;
    this.pending = null;
    this.outcome = null;
    this.lastMiss = null;
    this.decks = [[], []];
    this.taskDeck = [];
  }

  hasOpenCard(card) {
    return this.boards[this.player].some(cell =>
      !cell.marked && cardIdentity(cell.card) === cardIdentity(card)
    );
  }

  get canDraw() {
    return !this.pending && !this.outcome && (!this.drawn || !this.hasOpenCard(this.drawn));
  }

  draw() {
    if (!this.canDraw) return null;
    const player = this.player;
    if (!this.decks[player].length) {
      const marked = new Set(this.boards[player].filter(cell => cell.marked)
        .map(cell => cardIdentity(cell.card)));
      // Each player cycles through the deck independently, so alternating misses cannot starve either player.
      const eligible = this.passOnMiss
        ? this.cardsInPlay
        : this.cardsInPlay.filter(card => !marked.has(cardIdentity(card)));
      this.decks[player] = shuffle(eligible, this.random);
    }

    const card = this.decks[player].pop();
    this.lastMiss = null;
    if (this.passOnMiss && !this.hasOpenCard(card)) {
      this.lastMiss = card;
      this.player = 1 - player;
    } else {
      this.drawn = card;
    }
    return card;
  }

  choose(player, index) {
    if (player !== this.player || this.pending || this.outcome || !this.drawn) {
      return 'ignored';
    }
    const cell = this.boards[player][index];
    if (!cell || cell.marked) return 'ignored';
    if (cardIdentity(cell.card) !== cardIdentity(this.drawn)) return 'wrong';

    if (!this.taskDeck.length) {
      this.taskDeck = this.taskOrder === 'sequential'
        ? [...this.tasks].reverse()
        : shuffle(this.tasks, this.random);
    }
    this.pending = { index, text: this.taskDeck.pop() };
    return 'task';
  }

  completeTask() {
    if (!this.pending) return;
    const board = this.boards[this.player];
    board[this.pending.index].marked = true;
    this.pending = null;
    this.drawn = null;
    if (!this.passOnMiss) this.decks[this.player] = [];

    const cells = winningCells(board, this.size, this.mode);
    if (this.mode === 'full' && !this.passOnMiss) {
      if (this.player === 1) {
        const first = winningCells(this.boards[0], this.size, 'full');
        if (first.length && cells.length) this.outcome = { winner: null, cells };
        else if (first.length) this.outcome = { winner: 0, cells: first };
        else if (cells.length) this.outcome = { winner: 1, cells };
      }
    } else if (cells.length) {
      this.outcome = { winner: this.player, cells };
    }
    if (!this.outcome) this.player = 1 - this.player;
  }
}
