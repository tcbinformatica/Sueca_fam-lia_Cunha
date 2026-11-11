// Buraco fechado — 4 jogadores em duplas (1+3 contra 2+4), 2 baralhos, 11 cartas, morto de 11 por dupla.
// Só sequências do mesmo naipe (mín. 3). O 2 é curinga (no máx. 1 por jogo; o 2 do naipe no lugar dele é natural).
// Lixo: só pega o monte inteiro usando a carta de cima num jogo na hora. Bate só com canastra limpa.
const SP = process.env.FAST ? 0.01 : 1;
const META = 3000;
const NV = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13 };
const SUITS = 'hdsc';
const pts = c => c[0] === 'A' ? 15 : c[0] === '2' ? 10 : NV[c[0]] >= 8 ? 10 : 5;
const sortHand = h => h.sort((a, b) => (a[0] === '2') - (b[0] === '2') || SUITS.indexOf(a[1]) - SUITS.indexOf(b[1]) || NV[a[0]] - NV[b[0]]);
function shuffle(d) { for (let i = d.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [d[i], d[j]] = [d[j], d[i]]; } return d; }

// Valida um jogo (sequência). Devolve { cards em ordem, limpa } ou null.
function valid(cards) {
  if (cards.length < 3) return null;
  const non2 = cards.filter(c => c[0] !== '2'); if (!non2.length) return null;
  const suit = non2[0][1]; if (non2.some(c => c[1] !== suit)) return null;
  const twosS = cards.filter(c => c[0] === '2' && c[1] === suit), twosO = cards.filter(c => c[0] === '2' && c[1] !== suit);
  const aces = non2.filter(c => c[0] === 'A'); if (aces.length > 2) return null;
  const aceOpts = !aces.length ? [[]] : aces.length === 1 ? [[1], [14]] : [[1, 14]];
  let best = null;
  for (const ao of aceOpts) for (let n2 = 0; n2 <= Math.min(1, twosS.length); n2++) {
    let ai = 0; const nat = non2.map(c => ({ c, v: c[0] === 'A' ? ao[ai++] : NV[c[0]] }));
    if (n2) nat.push({ c: twosS[0], v: 2 });
    const wild = [...twosS.slice(n2), ...twosO]; if (wild.length > 1) continue;
    const vs = nat.map(x => x.v).sort((a, b) => a - b);
    if (new Set(vs).size !== vs.length) continue;
    const lo = vs[0], hi = vs[vs.length - 1];
    if ((hi - lo + 1) - vs.length > wild.length) continue;
    const byV = new Map(nat.map(x => [x.v, x.c])), w = [...wild], out = [];
    for (let v = lo; v <= hi; v++) out.push(byV.has(v) ? byV.get(v) : w.shift());
    if (w.length) { if (hi < 14) out.push(w.shift()); else if (lo > 1) out.unshift(w.shift()); else continue; }
    const res = { cards: out, limpa: !wild.length };
    if (!best || (res.limpa && !best.limpa)) best = res;
  }
  return best;
}
const canastra = m => m.cards.length >= 7;

module.exports = function () {
  const team = s => s % 2;
  function newRound(r) {
    const t = r.t;
    t.stock = shuffle([...'01'].flatMap(k => [...SUITS].flatMap(s => Object.keys(NV).map(x => x + s + k))));
    t.hands = [0, 1, 2, 3].map(() => sortHand(t.stock.splice(0, 11)));
    t.mortos = [t.stock.splice(0, 11), t.stock.splice(0, 11)];
    t.got = [false, false]; t.melds = [[], []]; t.discard = [t.stock.pop()];
    r.dealer = r.dealer == null ? Math.random() * 4 | 0 : (r.dealer + 1) % 4;
    t.turn = (r.dealer + 1) % 4; t.step = 'draw'; t.result = null;
    r.phase = 'play'; r.hid = (r.hid || 0) + 1;
  }
  const hasLimpa = (t, k) => t.melds[k].some(m => canastra(m) && m.limpa);
  // Se a mão vai ficar vazia: sem morto ainda, pode (pega o morto); com morto, precisa de canastra limpa.
  const emptyOk = (t, seat) => !t.got[team(seat)] || hasLimpa(t, team(seat));
  function onEmpty(r, seat, ctx, byDiscard) {
    const t = r.t, k = team(seat);
    if (!t.got[k]) {
      t.got[k] = true; t.hands[seat] = sortHand(t.mortos[k]); t.mortos[k] = [];
      ctx.say(r, `💀 ${r.seats[seat].name} pegou o morto!`);
      return false;
    }
    endRound(r, seat, ctx); return true;
  }
  function endRound(r, bateu, ctx) {
    const t = r.t, parts = [0, 1].map(k => {
      const mesa = t.melds[k].reduce((a, m) => a + m.cards.reduce((b, c) => b + pts(c), 0), 0);
      const bonus = t.melds[k].reduce((a, m) => a + (canastra(m) ? (m.limpa ? 200 : 100) : 0), 0) + (bateu >= 0 && team(bateu) === k ? 100 : 0);
      const mao = -[k, k + 2].reduce((a, i) => a + t.hands[i].reduce((b, c) => b + pts(c), 0), 0);
      const morto = t.got[k] ? 0 : -100;
      return { mesa, bonus, mao, morto, total: mesa + bonus + mao + morto };
    });
    parts.forEach((p, k) => t.total[k] += p.total);
    t.result = { bateu, parts };
    if (bateu >= 0) ctx.say(r, `🏁 ${r.seats[bateu].name} bateu!`); else ctx.say(r, 'Acabou o monte!');
    if (t.total.some(x => x >= META)) { r.phase = 'end'; r.matches[t.total[0] >= t.total[1] ? 0 : 1]++; } else r.phase = 'handEnd';
  }
  const takeFrom = (h, cards) => { for (const c of cards) h.splice(h.indexOf(c), 1); };
  const own = (h, cards) => Array.isArray(cards) && cards.length && new Set(cards).size === cards.length && cards.every(c => h.includes(c));

  function act(r, seat, m, ctx) {
    const t = r.t; if (!t || seat < 0 || !m) return;
    if (m.type === 'next') {
      if (r.phase === 'end') t.total = [0, 0];
      if (r.phase === 'handEnd' || r.phase === 'end') { newRound(r); ctx.push(r); } return;
    }
    if (r.phase !== 'play' || t.turn !== seat) return;
    const h = t.hands[seat], k = team(seat);
    if (m.type === 'draw' && t.step === 'draw') {
      if (!t.stock.length) { endRound(r, -1, ctx); return ctx.push(r); }
      h.push(t.stock.pop()); sortHand(h); t.step = 'meld'; return ctx.push(r);
    }
    if (m.type === 'take' && t.step === 'draw' && t.discard.length) {
      const sel = Array.isArray(m.cards) ? m.cards : [];
      if (sel.length && !own(h, sel)) return;
      const top = t.discard[t.discard.length - 1];
      let done = false;
      if (sel.length >= 2) { const v = valid([top, ...sel]); if (v) { t.melds[k].push(v); done = true; } }
      if (!done) for (let i = 0; i < t.melds[k].length && !done; i++) {
        const v = valid([...t.melds[k][i].cards, top, ...sel]); if (v) { t.melds[k][i] = v; done = true; }
      }
      if (!done) return 'Para pegar o lixo, use a carta de cima num jogo (selecione as cartas que combinam com ela).';
      takeFrom(h, sel); t.discard.pop(); h.push(...t.discard); t.discard = []; sortHand(h); t.step = 'meld';
      if (!h.length) onEmpty(r, seat, ctx);
      return ctx.push(r);
    }
    if (t.step !== 'meld') return;
    if (m.type === 'meld' || m.type === 'add') {
      if (!own(h, m.cards)) return;
      const tgt = m.type === 'add' ? t.melds[k][m.meld] : null; if (m.type === 'add' && !tgt) return;
      const v = valid(tgt ? [...tgt.cards, ...m.cards] : m.cards);
      if (!v) return m.type === 'add' ? 'Essas cartas não encaixam nesse jogo.' : 'Jogo inválido: precisa de sequência do mesmo naipe (mín. 3, até 1 curinga).';
      if (h.length === m.cards.length) {
        const after = t.melds[k].map((x, i) => i === m.meld && tgt ? v : x).concat(tgt ? [] : [v]);
        if (t.got[k] && !after.some(x => canastra(x) && x.limpa)) return 'Para bater precisa de uma canastra limpa.';
      }
      if (tgt) t.melds[k][m.meld] = v; else t.melds[k].push(v);
      takeFrom(h, m.cards);
      if (!h.length) onEmpty(r, seat, ctx);
      return ctx.push(r);
    }
    if (m.type === 'play' && h.includes(m.card)) {
      if (h.length === 1 && !emptyOk(t, seat)) return 'Para bater precisa de uma canastra limpa.';
      takeFrom(h, [m.card]); t.discard.push(m.card);
      if (!h.length && onEmpty(r, seat, ctx, true)) return ctx.push(r);
      t.turn = (seat + 1) % 4; t.step = 'draw'; return ctx.push(r);
    }
  }

  // ---------- Bots ----------
  function runs(h) {                                 // sequências naturais na mão
    const out = [];
    for (const s of SUITS) {
      const cs = h.filter(c => c[1] === s && c[0] !== '2');
      const byV = new Map(); for (const c of cs) { byV.set(NV[c[0]], c); if (c[0] === 'A') byV.set(14, c); }
      let cur = [];
      for (let v = 1; v <= 15; v++) {
        if (byV.has(v) && !(v === 14 && cur.includes(byV.get(v)))) cur.push(byV.get(v));
        else { if (cur.length >= 3) out.push(cur); cur = []; }
      }
    }
    return out;
  }
  function botMelds(r, seat, ctx) {
    const t = r.t, k = team(seat);
    for (let guard = 0; guard < 30 && r.phase === 'play' && t.turn === seat; guard++) {
      const h = t.hands[seat]; let did = false;
      for (const run of runs(h)) {
        const use = h.length - run.length >= 1 || emptyOk(t, seat) ? run : run.slice(0, Math.max(0, h.length - 1));
        if (use.length >= 3 && act(r, seat, { type: 'meld', cards: use }, ctx) === undefined && !h.includes(use[0])) { did = true; break; }
      }
      if (did) continue;
      for (const c of [...h]) {
        if (c[0] === '2' || (h.length === 1 && !emptyOk(t, seat))) continue;
        const i = t.melds[k].findIndex(m => { const v = valid([...m.cards, c]); return v && (v.limpa || !m.limpa); });
        if (i >= 0 && act(r, seat, { type: 'add', meld: i, cards: [c] }, ctx) === undefined && !h.includes(c)) { did = true; break; }
      }
      if (!did && h.some(c => c[0] === '2') && h.length > 1) {   // curinga para fechar canastra
        const w = h.find(c => c[0] === '2');
        const i = t.melds[k].findIndex(m => m.cards.length === 6 && valid([...m.cards, w]));
        if (i >= 0 && act(r, seat, { type: 'add', meld: i, cards: [w] }, ctx) === undefined) did = true;
      }
      if (!did) break;
    }
  }
  function worst(r, seat) {
    const t = r.t, h = t.hands[seat], opp = t.melds[1 - team(seat)];
    const score = c => {
      if (c[0] === '2') return 100;
      let s = 0;
      for (const x of h) if (x !== c && x[1] === c[1] && x[0] !== '2') { const d = Math.abs(NV[x[0]] - NV[c[0]]); if (d === 1) s += 4; else if (d === 2) s += 2; if (d === 0) s -= 1; }
      if (opp.some(m => valid([...m.cards, c]))) s += 8;     // não alimentar o adversário
      return s;
    };
    return [...h].sort((a, b) => score(a) - score(b) || pts(b) - pts(a))[0];
  }
  function tick(r, ctx) {
    clearTimeout(r.tTimer);
    const t = r.t; if (!t || r.phase !== 'play') return;
    const i = t.turn, s = r.seats[i]; if (!(s.bot || !s.online)) return;
    r.tTimer = setTimeout(() => {
      const h = t.hands[i], k = team(i);
      if (t.step === 'draw') {
        const top = t.discard[t.discard.length - 1];
        if (top && top[0] !== '2') {
          if (t.melds[k].some(m => valid([...m.cards, top]))) { if (act(r, i, { type: 'take', cards: [] }, ctx) === undefined) return; }
          for (let a = 0; a < h.length; a++) for (let b = a + 1; b < h.length; b++) {
            const v = valid([top, h[a], h[b]]);
            if (v && v.limpa && act(r, i, { type: 'take', cards: [h[a], h[b]] }, ctx) === undefined) return;
          }
        }
        return act(r, i, { type: 'draw' }, ctx);
      }
      botMelds(r, i, ctx);
      if (r.phase === 'play' && t.turn === i && t.hands[i].length) act(r, i, { type: 'play', card: worst(r, i) }, ctx);
    }, (s.bot ? 1400 : 15000) * SP);
  }
  function view(r, me) {
    const t = r.t; if (!t) return {};
    const mine = me >= 0 && r.phase === 'play' && t.turn === me;
    return {
      hand: me >= 0 ? t.hands[me] : [], counts: t.hands.map(h => h.length), stock: t.stock.length,
      top: t.discard[t.discard.length - 1] || null, lixo: t.discard.length,
      melds: t.melds, got: t.got, mortos: t.mortos.map(x => x.length), turn: t.turn, step: t.step,
      canDraw: mine && t.step === 'draw', canMeld: mine && t.step === 'meld',
      total: t.total, meta: META, result: t.result,
    };
  }
  return {
    start(r) { r.t = { total: [0, 0] }; r.dealer = null; newRound(r); },
    act, tick, view,
  };
};
module.exports.valid = valid;
