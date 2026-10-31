// 선수단: 선수 id·핫존, 한 경기 모드 상대 선수단, 선수단 저장, 선수 정보 글자, 타순 바꾸기 화면, 두 가지 중 고르기 창

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
const SLOT_TEXT = ['오버핸드', '사이드암', '언더핸드', '서브마린'];
// 시즌 상대 팀(SEASON_OPPS 순서)의 KBO 팀 코드
const oppCode = t => (KBO_TEAMS.find(k => k.name === SEASON_OPPS[t].n) || KBO_TEAMS[t + 1]).code;
// 시즌 상대 팀 9개 선수단: kbo-data.js의 실제 KBO 선수(타자 14명: 앞 9명이 타순, 투수 10명: 앞 5명이 선발)
function buildOppRosters() {
  return SEASON_OPPS.map((o, t) => ({
    batters: kboBatters(oppCode(t)).map(kboBatterRow),
    pitchers: kboPitchers(oppCode(t)).map(kboPitcherObj),
  }));
}let OPP_ROSTERS = buildOppRosters();

// ---------- 선수단 저장·불러오기 ----------
// 지금 선수단 전체(저장용)
function rosterState() {
  return {
    v: 2, // 2: 상대 팀이 실제 KBO 선수단
    my: { lineup: LINEUPS.m, bench: MY_BENCH, pitchers: PITCHERS, cur: curPitcher },
    opp: OPP_ROSTERS,
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
  [...LINEUPS.m, ...MY_BENCH, ...OPP_ROSTERS.flatMap(t => t.batters)].forEach(p =>
    usedNames.add(p[0]),
  );
  curPitcher = clamp(s.my.cur || 0, 0, PITCHERS.length - 1);
  moundPitcher = null;
  setMound(PITCHERS[curPitcher]);
  refreshHotZones();
}
const ROSTER_KEY = 'nb3_roster';
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
  // 리그: 고른 투수를 오늘 선발로, 타순을 리그 선수단에 저장
  if (league) {
    league.myStarter = PITCHERS[curPitcher].id;
    saveLeague();
    renderHub();
  } else if (isSeason) saveSeason();
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
