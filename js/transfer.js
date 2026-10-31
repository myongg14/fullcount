// 이적: 팀별 선수단(타자 12명·투수 5명), 트레이드·자유계약(FA), 타순·선발 투수 바꾸기, 선수단 저장

// 이적 설정표
const TRADE_TUNING = {
  perSeason: 3, // 시즌당 이적(트레이드+FA) 횟수
  closeAfter: 7, // 이 경기를 마친 뒤부터 이적 마감(8경기째부터)
  acceptRatio: 0.95, // 주는 몸값이 받는 몸값의 이 비율 이상이면 수락
  closeRatio: 0.8, // 이 비율 이상이면 '조금 더 필요해요'
  maxBatters: 16, // 한 팀 최대 타자 수
  maxPitchers: 12, // 한 팀 최대 투수 수
  minBatters: 9, // 한 팀 최소 타자 수(타순 9명)
  minPitchers: 3, // 한 팀 최소 투수 수
};

// ---------- 선수 표시(id) ----------
// 타자는 [이름, 포지션, 주력, 컨택, 좌우타, id, 원래 이름], 투수는 PITCHERS 형식 + id, n0(원래 이름)
LINEUPS.m.forEach((p, i) => ((p[5] = 'm' + (i + 1)), (p[6] = p[0])));
LINEUPS.o.forEach((p, i) => ((p[5] = 'o' + (i + 1)), (p[6] = p[0])));
PITCHERS.forEach((P, i) => ((P.id = 'p' + (i + 1)), (P.n0 = P.n)));
// 내 팀 후보 타자
let MY_BENCH = MY_BENCH_DATA.map((p, i) => [...p, 'mb' + (i + 1), p[0]]);
// 선수별 핫/콜드 존(이적해도 그 선수를 따라간다)
const HZ = {};
LINEUPS.m.forEach((p, i) => (HZ[p[5]] = HOT_ZONES.m[i]));
LINEUPS.o.forEach((p, i) => (HZ[p[5]] = HOT_ZONES.o[i]));
const hzOf = p => HZ[p[5]] || (HZ[p[5]] = hotZoneProfile(p[6] || p[0]));
// 타순이 바뀌면 핫존도 맞춘다
function refreshHotZones() {
  HOT_ZONES.m = LINEUPS.m.map(hzOf);
  HOT_ZONES.o = LINEUPS.o.map(hzOf);
}
// 처음 상대(한 경기 모드)
const ORIG_O = LINEUPS.o;
const clone = x => JSON.parse(JSON.stringify(x));
// 처음 선수단(되돌리기용)
const DEFAULT_MY = { lineup: clone(LINEUPS.m), bench: clone(MY_BENCH), pitchers: clone(PITCHERS) };

// ---------- 상대 팀 선수단 만들기(코드로 만든 가상의 선수, 항상 같은 결과) ----------
// 우리만의 무작위 수(게임의 무작위와 따로, 씨앗이 같으면 항상 같은 선수)
function seededRand(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SURNAMES = '김이박최정강조윤장임한오서신권황안송류홍전고문양손배백허유남심노하곽성차주우구민진'.split('');
const GIVEN = '민준서도현우지훈성재영호진수태윤석경동찬규원상혁기철승용준희범광일선태한결빈웅'.split('');
const usedNames = new Set(
  [...LINEUPS.m, ...LINEUPS.o, ...MY_BENCH]
    .map(p => p[0])
    .concat(PITCHERS.map(P => P.n), Object.values(KBO_PLAYERS).map(p => p.name0)),
);
// 겹치지 않는 가상의 이름
function makeName(r) {
  for (;;) {
    const n = SURNAMES[(r() * SURNAMES.length) | 0] + GIVEN[(r() * GIVEN.length) | 0] + GIVEN[(r() * GIVEN.length) | 0];
    if (!usedNames.has(n) && n[1] !== n[2]) {
      usedNames.add(n);
      return n;
    }
  }
}
const ri = (r, a, b) => a + ((r() * (b - a + 1)) | 0);
const BAT_POS = ['CF', 'SS', '2B', '1B', 'DH', 'LF', '3B', 'RF', 'C', 'C', '3B', 'CF'];
// 타자 한 명(st: 팀 강점)
function makeBatter(r, pos, id, st, boost) {
  const n = makeName(r);
  return [n, pos, clamp(ri(r, 2, 8) + st.spd + boost, 1, 10), clamp(ri(r, 3, 8) + st.con + boost, 1, 10), r() < 0.3 ? 'L' : 'R', id, n];
}
// 투구폼별 구종 후보 [종류, 이름, 비행 시간, 구속 범위]
const PITCH_MENU = {
  slider: ['슬라이더', 980, [128, 139]],
  curve: ['커브', 1150, [106, 118]],
  change: ['체인지업', 1250, [122, 132]],
  sinker: ['싱커', 930, [134, 144]],
  fork: ['포크', 1200, [128, 138]],
};
const SLOT_TEXT = ['오버핸드', '사이드암', '언더핸드', '서브마린'];
const SLOT_CY = [2.05, 1.85, 1.6, 1.35];
// 투수 한 명
function makePitcher(r, id, st, boost) {
  const n = makeName(r),
    slot = [0, 0, 0, 0, 1, 2, 3][ri(r, 0, 6)],
    hand = r() < 0.25 ? 'L' : 'R',
    top = ri(r, 140, 152) + st.velo + boost * 2 - [0, 3, 12, 15][slot],
    kinds = Object.keys(PITCH_MENU).sort(() => r() - 0.5).slice(0, ri(r, 2, 3)),
    ars = [pitchDef('fast', '직구', 850, [top - 10, top])].concat(
      kinds.map(k => pitchDef(k, PITCH_MENU[k][0], PITCH_MENU[k][1], PITCH_MENU[k][2].map(v => v + st.velo - [0, 3, 10, 12][slot]))),
    );
  return {
    n,
    n0: n,
    id,
    hand,
    cmd: clamp((ri(r, 52, 80) + st.cmd + boost * 3) / 100, 0.45, 0.88),
    s: `${SLOT_TEXT[slot]} · ${ars[1].n}`,
    slot,
    cy: SLOT_CY[slot],
    ars,
  };
}
// 시즌 상대 팀(SEASON_OPPS 순서)의 KBO 팀 코드
const oppCode = t => (KBO_TEAMS.find(k => k.name === SEASON_OPPS[t].n) || KBO_TEAMS[t + 1]).code;
// 시즌 상대 팀 9개 선수단: kbo-data.js의 실제 KBO 선수(타자 14명: 앞 9명이 타순, 투수 10명: 앞 5명이 선발)
function buildOppRosters() {
  return SEASON_OPPS.map((o, t) => ({
    batters: kboBatters(oppCode(t)).map(kboBatterRow),
    pitchers: kboPitchers(oppCode(t)).map(kboPitcherObj),
  }));
}// 자유계약(FA) 선수 4명: 어느 팀에도 없는 선수(능력이 조금 좋다)
function buildFaPool() {
  const r = seededRand(77031),
    st = { spd: 0, con: 0, cmd: 0, velo: 0 };
  return [makeBatter(r, 'CF', 'fa1', st, 1), makeBatter(r, '1B', 'fa2', st, 1), makePitcher(r, 'fa3', st, 1), makePitcher(r, 'fa4', st, 1)];
}
let OPP_ROSTERS = buildOppRosters();
let FA_POOL = buildFaPool();
// 이번 시즌 이적 횟수와 FA 영입 여부
let tradesUsed = 0;
let faUsed = false;

// ---------- 선수단 저장·불러오기 ----------
// 지금 선수단 전체(저장용)
function rosterState() {
  return {
    v: 2, // 2: 상대 팀이 실제 KBO 선수단
    my: { lineup: LINEUPS.m, bench: MY_BENCH, pitchers: PITCHERS, cur: curPitcher },
    opp: OPP_ROSTERS,
    fa: FA_POOL,
    used: tradesUsed,
    faUsed,
  };
}
// 저장해 둔 선수단을 게임에 반영한다
function applyRosterState(s) {
  if (!s || !(s.v === 1 || s.v === 2) || !s.my || s.my.lineup.length < 9 || !s.my.pitchers.length) return;
  LINEUPS.m = s.my.lineup;
  MY_BENCH = s.my.bench || [];
  PITCHERS.splice(0, PITCHERS.length, ...s.my.pitchers);
  // 예전(가상 선수) 저장의 상대 팀은 버리고 KBO 선수단으로
  if (s.v === 2 && s.opp && s.opp.length === SEASON_OPPS.length) OPP_ROSTERS = s.opp;
  if (s.v === 2 && s.fa) FA_POOL = s.fa;
  tradesUsed = s.used || 0;
  faUsed = !!s.faUsed;
  [...LINEUPS.m, ...MY_BENCH, ...OPP_ROSTERS.flatMap(t => t.batters), ...FA_POOL.filter(Array.isArray)].forEach(p =>
    usedNames.add(p[0]),
  );
  curPitcher = clamp(s.my.cur || 0, 0, PITCHERS.length - 1);
  moundPitcher = null;
  setMound(PITCHERS[curPitcher]);
  refreshHotZones();
}
// 시즌이 끝나면 선수단을 따로 기억(다음 시즌 '선수단 유지'용)
const ROSTER_KEY = 'nb3_roster';
function keepRoster() {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(rosterState()));
  } catch (e) {}
}
// 처음 선수단과 달라졌는지
function rosterChanged() {
  const ids = a => a.map(p => (Array.isArray(p) ? p[5] : p.id)).join();
  return ids(LINEUPS.m.concat(MY_BENCH)) !== ids(DEFAULT_MY.lineup.concat(DEFAULT_MY.bench)) || ids(PITCHERS) !== ids(DEFAULT_MY.pitchers);
}
// 처음 선수단으로 되돌린다(내 팀·상대 팀 모두)
function resetRoster() {
  LINEUPS.m = clone(DEFAULT_MY.lineup);
  MY_BENCH = clone(DEFAULT_MY.bench);
  PITCHERS.splice(0, PITCHERS.length, ...clone(DEFAULT_MY.pitchers));
  OPP_ROSTERS = buildOppRosters();
  curPitcher = 0;
  moundPitcher = null;
  setMound(PITCHERS[0]);
  refreshHotZones();
  try {
    localStorage.removeItem(ROSTER_KEY);
  } catch (e) {}
  if (typeof applyTeam === 'function') applyTeam(loadTeam()); // 팀 편집 이름 다시 적용
}
// 새 시즌: 이적 횟수 초기화, FA 다시(이미 어느 팀에 있는 선수는 빼고)
function newSeasonMarket() {
  tradesUsed = 0;
  faUsed = false;
  const onTeam = new Set([...LINEUPS.m, ...MY_BENCH].map(p => p[5]).concat(PITCHERS.map(P => P.id)));
  OPP_ROSTERS.forEach(t => (t.batters.forEach(p => onTeam.add(p[5])), t.pitchers.forEach(P => onTeam.add(P.id))));
  FA_POOL = buildFaPool().filter(x => !onTeam.has(Array.isArray(x) ? x[5] : x.id));
}
// 경기 시작 때 상대 선수단: 시즌이면 그 팀 타순·투수진, 아니면 예전 상대
function applyOppRoster() {
  if (isSeason) {
    const t = OPP_ROSTERS[(seasonGame - 1) % OPP_ROSTERS.length];
    LINEUPS.o = t.batters.slice(0, 9);
    cpuStaff = t.pitchers;
    // 선발 로테이션: 선발(SP) 투수들이 경기마다 차례로
    const sp = cpuStaff.map((P, i) => i).filter(i => cpuStaff[i].role !== 'RP');
    cpuIdx = sp.length ? sp[(seasonGame - 1) % sp.length] : (seasonGame - 1) % cpuStaff.length;
  } else {
    LINEUPS.o = ORIG_O;
    cpuStaff = null;
  }
  refreshHotZones();
}
// 처음 켤 때: 진행 중인 시즌 또는 지난 시즌 선수단을 불러온다
{
  let s = null;
  try {
    const save = JSON.parse(localStorage.getItem('nb3_season'));
    s = (save && save.roster) || JSON.parse(localStorage.getItem(ROSTER_KEY));
  } catch (e) {}
  if (s) applyRosterState(s);
}

// ---------- 몸값 ----------
const isBatter = x => Array.isArray(x);
const topSpeed = P => Math.max(...P.ars.map(a => a.v[1]));
// 몸값(억 원): economy.js의 계산(OVR·나이·시즌 성적·포지션)
const playerValue = x => playerCard(x).value;
// 능력치 글자
const abilityText = x =>
  isBatter(x)
    ? `${x[1]} · 컨택 ${x[3]} · 주력 ${x[2]} · ${x[4] === 'L' ? '좌타' : '우타'}`
    : `${x.hand === 'L' ? '좌완' : '우완'} ${SLOT_TEXT[x.slot] || ''} · 제구 ${Math.round(x.cmd * 100)} · 최고 ${topSpeed(x)}km`;
// 시즌 기록 글자(내 선수만)
function recordText(x) {
  if (isBatter(x)) {
    const s = seasonStats.b[x[5]];
    return s && s.ab ? `타율 ${(s.h / s.ab).toFixed(3).replace(/^0/, '')} · ${s.hr}홈런` : '기록 없음';
  }
  const s = seasonStats.p[x.id];
  return s && s.g ? `${s.w}승 · ${s.k}탈삼진` : '기록 없음';
}
const nameOf = x => (isBatter(x) ? x[0] : x.n);
const idOf = x => (isBatter(x) ? x[5] : x.id);

// ---------- 트레이드 ----------
// 이적할 수 있는지(남은 횟수, 마감)
function marketOpen() {
  if (!isSeason) return '시즌 중에만 이적할 수 있어요';
  if (seasonGame > TRADE_TUNING.closeAfter) return `이적 마감(${TRADE_TUNING.closeAfter}경기 이후)`;
  if (tradesUsed >= TRADE_TUNING.perSeason) return `이번 시즌 이적 ${TRADE_TUNING.perSeason}번을 다 썼어요`;
  return '';
}
// 팀 선수단 묶음: { batters, pitchers, lineup(타순 9명 배열, 내 팀은 LINEUPS.m) }
const mySide = () => ({ lineup: LINEUPS.m, bench: MY_BENCH, pitchers: PITCHERS });
const oppSide = t => ({ lineup: null, roster: OPP_ROSTERS[t], pitchers: OPP_ROSTERS[t].pitchers });
// 트레이드 판단: give(내 선수 1~2명) ↔ get(상대 선수 1명). 결과 { ok, msg }
function judgeTrade(team, give, get) {
  const closed = marketOpen();
  if (closed) return { ok: false, msg: closed };
  if (!give.length || give.length > 2 || !get) return { ok: false, msg: '내 선수 1~2명과 상대 선수 1명을 골라요' };
  const R = OPP_ROSTERS[team],
    T = TRADE_TUNING;
  // 상대 팀에 꼭 필요한 포지션(포수가 1명뿐)은 내주지 않는다
  if (isBatter(get) && get[1] === 'C' && R.batters.filter(p => p[1] === 'C').length <= 1)
    return { ok: false, msg: '거절 · 우리 팀 포수가 1명뿐이라 안 돼요' };
  // 선수 수 확인
  const gB = give.filter(isBatter).length,
    gP = give.length - gB,
    myB = LINEUPS.m.length + MY_BENCH.length - gB + (isBatter(get) ? 1 : 0),
    myP = PITCHERS.length - gP + (isBatter(get) ? 0 : 1),
    thB = R.batters.length + gB - (isBatter(get) ? 1 : 0),
    thP = R.pitchers.length + gP - (isBatter(get) ? 0 : 1);
  if (myB < T.minBatters || myP < T.minPitchers) return { ok: false, msg: `우리 팀 선수가 모자라요(타자 ${T.minBatters}명·투수 ${T.minPitchers}명 이상)` };
  if (myB > T.maxBatters || myP > T.maxPitchers) return { ok: false, msg: '우리 팀 자리가 꽉 찼어요' };
  if (thB < T.minBatters || thP < T.minPitchers) return { ok: false, msg: '거절 · 우리 팀 선수가 모자라져요' };
  if (thB > T.maxBatters || thP > T.maxPitchers) return { ok: false, msg: '거절 · 우리 팀 자리가 꽉 찼어요' };
  const gv = give.reduce((s, x) => s + playerValue(x), 0),
    rv = playerValue(get);
  if (gv >= rv * T.acceptRatio) return { ok: true, msg: `수락! (주는 몸값 ${gv} · 받는 몸값 ${rv})` };
  if (gv >= rv * T.closeRatio) return { ok: false, msg: `거절 · 조금 더 필요해요 (${gv} / ${rv})` };
  return { ok: false, msg: `거절 · 몸값 차이가 너무 커요 (${gv} / ${rv})` };
}
// 내 팀에서 선수 x를 빼고, 빈 타순 자리는 들어오는 타자 → 후보 순서로 채운다
function removeFromMine(x, incoming) {
  if (!isBatter(x)) {
    const i = PITCHERS.indexOf(x);
    PITCHERS.splice(i, 1);
    if (curPitcher >= PITCHERS.length || curPitcher === i) curPitcher = 0;
    else if (i < curPitcher) curPitcher--;
    return;
  }
  const li = LINEUPS.m.indexOf(x);
  if (li >= 0) {
    // 타순에 있던 선수: 들어오는 타자가 있으면 그 자리, 없으면 같은 포지션 후보 → 아무 후보
    let sub = incoming && isBatter(incoming) && !LINEUPS.m.includes(incoming) ? incoming : null;
    if (!sub) sub = MY_BENCH.find(p => p[1] === x[1]) || MY_BENCH[0];
    MY_BENCH = MY_BENCH.filter(p => p !== sub);
    LINEUPS.m[li] = sub;
  } else MY_BENCH = MY_BENCH.filter(p => p !== x);
}
// 상대 팀에서 선수 x를 빼고, 빈 타순 자리(앞 9명)는 들어오는 선수로
function swapInOpp(R, x, incomingBatters, incomingPitchers) {
  if (isBatter(x)) {
    const i = R.batters.indexOf(x);
    if (incomingBatters.length) R.batters[i] = incomingBatters.shift();
    else R.batters.splice(i, 1);
  } else R.pitchers.splice(R.pitchers.indexOf(x), 1);
  R.batters.push(...incomingBatters);
  R.pitchers.push(...incomingPitchers);
}
// 트레이드 실행
function doTrade(team, give, get) {
  const R = OPP_ROSTERS[team];
  give.forEach(x => removeFromMine(x, get));
  if (isBatter(get)) {
    if (!LINEUPS.m.includes(get)) MY_BENCH.push(get);
  } else PITCHERS.push(get);
  swapInOpp(R, get, give.filter(isBatter), give.filter(x => !isBatter(x)));
  tradesUsed++;
  seasonStats.trades.push(`${seasonGame}경기 전 · ${give.map(nameOf).join('·')} ↔ ${SEASON_OPPS[team].s} ${nameOf(get)}`);
  afterRosterChange();
}
// FA 영입(시즌당 1명, 이적 횟수에 포함)
function signFa(x) {
  const closed = marketOpen();
  if (closed) return { ok: false, msg: closed };
  if (faUsed) return { ok: false, msg: 'FA는 시즌당 1명만 데려올 수 있어요' };
  if (isBatter(x) ? LINEUPS.m.length + MY_BENCH.length >= TRADE_TUNING.maxBatters : PITCHERS.length >= TRADE_TUNING.maxPitchers)
    return { ok: false, msg: '우리 팀 자리가 꽉 찼어요' };
  FA_POOL = FA_POOL.filter(y => y !== x);
  if (isBatter(x)) MY_BENCH.push(x);
  else PITCHERS.push(x);
  faUsed = true;
  tradesUsed++;
  seasonStats.trades.push(`${seasonGame}경기 전 · FA 영입 ${nameOf(x)}`);
  afterRosterChange();
  return { ok: true, msg: `${nameOf(x)} 영입!` };
}
// 선수단이 바뀐 뒤: 핫존·투수 버튼·마운드·저장
function afterRosterChange() {
  refreshHotZones();
  moundPitcher = null;
  setMound(PITCHERS[curPitcher]);
  renderPitcherButtons();
  $('sw').textContent = '🔄 ' + PITCHERS[curPitcher].n;
  saveSeason();
  updateSeasonModal();
}

// ---------- 이적 시장 화면 ----------
const market = { team: 0, give: [], get: null, msg: '' };
// 선수 한 줄
function playerRow(x, on, mine) {
  return `<button class="pl${on ? ' on' : ''}" data-id="${idOf(x)}">
    <b>${nameOf(x)}</b><span>${abilityText(x)}</span><span>OVR ${playerCard(x).ovr} · ${mine || (isBatter(x) ? seasonStats.b[x[5]] : seasonStats.p[x.id]) ? recordText(x) + ' · ' : ''}몸값 <i>${playerValue(x)}억</i></span></button>`;
}
// 이적 시장 그리기
function renderMarket() {
  const closed = marketOpen(),
    isFa = market.team === 'fa';
  $('mkTabs').innerHTML =
    SEASON_OPPS.map((o, t) => `<button data-t="${t}" class="${market.team === t ? 'on' : ''}">${o.s}</button>`).join('') +
    `<button data-t="fa" class="${isFa ? 'on' : ''}">FA</button>`;
  const mine = [...LINEUPS.m, ...MY_BENCH, ...PITCHERS];
  $('mkMine').innerHTML = isFa
    ? '<p class="mk-note">FA는 내 선수를 주지 않고 데려와요(시즌당 1명)</p>'
    : mine.map(x => playerRow(x, market.give.includes(x), true)).join('');
  const theirs = isFa ? FA_POOL : [...OPP_ROSTERS[market.team].batters, ...OPP_ROSTERS[market.team].pitchers];
  $('mkTheirs').innerHTML =
    (isFa ? '' : `<p class="mk-note">${SEASON_OPPS[market.team].n} · 연고지 ${KBO_BY_CODE[oppCode(market.team)].city}</p>`) +
    (theirs.length ? theirs.map(x => playerRow(x, market.get === x, false)).join('') : '<p class="mk-note">남은 선수가 없어요</p>');
  const gv = market.give.reduce((s, x) => s + playerValue(x), 0);
  $('mkSum').textContent = isFa
    ? market.get
      ? `${nameOf(market.get)} 영입 · 몸값 ${playerValue(market.get)}억`
      : 'FA 선수를 골라요'
    : `주는 몸값 ${gv}억${market.get ? ' · 받는 몸값 ' + playerValue(market.get) + '억' : ''}`;
  $('mkGo').textContent = isFa ? '영입' : '제안';
  $('mkGo').disabled = !!closed;
  $('mkInfo').textContent = closed || `남은 이적 ${TRADE_TUNING.perSeason - tradesUsed}번${faUsed ? ' · FA 영입 완료' : ''}`;
  $('mkMsg').textContent = market.msg;
}
function openMarket() {
  market.give = [];
  market.get = null;
  market.msg = '';
  renderMarket();
  $('market').style.display = 'block';
}
$('market').addEventListener('pointerdown', e => e.stopPropagation());
$('mkTabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  market.team = b.dataset.t === 'fa' ? 'fa' : Number(b.dataset.t);
  market.give = market.team === 'fa' ? [] : market.give;
  market.get = null;
  market.msg = '';
  renderMarket();
});
$('mkMine').addEventListener('click', e => {
  const b = e.target.closest('.pl');
  if (!b) return;
  const x = [...LINEUPS.m, ...MY_BENCH, ...PITCHERS].find(y => idOf(y) === b.dataset.id);
  if (market.give.includes(x)) market.give = market.give.filter(y => y !== x);
  else if (market.give.length < 2) market.give.push(x);
  else market.msg = '내 선수는 2명까지 고를 수 있어요';
  renderMarket();
});
$('mkTheirs').addEventListener('click', e => {
  const b = e.target.closest('.pl');
  if (!b) return;
  const list = market.team === 'fa' ? FA_POOL : [...OPP_ROSTERS[market.team].batters, ...OPP_ROSTERS[market.team].pitchers];
  const x = list.find(y => idOf(y) === b.dataset.id);
  market.get = market.get === x ? null : x;
  market.msg = '';
  renderMarket();
});
$('mkGo').addEventListener('click', () => {
  if (market.team === 'fa') {
    if (!market.get) return;
    market.msg = signFa(market.get).msg;
    market.get = null;
  } else {
    const r = judgeTrade(market.team, market.give, market.get);
    market.msg = r.msg;
    if (r.ok) {
      doTrade(market.team, market.give, market.get);
      market.give = [];
      market.get = null;
    }
  }
  renderMarket();
});
$('mkClose').addEventListener('click', () => ($('market').style.display = 'none'));

// ---------- 타순 바꾸기 화면 ----------
let lineupPick = -1; // 탭해서 바꾸기: 먼저 고른 줄
// 타순(1~9)과 후보, 선발 투수를 그린다
function renderLineup() {
  const all = [...LINEUPS.m, ...MY_BENCH];
  $('luRows').innerHTML = all
    .map(
      (p, i) =>
        `${i === 9 ? '<p class="mk-note">후보</p>' : ''}<div class="lu-row${i === lineupPick ? ' on' : ''}" data-i="${i}"><span class="lu-no">${i < 9 ? i + 1 : '-'}</span><b>${p[0]}</b><span>${p[1]}</span><span>${abilityText(p).split(' · ').slice(1).join(' · ')}</span></div>`,
    )
    .join('');
  // 포지션이 겹치면 경고(DH 제외)
  const seen = {},
    dup = [];
  LINEUPS.m.forEach(p => {
    if (p[1] !== 'DH' && seen[p[1]] && !dup.includes(p[1])) dup.push(p[1]);
    seen[p[1]] = 1;
  });
  $('luWarn').textContent = dup.length ? `⚠ 포지션이 겹쳐요: ${dup.join(', ')}` : '';
  $('luPitchers').innerHTML = PITCHERS.map(
    (P, i) => `<button data-i="${i}" class="${i === curPitcher ? 'on' : ''}">${P.n}<small>${abilityText(P)}</small></button>`,
  ).join('');
}
// 두 줄(타순·후보)의 선수를 맞바꾼다
function swapLineup(a, b) {
  if (a === b) return;
  const all = [...LINEUPS.m, ...MY_BENCH];
  [all[a], all[b]] = [all[b], all[a]];
  LINEUPS.m = all.slice(0, 9);
  MY_BENCH = all.slice(9);
  refreshHotZones();
  renderLineup();
}
function openLineup() {
  lineupPick = -1;
  renderLineup();
  $('lineup').style.display = 'block';
}
$('lineup').addEventListener('pointerdown', e => e.stopPropagation());
// 끌어서 바꾸기: 줄을 누른 채 다른 줄 위에서 떼면 맞바꾼다. 그냥 탭 두 번으로도 바꿀 수 있다
{
  let drag = null;
  $('luRows').addEventListener('pointerdown', e => {
    const row = e.target.closest('.lu-row');
    if (!row) return;
    e.preventDefault();
    drag = { from: Number(row.dataset.i), x: e.clientX, y: e.clientY, moved: false };
    try {
      $('luRows').setPointerCapture(e.pointerId);
    } catch (_) {}
    row.classList.add('drag');
  });
  $('luRows').addEventListener('pointermove', e => {
    if (drag && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12) drag.moved = true;
  });
  $('luRows').addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag;
    drag = null;
    const el = document.elementFromPoint(e.clientX, e.clientY),
      row = el && el.closest && el.closest('.lu-row');
    if (d.moved) {
      if (row) swapLineup(d.from, Number(row.dataset.i));
      else renderLineup();
      lineupPick = -1;
      return;
    }
    // 탭: 첫 탭은 고르고, 두 번째 탭에서 맞바꾼다
    if (lineupPick < 0) lineupPick = d.from;
    else {
      const a = lineupPick;
      lineupPick = -1;
      swapLineup(a, d.from);
    }
    renderLineup();
  });
}
$('luPitchers').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  selectPitcher(Number(b.dataset.i), false);
  renderLineup();
});
$('luDone').addEventListener('click', () => {
  $('lineup').style.display = 'none';
  if (isSeason) saveSeason();
});

// ---------- 두 가지 중 고르기 창 ----------
let choiceCb = null;
function askChoice(title, text, labels, cb) {
  $('chTitle').textContent = title;
  $('chText').textContent = text;
  $('chA').textContent = labels[0];
  $('chB').textContent = labels[1];
  choiceCb = cb;
  $('choice').style.display = 'flex';
}
$('choice').addEventListener('pointerdown', e => e.stopPropagation());
['chA', 'chB'].forEach((id, k) =>
  $(id).addEventListener('click', () => {
    $('choice').style.display = 'none';
    const cb = choiceCb;
    choiceCb = null;
    if (cb) cb(k);
  }),
);
// 페넌트레이스 창 버튼
$('btn-market').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  openMarket();
});
$('btn-lineup').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  openLineup();
});
