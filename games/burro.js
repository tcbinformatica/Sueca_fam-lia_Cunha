// Burro — 2 a 4 jogadores, baralho de 52, 5 cartas na mão.
// Quem começa a vaza joga qualquer carta; os outros seguem o naipe. Quem não tem o naipe compra do monte
// até achar (monte vazio: joga qualquer carta, que não ganha). A maior do naipe leva e começa a próxima.
// Quem fica sem cartas sai; o último com cartas é o BURRO.
const SP = process.env.FAST ? 0.01 : 1;
const RK = '23456789TJQKA';                 // do mais fraco para o mais forte
const SUITS = 'hdsc';
const str = c => RK.indexOf(c[0]);
const sortHand = h => h.sort((a, b) => SUITS.indexOf(a[1]) - SUITS.indexOf(b[1]) || str(a) - str(b));
function shuffle(d) { for (let i = d.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [d[i], d[j]] = [d[j], d[i]]; } return d; }

module.exports = function () {
  const players = r => r.seats.map((s, i) => s ? i : -1).filter(i => i >= 0);
  const withCards = r => players(r).filter(i => r.t.hands[i].length);
  const after = (r, i, list) => { const p = players(r); for (let k = 1; k <= 4; k++) { const j = p[(p.indexOf(i) + k) % p.length]; if (list.includes(j)) return j; } return -1; };

  function newRound(r) {
    const t = r.t, p = players(r);
    t.stock = shuffle([...SUITS].flatMap(s => [...RK].map(x => x + s)));
    t.hands = [[], [], [], []];
    for (const i of p) t.hands[i] = sortHand(t.stock.splice(0, 5));
    r.dealer = r.dealer == null ? p[Math.random() * p.length | 0] : after(r, r.dealer, p);
    t.out = []; t.result = null; t.win = null; t.pause = false;
    startTrick(r, after(r, r.dealer, p));
    r.phase = 'play'; r.hid = (r.hid || 0) + 1;
  }
  function startTrick(r, leader) {
    const t = r.t, need = withCards(r), p = players(r);
    t.trick = []; t.need = []; // ordem de quem joga esta vaza, a partir de quem começa
    for (let k = 0; k < p.length; k++) { const j = p[(p.indexOf(leader) + k) % p.length]; if (need.includes(j)) t.need.push(j); }
    t.turn = t.need[0];
  }
  function legal(r, seat) {
    const t = r.t, h = t.hands[seat];
    if (!t.trick.length) return h;
    const f = h.filter(c => c[1] === t.trick[0].card[1]);
    return f.length ? f : (t.stock.length ? [] : h);   // [] = precisa comprar
  }
  function resolve(r, ctx) {
    const t = r.t, lead = t.trick[0].card[1];
    const w = t.trick.filter(x => x.card[1] === lead).reduce((a, x) => str(x.card) > str(a.card) ? x : a);
    t.win = w.seat; t.pause = true; ctx.push(r);
    const hid = r.hid;
    setTimeout(() => {
      if (r.hid !== hid) return;
      t.pause = false; t.win = null;
      const left = withCards(r);
      if (left.length <= 1) {
        const burro = left.length ? left[0] : t.trick[t.trick.length - 1].seat;   // ninguém sobrou: o último a sair é o burro
        t.burros[burro]++; t.result = { burro, out: t.out.slice() };
        t.trick = []; r.phase = 'handEnd';
        ctx.say(r, `🫏 ${r.seats[burro].name} é o burro!`);
      } else startTrick(r, left.includes(w.seat) ? w.seat : after(r, w.seat, left));
      ctx.push(r);
    }, 2200 * SP);
  }
  function act(r, seat, m, ctx) {
    const t = r.t; if (!t || seat < 0 || !m) return;
    if (m.type === 'next') { if (r.phase === 'handEnd') { newRound(r); ctx.push(r); } return; }
    if (r.phase !== 'play' || t.pause || t.turn !== seat) return;
    if (m.type === 'draw') {
      if (legal(r, seat).length || !t.stock.length) return;
      t.hands[seat].push(t.stock.pop()); sortHand(t.hands[seat]); return ctx.push(r);
    }
    if (m.type === 'play') {
      if (!legal(r, seat).includes(m.card)) return;
      t.hands[seat].splice(t.hands[seat].indexOf(m.card), 1);
      t.trick.push({ seat, card: m.card });
      if (!t.hands[seat].length) { t.out.push(seat); ctx.say(r, `${r.seats[seat].name} saiu!`); }
      const k = t.need.indexOf(seat);
      if (k === t.need.length - 1) return resolve(r, ctx);
      t.turn = t.need[k + 1]; return ctx.push(r);
    }
  }
  function tick(r, ctx) {
    clearTimeout(r.tTimer);
    const t = r.t; if (!t || r.phase !== 'play' || t.pause) return;
    const i = t.turn, s = r.seats[i]; if (!(s.bot || !s.online)) return;
    r.tTimer = setTimeout(() => {
      const L = legal(r, i);
      if (!L.length) return act(r, i, { type: 'draw' }, ctx);
      const byStr = [...L].sort((a, b) => str(a) - str(b));
      const follow = t.trick.length && L[0][1] === t.trick[0].card[1];
      act(r, i, { type: 'play', card: follow ? byStr[byStr.length - 1] : byStr[0] }, ctx);
    }, (s.bot ? 1100 : 15000) * SP);
  }
  function view(r, me) {
    const t = r.t; if (!t) return {};
    const mine = me >= 0 && r.phase === 'play' && !t.pause && t.turn === me;
    const L = mine ? legal(r, me) : [];
    return {
      hand: me >= 0 ? t.hands[me] : [], counts: t.hands.map(h => h.length), stock: t.stock.length,
      trick: t.trick, turn: t.turn, win: t.pause ? t.win : null, legal: L, canPlay: L.length > 0,
      mustDraw: mine && !L.length, out: t.out, burros: t.burros, result: t.result,
    };
  }
  return {
    flex: true,
    start(r) { r.t = { burros: [0, 0, 0, 0] }; r.dealer = null; newRound(r); },
    act, tick, view,
  };
};
