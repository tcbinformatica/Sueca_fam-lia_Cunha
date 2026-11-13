// Poker — Texas Hold'em (2 cartas) e Omaha (4 cartas, usa exatamente 2 da mão + 3 da mesa).
// 2 a 4 jogadores, fichas de brincadeira (1.000 cada), blinds 10/20, potes paralelos quando há all-in.
const SP = process.env.FAST ? 0.01 : 1;
const RK = '23456789TJQKA', SUITS = 'hdsc';
const rv = c => RK.indexOf(c[0]) + 2;
const NAMES = ['Carta alta', 'Par', 'Dois pares', 'Trinca', 'Sequência', 'Flush', 'Full house', 'Quadra', 'Straight flush'];
function shuffle(d) { for (let i = d.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [d[i], d[j]] = [d[j], d[i]]; } return d; }

function eval5(cs) {
  const v = cs.map(rv).sort((a, b) => b - a);
  const flush = cs.every(c => c[1] === cs[0][1]);
  const cnt = {}; v.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
  const g = Object.entries(cnt).map(([x, n]) => [n, +x]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const u = [...new Set(v)];
  let st = 0;
  if (u.length === 5) { if (u[0] - u[4] === 4) st = u[0]; else if (u.join() === '14,5,4,3,2') st = 5; }
  if (st && flush) return [8, st];
  if (g[0][0] === 4) return [7, g[0][1], g[1][1]];
  if (g[0][0] === 3 && g[1][0] === 2) return [6, g[0][1], g[1][1]];
  if (flush) return [5, ...v];
  if (st) return [4, st];
  if (g[0][0] === 3) return [3, ...g.map(x => x[1])];
  if (g[0][0] === 2 && g[1][0] === 2) return [2, ...g.map(x => x[1])];
  if (g[0][0] === 2) return [1, ...g.map(x => x[1])];
  return [0, ...v];
}
const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0); return 0; };
function combos(a, k) { const out = []; const f = (s, cur) => { if (cur.length === k) return out.push(cur.slice()); for (let i = s; i < a.length; i++) { cur.push(a[i]); f(i + 1, cur); cur.pop(); } }; f(0, []); return out; }
function best(hole, board, omaha) {
  let b = null;
  const sets = omaha ? combos(hole, 2).flatMap(h => combos(board, 3).map(x => [...h, ...x])) : combos([...hole, ...board], 5);
  for (const cs of sets) { const s = eval5(cs); if (!b || cmp(s, b.score) > 0) b = { score: s, cards: cs }; }
  return b;
}
const handName = s => s[0] === 8 && s[1] === 14 ? 'Royal flush' : NAMES[s[0]];

module.exports = function (variant) {
  const omaha = variant === 'omaha', NH = omaha ? 4 : 2, SB = 10, BB = 20, START = 1000;
  const seated = r => r.seats.map((s, i) => s ? i : -1).filter(i => i >= 0);
  const after = (list, i) => { for (let k = 1; k <= 4; k++) { const j = (i + k) % 4; if (list.includes(j)) return j; } return -1; };
  const live = t => t.in.filter(i => !t.folded[i]);
  const canAct = (t, i) => t.in.includes(i) && !t.folded[i] && !t.allin[i];
  const nextActor = (t, from) => { for (let k = 1; k <= 4; k++) { const j = (from + k) % 4; if (canAct(t, j) && (!t.acted[j] || t.bet[j] < t.cur)) return j; } return -1; };
  const pot = t => t.contrib.reduce((a, b) => a + b, 0);
  function post(t, i, a) { a = Math.min(a, t.stacks[i]); t.stacks[i] -= a; t.bet[i] += a; t.contrib[i] += a; if (!t.stacks[i]) t.allin[i] = true; }

  function newHand(r) {
    const t = r.t;
    for (const i of seated(r)) if (t.stacks[i] == null) t.stacks[i] = START;   // quem entrou depois
    const alive = seated(r).filter(i => t.stacks[i] > 0);
    r.hid = (r.hid || 0) + 1;
    if (alive.length < 2) { r.phase = 'end'; t.result = { champ: alive.length ? alive[0] : -1 }; if (alive.length) t.titles[alive[0]]++; return; }
    t.deck = shuffle([...SUITS].flatMap(s => [...RK].map(x => x + s)));
    t.hands = [[], [], [], []]; t.in = alive; t.board = []; t.street = 0; t.result = null;
    t.folded = [0, 0, 0, 0].map(() => false); t.allin = t.folded.slice(); t.acted = t.folded.slice();
    t.contrib = [0, 0, 0, 0]; t.bet = [0, 0, 0, 0];
    for (const i of alive) t.hands[i] = t.deck.splice(0, NH);
    t.button = t.button == null || !alive.length ? alive[Math.random() * alive.length | 0] : after(alive, t.button);
    const sb = alive.length === 2 ? t.button : after(alive, t.button), bb = after(alive, sb);
    post(t, sb, SB); post(t, bb, BB); t.cur = BB; t.minRaise = BB; t.sb = sb; t.bb = bb;
    r.phase = 'play';
    t.turn = nextActor(t, bb);
  }
  function kick(r, ctx) { if (r.phase === 'play' && r.t.turn < 0) endStreet(r, ctx); }   // blinds deixaram todos all-in
  function endStreet(r, ctx) {
    const t = r.t;
    t.bet = [0, 0, 0, 0]; t.cur = 0; t.minRaise = BB; t.acted = [false, false, false, false];
    t.street++;
    if (t.street === 4) return showdown(r, ctx);
    t.board.push(...t.deck.splice(0, t.street === 1 ? 3 : 1));
    if (t.in.filter(i => canAct(t, i)).length <= 1) {      // todos all-in: abre o resto da mesa devagar
      t.turn = -1; ctx.push(r);
      const hid = r.hid; setTimeout(() => { if (r.hid === hid) endStreet(r, ctx); ctx.push(r); }, 1500 * SP);
      return;
    }
    t.turn = nextActor(t, t.button);
  }
  function award(t, seat, amount) { t.stacks[seat] += amount; }
  function showdown(r, ctx) {
    const t = r.t, L = live(t), hands = {};
    for (const i of L) { const b = best(t.hands[i], t.board, omaha); hands[i] = { score: b.score, name: handName(b.score), cards: b.cards }; }
    const levels = [...new Set(t.contrib.filter(x => x > 0))].sort((a, b) => a - b);
    const won = [0, 0, 0, 0]; let prev = 0;
    for (const lv of levels) {
      const amount = t.contrib.reduce((a, c) => a + Math.max(0, Math.min(c, lv) - prev), 0);
      const elig = L.filter(i => t.contrib[i] >= lv); prev = lv;
      if (!elig.length || !amount) continue;
      const top = elig.reduce((a, i) => cmp(hands[i].score, hands[a].score) > 0 ? i : a, elig[0]);
      const ws = elig.filter(i => cmp(hands[i].score, hands[top].score) === 0);
      const share = Math.floor(amount / ws.length);
      ws.forEach((i, k) => won[i] += share + (k === 0 ? amount - share * ws.length : 0));
    }
    won.forEach((a, i) => award(t, i, a));
    t.result = { show: true, won, hands: Object.fromEntries(Object.entries(hands).map(([i, h]) => [i, { name: h.name, cards: h.cards }])) };
    t.turn = -1; r.phase = 'handEnd';
    const ws = won.map((a, i) => a ? i : -1).filter(i => i >= 0);
    ctx.say(r, ws.map(i => `${r.seats[i].name} leva ${won[i]} (${hands[i].name})`).join(' · '));
  }
  function act(r, seat, m, ctx) {
    const t = r.t; if (!t || seat < 0 || !m) return;
    if (m.type === 'next') {
      if (r.phase === 'end') { for (const i of seated(r)) t.stacks[i] = START; t.button = null; }
      if (r.phase === 'handEnd' || r.phase === 'end') { newHand(r); kick(r, ctx); ctx.push(r); }
      return;
    }
    if (r.phase !== 'play' || t.turn !== seat || !canAct(t, seat)) return;
    const toCall = t.cur - t.bet[seat];
    if (m.type === 'fold') { t.folded[seat] = true; ctx.say(r, `${r.seats[seat].name} desistiu.`); }
    else if (m.type === 'check') { if (toCall > 0) return; }
    else if (m.type === 'call') { if (toCall <= 0) return; post(t, seat, toCall); }
    else if (m.type === 'raise') {
      const max = t.bet[seat] + t.stacks[seat];
      let to = Math.min(Math.floor(Number(m.ans) || 0), max);
      if (to <= t.cur) return;
      if (to < t.cur + t.minRaise && to < max) return;          // aumento menor que o mínimo só se for all-in
      if (to - t.cur >= t.minRaise) t.minRaise = to - t.cur;
      post(t, seat, to - t.bet[seat]); t.cur = Math.max(t.cur, t.bet[seat]);
      for (const i of t.in) if (i !== seat) t.acted[i] = false;   // reabre a rodada
      ctx.say(r, t.allin[seat] ? `${r.seats[seat].name}: ALL-IN!` : `${r.seats[seat].name} aumentou para ${to}.`);
    } else return;
    t.acted[seat] = true;
    const L = live(t);
    if (L.length === 1) {                                        // todos desistiram
      const p = pot(t); award(t, L[0], p);
      t.result = { show: false, won: [0, 1, 2, 3].map(i => i === L[0] ? p : 0) };
      t.turn = -1; r.phase = 'handEnd'; return ctx.push(r);
    }
    const n = nextActor(t, seat);
    if (n >= 0) t.turn = n; else endStreet(r, ctx);
    ctx.push(r);
  }
  // ---------- Bots ----------
  function strength(t, i) {
    const h = t.hands[i];
    if (!t.board.length) {
      const v = h.map(rv).sort((a, b) => b - a);
      if (omaha) { const pairs = combos(h, 2).filter(x => x[0][0] === x[1][0]).map(x => rv(x[0])); return pairs.some(p => p >= 10) ? 2 : pairs.length || v[0] + v[1] >= 25 ? 1 : 0; }
      if (v[0] === v[1]) return v[0] >= 9 ? 2 : 1;
      return v[0] + v[1] >= 24 ? 2 : v[0] + v[1] >= 19 || h[0][1] === h[1][1] ? 1 : 0;
    }
    const c = best(h, t.board, omaha && t.board.length >= 3).score[0];
    return c >= 2 ? 2 : c === 1 ? 1 : 0;
  }
  function botMove(r, i, ctx) {
    const t = r.t, toCall = t.cur - t.bet[i], s = strength(t, i), p = pot(t), rnd = Math.random();
    const raiseTo = Math.min(t.bet[i] + t.stacks[i], t.cur + Math.max(t.minRaise, Math.floor(p / 2 / 10) * 10));
    if (raiseTo > t.cur && ((s === 2 && rnd < 0.45) || rnd < 0.04)) return act(r, i, { type: 'raise', ans: raiseTo }, ctx);   // só aumenta se tiver fichas para isso
    if (toCall <= 0) return act(r, i, { type: 'check' }, ctx);
    if (s === 2 || (s === 1 && toCall <= t.stacks[i] * 0.3) || (toCall <= BB && rnd < 0.5)) return act(r, i, { type: 'call' }, ctx);
    act(r, i, { type: 'fold' }, ctx);
  }
  function tick(r, ctx) {
    clearTimeout(r.tTimer);
    const t = r.t; if (!t || r.phase !== 'play' || t.turn < 0) return;
    const i = t.turn, s = r.seats[i]; if (!s) return;
    if (s.bot) r.tTimer = setTimeout(() => botMove(r, i, ctx), 1300 * SP);
    else if (!s.online) r.tTimer = setTimeout(() => act(r, i, { type: t.cur > t.bet[i] ? 'fold' : 'check' }, ctx), 15000 * SP);
  }
  function view(r, me) {
    const t = r.t; if (!t || !t.hands) return { variant };
    const mine = me >= 0 && r.phase === 'play' && t.turn === me && canAct(t, me);
    const max = me >= 0 ? t.bet[me] + t.stacks[me] : 0;
    const show = t.result && t.result.show;
    return {
      variant, stacks: t.stacks, bet: t.bet, folded: t.folded, allin: t.allin, in: t.in, board: t.board,
      pot: pot(t), cur: t.cur, button: t.button, turn: t.turn, street: t.street, titles: t.titles,
      hand: me >= 0 ? t.hands[me] : [], counts: t.hands.map(h => h.length),
      shown: show ? Object.fromEntries(live(t).map(i => [i, t.hands[i]])) : null,
      canAct: mine, toCall: mine ? Math.min(t.cur - t.bet[me], t.stacks[me]) : 0,
      minTo: mine ? Math.min(max, t.cur + t.minRaise) : 0, maxTo: max,
      result: t.result,
    };
  }
  return {
    flex: true, min: 2,
    start(r, ctx) { r.t = { stacks: [], titles: [0, 0, 0, 0], button: null }; for (const i of seated(r)) r.t.stacks[i] = START; newHand(r); kick(r, ctx); },
    act, tick, view,
  };
};
module.exports.best = best; module.exports.eval5 = eval5; module.exports.handName = handName;
