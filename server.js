// Sueca online para amigos — servidor (Node + Socket.IO)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.static(__dirname + '/public'));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ---------- Regras ----------
const RANKS = 'A7KJQ65432';               // do mais forte para o mais fraco
const PTS = { A: 11, '7': 10, K: 4, J: 3, Q: 2 };
const SUITS = 'hdsc';                     // copas, ouros, espadas, paus
const BOT_NAMES = ['Bot Zé', 'Bot Maria', 'Bot Tonho', 'Bot Lia'];
const str = c => 9 - RANKS.indexOf(c[0]);
const pts = c => PTS[c[0]] || 0;
const sortFn = (a, b) => SUITS.indexOf(a[1]) - SUITS.indexOf(b[1]) || str(b) - str(a);

const rooms = {}, where = {};             // where[pid] = código da sala

function newDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push(r + s);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
function newCode() { let c; do c = Math.random().toString(36).slice(2, 6).toUpperCase(); while (rooms[c] || c.length < 4); return c; }
const clean = n => String(n || '').trim().slice(0, 14) || 'Jogador';
const beats = (a, b, trump) => a[1] === b[1] ? str(a) > str(b) : a[1] === trump;
function winnerOf(trick, trump) { let w = trick[0]; for (const t of trick) if (beats(t.card, w.card, trump)) w = t; return w; }
function legal(r, seat) {
  const h = r.hands[seat];
  if (!r.trick.length) return h;
  const f = h.filter(c => c[1] === r.trick[0].card[1]);
  return f.length ? f : h;
}

// ---------- Bot ----------
function botCard(r, seat) {
  const L = legal(r, seat);
  const low = [...L].sort((a, b) => pts(a) - pts(b) || str(a) - str(b));
  if (!r.trick.length) return low.find(c => c[1] !== r.trump) || low[0];
  const w = winnerOf(r.trick, r.trump);
  const trickPts = r.trick.reduce((a, t) => a + pts(t.card), 0);
  if (w.seat % 2 === seat % 2) {          // parceiro ganhando
    if (r.trick.length === 3) {
      const nt = L.filter(c => c[1] !== r.trump);
      return (nt.length ? nt : L).sort((a, b) => pts(b) - pts(a))[0];
    }
    return low[0];
  }
  const wins = L.filter(c => winnerOf([...r.trick, { seat, card: c }], r.trump).seat === seat)
    .sort((a, b) => (a[1] === r.trump) - (b[1] === r.trump) || str(a) - str(b));
  if (wins.length && (trickPts > 0 || r.trick.length === 3 || wins[0][1] !== r.trump)) return wins[0];
  return low[0];
}

// ---------- Fluxo do jogo ----------
function deal(r) {
  const d = newDeck();
  r.dealer = r.dealer == null ? Math.random() * 4 | 0 : (r.dealer + 1) % 4;
  r.hands = [0, 1, 2, 3].map(i => d.slice(i * 10, i * 10 + 10));
  r.trumpCard = r.hands[r.dealer][9];     // última carta do dador é o trunfo
  r.trump = r.trumpCard[1];
  r.hands.forEach(h => h.sort(sortFn));
  r.turn = (r.dealer + 1) % 4;
  r.trick = []; r.pts = [0, 0]; r.phase = 'play'; r.result = null; r.pause = false;
  r.renounces = []; r.judged = false; r.falseAcc = [false, false]; r.hid = (r.hid || 0) + 1;
}
function play(r, seat, card) {
  if (r.phase !== 'play' || r.pause || r.turn !== seat || !r.hands[seat].includes(card)) return;
  // Renúncia liberada, como na mesa: só é punida se alguém acusar
  for (const x of r.renounces) if (x.seat === seat && x.suit === card[1] && !x.exposed) { x.exposed = true; botsNotice(r, seat); }
  if (!legal(r, seat).includes(card)) r.renounces.push({ seat, suit: r.trick[0].card[1], exposed: false });
  r.hands[seat].splice(r.hands[seat].indexOf(card), 1);
  r.trick.push({ seat, card });
  if (r.trick.length < 4) { r.turn = (seat + 1) % 4; return push(r); }
  const w = winnerOf(r.trick, r.trump).seat;
  r.pts[w % 2] += r.trick.reduce((a, t) => a + pts(t.card), 0);
  r.pause = true; r.turn = w; r.win = w; push(r);
  const hid = r.hid;
  setTimeout(() => {
    if (r.hid !== hid || r.phase !== 'play') return;
    r.trick = []; r.pause = false; r.win = null;
    if (!r.hands[0].length) endHand(r);
    push(r);
  }, 3300);                               // tempo para ver a vaza e contar os pontos
}
function closeHand(r) {                  // 4 pontos fecha a partida e soma no placar geral
  if (r.games.some(x => x >= 4)) { r.phase = 'end'; r.matches[r.games[0] >= 4 ? 0 : 1]++; }
  else r.phase = 'handEnd';
}
function endHand(r) {
  const [a, b] = r.pts, m = r.mult; let t = -1, g = 0, band = false;
  if (a !== b) { t = a > b ? 0 : 1; const p = r.pts[t]; band = p === 120; g = (band ? 4 : p >= 91 ? 2 : 1) * m; r.mult = 1; }
  else r.mult *= 2;                        // empate 60 x 60: a próxima mão vale dobrado
  if (t >= 0) r.games[t] += g;
  r.result = { team: t, g, pts: r.pts.slice(), band, m };
  closeHand(r);
}
function say(r, text) { r.msg = { id: Date.now() + Math.random(), text }; }
function botsNotice(r, offender) {           // bots adversários às vezes percebem a renúncia
  const hid = r.hid;
  r.seats.forEach((s, i) => {
    if (s.bot && i % 2 !== offender % 2 && Math.random() < 0.6)
      setTimeout(() => { if (r.hid === hid) accuse(r, i); }, 2000 + Math.random() * 3000);
  });
}
function accuse(r, seat) {
  if (!(r.phase === 'play' || r.phase === 'handEnd') || r.judged || seat < 0) return;
  const team = seat % 2, acc = r.seats[seat].name;
  const off = r.renounces.find(x => x.seat % 2 !== team);
  if (off) {
    if (r.phase === 'handEnd' && r.result.team >= 0) r.games[r.result.team] -= r.result.g;
    clearTimeout(r.timer); r.trick = []; r.pause = false; r.judged = true;
    r.games[team] += 4; r.mult = 1;
    const ren = r.seats[off.seat].name;
    r.result = { team, g: 4, pts: r.pts.slice(), renuncia: ren, acc };
    closeHand(r);
    say(r, `🚨 ${acc} acusou renúncia de ${ren}. Correto! +4 jogos`);
  } else {
    if (r.falseAcc[team]) return;
    r.falseAcc[team] = true; r.games[1 - team] += 1;
    say(r, `${acc} acusou renúncia, mas não houve. +1 jogo para a outra dupla`);
    if (r.games[1 - team] >= 4) { clearTimeout(r.timer); r.judged = true; r.result = { team: 1 - team, g: 1, pts: r.pts.slice(), falsa: acc }; closeHand(r); }
  }
  push(r);
}
function tick(r) {
  clearTimeout(r.timer);
  if (r.phase !== 'play' || r.pause) return;
  const s = r.seats[r.turn];
  if (s.bot || !s.online)                 // bot joga; humano offline vira bot após 15s
    r.timer = setTimeout(() => play(r, r.turn, botCard(r, r.turn)), s.bot ? 1500 : 15000);
}
function view(r, pid) {
  const me = r.seats.findIndex(s => s && s.pid === pid);
  const inGame = r.phase !== 'lobby';
  return {
    code: r.code, me, host: r.host === pid, phase: r.phase,
    seats: r.seats.map(s => s && { name: s.name, bot: !!s.bot, online: !!(s.bot || s.online) }),
    hand: inGame ? r.hands[me] : [], counts: inGame ? r.hands.map(h => h.length) : [],
    legal: r.phase === 'play' && r.turn === me && !r.pause ? r.hands[me] : [],
    canAccuse: me >= 0 && (r.phase === 'play' || r.phase === 'handEnd') && !r.judged && !r.falseAcc[me % 2],
    msg: r.msg,
    trump: r.trump, trumpCard: r.trumpCard, dealer: r.dealer, turn: r.turn,
    trick: r.trick, win: r.pause ? r.win : null, mult: r.mult, games: r.games, matches: r.matches, result: r.result,
  };
}
function push(r) {
  for (const s of r.seats) if (s && !s.bot && s.sid) io.to(s.sid).emit('state', view(r, s.pid));
  tick(r);
}

// ---------- Conexões ----------
io.on('connection', sock => {
  let pid = null;
  const room = () => rooms[where[pid]];
  const seatOf = r => r.seats.findIndex(s => s && s.pid === pid);

  function leave() {
    const r = room(); if (!r) return;
    const i = seatOf(r);
    r.seats[i] = r.phase === 'lobby' ? null : { pid: 'bot' + i, name: BOT_NAMES[i], bot: true };
    delete where[pid];
    const humans = r.seats.filter(s => s && !s.bot);
    if (!humans.length) { clearTimeout(r.timer); delete rooms[r.code]; return; }
    if (r.host === pid) r.host = humans[0].pid;
    push(r);
  }

  sock.on('hello', p => {
    pid = String((p && p.pid) || '').slice(0, 40);
    const r = room(); if (!r) return sock.emit('state', null);
    const s = r.seats[seatOf(r)]; s.sid = sock.id; s.online = true; push(r);
  });
  sock.on('create', ({ name } = {}) => {
    if (!pid) return; leave();
    const c = newCode();
    rooms[c] = { code: c, host: pid, phase: 'lobby', games: [0, 0], matches: [0, 0], mult: 1, trick: [], dealer: null,
      seats: [{ pid, name: clean(name), sid: sock.id, online: true }, null, null, null] };
    where[pid] = c; push(rooms[c]);
  });
  sock.on('join', ({ name, code } = {}) => {
    if (!pid) return;
    const r = rooms[String(code || '').toUpperCase().trim()];
    if (!r) return sock.emit('err', 'Sala não encontrada');
    if (where[pid] === r.code) return push(r);
    let i = r.phase === 'lobby' ? r.seats.findIndex(s => !s) : -1;
    if (i < 0) i = r.seats.findIndex(s => s && s.bot);   // entra no lugar de um bot
    if (i < 0) return sock.emit('err', 'Sala cheia');
    leave();
    r.seats[i] = { pid, name: clean(name), sid: sock.id, online: true };
    where[pid] = r.code; push(r);
  });
  sock.on('sit', ({ seat } = {}) => {
    const r = room(); if (!r || r.phase !== 'lobby' || r.seats[seat] !== null) return;
    const i = seatOf(r); r.seats[seat] = r.seats[i]; r.seats[i] = null; push(r);
  });
  sock.on('bot', ({ seat } = {}) => {
    const r = room(); if (!r || r.host !== pid || r.phase !== 'lobby' || !(seat >= 0 && seat < 4)) return;
    const s = r.seats[seat];
    if (!s) r.seats[seat] = { pid: 'bot' + seat, name: BOT_NAMES[seat], bot: true };
    else if (s.bot) r.seats[seat] = null;
    push(r);
  });
  sock.on('start', () => {
    const r = room(); if (!r || r.host !== pid || r.phase !== 'lobby') return;
    r.seats = r.seats.map((s, i) => s || { pid: 'bot' + i, name: BOT_NAMES[i], bot: true });
    deal(r); push(r);
  });
  sock.on('play', ({ card } = {}) => { const r = room(); if (r) play(r, seatOf(r), card); });
  sock.on('next', () => {
    const r = room(); if (!r) return;
    if (r.phase === 'end') r.games = [0, 0];
    if (r.phase === 'handEnd' || r.phase === 'end') { deal(r); push(r); }
  });
  sock.on('accuse', () => { const r = room(); if (r) accuse(r, seatOf(r)); });
  sock.on('rtc', m => {                     // sinalização da câmera (WebRTC)
    const r = room(); if (!r || !m) return;
    const s = r.seats[m.to]; if (s && !s.bot && s.sid) io.to(s.sid).emit('rtc', { ...m, from: seatOf(r) });
  });
  sock.on('leave', () => { leave(); sock.emit('state', null); });
  sock.on('disconnect', () => {
    const r = room(); if (!r) return;
    const s = r.seats[seatOf(r)]; if (s && s.sid === sock.id) { s.online = false; push(r); }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Sueca rodando na porta ' + PORT));
