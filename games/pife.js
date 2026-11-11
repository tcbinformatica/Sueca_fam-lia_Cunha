// Pife — 2 a 4 jogadores, 2 baralhos (104 cartas), 9 cartas na mão.
// Na vez: compra do monte ou pega a do lixo, e descarta uma. Bate quem fechar as 9 cartas em jogos
// (trinca/quadra do mesmo número com naipes diferentes, ou sequência do mesmo naipe; Ás vale baixo ou alto).
const SP = process.env.FAST ? 0.01 : 1;
const RK = 'A23456789TJQK';
const val = c => RK.indexOf(c[0]) + 1;
const SUITS = 'hdsc';
const sortHand = h => h.sort((a, b) => SUITS.indexOf(a[1]) - SUITS.indexOf(b[1]) || val(a) - val(b));

function shuffle(d) { for (let i = d.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [d[i], d[j]] = [d[j], d[i]]; } return d; }

// Divide as cartas em jogos válidos (cada um com 3 ou mais). Devolve a lista de jogos ou null.
function partition(cs) {
  if (!cs.length) return [];
  const sorted = [...cs].sort((a, b) => val(a) - val(b));
  const c = sorted[0], rest = sorted.slice(1), v = val(c);
  // trinca ou quadra: mesmo número, naipes diferentes
  const same = rest.filter(x => x[0] === c[0] && x[1] !== c[1]);
  const combos = [];
  for (let i = 0; i < same.length; i++) for (let j = i + 1; j < same.length; j++) {
    if (same[i][1] === same[j][1]) continue;
    combos.push([same[i], same[j]]);
    for (let k = j + 1; k < same.length; k++)
      if (same[k][1] !== same[i][1] && same[k][1] !== same[j][1]) combos.push([same[i], same[j], same[k]]);
  }
  for (const cb of combos) {
    const pool = rest.filter(x => !cb.includes(x)); const r = partition(pool);
    if (r) return [[c, ...cb], ...r];
  }
  // sequência do mesmo naipe a partir desta carta (para cima; o Ás também fecha Q-K-A)
  const runs = v === 1 ? [[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]] : [[]];
  if (v !== 1) for (let x = v + 1; x <= 13; x++) runs[0].push(x);
  for (const want of runs) {
    const used = [c]; const pool = [...rest];
    for (const w of want) {
      const i = pool.findIndex(x => x[1] === c[1] && val(x) === w); if (i < 0) break;
      used.push(pool[i]); pool.splice(i, 1);
      if (used.length >= 3) { const r = partition(pool); if (r) return [[...used], ...r]; }
    }
  }
  return null;
}
function canBeat(hand) {          // mão de 10: descarta uma e as 9 restantes fecham em jogos
  for (let i = 0; i < hand.length; i++) {
    const rest = hand.filter((_, k) => k !== i); const m = partition(rest);
    if (m) return { discard: hand[i], melds: m.map(g => { g = sortHand([...g]); return g.some(x => x[0] === 'K') && g[0][0] === 'A' && g.every(x => x[1] === g[0][1]) ? [...g.slice(1), g[0]] : g; }) };
  }
  return null;
}
// utilidade de uma carta para a mão (para os bots)
function useful(c, hand) {
  let s = 0;
  for (const x of hand) {
    if (x === c) continue;
    if (x[0] === c[0] && x[1] !== c[1]) s += 3;
    if (x[1] === c[1]) { const d = Math.abs(val(x) - val(c)); if (d === 1) s += 3; else if (d === 2) s += 1; }
  }
  return s;
}

module.exports = function () {
  const players = r => r.seats.map((s, i) => s ? i : -1).filter(i => i >= 0);
  const nextSeat = (r, i) => { const p = players(r); return p[(p.indexOf(i) + 1) % p.length]; };

  function newRound(r) {
    const t = r.t, p = players(r);
    t.stock = shuffle([...'01'].flatMap(k => [...SUITS].flatMap(s => [...RK].map(x => x + s + k))));
    t.hands = [[], [], [], []];
    for (const i of p) t.hands[i] = sortHand(t.stock.splice(0, 9));
    t.discard = [t.stock.pop()];
    r.dealer = r.dealer == null ? p[Math.random() * p.length | 0] : nextSeat(r, r.dealer);
    t.turn = nextSeat(r, r.dealer); t.step = 'draw'; t.result = null;
    r.phase = 'play'; r.hid = (r.hid || 0) + 1;
  }
  function draw(r, seat, from) {
    const t = r.t;
    if (from === 'discard' && t.discard.length) t.hands[seat].push(t.discard.pop());
    else {
      if (!t.stock.length) { const top = t.discard.pop(); t.stock = shuffle(t.discard); t.discard = [top]; }
      t.hands[seat].push(t.stock.pop());
    }
    sortHand(t.hands[seat]); t.step = 'discard';
  }
  function act(r, seat, m, ctx) {
    const t = r.t; if (!t || seat < 0 || !m) return;
    if (m.type === 'next') { if (r.phase === 'handEnd') { newRound(r); ctx.push(r); } return; }
    if (r.phase !== 'play' || t.turn !== seat) return;
    if (m.type === 'draw' && t.step === 'draw') { draw(r, seat, m.ans); return ctx.push(r); }
    if (m.type === 'play' && t.step === 'discard' && t.hands[seat].includes(m.card)) {
      t.hands[seat].splice(t.hands[seat].indexOf(m.card), 1); t.discard.push(m.card);
      t.turn = nextSeat(r, seat); t.step = 'draw'; return ctx.push(r);
    }
    if (m.type === 'beat' && t.step === 'discard') {
      const b = canBeat(t.hands[seat]); if (!b) return;
      t.wins[seat]++; t.result = { seat, ...b }; r.phase = 'handEnd';
      ctx.say(r, `🏆 ${r.seats[seat].name} bateu!`); return ctx.push(r);
    }
  }
  function tick(r, ctx) {
    clearTimeout(r.tTimer);
    const t = r.t; if (!t || r.phase !== 'play') return;
    const i = t.turn, s = r.seats[i]; if (!(s.bot || !s.online)) return;
    r.tTimer = setTimeout(() => {
      const h = t.hands[i];
      if (t.step === 'draw') {
        const top = t.discard[t.discard.length - 1];
        const take = top && (canBeat([...h, top]) || useful(top, h) >= 3);
        act(r, i, { type: 'draw', ans: take ? 'discard' : 'stock' }, ctx);
      } else if (canBeat(h)) act(r, i, { type: 'beat' }, ctx);
      else {
        const worst = [...h].sort((a, b) => useful(a, h) - useful(b, h) || val(b) - val(a))[0];
        act(r, i, { type: 'play', card: worst }, ctx);
      }
    }, (s.bot ? 1300 : 15000) * SP);
  }
  function view(r, me) {
    const t = r.t; if (!t) return {};
    const mine = me >= 0 && t.turn === me && r.phase === 'play';
    return {
      hand: me >= 0 ? t.hands[me] : [], counts: t.hands.map(h => h.length),
      stock: t.stock.length, top: t.discard[t.discard.length - 1] || null,
      turn: t.turn, step: t.step, wins: t.wins,
      canDraw: mine && t.step === 'draw', canPlay: mine && t.step === 'discard',
      canBeat: mine && t.step === 'discard' && !!canBeat(t.hands[me]),
      result: t.result,
    };
  }
  return {
    flex: true,
    start(r) { r.t = { wins: [0, 0, 0, 0] }; r.dealer = null; newRound(r); },
    act, tick, view,
  };
};
module.exports.partition = partition; module.exports.canBeat = canBeat;
