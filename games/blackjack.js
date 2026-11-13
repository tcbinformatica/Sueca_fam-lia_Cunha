// Blackjack (21) — 1 a 4 jogadores contra a banca. 6 baralhos, banca para no 17,
// blackjack paga 3:2, dobrar só com 2 cartas. Fichas de brincadeira: quem zera recebe 1.000 de novo.
const SP = process.env.FAST ? 0.01 : 1;
const START = 1000, BETS = [10, 25, 50, 100];
const RK = 'A23456789TJQK', SUITS = 'hdsc';
function shuffle(d) { for (let i = d.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [d[i], d[j]] = [d[j], d[i]]; } return d; }
function total(cs) {
  let s = 0, a = 0;
  for (const c of cs) { if (c[0] === 'A') { a++; s += 11; } else s += 'TJQK'.includes(c[0]) ? 10 : +c[0]; }
  while (s > 21 && a) { s -= 10; a--; }
  return s;
}
const natural = cs => cs.length === 2 && total(cs) === 21;

module.exports = function () {
  const seated = r => r.seats.map((s, i) => s ? i : -1).filter(i => i >= 0);
  function draw(t) { if (t.shoe.length < 60) t.shoe = shuffle([0, 1, 2, 3, 4, 5].flatMap(() => [...SUITS].flatMap(s => [...RK].map(x => x + s)))); return t.shoe.pop(); }

  function newRound(r) {
    const t = r.t;
    for (const i of seated(r)) { if (t.stacks[i] == null) t.stacks[i] = START; if (t.stacks[i] < BETS[0]) { t.stacks[i] = START; t.rebuys[i]++; } }
    t.bets = [0, 0, 0, 0]; t.hands = [[], [], [], []]; t.done = [false, false, false, false];
    t.dealer = []; t.reveal = false; t.result = null; t.turn = -1; t.players = seated(r);
    r.phase = 'bet'; r.hid = (r.hid || 0) + 1;
  }
  function deal(r, ctx) {
    const t = r.t;
    t.players = t.players.filter(i => t.bets[i] > 0);
    for (let k = 0; k < 2; k++) { for (const i of t.players) t.hands[i].push(draw(t)); t.dealer.push(draw(t)); }
    for (const i of t.players) if (natural(t.hands[i])) t.done[i] = true;
    r.phase = 'play';
    if (natural(t.dealer)) { ctx.say(r, 'A banca tem Blackjack!'); return dealerPlay(r, ctx); }
    advance(r, ctx, -1);
  }
  function advance(r, ctx, from) {
    const t = r.t, p = t.players, k = from < 0 ? 0 : p.indexOf(from) + 1;
    const n = p.slice(k).find(i => !t.done[i]);
    if (n === undefined) return dealerPlay(r, ctx);
    t.turn = n;
  }
  function dealerPlay(r, ctx) {
    const t = r.t; t.turn = -1; t.reveal = true; ctx.push(r);
    const anyAlive = t.players.some(i => total(t.hands[i]) <= 21 && !natural(t.hands[i]));
    const hid = r.hid;
    const step = () => {
      if (r.hid !== hid) return;
      if (anyAlive && !natural(t.dealer) && total(t.dealer) < 17) { t.dealer.push(draw(t)); ctx.push(r); return setTimeout(step, 900 * SP); }
      settle(r, ctx); ctx.push(r);
    };
    setTimeout(step, 900 * SP);
  }
  function settle(r) {
    const t = r.t, dv = total(t.dealer), dbj = natural(t.dealer), res = {};
    for (const i of t.players) {
      const h = t.hands[i], pv = total(h), pbj = natural(h), b = t.bets[i];
      let out, back;
      if (pv > 21) { out = 'estourou'; back = 0; }
      else if (pbj && !dbj) { out = 'blackjack'; back = Math.floor(b * 2.5); }
      else if (dbj && !pbj) { out = 'perdeu'; back = 0; }
      else if (pbj && dbj) { out = 'empate'; back = b; }
      else if (dv > 21 || pv > dv) { out = 'ganhou'; back = b * 2; }
      else if (pv === dv) { out = 'empate'; back = b; }
      else { out = 'perdeu'; back = 0; }
      t.stacks[i] += back; res[i] = { out, delta: back - b, total: pv };
    }
    t.result = { res, dealer: dv };
    r.phase = 'handEnd';
  }
  function act(r, seat, m, ctx) {
    const t = r.t; if (!t || seat < 0 || !m) return;
    if (m.type === 'next') { if (r.phase === 'handEnd') { newRound(r); ctx.push(r); } return; }
    if (m.type === 'bet') {
      const b = Number(m.ans);
      if (r.phase !== 'bet' || !t.players.includes(seat) || t.bets[seat] || !BETS.includes(b) || b > t.stacks[seat]) return;
      t.bets[seat] = b; t.stacks[seat] -= b;
      if (t.players.every(i => t.bets[i])) deal(r, ctx);
      return ctx.push(r);
    }
    if (r.phase !== 'play' || t.turn !== seat) return;
    const h = t.hands[seat];
    if (m.type === 'hit') { h.push(draw(t)); if (total(h) >= 21) { t.done[seat] = true; advance(r, ctx, seat); } }
    else if (m.type === 'stand') { t.done[seat] = true; advance(r, ctx, seat); }
    else if (m.type === 'double') {
      if (h.length !== 2 || t.stacks[seat] < t.bets[seat]) return;
      t.stacks[seat] -= t.bets[seat]; t.bets[seat] *= 2; h.push(draw(t)); t.done[seat] = true; advance(r, ctx, seat);
    } else return;
    ctx.push(r);
  }
  function tick(r, ctx) {
    clearTimeout(r.tTimer);
    const t = r.t; if (!t) return;
    const auto = i => r.seats[i] && (r.seats[i].bot || !r.seats[i].online);
    const wait = i => (r.seats[i].bot ? 1200 : 15000) * SP;
    if (r.phase === 'bet') {
      const i = t.players.find(i => !t.bets[i] && auto(i)); if (i === undefined) return;
      r.tTimer = setTimeout(() => act(r, i, { type: 'bet', ans: r.seats[i].bot ? BETS[Math.random() * 3 | 0] : 10 }, ctx), wait(i));
    } else if (r.phase === 'play' && t.turn >= 0 && auto(t.turn)) {
      const i = t.turn;
      r.tTimer = setTimeout(() => {
        if (!r.seats[i].bot) return act(r, i, { type: 'stand' }, ctx);
        const h = t.hands[i], v = total(h), up = total([t.dealer[0]]);
        if (h.length === 2 && (v === 11 || (v === 10 && up < 10)) && t.stacks[i] >= t.bets[i]) return act(r, i, { type: 'double' }, ctx);
        act(r, i, { type: v < 12 || (v < 17 && up >= 7) ? 'hit' : 'stand' }, ctx);   // estratégia básica simplificada
      }, wait(i));
    }
  }
  function view(r, me) {
    const t = r.t; if (!t || !t.hands) return {};
    const mine = me >= 0 && r.phase === 'play' && t.turn === me;
    return {
      stacks: t.stacks, bets: t.bets, rebuys: t.rebuys, players: t.players, turn: t.turn,
      hands: t.hands, totals: t.hands.map(total), hand: me >= 0 ? t.hands[me] : [], counts: t.hands.map(h => h.length),
      dealer: t.reveal ? t.dealer : t.dealer.length ? [t.dealer[0], 'back'] : [],
      dealerTotal: t.reveal ? total(t.dealer) : t.dealer.length ? total([t.dealer[0]]) : 0,
      betOptions: BETS, canBet: me >= 0 && r.phase === 'bet' && t.players.includes(me) && !t.bets[me],
      canHit: mine, canDouble: mine && t.hands[me].length === 2 && t.stacks[me] >= t.bets[me],
      result: t.result,
    };
  }
  return {
    flex: true, min: 1,
    start(r) { r.t = { stacks: [], rebuys: [0, 0, 0, 0], shoe: [] }; r.dealer = null; newRound(r); },
    act, tick, view,
  };
};
