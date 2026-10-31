// 성장·나이·드래프트: 경험치와 능력치 성장, 특별 훈련, 시즌 끝 나이·하락·은퇴, 가상 신인 드래프트, 스토브리그와 다음 시즌

// 성장 설정표(밸런스 숫자)
const GROWTH = {
  expPerPA: 1, // 내 경기 타석마다 타자 경험치
  expPerOut: 0.4, // 잡은 아웃마다 투수 경험치
  simBatExp: 4, // 결과 계산 경기에 나간 타자 경험치
  needExp: 30, // 시즌 중 능력치 +1을 노려 보는 데 필요한 경험치(3연전마다 확인)
  ageMul: [
    [23, 0.9], // 23세 이하: 잘 오른다
    [27, 0.6],
    [30, 0.35],
    [99, 0.1], // 31세 이상: 거의 안 오른다
  ],
  gapScale: 25, // 잠재력 − OVR이 이만큼이면 오를 확률 최대(가까워질수록 느려짐)
  trainCost: 1, // 특별 훈련 비용(억)
  trainExp: 40, // 특별 훈련 경험치
  endRate: [
    [23, 0.25, 0.35], // 시즌 끝 성장: (잠재력 − OVR) × 이 범위(나이별)
    [27, 0.15, 0.25],
    [30, 0.05, 0.15],
  ],
  declineFrom: 31, // 이 나이부터 해마다 능력치가 떨어질 수 있음
  declineChance: [0.3, 0.6], // 31~32세, 33세 이상
  retireAge: 37, // 이 나이 이상이면 시즌 끝에 은퇴할 수 있음
  retireBase: 0.25, // 은퇴 확률 = retireBase + (60 − OVR) × retirePerOvr
  retirePerOvr: 0.02,
  rookies: 40, // 드래프트 신인 수
  rookieAge: [18, 22],
  draftRounds: 3,
  draftBonus: [3, 1.5, 0.8], // 라운드별 계약금(억)
  rookieSalary: 0.3, // 신인 연봉(억)
  foundingRookies: 12, // 창단 드래프트(첫 시즌) 신인 수, 팀마다 1명
};

// ---------- 선수 기록(리그 안에서 바뀌는 것) ----------
// 리그 안의 바뀌는 기록(없으면 원래 기록을 복사해서 만든다)
function ensureRec(x) {
  const id = typeof x === 'string' ? x : idOf(x);
  if (!league.recs) league.recs = {};
  if (league.recs[id]) return league.recs[id];
  const base = league.extra && league.extra[id] ? league.extra[id] : recordOf(typeof x === 'string' ? null : x) || KBO_PLAYERS[id];
  if (!base) return null;
  const r = JSON.parse(JSON.stringify(base));
  r.id = id;
  league.recs[id] = r;
  return r;
}
// 경험치
function gainExp(x, n) {
  if (!league || !x || !n) return;
  const r = ensureRec(x);
  if (r) r.exp = (r.exp || 0) + n;
}
// 능력치가 바뀐 기록을 경기용 선수(타순 배열·투수 객체)에 반영
function syncPlayerToGame(r) {
  const all = [...Object.values(league.rosters).flatMap(R => [...R.batters, ...R.pitchers]), ...league.fa];
  all.forEach(x => {
    if (idOf(x) !== r.id) return;
    if (isBatter(x)) {
      x[2] = r.spd;
      x[3] = r.con;
      x[7] = r.pow;
      x[8] = r.def;
    } else {
      const o = kboPitcherObj(r);
      x.cmd = o.cmd;
      x.ars = o.ars;
      x.s = o.s;
    }
  });
}
// 능력치 하나를 올리거나(+1) 내린다(−1). 타자: 컨택·파워·주력·수비, 투수: 구속(km/h)·제구·체력
const ATTR_NAME = { con: '컨택', pow: '파워', spd: '주력', def: '수비', velo: '구속', ctrl: '제구', sta: '체력' };
const attrsOf = r => (r.type === 'B' ? ['con', 'pow', 'spd', 'def'] : ['velo', 'ctrl', 'sta']);
function bumpAttr(r, attr, d) {
  if (attr === 'velo') r.velo = clamp(r.velo + d * 2, 130, 160);
  else r[attr] = clamp(r[attr] + d, 1, 10);
}
// 오를 수 있는 능력치(최대가 아닌 것) 중 하나
function pickAttr(r, focus) {
  const ok = attrsOf(r).filter(a => (a === 'velo' ? r.velo < 160 : r[a] < 10));
  if (focus && ok.includes(focus)) return focus;
  return ok.length ? ok[(rand() * ok.length) | 0] : null;
}
const ageMulOf = age => GROWTH.ageMul.find(([max]) => age <= max)[1];

// ---------- 시즌 중 성장(3연전마다) ----------
// 경험치가 쌓인 선수는 능력치 +1을 노린다(어릴수록, 잠재력까지 멀수록 잘 오른다)
function midSeasonGrowth() {
  const mine = new Set([...LINEUPS.m, ...MY_BENCH, ...PITCHERS].map(idOf));
  Object.values(league.recs || {}).forEach(r => {
    while ((r.exp || 0) >= GROWTH.needExp) {
      r.exp -= GROWTH.needExp;
      const ovr = ovrOf(r),
        p = clamp((r.pot - ovr) / GROWTH.gapScale, 0, 1) * ageMulOf(r.age);
      if (rand() >= p) continue;
      const a = pickAttr(r, r.focus);
      if (!a) continue;
      bumpAttr(r, a, 1);
      r.focus = null;
      syncPlayerToGame(r);
      if (mine.has(r.id)) addNews(`📈 ${r.name} ${ATTR_NAME[a]} +1!`);
    }
  });
}

// ---------- 특별 훈련 ----------
// 3연전마다 한 명: 1억으로 경험치 크게 + 능력치 하나 집중
function trainPlayer(x, attr) {
  if (league.trained === seriesKey()) return '이번 3연전에는 이미 특별 훈련을 했어요';
  if (league.funds[league.my] < GROWTH.trainCost) return '자금이 모자라요';
  const r = ensureRec(x);
  r.exp = (r.exp || 0) + GROWTH.trainExp;
  r.focus = attr;
  league.trained = seriesKey();
  addMoney(league.my, -GROWTH.trainCost, `특별 훈련: ${nameOf(x)} ${ATTR_NAME[attr]}`);
  return `${nameOf(x)} 특별 훈련: ${ATTR_NAME[attr]} 집중 (경험치 +${GROWTH.trainExp})`;
}
// 지금 3연전 표시(특별 훈련은 3연전마다 한 번)
function seriesKey() {
  if (league.phase !== 'reg') return league.phase + (league.season || 1);
  let d = league.day;
  while (d > 0 && league.sched[d][0][2] !== 1) d--;
  return `${league.season || 1}-${d}`;
}

// ---------- 시즌 끝: 나이·성장·하락·은퇴 ----------
function seasonEndAging() {
  const lines = [];
  const mineIds = new Set([...LINEUPS.m, ...MY_BENCH, ...PITCHERS].map(idOf));
  marketPlayers().forEach(({ x, team }) => {
    const r = ensureRec(x);
    if (!r) return;
    const before = ovrOf(r);
    r.age++;
    // 성장: (잠재력 − OVR) × 나이별 비율 × 출전(경험치)
    const rate = GROWTH.endRate.find(([max]) => r.age - 1 <= max);
    if (rate && r.pot > before) {
      const play = clamp(((r.exp || 0) + 40) / 100, 0.3, 1),
        target = before + (r.pot - before) * (rate[1] + rand() * (rate[2] - rate[1])) * play;
      let n = 0;
      while (ovrOf(r) < target && n++ < 12) {
        const a = pickAttr(r);
        if (!a) break;
        bumpAttr(r, a, 1);
      }
    }
    // 하락: 31세부터(33세 이상은 더 자주), 투수는 구속부터
    if (r.age >= GROWTH.declineFrom && rand() < GROWTH.declineChance[r.age >= 33 ? 1 : 0]) {
      const a = r.type === 'P' && rand() < 0.6 ? 'velo' : attrsOf(r)[(rand() * attrsOf(r).length) | 0];
      bumpAttr(r, a, -1);
    }
    r.exp = 0;
    r.pot = Math.max(r.pot, ovrOf(r));
    syncPlayerToGame(r);
    const after = ovrOf(r);
    if (mineIds.has(r.id) && after !== before) lines.push(`${r.name} ${r.age}세 OVR ${before} → ${after}`);
    // 은퇴: 37세 이상, 능력치가 낮을수록 잘
    if (r.age >= GROWTH.retireAge && rand() < clamp(GROWTH.retireBase + (60 - after) * GROWTH.retirePerOvr, 0.05, 0.9)) {
      removeFromTeam(team, x);
      delete league.salary[r.id];
      league.retired = league.retired || [];
      league.retired.push({ n: r.name, team: teamShort(team), age: r.age, ovr: after, season: league.season || 1 });
      lines.push(`👋 ${r.name}(${teamShort(team)}, ${r.age}세) 은퇴`);
      if (team !== 'FA') autoFill(team);
    }
  });
  return lines;
}

// ---------- 신인 ----------
const ROOKIE_NOTES = {
  con: '공을 맞히는 재주가 있다',
  pow: '힘이 좋아 장타가 기대된다',
  spd: '발이 빠르다',
  def: '수비가 안정적이다',
  velo: '공이 빠르다',
  ctrl: '제구가 안정적이다',
  sta: '오래 던질 수 있다',
};
// 가상의 신인 n명(코드로 만든 한국식 이름, 실제 선수와 겹치지 않게)
function makeRookies(n, tag) {
  const r = seededRand(4242 + (league.season || 1) * 97 + (tag === 'F' ? 7 : 0)),
    out = [];
  for (let i = 0; i < n; i++) {
    const id = `R${league.season || 1}${tag}-${i + 1}`,
      name = makeName(r),
      age = ri(r, GROWTH.rookieAge[0], GROWTH.rookieAge[1]),
      bat = r() < 0.6;
    let rec;
    if (bat)
      rec = {
        id, type: 'B', name, name0: name, age, pos: ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'][ri(r, 0, 7)], hand: r() < 0.35 ? 'L' : 'R',
        con: ri(r, 2, 5), pow: ri(r, 2, 5), spd: ri(r, 2, 6), def: ri(r, 2, 5),
      };
    else
      rec = {
        id, type: 'P', name, name0: name, age, hand: r() < 0.3 ? 'L' : 'R', role: r() < 0.5 ? 'SP' : 'RP', slot: ['O', 'O', 'O', 'T', 'S'][ri(r, 0, 4)],
        velo: ri(r, 136, 149), ctrl: ri(r, 2, 5), pitches: ['fast', 'slider', 'curve', 'change', 'fork'].slice(0, ri(r, 2, 3)), sta: ri(r, 3, 6),
      };
    // 잠재력: 대부분 60~75, 아주 드물게 90 이상
    const roll = r();
    rec.pot = roll < 0.04 ? ri(r, 88, 95) : roll < 0.2 ? ri(r, 76, 87) : roll < 0.9 ? ri(r, 60, 75) : ri(r, 50, 59);
    rec.rookie = true;
    rec.school = age <= 19 ? '고교' : '대학';
    // 스카우트 정확도: 보이는 별이 ±1 틀릴 수 있다
    rec.scoutStars = clamp(potStars(rec) + (roll * 7 > 5 ? 1 : roll * 7 < 1.5 ? -1 : 0), 1, 5);
    const best = attrsOf(rec).reduce((a, b) => ((b === 'velo' ? (rec.velo - 130) / 3 : rec[b]) > (a === 'velo' ? (rec.velo - 130) / 3 : rec[a]) ? b : a));
    rec.note = ROOKIE_NOTES[best] + (rec.pot >= 80 ? ', 성장 기대가 크다' : '');
    rec.v = true;
    league.extra[id] = rec;
    out.push(id);
  }
  return out;
}

// ---------- 드래프트 ----------
// 드래프트 시작: 순위 역순(10위가 먼저)으로 라운드마다 한 명씩
function startDraft(rounds, nRookies, tag) {
  const order = rankList().reverse();
  league.draft = { rounds, order, pick: 0, pool: makeRookies(nRookies, tag), log: [] };
}
// 지금 지명할 팀
const draftTeam = () => league.draft && league.draft.pick < league.draft.rounds * league.draft.order.length ? league.draft.order[league.draft.pick % league.draft.order.length] : null;
const draftRound = () => Math.floor(league.draft.pick / league.draft.order.length);
// 신인을 팀에 넣는다(계약금·연봉, 입단 때 몸값)
function draftPick(code, id) {
  const D = league.draft,
    rec = league.extra[id],
    round = draftRound(),
    bonus = GROWTH.draftBonus[round] || GROWTH.draftBonus[GROWTH.draftBonus.length - 1];
  D.pool = D.pool.filter(x => x !== id);
  const x = rec.type === 'B' ? kboBatterRow(rec) : kboPitcherObj(rec);
  addToTeam(code, x);
  if (code === league.my) addMoney(code, -bonus, `신인 계약금: ${rec.name} (${round + 1}라운드)`);
  else league.funds[code] = won1(league.funds[code] - bonus);
  league.salary[id] = GROWTH.rookieSalary;
  rec.v0 = valueOf(rec);
  D.log.push(`${round + 1}R ${teamShort(code)}: ${rec.name}`);
  D.pick++;
  // 컴퓨터 팀은 자리가 넘치면 가장 약한 선수를 방출
  if (code !== league.my)
    while (rosterLimit(code, 0, 0)) {
      const R = league.rosters[code],
        list = rec.type === 'B' ? R.batters : R.pitchers,
        worst = list.reduce((a, y) => (playerCard(y).ovr < playerCard(a).ovr ? y : a));
      removeFromTeam(code, worst);
      addToTeam('FA', worst);
      delete league.salary[idOf(worst)];
    }
}
// 내 차례가 올 때까지 컴퓨터 팀이 지명(잠재력 위주)
function draftRunCpu() {
  let t;
  while ((t = draftTeam()) && t !== league.my) {
    const best = league.draft.pool.reduce((a, id) => (league.extra[id].pot > league.extra[a].pot ? id : a));
    draftPick(t, best);
  }
}
// 드래프트가 끝났는지
const draftDone = () => !league.draft || !draftTeam();

// ---------- 스토브리그와 다음 시즌 ----------
// 시즌이 끝나면(명예의 전당 다음): 나이·성장·은퇴 → FA 시장 → 신인 드래프트
function startOffseason() {
  league.season = league.season || 1;
  league.report = seasonEndAging();
  stoveFreeAgents();
  startDraft(GROWTH.draftRounds, GROWTH.rookies, 'D');
  league.phase = 'stove';
  league.msg = `스토브리그: 성장·나이 결과를 보고, 신인을 뽑고, FA를 데려오세요`;
  saveLeague();
}
// 다음 시즌 시작: 남은 FA는 컴퓨터 팀이 데려가고, 일정·순위·기록을 새로
function startNextSeason() {
  if (!draftDone()) return '신인 드래프트를 먼저 끝내세요';
  const lim = rosterLimit(league.my, 0, 0);
  if (lim) return `선수단을 맞춰 주세요: ${lim}`;
  cpuSignFreeAgents();
  league.season++;
  league.day = 0;
  league.sched = buildSchedule(league.len);
  league.table = Object.fromEntries(KBO_TEAMS.map(t => [t.code, { w: 0, l: 0, d: 0, rs: 0, ra: 0, last: [], streak: 0 }]));
  league.rot = Object.fromEntries(KBO_TEAMS.map(t => [t.code, 0]));
  league.yday = [];
  league.myLog = [];
  league.myStarter = null;
  league.phase = 'reg';
  league.post = null;
  league.draft = null;
  league.report = null;
  league.flow = { in: 0, out: 0 };
  league.finished = false;
  // 새 시즌 연봉(능력이 바뀌었으니 다시)
  Object.values(league.rosters).forEach(R => [...R.batters, ...R.pitchers].forEach(x => (league.salary[idOf(x)] = playerCard(x).salary)));
  ssReset();
  league.msg = `${league.season}번째 시즌 시작!`;
  saveLeague();
  return '';
}

// ---------- 화면 ----------
// 드래프트 화면
function renderDraft() {
  const D = league.draft,
    t = draftTeam();
  $('dfInfo').textContent = t
    ? `${draftRound() + 1}라운드 ${(D.pick % D.order.length) + 1}번째 지명: ${KBO_BY_CODE[t].name}${t === league.my ? ' (내 차례!)' : ''} · 계약금 ${GROWTH.draftBonus[draftRound()]}억`
    : '드래프트가 끝났어요';
  $('dfList').innerHTML = D.pool
    .map(id => league.extra[id])
    .sort((a, b) => b.scoutStars - a.scoutStars || ovrOf(b) - ovrOf(a))
    .map(
      r => `<div class="pl"><b>${r.name} <small>${r.age}세 · ${r.school} · ${r.type === 'B' ? r.pos : r.role === 'SP' ? '선발' : '불펜'}</small></b>
        <span>OVR ${ovrOf(r)} · 잠재력 ${'★'.repeat(r.scoutStars)}${'☆'.repeat(5 - r.scoutStars)} (스카우트 평가) · ${r.note}</span>
        ${t === league.my ? `<button class="df-pick" data-id="${r.id}">지명</button>` : ''}</div>`,
    )
    .join('');
  $('dfLog').innerHTML = D.log
    .slice(-12)
    .reverse()
    .map(l => `<div>${l}</div>`)
    .join('');
}
function openDraft() {
  draftRunCpu();
  renderDraft();
  $('draft').style.display = 'block';
}
$('draft').addEventListener('pointerdown', e => e.stopPropagation());
$('dfList').addEventListener('click', e => {
  const b = e.target.closest('.df-pick');
  if (!b || draftTeam() !== league.my) return;
  draftPick(league.my, b.dataset.id);
  draftRunCpu();
  saveLeague();
  renderDraft();
  renderHub();
});
$('dfClose').addEventListener('click', () => {
  $('draft').style.display = 'none';
  renderHub();
});
// 특별 훈련 화면: 선수와 능력치 고르기
let trainSel = null;
function renderTrain() {
  const mine = [...LINEUPS.m, ...MY_BENCH, ...PITCHERS];
  $('trInfo').textContent = `비용 ${GROWTH.trainCost}억 · 경험치 +${GROWTH.trainExp} · 3연전마다 한 명${league.trained === seriesKey() ? ' (이번 3연전은 이미 했어요)' : ''}`;
  $('trList').innerHTML = mine
    .map(x => {
      const r = recordOf(x),
        c = playerCard(x);
      return `<button class="pl${trainSel === idOf(x) ? ' on' : ''}" data-id="${idOf(x)}"><b>${nameOf(x)} <small>${r.age}세 · OVR ${c.ovr} · ${'★'.repeat(potStars(r))}</small></b><span>경험치 ${Math.floor(r.exp || 0)}/${GROWTH.needExp}${r.focus ? ` · 집중 ${ATTR_NAME[r.focus]}` : ''}</span></button>`;
    })
    .join('');
  const x = mine.find(y => idOf(y) === trainSel);
  $('trAttrs').innerHTML = x
    ? attrsOf(recordOf(x))
        .map(a => `<button data-a="${a}">${ATTR_NAME[a]} ${a === 'velo' ? recordOf(x).velo + 'km' : recordOf(x)[a]}</button>`)
        .join('')
    : '<p class="mk-note">선수를 고르세요</p>';
}
$('train').addEventListener('pointerdown', e => e.stopPropagation());
$('trList').addEventListener('click', e => {
  const b = e.target.closest('.pl');
  if (!b) return;
  trainSel = b.dataset.id;
  renderTrain();
});
$('trAttrs').addEventListener('click', e => {
  const b = e.target.closest('button[data-a]');
  if (!b) return;
  const x = [...LINEUPS.m, ...MY_BENCH, ...PITCHERS].find(y => idOf(y) === trainSel);
  $('trMsg').textContent = trainPlayer(x, b.dataset.a);
  saveLeague();
  renderTrain();
  renderHub();
});
$('trClose').addEventListener('click', () => ($('train').style.display = 'none'));
function openTrain() {
  trainSel = null;
  $('trMsg').textContent = '';
  renderTrain();
  $('train').style.display = 'block';
}
