// Truco Paulista e Mineiro — 4 jogadores, duplas (lugares 1+3 contra 2+4), partida até 12
const ORDER = '4567QJKA23';                 // cartas comuns, da mais fraca para a mais forte
const MSUIT = 'dshc';                       // manilha (paulista): ouros < espadas < copas < paus
const MINEIRO_M = { '4c': 4, '7h': 3, 'As': 2, '7d': 1 }; // manilhas fixas: zap, copas, espadilha, pica-fumo
const CFG = {
  paulista: { base: 1, steps: [3, 6, 9, 12], names: ['Truco', 'Seis', 'Nove', 'Doze'], onze: 11 },
  mineiro: { base: 2, steps: [4, 6, 10, 12], names: ['Truco', 'Seis', 'Dez', 'Doze'], onze: 10 },
};

const SP = process.env.FAST ? 0.01 : 1;     // só para testes automáticos

module.exports = function (variant) {
  const C = CFG[variant];
  const power = (r, c) => variant === 'mineiro'
    ? (MINEIRO_M[c] ? 100 + MINEIRO_M[c] : ORDER.indexOf(c[0]))
    : (c[0] === r.t.manilha ? 100 + MSUIT.indexOf(c[1]) : ORDER.indexOf(c[0]));
  const name = (r, i) => r.seats[i].name;

  function deck() {
    const d = [];
    for (const s of 'hdsc') for (const k of ORDER) d.push(k + s);
    for (let i = d.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }

  function newHand(r) {
    const t = r.t, d = deck();
    r.dealer = r.dealer == null ? Math.random() * 4 | 0 : (r.dealer + 1) % 4;
    t.hands = [0, 1, 2, 3].map(i => d.slice(i * 3, i * 3 + 3));
    if (variant === 'paulista') { t.vira = d[12]; t.manilha = ORDER[(ORDER.indexOf(t.vira[0]) + 1) % 10]; }
    t.hands.forEach(h => h.sort((a, b) => power(r, a) - power(r, b)));
    t.turn = (r.dealer + 1) % 4; t.trick = []; t.R = []; t.value = C.base; t.level = 0;
    t.lastRaise = -1; t.pending = null; t.win = null; t.pause = false; t.result = null; t.ferro = false; t.d11 = null;
    const at = [0, 1].filter(k => t.score[k] === C.onze);
    t.noTruco = at.length > 0;
    if (at.length === 2) { t.ferro = true; t.value = 12; r.phase = 'play'; }      // mão de ferro: vale o jogo
    else if (at.length === 1) { t.d11 = at[0]; r.phase = 'decide11'; }           // mão de onze/dez
    else r.phase = 'play';
    r.hid = (r.hid || 0) + 1;
  }

  // Quem ganha a mão, olhando as vazas (0, 1 ou -1 = cangou). null = continua.
  function decide(R) {
    const c0 = R.filter(x => x === 0).length, c1 = R.filter(x => x === 1).length;
    if (c0 === 2) return 0; if (c1 === 2) return 1;
    if (R.length >= 2) {
      if (R[0] === -1 && R[1] !== -1) return R[1];
      if (R[0] !== -1 && R[1] === -1) return R[0];
    }
    if (R.length === 3) {
      if (R[0] === -1 && R[1] === -1) return R[2];         // tudo empatado = ninguém pontua
      return R[2] !== -1 ? R[2] : R[0];                    // 1x1 e cangou a terceira: vale a primeira
    }
    return null;
  }

  function endHand(r, team, ctx) {
    const t = r.t;
    if (team >= 0) t.score[team] = Math.min(12, t.score[team] + t.value);
    t.result = { team, value: t.value };
    t.pending = null;
    if (t.score.some(x => x >= 12)) { r.phase = 'end'; r.matches[t.score[0] >= 12 ? 0 : 1]++; }
    else r.phase = 'handEnd';
  }

  const canTruco = (r, seat) => {
    const t = r.t;
    return r.phase === 'play' && !t.pause && !t.pending && t.turn === seat && !t.noTruco &&
      t.level < C.steps.length && t.lastRaise !== seat % 2;
  };

  function playCard(r, seat, card, ctx, hidden) {
    const t = r.t;
    t.hands[seat].splice(t.hands[seat].indexOf(card), 1);
    t.trick.push({ seat, card, hidden: !!hidden });
    if (t.trick.length < 4) { t.turn = (seat + 1) % 4; return ctx.push(r); }
    const pw = x => x.hidden ? -1 : power(r, x.card);           // encoberta não ganha de nada
    const best = Math.max(...t.trick.map(pw));
    const top = t.trick.filter(x => pw(x) === best);
    const res = new Set(top.map(x => x.seat % 2)).size > 1 ? -1 : top[0].seat % 2;
    t.R.push(res); t.win = res === -1 ? null : top.find(x => x.seat % 2 === res).seat;
    t.pause = true; ctx.push(r);
    const hid = r.hid, next = top[0].seat;
    setTimeout(() => {
      if (r.hid !== hid || r.phase !== 'play') return;
      t.trick = []; t.pause = false; t.win = null;
      const d = decide(t.R);
      if (d !== null) endHand(r, d, ctx); else t.turn = next;
      ctx.push(r);
    }, 2600 * SP);
  }

  function act(r, seat, m, ctx) {
    const t = r.t; if (!t || seat < 0 || !m) return;
    if (m.type === 'play') {
      if (r.phase !== 'play' || t.pause || t.pending || t.turn !== seat || !t.hands[seat].includes(m.card)) return;
      return playCard(r, seat, m.card, ctx);
    }
    if (m.type === 'cover') {
      if (r.phase !== 'play' || t.pause || t.pending || t.turn !== seat || !t.R.length || !t.hands[seat].includes(m.card)) return;
      ctx.say(r, `${name(r, seat)} jogou encoberta.`);
      return playCard(r, seat, m.card, ctx, true);
    }
    if (m.type === 'truco') {
      if (!canTruco(r, seat)) return;
      t.pending = { team: 1 - seat % 2, by: seat };
      ctx.say(r, `${name(r, seat)}: ${C.names[t.level].toUpperCase()}!`);
      return ctx.push(r);
    }
    if (m.type === 'resp') {
      const p = t.pending; if (!p || seat % 2 !== p.team) return;
      if (m.ans === 'no') {
        ctx.say(r, `${name(r, seat)} correu.`);
        endHand(r, 1 - p.team, ctx);
      } else {
        t.value = C.steps[t.level]; t.level++; t.lastRaise = 1 - p.team; t.pending = null;
        if (m.ans === 'raise' && t.level < C.steps.length) {
          t.pending = { team: 1 - seat % 2, by: seat };
          ctx.say(r, `${name(r, seat)}: ${C.names[t.level].toUpperCase()}!`);
        } else ctx.say(r, `${name(r, seat)} aceitou. Vale ${t.value}.`);
      }
      return ctx.push(r);
    }
    if (m.type === 'd11') {
      if (r.phase !== 'decide11' || seat % 2 !== t.d11) return;
      if (m.ans === 'run') { ctx.say(r, `${name(r, seat)} correu da mão de ${C.onze}.`); t.value = C.base; endHand(r, 1 - t.d11, ctx); }
      else { t.value = C.steps[0]; r.phase = 'play'; ctx.say(r, `Mão de ${C.onze}: vamos jogar! Vale ${t.value}.`); }
      return ctx.push(r);
    }
    if (m.type === 'next') {
      if (r.phase === 'end') t.score = [0, 0];
      if (r.phase === 'handEnd' || r.phase === 'end') { newHand(r); ctx.push(r); }
    }
  }

  // ---------- Bots ----------
  function strength(r, seat) {
    const t = r.t;
    let s = t.hands[seat].reduce((a, c) => { const p = power(r, c); return a + (p >= 100 ? 12 : Math.max(0, p - 4)); }, 0);
    for (const x of t.R) if (x !== -1) s += x === seat % 2 ? 6 : -6;
    return s;
  }
  function botCard(r, seat) {
    const t = r.t, h = [...t.hands[seat]].sort((a, b) => power(r, a) - power(r, b));
    if (!t.trick.length) return t.R.length === 0 && h.length === 3 ? h[1] : h[h.length - 1];
    const best = t.trick.reduce((a, x) => power(r, x.card) > power(r, a.card) ? x : a);
    const bp = power(r, best.card);
    if (best.seat % 2 === seat % 2 && t.trick.filter(x => x.seat % 2 !== seat % 2).every(x => power(r, x.card) < bp)) return h[0];
    return h.find(c => power(r, c) > bp) || h[0];
  }
  function tick(r, ctx) {
    clearTimeout(r.tTimer);
    const t = r.t; if (!t) return;
    const bot = i => r.seats[i].bot || !r.seats[i].online;
    const wait = i => (r.seats[i].bot ? 1500 : 15000);
    const later = (ms, fn) => { r.tTimer = setTimeout(fn, ms * SP); };
    const teamBot = team => [team, team + 2].every(bot);       // sem humano online na dupla
    if (r.phase === 'decide11') {
      if (!teamBot(t.d11)) return;
      const i = t.d11; return later(wait(i), () => act(r, i, { type: 'd11', ans: strength(r, i) + strength(r, i + 2) >= 14 ? 'play' : 'run' }, ctx));
    }
    if (r.phase !== 'play' || t.pause) return;
    if (t.pending) {
      const team = t.pending.team; if (!teamBot(team)) return;
      const i = bot(team) && !r.seats[team].bot ? team + 2 : team;
      const s = strength(r, i);
      const ans = s >= 22 && t.level + 1 < C.steps.length && Math.random() < 0.35 ? 'raise' : s >= 11 || Math.random() < 0.15 ? 'yes' : 'no';
      return later(wait(i), () => act(r, i, { type: 'resp', ans }, ctx));
    }
    const i = t.turn; if (!bot(i)) return;
    later(wait(i), () => {
      const s = strength(r, i);
      if (canTruco(r, i) && (s >= 16 && Math.random() < 0.5 || Math.random() < 0.05)) act(r, i, { type: 'truco' }, ctx);
      else act(r, i, { type: 'play', card: botCard(r, i) }, ctx);
    });
  }

  function view(r, me) {
    const t = r.t; if (!t) return { variant };
    const my = me >= 0 ? me % 2 : -1;
    const p = t.pending;
    return {
      variant, onze: C.onze,
      hand: me >= 0 ? t.hands[me] : [], counts: t.hands.map(h => h.length),
      trick: t.trick.map(x => x.hidden ? { seat: x.seat, card: 'back' } : x), win: t.pause ? t.win : null, last: t.pause ? t.R[t.R.length - 1] : null, R: t.R,
      turn: t.turn, vira: t.vira || null, score: t.score, value: t.value, ferro: t.ferro,
      pending: p && { team: p.team, by: p.by, name: C.names[t.level], value: C.steps[t.level], raise: C.names[t.level + 1] || null },
      callName: C.names[t.level] || null,
      canTruco: me >= 0 && canTruco(r, me),
      canPlay: me >= 0 && r.phase === 'play' && !t.pause && !p && t.turn === me,
      canCover: me >= 0 && r.phase === 'play' && !t.pause && !p && t.turn === me && t.R.length > 0,
      d11: r.phase === 'decide11' ? t.d11 : null,
      partnerHand: r.phase === 'decide11' && my === t.d11 ? t.hands[(me + 2) % 4] : null,
      result: t.result,
    };
  }

  return {
    start(r, ctx) { r.t = { score: [0, 0] }; r.dealer = null; newHand(r); },
    act, tick, view,
  };
};
