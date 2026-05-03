export const SUITS = [
  { id: "crimson", label: "Crimson", glyph: "✦", hue: 6 },
  { id: "azure", label: "Azure", glyph: "❖", hue: 210 },
  { id: "verdant", label: "Verdant", glyph: "❀", hue: 140 },
  { id: "gold", label: "Gold", glyph: "✸", hue: 42 },
];

export const SUIT_BY_ID = Object.fromEntries(SUITS.map((suit) => [suit.id, suit]));
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const HAND_SIZE = 5;
export const BOARD_SIZE = 3;
export const MAX_TURNS = 10;
export const DECK_COPIES = 2;
export const TOTAL_CARDS = SUITS.length * RANKS.length * DECK_COPIES;

const MATCH_RULES = [
  {
    kind: "perfect",
    label: "PRISM",
    priority: 4,
    matches: ({ sameSuit, sameRank }) => sameSuit && sameRank,
    getPoints: (handCard) => handCard.rank * 5,
  },
  {
    kind: "bond",
    label: "BOND OF TEN",
    priority: 3,
    matches: ({ sumTen }) => sumTen,
    getPoints: () => 20,
  },
  {
    kind: "hue",
    label: "HUE MATCH",
    priority: 2,
    matches: ({ sameSuit }) => sameSuit,
    getPoints: (handCard) => handCard.rank * 3,
  },
  {
    kind: "twin",
    label: "TWIN",
    priority: 1,
    matches: ({ sameRank }) => sameRank,
    getPoints: (handCard) => handCard.rank * 3,
  },
];

export function buildDeck() {
  const deck = [];
  let id = 0;
  for (let copy = 0; copy < DECK_COPIES; copy += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ id: `c${id}`, suit: suit.id, rank });
        id += 1;
      }
    }
  }
  return deck;
}

export function shuffle(items, random = Math.random) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createGame(random = Math.random) {
  const deck = shuffle(buildDeck(), random);
  const hand = deck.splice(0, HAND_SIZE);
  const board = deck.splice(0, BOARD_SIZE);
  return {
    deck,
    hand,
    board,
    score: 0,
    turn: 1,
    log: [],
    over: false,
  };
}

export function evaluateMatch(handCard, boardCard) {
  const flags = {
    sameSuit: handCard.suit === boardCard.suit,
    sameRank: handCard.rank === boardCard.rank,
    sumTen: handCard.rank + boardCard.rank === 10,
  };

  let best = {
    kind: "mismatch",
    label: "MISMATCH",
    points: -3,
    priority: 0,
  };

  for (const rule of MATCH_RULES) {
    if (!rule.matches(flags)) continue;
    const points = rule.getPoints(handCard, boardCard);
    if (points > best.points || (points === best.points && rule.priority > best.priority)) {
      best = {
        kind: rule.kind,
        label: rule.label,
        points,
        priority: rule.priority,
      };
    }
  }

  return {
    kind: best.kind,
    points: best.points,
    label: best.label,
  };
}

export function play(state, handIndex, boardIndex) {
  if (state.over) return state;
  const handCard = state.hand[handIndex];
  const boardCard = state.board[boardIndex];
  if (!handCard || !boardCard) return state;

  const result = evaluateMatch(handCard, boardCard);
  state.score += result.points;
  state.log.unshift({ turn: state.turn, handCard, boardCard, result });

  state.hand.splice(handIndex, 1);
  state.board.splice(boardIndex, 1);

  const drawnHand = state.deck.shift();
  if (drawnHand) state.hand.push(drawnHand);
  const drawnBoard = state.deck.shift();
  if (drawnBoard) state.board.push(drawnBoard);

  state.turn += 1;
  if (state.turn > MAX_TURNS || state.hand.length === 0 || state.board.length === 0) {
    state.over = true;
  }
  return state;
}
