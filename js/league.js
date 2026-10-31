// KBO 리그: 내 팀 고르기, 3연전 일정, 다른 경기 결과 계산, 순위표, 포스트시즌(5위까지), 리그 화면, 저장

// 리그 설정표
const LEAGUE = {
  // 시즌 길이: 팀마다 상대 9팀과 붙는 시리즈 길이 목록(3 = 3연전, 2 = 2연전)
  lengths: {
    short: { label: '짧게 27경기', series: [3] },
    normal: { label: '보통 54경기', series: [3, 3] },
    full: { label: '정식 144경기', series: [3, 3, 3, 3, 2, 2] },
  },
  defaultLength: 'short',
  homeEdge: 0.03, // 홈 팀 승리 확률 보너스(+3%)
  winPerOvr: 0.012, // 팀 능력(OVR) 1 차이당 승리 확률 변화
  baseRuns: 5.4, // 기본 득점(타선과 상대 선발 차이로 늘고 줄어 평균 4~5점)
  runsPerOvr: 0.06, // 타선 OVR − 상대 선발 OVR 1당 평균 득점 변화
  maxRuns: 12, // 한 경기 최대 점수(다른 경기 계산)
  drawChance: 0.012, // 무승부(12회까지 동점) 확률
  postTeams: 5, // 포스트시즌 진출 팀 수
  minAbPerGame: 2.5, // 타율 타이틀 규정 타석: 경기 수 × 이 값
  minOutsPerGame: 2.4, // 평균자책 타이틀 규정 이닝: 경기 수 × 이 값(아웃)
};
// 포스트시즌 라운드: 이름, 이겨야 하는 경기 수, 높은 순위 팀이 안고 시작하는 승
const POST_ROUNDS = [
  { label: '와일드카드 결정전', need: 2, head: 1 },
  { label: '준플레이오프', need: 3, head: 0 },
  { label: '플레이오프', need: 3, head: 0 },
  { label: '한국시리즈', need: 4, head: 0 },
];
const LEAGUE_KEY = 'nb3_league';
// 지금 리그(null = 리그 밖). 저장되는 모든 진행 상황이 여기에 있다
let league = null;

// ---------- 일정 ----------
// 라운드 로빈(원형 방식): 10팀이 9라운드 동안 한 번씩 만난다. 라운드마다 5쌍 [홈, 원정]
function roundRobin(codes) {
  const t = codes.slice(),
    rounds = [];
  for (let r = 0; r < t.length - 1; r++) {
    const pairs = [];
    for (let k = 0; k < t.length / 2; k++) {
      const a = t[k],
        b = t[t.length - 1 - k];
      // 홈/원정이 고르게 돌아가도록
      pairs.push((r + k) % 2 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    t.splice(1, 0, t.pop()); // 첫 팀은 고정, 나머지를 한 칸씩 돌린다
  }
  return rounds;
}
// 시즌 일정: 날마다 5경기 [홈, 원정, 시리즈 몇 번째 경기, 시리즈 길이]
function buildSchedule(len) {
  const rounds = roundRobin(KBO_TEAMS.map(t => t.code)),
    days = [];
  LEAGUE.lengths[len].series.forEach((n, cycle) => {
    rounds.forEach(pairs => {
      for (let g = 1; g <= n; g++)
        days.push(pairs.map(([h, a]) => (cycle % 2 ? [a, h, g, n] : [h, a, g, n]))); // 다음 바퀴는 홈/원정을 바꾼다
    });
  });
  return days;
}

// ---------- 새 리그·저장 ----------
// 팀 선수단(KBO 데이터에서): 타자 14명(앞 9명 타순), 투수 10명(앞 5명 선발)
const freshRoster = code => ({ batters: kboBatters(code).map(kboBatterRow), pitchers: kboPitchers(code).map(kboPitcherObj) });
function newLeague(my, len) {
  const codes = KBO_TEAMS.map(t => t.code);
  league = {
    v: 1,
    my,
    len,
    day: 0,
    sched: buildSchedule(len),
    table: Object.fromEntries(codes.map(c => [c, { w: 0, l: 0, d: 0, rs: 0, ra: 0, last: [], streak: 0 }])),
    rot: Object.fromEntries(codes.map(c => [c, 0])),
    rosters: Object.fromEntries(codes.map(c => [c, freshRoster(c)])),
    yday: [],
    myLog: [],
    myStarter: null,
    phase: 'reg',
    post: null,
    msg: '',
  };
  ssReset();
  gameOuts = {};
  initFunds();
  initMarket();
  league.season = 1;
  startDraft(1, GROWTH.foundingRookies, 'F'); // 창단 드래프트(팀마다 신인 1명)
  [...league.rosters[my].batters, ...league.rosters[my].pitchers].forEach(x => (ensureRec(x).v0 = playerCard(x).value)); // 입단 때 몸값
}
function saveLeague() {
  if (!league) return;
  syncMyRoster();
  try {
    localStorage.setItem(LEAGUE_KEY, leagueSaveText());
  } catch (e) {
    // 저장 공간이 모자라면 오래된 기록을 줄여서 다시
    trimLeague(true);
    try {
      localStorage.setItem(LEAGUE_KEY, JSON.stringify({ league, stats: seasonStats }));
    } catch (e2) {
      league.msg = '⚠️ 기기 저장 공간이 모자라 저장하지 못했어요';
    }
  }
  renderLeagueButton();
}
function loadLeagueSave() {
  try {
    const s = JSON.parse(localStorage.getItem(LEAGUE_KEY));
    return s && s.league && s.league.v === 1 && s.league.sched ? s : null;
  } catch (e) {
    return null;
  }
}
function clearLeagueSave() {
  try {
    localStorage.removeItem(LEAGUE_KEY);
  } catch (e) {}
  renderLeagueButton();
}
// 타이틀의 '시즌 이어하기' 버튼(저장된 리그가 있을 때만)
function renderLeagueButton() {
  const s = loadLeagueSave();
  $('btn-cont').style.display = s ? 'inline-block' : 'none';
  if (s) {
    const L = s.league,
      t = L.table[L.my];
    const where = L.phase === 'reg' ? `${L.day}/${L.sched.length}경기 · ${t.w}승 ${t.l}패` : L.phase === 'stove' ? '스토브리그' : `포스트시즌 · ${t.w}승 ${t.l}패`;
    $('btn-cont').textContent = `▶ 시즌 이어하기 (${KBO_BY_CODE[L.my].short} · ${L.season || 1}번째 시즌 · ${where})`;
  }
}

// ---------- 내 팀 들어가기/나오기 ----------
// 리그에 들어가기 전 한 경기 모드의 내 팀(나올 때 되돌린다)
let singleTeam = null;
// 리그의 내 팀을 게임의 내 팀(LINEUPS.m·후보·PITCHERS·이름·유니폼)으로
function enterLeagueTeam() {
  if (!singleTeam)
    singleTeam = { lineup: LINEUPS.m, bench: MY_BENCH, pitchers: [...PITCHERS], cur: curPitcher, name: TEAM_NAMES.m, colors: [...TEAM_COLORS.m] };
  const R = league.rosters[league.my],
    k = KBO_BY_CODE[league.my];
  LINEUPS.m = R.batters.slice(0, 9);
  MY_BENCH = R.batters.slice(9);
  PITCHERS.splice(0, PITCHERS.length, ...R.pitchers);
  TEAM_NAMES.m = k.name;
  TEAM_COLORS.m = kboUniform(k);
  curPitcher = Math.max(0, PITCHERS.indexOf(starterOf(league.my)));
  moundPitcher = null;
  refreshHotZones();
  renderPitcherButtons();
  dressAll();
}
// 타순 바꾸기 결과를 리그 선수단에 옮긴다
function syncMyRoster() {
  if (!league || !singleTeam) return;
  const R = league.rosters[league.my];
  R.batters = [...LINEUPS.m, ...MY_BENCH];
  R.pitchers = [...PITCHERS];
}
// 리그에서 나와 한 경기 모드의 내 팀으로 되돌린다
function exitLeague() {
  if (league && !league.finished) saveLeague();
  restoreSingleTeam();
  league = null;
  isSeason = false;
  cpuStaff = null;
  ['leagueHub', 'leagueSetup', 'schedule', 'ledger', 'market', 'draft', 'train', 'seasonEnd', 'history'].forEach(id => ($(id).style.display = 'none'));
}
// 리그나 한 경기(팀 고르기)에서 바꿔 둔 내 팀을 원래 팀(팀 편집한 팀)으로
function restoreSingleTeam() {
  if (singleTeam) {
    LINEUPS.m = singleTeam.lineup;
    MY_BENCH = singleTeam.bench;
    PITCHERS.splice(0, PITCHERS.length, ...singleTeam.pitchers);
    curPitcher = singleTeam.cur;
    TEAM_NAMES.m = singleTeam.name;
    TEAM_COLORS.m = singleTeam.colors;
    singleTeam = null;
    moundPitcher = null;
    setMound(PITCHERS[curPitcher]);
    refreshHotZones();
    renderPitcherButtons();
    dressAll();
  }
}

// ---------- 오늘 경기 ----------
const teamName = c => KBO_BY_CODE[c].name;
// 오늘 선발: 선발(SP) 투수들이 차례로. 내 팀은 바꿔 둔 선발이 있으면 그 투수
function starterOf(code) {
  const P = league.rosters[code].pitchers;
  if (code === league.my && league.myStarter) {
    const s = P.find(x => x.id === league.myStarter);
    if (s) return s;
  }
  const sp = P.filter(x => x.role !== 'RP');
  const list = sp.length ? sp : P;
  return list[league.rot[code] % list.length];
}
// 내 팀의 오늘 경기 { h, a, opp, myHome, g, n, label }. 없으면 null
function todayMatch() {
  if (!league) return null;
  if (league.phase === 'reg') {
    const day = league.sched[league.day];
    if (!day) return null;
    const m = day.find(x => x[0] === league.my || x[1] === league.my);
    return { h: m[0], a: m[1], opp: m[0] === league.my ? m[1] : m[0], myHome: m[0] === league.my, g: m[2], n: m[3], label: `${m[3]}연전 ${m[2]}번째 경기` };
  }
  if (league.phase === 'post') {
    const s = league.post.cur;
    if (!s || s.winner || (s.hi !== league.my && s.lo !== league.my)) return null;
    const h = seriesHome(s),
      a = h === s.hi ? s.lo : s.hi;
    return { h, a, opp: h === league.my ? a : h, myHome: h === league.my, g: s.games.length + 1, n: 0, label: `${POST_ROUNDS[s.r].label} ${s.games.length + 1}차전` };
  }
  return null;
}
// 경기를 시작하기 전에(startGame → applyOpp): 오늘 상대 선수단·선발, 홈/원정, 내 선발
function leagueApplyMatch() {
  const m = todayMatch(),
    R = league.rosters[m.opp],
    k = KBO_BY_CODE[m.opp];
  myHome = m.myHome;
  LINEUPS.o = R.batters.slice(0, 9);
  cpuStaff = R.pitchers;
  cpuIdx = Math.max(0, cpuStaff.indexOf(starterOf(m.opp)));
  TEAM_NAMES.o = k.name;
  TEAM_COLORS.o = kboUniform(k);
  curPitcher = Math.max(0, PITCHERS.indexOf(starterOf(league.my)));
  moundPitcher = null;
  refreshHotZones();
  gameOuts = {};
  league.hl = { hr: 0, k: 0, dive: 0 }; // 이번 경기 명장면(자금 보너스)
}
// 내 팀 경기 직접 하기
function playMyGame() {
  const m = todayMatch();
  if (!m) return;
  finishDraftAuto();
  $('leagueHub').style.display = 'none';
  isSeason = true;
  startGame(m.myHome, true); // 내가 홈이면 초에 수비부터
}

// ---------- 다른 경기 결과 계산 ----------
const avgOvr = list => list.reduce((s, x) => s + playerCard(x).ovr, 0) / Math.max(1, list.length);
// 포아송 분포 점수(평균 mean)
function poissonRuns(mean) {
  const L = Math.exp(-mean);
  let k = 0,
    p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return Math.min(LEAGUE.maxRuns, k - 1);
}
// 한 경기 결과 계산: 타선 OVR 평균·선발 OVR·홈 이점으로 승리 확률, 점수는 그럴듯하게. 선수별 기록도 쌓는다
function simGame(h, a, noDraw) {
  const Rh = league.rosters[h],
    Ra = league.rosters[a],
    sh = starterOf(h),
    sa = starterOf(a),
    batH = avgOvr(Rh.batters.slice(0, 9)),
    batA = avgOvr(Ra.batters.slice(0, 9)),
    spH = playerCard(sh).ovr,
    spA = playerCard(sa).ovr,
    pHome = clamp(0.5 + LEAGUE.homeEdge + ((batH - batA) * 0.5 + (spH - spA) * 0.5) * LEAGUE.winPerOvr, 0.2, 0.8);
  let hs = poissonRuns(clamp(LEAGUE.baseRuns + (batH - spA) * LEAGUE.runsPerOvr, 2, 8)),
    as = poissonRuns(clamp(LEAGUE.baseRuns + (batA - spH) * LEAGUE.runsPerOvr, 2, 8));
  if (!noDraw && rand() < LEAGUE.drawChance) as = hs;
  else {
    const homeWin = rand() < pHome;
    if (homeWin && hs <= as) [hs, as] = as > hs ? [as, hs] : [hs + 1, as];
    if (!homeWin && as <= hs) [hs, as] = hs > as ? [as, hs] : [hs, as + 1];
  }
  simStats(h, sh, hs, as);
  simStats(a, sa, as, hs);
  return { h, a, hs, as };
}
// 결과 계산 경기의 선수별 기록(대략): 타자는 안타·홈런·타점·도루, 투수는 이닝·자책·탈삼진·승패·세이브
function simStats(code, starter, rf, ra) {
  const R = league.rosters[code],
    bats = R.batters.slice(0, 9),
    won = rf > ra,
    lost = rf < ra;
  const pick = w => {
    const sum = w.reduce((s, x) => s + x, 0);
    let r = rand() * sum;
    return w.findIndex(x => (r -= x) < 0);
  };
  // 팀 안타는 득점에 맞춰 대략(평균 9개 안팎, 팀 타율 .270 정도), 컨택 좋은 타자가 조금 더 친다
  const hits = clamp(Math.round(rf * 1.1 + 3.5 + rand() * 2), 2, 18),
    hrs = Math.min(hits, Math.round(rf * 0.12 + rand() * 0.7)),
    conW = bats.map(p => (p[3] || 5) + 8),
    powW = bats.map(p => Math.pow(p[7] || 5, 2));
  bats.forEach(p => {
    ssB(p).ab += 3 + (rand() < 0.6 ? 1 : 0) + (rand() < 0.15 ? 1 : 0);
    gainExp(p, GROWTH.simBatExp); // 출전 경험치
  });
  for (let i = 0; i < hits; i++) {
    const x = ssB(bats[pick(conW)]);
    x.h++;
    if (x.h > x.ab) x.ab = x.h;
  }
  for (let i = 0; i < hrs; i++) {
    const x = ssB(bats[pick(powW)]);
    x.hr++;
    if (x.hr > x.h) (x.h = x.hr), (x.ab = Math.max(x.ab, x.h));
  }
  for (let i = 0; i < rf; i++) ssB(bats[pick(bats.map((p, k) => (p[7] || 5) + (p[3] || 5) + (k > 1 && k < 6 ? 4 : 0)))]).rbi++;
  bats.forEach(p => {
    if (rand() < Math.max(0, ((p[2] || 5) - 4) * 0.04)) ssB(p).sb++;
  });
  // 투수: 선발이 5~7이닝, 나머지는 불펜
  const pc = playerCard(starter),
    sOuts = clamp(Math.round(15 + rand() * 6 + (pc.ovr - 60) * 0.1), 9, 24),
    rp = R.pitchers.filter(P => P.role === 'RP' && P !== starter),
    used = [[starter, sOuts]];
  let left = 27 - sOuts;
  const closer = rp[0];
  const middle = rp.slice(1).sort(() => rand() - 0.5);
  while (left > 0 && middle.length) {
    const o = Math.min(left, 3 + Math.round(rand() * 3));
    used.push([middle.shift(), o]);
    left -= o;
    if (won && Math.abs(rf - ra) <= 3 && left <= 3 && closer) break;
  }
  if (left > 0) used.push([closer || starter, left]);
  let erLeft = ra;
  used.forEach(([P, o], i) => {
    const x = ssP(P),
      er = i === used.length - 1 ? erLeft : Math.min(erLeft, Math.round((ra * o) / 27 + (rand() - 0.5)));
    erLeft -= er;
    x.g++;
    x.outs += o;
    gainExp(P, o * GROWTH.expPerOut);
    x.er += Math.max(0, er);
    x.k += Math.round((o / 3) * (0.45 + playerCard(P).ovr / 200) * (0.7 + rand() * 0.6)); // 9이닝당 7개 안팎
  });
  if (won) ssP(sOuts >= 15 ? starter : used[1] ? used[1][0] : starter).w++;
  if (lost) ssP(starter).l++;
  const last = used[used.length - 1][0];
  if (won && Math.abs(rf - ra) <= 3 && last !== starter && last.role === 'RP') ssP(last).sv++;
}
// 순위표에 결과 기록(승·패·무, 득실, 최근 10경기, 연승/연패)
function recordResult(r) {
  const put = (c, rf, ra) => {
    const t = league.table[c],
      res = rf > ra ? 'W' : rf < ra ? 'L' : 'D';
    if (res === 'W') t.w++;
    else if (res === 'L') t.l++;
    else t.d++;
    t.rs += rf;
    t.ra += ra;
    t.last = [...t.last, res].slice(-10);
    t.streak = res === 'D' ? 0 : res === 'W' ? (t.streak > 0 ? t.streak + 1 : 1) : t.streak < 0 ? t.streak - 1 : -1;
  };
  put(r.h, r.hs, r.as);
  put(r.a, r.as, r.hs);
  league.rot[r.h]++;
  league.rot[r.a]++;
}

// ---------- 순위 ----------
const pct = t => (t.w + t.l ? t.w / (t.w + t.l) : 0);
// 순위(승률 → 승 → 득실차)
function rankList() {
  return KBO_TEAMS.map(t => t.code).sort((x, y) => {
    const a = league.table[x],
      b = league.table[y];
    return pct(b) - pct(a) || b.w - a.w || b.rs - b.ra - (a.rs - a.ra);
  });
}
// 게임차(1위와)
function gamesBehind(c, lead) {
  const a = league.table[lead],
    t = league.table[c];
  return (a.w - t.w + (t.l - a.l)) / 2;
}

// ---------- 하루 진행 ----------
// 내 팀 경기가 끝난 뒤(직접 했든 자동이든): 결과 기록 → 다른 경기 계산 → 다음 날
function finishMyMatch(myR, oppR, played) {
  const m = todayMatch();
  if (!m) return;
  const r = { h: m.h, a: m.a, hs: m.myHome ? myR : oppR, as: m.myHome ? oppR : myR };
  league.myLog.push({ day: league.phase === 'reg' ? league.day + 1 : 0, opp: m.opp, home: m.myHome, my: myR, op: oppR, label: m.label });
  const res = myR > oppR ? '승' : myR < oppR ? '패' : '무';
  league.msg = `지난 경기: ${teamName(m.opp)}전 ${myR} : ${oppR} ${res}`;
  league.myStarter = null;
  // 돈: 내 경기(직접 했으면 명장면 보너스도)
  league.money = gameFinance(r, played ? league.hl : null);
  if (league.phase === 'reg') {
    recordResult(r);
    const others = league.sched[league.day].filter(x => x[0] !== league.my && x[1] !== league.my).map(([h, a]) => simGame(h, a));
    others.forEach(x => {
      gameFinance(x);
      recordResult(x);
    });
    league.yday = [r, ...others];
    league.day++;
    if (league.day >= league.sched.length) startPost();
    else if (league.sched[league.day][0][2] === 1) {
      cpuMarketMoves(); // 새 3연전 전에 컴퓨터 팀 이적
      midSeasonGrowth(); // 경험치가 쌓인 선수 능력치 +1 기회
    }
  } else postGameDone(r);
  saveLeague();
}
// 직접 한 경기가 끝나면(endGame에서)
function leagueGameOver(myR, oppR) {
  isSeason = false;
  finishMyMatch(myR, oppR, true);
  showHub();
}
// 이 경기 자동 진행(내 팀 경기도 결과만 계산)
function autoMyGame() {
  const m = todayMatch();
  if (!m) return;
  finishDraftAuto();
  const r = simGame(m.h, m.a, league.phase === 'post');
  finishMyMatch(m.myHome ? r.hs : r.as, m.myHome ? r.as : r.hs);
  renderHub();
}

// 창단 드래프트를 안 하고 경기를 시작하면 남은 지명을 자동으로(내 차례는 스카우트 평가가 좋은 신인)
function finishDraftAuto() {
  if (league.phase !== 'reg' || draftDone()) return;
  autoDraftMine();
  league.draft = null;
}

// ---------- 포스트시즌 ----------
function makeSeries(r, hi, lo) {
  return { r, hi, lo, wins: { [hi]: POST_ROUNDS[r].head, [lo]: 0 }, games: [], winner: null };
}
// 정규 시즌이 끝나면 5위까지 포스트시즌: 4위 vs 5위 와일드카드부터
function startPost() {
  const seeds = rankList().slice(0, LEAGUE.postTeams);
  league.phase = 'post';
  league.post = { seeds, done: [], cur: makeSeries(0, seeds[3], seeds[4]), champ: null };
  league.msg += ` · 정규 시즌 끝! 1위 ${teamName(seeds[0])}`;
  // 순위 상금과 포스트시즌 진출금
  rankList().forEach((c, i) => addMoney(c, ECONOMY.rankPrize[i], `정규 시즌 ${i + 1}위 상금`, true));
  seeds.forEach(c => addMoney(c, ECONOMY.postEntry, '포스트시즌 진출', true));
}
// 시리즈 다음 경기의 홈 팀(높은 순위 팀이 1·2차전 홈. 5전: 5차전도, 7전: 6·7차전도)
function seriesHome(s) {
  const g = s.games.length;
  if (s.r === 0) return s.hi;
  if (POST_ROUNDS[s.r].need === 4) return [0, 1, 5, 6].includes(g) ? s.hi : s.lo;
  return [0, 1, 4].includes(g) ? s.hi : s.lo;
}
// 포스트시즌 한 경기가 끝나면: 승수 → 시리즈 승자 → 다음 라운드 → 우승
function postGameDone(r) {
  const s = league.post.cur;
  s.games.push(r);
  league.rot[r.h]++; // 다음 경기는 다음 선발
  league.rot[r.a]++;
  if (r.hs !== r.as) s.wins[r.hs > r.as ? r.h : r.a]++;
  const need = POST_ROUNDS[s.r].need;
  [s.hi, s.lo].forEach(c => {
    if (s.wins[c] >= need) s.winner = c;
  });
  if (!s.winner) return;
  league.post.done.push(s);
  league.msg = `${POST_ROUNDS[s.r].label}: ${teamName(s.winner)} 승리!`;
  addMoney(s.winner, ECONOMY.postSeriesWin, `${POST_ROUNDS[s.r].label} 승리`, true);
  if (s.r === 3) addMoney(s.winner, ECONOMY.ksChampion, '한국시리즈 우승', true);
  if (s.r === 3) {
    league.post.champ = s.winner;
    league.post.cur = null;
    league.phase = 'over';
    return;
  }
  const seeds = league.post.seeds;
  league.post.cur = makeSeries(s.r + 1, seeds[2 - s.r], s.winner);
}
// 내 팀이 없는 포스트시즌 경기 결과 보기(한 경기씩)
function simPostGame() {
  const s = league.post && league.post.cur;
  if (!s || s.hi === league.my || s.lo === league.my) return;
  const h = seriesHome(s),
    a = h === s.hi ? s.lo : s.hi,
    r = simGame(h, a, true);
  gameFinance(r);
  postGameDone(r);
  saveLeague();
  renderHub();
}

// ---------- 시즌 끝: 리그 타이틀 ----------
function leagueAwards() {
  const games = league.sched.length,
    team = id => teamTagOf(id),
    B = Object.entries(seasonStats.b).map(([id, x]) => ({ id, ...x })),
    P = Object.entries(seasonStats.p).map(([id, x]) => ({ id, ...x })),
    best = (list, f, low) => list.reduce((a, x) => (!a || (low ? f(x) < f(a) : f(x) > f(a)) ? x : a), null),
    qb = B.filter(x => x.ab >= games * LEAGUE.minAbPerGame),
    qp = P.filter(x => x.outs >= games * LEAGUE.minOutsPerGame),
    era = x => (x.outs ? (x.er * 27) / x.outs : 99),
    out = [];
  const add = (title, x, v) => x && out.push({ title, name: x.n, team: team(x.id), v });
  let x;
  add('타율', (x = best(qb, y => y.h / y.ab)), x && (x.h / x.ab).toFixed(3).replace(/^0/, ''));
  add('홈런', (x = best(B, y => y.hr)), x && x.hr + '개');
  add('타점', (x = best(B, y => y.rbi)), x && x.rbi + '점');
  add('도루', (x = best(B, y => y.sb)), x && x.sb + '개');
  add('다승', (x = best(P, y => y.w)), x && x.w + '승');
  add('평균자책', (x = best(qp, era, true)), x && era(x).toFixed(2));
  add('탈삼진', (x = best(P, y => y.k)), x && x.k + '개');
  add('세이브', (x = best(P, y => y.sv)), x && x.sv + '개');
  return out.concat(honorAwards()); // 끝에 MVP·신인왕
}
// 시즌이 끝나면: 명예의 전당(한국시리즈 우승이면 우승 화면) → 저장 지우기
function finishLeague() {
  const t = league.table[league.my];
  seasonWins = t.w;
  seasonLosses = t.l;
  seasonDraws = t.d;
  seasonStats.rs = t.rs;
  seasonStats.ra = t.ra;
  leagueEnding = { champ: league.post.champ, awards: leagueAwards() };
  recordHistory(); // 구단 역사에 이번 시즌
  saveLeague();
  $('leagueHub').style.display = 'none';
  showHof(league.post.champ === league.my);
}
// 명예의 전당에 넘겨줄 시즌 끝 정보(null이면 예전 방식)
let leagueEnding = null;

// ---------- 리그 화면 ----------
function showHub() {
  $('title').style.display = 'none';
  $('end').style.display = 'none';
  $('hud').style.display = 'none';
  renderHub();
  $('leagueHub').style.display = 'block';
}
// 리그 화면 그리기: 다음 경기, 순위표(또는 대진표), 어제 결과, 버튼
function renderHub() {
  if (!league) return;
  const my = league.my,
    t = league.table[my],
    ranks = rankList(),
    m = todayMatch();
  $('lgHead').textContent =
    `${teamName(my)} · ${t.w}승 ${t.l}패${t.d ? ' ' + t.d + '무' : ''}` + (t.w + t.l + t.d ? ` · ${ranks.indexOf(my) + 1}위` : ' · 시즌 시작 전');
  $('lgMsg').textContent = league.msg || '';
  // 자금: 현재 자금, 이번 시즌 수입/지출, 지난 경기 돈. 마이너스면 빨간 글씨 + 안내
  const f = league.funds[my];
  $('lgMoney').innerHTML =
    `💰 자금 <b class="${f < 0 ? 'neg' : ''}">${moneyText(f)}</b> · 이번 시즌 수입 +${league.flow.in.toFixed(1)}억 / 지출 −${league.flow.out.toFixed(1)}억 · 연봉 합계 ${payrollOf(my).toFixed(1)}억/시즌` +
    (league.money ? `<br><small>${league.money}</small>` : '') +
    (f < 0 ? '<br><b class="neg">자금이 마이너스예요. 선수를 팔거나 연봉을 줄이세요</b>' : '');
  // 다음 경기
  let next = '';
  if (league.phase === 'reg' && m) {
    const sm = starterOf(my),
      so = starterOf(m.opp);
    next = `<b>${league.day + 1}일째</b> / ${league.sched.length}경기 · ${m.label}<br>
      VS <b>${teamName(m.opp)}</b> (${m.myHome ? '홈' : '원정'})<br>
      선발: ${sm.n} (OVR ${playerCard(sm).ovr}) vs ${so.n} (OVR ${playerCard(so).ovr})`;
  } else if (league.phase === 'post') {
    const s = league.post.cur;
    next = m
      ? `<b>${m.label}</b> · VS <b>${teamName(m.opp)}</b> (${m.myHome ? '홈' : '원정'})<br>시리즈 ${s.wins[my]}승 ${s.wins[m.opp]}승<br>선발: ${starterOf(my).n} vs ${starterOf(m.opp).n}`
      : s
        ? `<b>${POST_ROUNDS[s.r].label}</b>: ${teamName(s.hi)} ${s.wins[s.hi]} - ${s.wins[s.lo]} ${teamName(s.lo)}<br>내 팀은 이 시리즈에 나가지 않아요`
        : '';
  } else if (league.phase === 'over') next = `<b>🏆 ${teamName(league.post.champ)} 한국시리즈 우승!</b>`;
  else if (league.phase === 'stove')
    next =
      `<b>스토브리그</b> · ${league.season}번째 시즌이 끝났어요<br>` +
      (draftDone() ? '신인 드래프트 끝 · 이적 시장(FA)을 둘러보고 다음 시즌을 시작하세요' : '신인 드래프트를 하세요(순위 역순 3라운드)') +
      (league.report && league.report.length ? `<div class="lg-report">${league.report.slice(0, 12).join('<br>')}</div>` : '');
  $('lgNext').innerHTML = next;
  // 순위표
  const lead = ranks[0];
  $('lgTable').innerHTML =
    '<tr><th>순위</th><th>팀</th><th>경기</th><th>승</th><th>패</th><th>무</th><th>승률</th><th>게임차</th><th>최근10</th><th>연속</th></tr>' +
    ranks
      .map((c, i) => {
        const x = league.table[c],
          l10 = x.last.filter(r => r === 'W').length + '승' + x.last.filter(r => r === 'L').length + '패',
          st = x.streak > 0 ? x.streak + '연승' : x.streak < 0 ? -x.streak + '연패' : '-';
        return `<tr class="${c === my ? 'mine' : ''}${i === LEAGUE.postTeams - 1 ? ' cut' : ''}"><td>${i + 1}</td><td>${KBO_BY_CODE[c].short}</td><td>${x.w + x.l + x.d}</td><td>${x.w}</td><td>${x.l}</td><td>${x.d}</td><td>${pct(x).toFixed(3).replace(/^0/, '')}</td><td>${i ? gamesBehind(c, lead).toFixed(1) : '-'}</td><td>${l10}</td><td>${st}</td></tr>`;
      })
      .join('');
  // 어제 결과 또는 대진표
  const news = league.news && league.news.length ? '<h3>이적 소식</h3>' + league.news.slice(0, 4).map(t => `<div class="lg-res">${t}</div>`).join('') : '';
  if (league.phase === 'reg')
    $('lgSide').innerHTML =
      news +
      '<h3>지난 경기 결과</h3>' +
      (league.yday.length
        ? league.yday.map(r => `<div class="lg-res">${KBO_BY_CODE[r.a].short} ${r.as} : ${r.hs} ${KBO_BY_CODE[r.h].short}</div>`).join('')
        : '<p class="mk-note">아직 경기가 없어요</p>');
  else {
    const P = league.post,
      line = s =>
        `<div class="lg-res${s.hi === my || s.lo === my ? ' mine' : ''}"><b>${POST_ROUNDS[s.r].label}</b><br>${KBO_BY_CODE[s.hi].short} ${s.wins[s.hi]} - ${s.wins[s.lo]} ${KBO_BY_CODE[s.lo].short}${s.winner ? ' → ' + KBO_BY_CODE[s.winner].short : ''}</div>`;
    $('lgSide').innerHTML =
      `<h3>포스트시즌 대진</h3><p class="mk-note">1위 ${P.seeds.map((c, i) => `${i + 1}위 ${KBO_BY_CODE[c].short}`).join(' · ')}</p>` +
      P.done.map(line).join('') +
      (P.cur ? line(P.cur) : '');
  }
  // 버튼
  const mine = !!m,
    postOther = league.phase === 'post' && !m && league.post.cur;
  $('lgPlay').style.display = mine ? '' : 'none';
  $('lgAuto').style.display = mine ? '' : 'none';
  $('lgPostNext').style.display = postOther ? '' : 'none';
  $('lgEnd').style.display = league.phase === 'over' || league.phase === 'stove' ? '' : 'none';
  $('lgEnd').textContent = league.phase === 'stove' ? '📋 시즌 마무리 순서' : '🏆 시즌 마무리';
  const draftOpen = league.draft && !draftDone() && (league.phase === 'stove' || (league.phase === 'reg' && league.day === 0));
  $('lgDraft').style.display = draftOpen ? '' : 'none';
  $('lgDraft').textContent = league.phase === 'stove' ? '🎓 신인 드래프트' : '🎓 창단 드래프트';
  $('lgNextSeason').style.display = league.phase === 'stove' ? '' : 'none';
  $('lgTrain').style.display = league.phase === 'reg' ? '' : 'none';
}
// 내 팀 일정 화면
function renderSchedule() {
  const my = league.my,
    rows = [];
  league.sched.forEach((day, i) => {
    const g = day.find(x => x[0] === my || x[1] === my),
      opp = g[0] === my ? g[1] : g[0],
      log = league.myLog.find(x => x.day === i + 1);
    rows.push(
      `<tr class="${i === league.day ? 'mine' : ''}"><td>${i + 1}</td><td>${g[0] === my ? '홈' : '원정'}</td><td>${teamName(opp)}</td><td>${g[2]}/${g[3]}</td><td>${log ? `${log.my} : ${log.op} ${log.my > log.op ? '승' : log.my < log.op ? '패' : '무'}` : ''}</td></tr>`,
    );
  });
  $('scTable').innerHTML = '<tr><th>날</th><th>홈/원정</th><th>상대</th><th>시리즈</th><th>결과</th></tr>' + rows.join('');
}

// ---------- 시작 화면(내 팀 고르기) ----------
let setupPick = null;
let setupLen = LEAGUE.defaultLength;
function startLeagueSetup() {
  const s = loadLeagueSave();
  if (s && !confirm(`저장된 시즌(${KBO_BY_CODE[s.league.my].name})이 있어요.\n새 시즌을 시작하면 지워져요. 새로 시작할까요?`)) return;
  setupPick = null;
  renderSetup();
  $('title').style.display = 'none';
  $('leagueSetup').style.display = 'block';
}
// 팀 카드(이름·색·팀 OVR 평균·시작 자금)와 시즌 길이
function renderSetup() {
  $('lsTeams').innerHTML = KBO_TEAMS.map(t => {
    const ovr = Math.round(avgOvr([...kboBatters(t.code), ...kboPitchers(t.code)]));
    return `<button class="ls-team${setupPick === t.code ? ' on' : ''}" data-c="${t.code}" style="border-left-color:${hexCss(t.colors[0])}">
      <b>${t.name}</b><span>${t.city} · 팀 OVR ${ovr} · 시작 자금 ${startMoney(t)}억</span></button>`;
  }).join('');
  $('lsLen').innerHTML = Object.entries(LEAGUE.lengths)
    .map(([k, v]) => `<button data-v="${k}" class="${setupLen === k ? 'on' : ''}">${v.label}</button>`)
    .join('');
  $('lsGo').disabled = !setupPick;
  $('lsGo').textContent = setupPick ? `${KBO_BY_CODE[setupPick].name}로 시즌 시작` : '팀을 골라요';
}
// 저장된 리그 이어하기
function continueLeague() {
  const s = loadLeagueSave();
  if (!s) return;
  league = s.league;
  seasonStats = s.stats || seasonStats;
  if (!seasonStats.b) ssReset();
  if (!league.funds) initFunds(); // 자금이 생기기 전 저장
  initMarket();
  applyKboNamesToLeague(); // 팀 편집에서 고친 KBO 선수 이름을 리그 전체(선수단·FA·기록)에
  enterLeagueTeam();
  showHub();
}

// ---------- 버튼 ----------
const onTap = (id, fn) =>
  $(id).addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    unlockAudio();
    fn();
  });
['leagueSetup', 'leagueHub', 'schedule', 'ledger'].forEach(id => $(id).addEventListener('pointerdown', e => e.stopPropagation()));
$('lsTeams').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  setupPick = b.dataset.c;
  renderSetup();
});
$('lsLen').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  setupLen = b.dataset.v;
  renderSetup();
});
$('lsGo').addEventListener('click', () => {
  if (!setupPick) return;
  clearLeagueSave();
  newLeague(setupPick, setupLen);
  $('leagueSetup').style.display = 'none';
  enterLeagueTeam();
  saveLeague();
  showHub();
});
$('lsBack').addEventListener('click', () => {
  $('leagueSetup').style.display = 'none';
  $('title').style.display = '';
});
onTap('lgPlay', playMyGame);
onTap('lgAuto', autoMyGame);
onTap('lgPostNext', simPostGame);
onTap('lgEnd', () => (league.phase === 'stove' ? openSeasonEnd() : finishLeague()));
onTap('lgHistory', () => openHistory());
onTap('lgReset', () => resetLeague());
onTap('lgRoster', () => openLineup());
onTap('lgLedger', () => {
  $('ldTable').innerHTML =
    '<tr><th>날</th><th>내용</th><th>금액</th></tr>' +
    (league.ledger.slice(0, 20).map(x => `<tr><td>${x.d}</td><td>${x.t}</td><td class="${x.a < 0 ? 'neg' : 'pos'}">${x.a > 0 ? '+' : ''}${moneyText(x.a)}</td></tr>`).join('') ||
      '<tr><td colspan="3">아직 내역이 없어요</td></tr>');
  $('ledger').style.display = 'block';
});
onTap('ldClose', () => ($('ledger').style.display = 'none'));
onTap('lgMarket', () => openMarket());
onTap('lgDraft', () => openDraft());
onTap('lgTrain', () => openTrain());
onTap('lgNextSeason', () => {
  const why = startNextSeason();
  league.msg = why || league.msg;
  enterLeagueTeam();
  renderHub();
});
onTap('lgSched', () => {
  renderSchedule();
  $('schedule').style.display = 'block';
});
onTap('scClose', () => ($('schedule').style.display = 'none'));
onTap('lgExit', () => {
  exitLeague();
  backToTitle();
});
renderLeagueButton();
