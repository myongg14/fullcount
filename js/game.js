// 경기 진행: 한 경기의 규칙과 상태(이닝, 점수, 주자, 볼·스트라이크·아웃, 타순, 투수·투구 수)를 이 파일에서만 바꾼다

// ---------- 경기 설정 (숫자만 바꿔서 조절) ----------
// 시작 메뉴는 10단계에서 만든다. 그 전까지는 여기 값으로 정하고, 경기가 끝나면 3/9이닝을 골라 새 경기를 할 수 있다.
const GAME_SETTINGS = {
  innings: 3,            // 3 또는 9
  myHome: false,         // false = 내 팀이 원정(초에 공격), true = 내 팀이 홈(말에 공격)
  myTeam: 0,             // 내 팀: data/teams.js의 TEAMS 순서(0 또는 1). 나머지 팀이 상대 팀
  doublePlayChance: 0.3, // 땅볼 아웃 때 1루 주자가 있고 0·1아웃이면 병살이 될 확률
  // 낮 경기(false) / 밤 경기(true). 주소 끝에 ?night 를 붙여 열면 밤 경기
  night: /[?&]night\b/.test(location.search),
};

// ---------- 경기 상태 ----------
// side: 'away'(원정, 초 공격) | 'home'(홈, 말 공격)
const G = {
  innings: 3, myHome: false,
  inning: 1, top: true,
  balls: 0, strikes: 0, outs: 0,
  bases: [false, false, false],          // 1루, 2루, 3루에 주자가 있는지
  runs: { away: 0, home: 0 },
  hits: { away: 0, home: 0 },
  line: { away: [], home: [] },          // 이닝별 점수(라인 스코어)
  order: { away: 0, home: 0 },           // 지금 타석에 선 타순(0~8)
  pitcher: { away: 0, home: 0 },         // 지금 던지는 투수(팀 pitchers 순서, 0 = 선발)
  pitchCount: { away: [], home: [] },    // 투수별 투구 수
  usedPitchers: { away: [0], home: [0] },// 이미 나온 투수(한 번 내려가면 다시 못 나옴)
  box: { away: [], home: [] },           // 타자별 이번 경기 기록(타순 순서)
  lastPitch: null,                       // 마지막 투구 { name, kmh }
  pstats: { away: [], home: [] },        // 투수별 기록 { outs, h, r, k }
  records: { hr: null, ev: null },       // 이번 경기 가장 긴 홈런, 가장 빠른 타구
  next: 'pa',                            // 결과 화면 뒤에 할 일: pa(다음 타석) | switch(공수 교대) | over(경기 끝) | final(새 경기 고르기)
};

const battingSide = () => (G.top ? 'away' : 'home');
const fieldingSide = () => (G.top ? 'home' : 'away');
const isMine = side => (side === 'home') === G.myHome;
const teamIndex = side => (isMine(side) ? GAME_SETTINGS.myTeam : 1 - GAME_SETTINGS.myTeam);
const team = side => TEAMS[teamIndex(side)];
const teamName = side => team(side).name;
const currentBatter = () => team(battingSide()).batters[G.order[battingSide()]];
const currentPitcher = () => team(fieldingSide()).pitchers[G.pitcher[fieldingSide()]];
const currentPitchCount = () => G.pitchCount[fieldingSide()][G.pitcher[fieldingSide()]] || 0;
// 투수 체력: 투구 수가 체력의 절반을 넘으면 지치기 시작해, 체력 x 1.3개쯤에서 완전히 지침(0 = 쌩쌩, 1 = 완전히 지침)
const pitcherFatigue = () => {
  const st = currentPitcher().stamina;
  return clamp((currentPitchCount() - st * 0.5) / (st * 0.8), 0, 1);
};
const inningText = () => `${G.inning}회 ${G.top ? '초' : '말'}`;

// ---------- 진루 ----------
// 안타: 모든 주자가 타자와 같은 수만큼 진루. bases 4 = 홈런. 들어온 점수를 돌려준다.
const advanceRunners = bases => {
  let scored = 0;
  const nb = [false, false, false];
  for (let i = 2; i >= 0; i--) {
    if (!G.bases[i]) continue;
    if (i + bases >= 3) scored++; else nb[i + bases] = true;
  }
  if (bases >= 4) scored++; else nb[bases - 1] = true;
  G.bases = nb;
  return scored;
};
// 볼넷: 밀어내기만(앞 베이스가 차 있을 때만 주자가 한 베이스씩 밀림)
const walkRunners = () => {
  let scored = 0;
  const b = G.bases;
  if (b[0]) {
    if (b[1]) { if (b[2]) scored++; b[2] = true; }
    b[1] = true;
  }
  b[0] = true;
  return scored;
};

// ---------- 투수 ----------
// 공을 한 개 던질 때마다 부른다
const pitchThrown = () => {
  const side = fieldingSide(), i = G.pitcher[side];
  G.pitchCount[side][i] = (G.pitchCount[side][i] || 0) + 1;
  if (S.pitch) G.lastPitch = { name: S.pitch.name, kmh: S.pitch.kmh };
  renderBoard();
};
const bullpenOptions = () => team(fieldingSide()).pitchers
  .map((p, i) => ({ p, i }))
  .filter(({ i }) => !G.usedPitchers[fieldingSide()].includes(i));
const changePitcher = i => {
  const side = fieldingSide();
  G.pitcher[side] = i; G.usedPitchers[side].push(i);
  setPitcherHand(currentPitcher().throws); dressPlayers();
  renderPitchCards(); renderBoard();
  banner('투수 교체', `${currentPitcher().name} · ${currentPitcher().throws === 'L' ? '좌투' : '우투'}`, 1300);
};
// 컴퓨터 팀은 투수가 많이 지치면 알아서 불펜 투수로 바꾼다
const cpuBullpenCheck = () => {
  if (isMine(fieldingSide()) || pitcherFatigue() < 0.85) return;
  const next = bullpenOptions()[0];
  if (next) changePitcher(next.i);
};
// 타석 시작 전: 타자·투수 모습과 화면 정리
const preparePA = () => {
  cpuBullpenCheck();
  setBatterSide(currentBatter().bats);
  setPitcherHand(currentPitcher().throws);
  dressPlayers();
  renderPitchCards(); renderBoard();
};

// ---------- 공수와 모드 ----------
// 내 팀이 공격이면 타격, 수비면 투구
const applyMode = () => {
  const m = isMine(battingSide()) ? 'bat' : 'pitch';
  S.mode = m;
  $('batDock').hidden = m !== 'bat'; $('pitchDock').hidden = m !== 'pitch';
  // 타자 반투명(내가 칠 때)은 dressPlayers()가 유니폼을 입힐 때 정한다
  catcher.setEnabled(m === 'pitch'); mitt.setEnabled(m === 'pitch');
  zoneFrame.setEnabled(m === 'pitch'); zoneLines.setEnabled(m === 'bat');
};
const startHalf = () => {
  const side = battingSide();
  G.outs = 0; G.bases = [false, false, false]; resetCount();
  G.line[side][G.inning - 1] = 0;
  applyMode(); preparePA();
  landMark.isVisible = false; ball.isVisible = false; shadow.isVisible = false;
  if (!$('banner').classList.contains('show')) {
    banner(inningText(), `${teamName(side)} 공격 · ${S.mode === 'bat' ? '내가 타격' : '내가 투구'}`, 1500);
  }
  S.phase = 'idle';
  if (S.mode === 'bat') {
    hint('공이 홈플레이트에 들어오는 순간, 공이 있는 곳을 탭하세요.');
    setTimeout(startAIPitch, 1700);
  } else readyPitch();
};
const newGame = (innings = GAME_SETTINGS.innings) => {
  GAME_SETTINGS.innings = innings;
  Object.assign(G, {
    innings, myHome: GAME_SETTINGS.myHome, inning: 1, top: true,
    runs: { away: 0, home: 0 }, hits: { away: 0, home: 0 },
    line: { away: [], home: [] }, order: { away: 0, home: 0 }, next: 'pa',
    pitcher: { away: 0, home: 0 }, pitchCount: { away: [], home: [] }, usedPitchers: { away: [0], home: [0] },
    box: { away: newBox(), home: newBox() }, lastPitch: null,
    pstats: { away: [], home: [] }, records: { hr: null, ev: null },
  });
  paintCrowd(team('home').colors, team('away').colors);
  applyTimeOfDay(GAME_SETTINGS.night);
  $('nextBtn').hidden = true; $('result').hidden = true; $('banner').classList.remove('show');
  startHalf();
};

// 경기가 이 시점에서 끝나는지
const lastInning = () => G.inning >= G.innings;
const gameOverNow = () => {
  // 마지막 이닝 말에 홈팀이 앞서면 그 자리에서 끝(끝내기)
  if (lastInning() && !G.top && G.runs.home > G.runs.away) return true;
  if (G.outs < 3) return false;
  // 마지막 이닝 초가 끝났는데 홈팀이 앞서 있으면 말 공격은 하지 않는다
  if (lastInning() && G.top && G.runs.home > G.runs.away) return true;
  // 마지막 이닝 말이 끝나면 끝(동점이면 연장 없이 무승부)
  return lastInning() && !G.top;
};

// ---------- 타자 기록 ----------
const newBox = () => Array.from({ length: 9 }, () => ({ pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, k: 0, bb: 0 }));
const batterBox = () => G.box[battingSide()][G.order[battingSide()]];
// 예: "2타수 1안타 1홈런"
const boxText = b => (b.pa === 0 ? '첫 타석' : `${b.ab}타수 ${b.h}안타` + (b.hr ? ` ${b.hr}홈런` : '') + (b.bb ? ` ${b.bb}볼넷` : ''));

// ---------- 진행 ----------
const resetCount = () => { G.balls = 0; G.strikes = 0; };
// 타구 기록: 가장 긴 홈런, 가장 빠른 타구(파울 제외)
const recordBatted = res => {
  const who = { name: currentBatter().name, team: teamName(battingSide()) };
  if (res.kind === 'hr' && (!G.records.hr || res.fl.dist > G.records.hr.dist)) G.records.hr = { dist: Math.round(res.fl.dist), ...who };
  if (res.kind !== 'foul' && res.ev && (!G.records.ev || res.ev > G.records.ev.kmh)) G.records.ev = { kmh: Math.round(res.ev), ...who };
};
// kind: 'hit' | 'hr' | 'out' | 'k' | 'bb', info: { bases, groundOut, dp }
const endPA = (kind, text, sub, info = {}) => {
  const side = battingSide();
  const outsBefore = G.outs;
  let scored = 0;
  if (kind === 'k') G.outs++;
  if (kind === 'out') {
    // 병살 여부는 플레이를 보여 주기 전에 play.js가 미리 정해서 넘겨준다(info.dp)
    const dp = info.dp ?? (info.groundOut && G.bases[0] && G.outs < 2 && Math.random() < GAME_SETTINGS.doublePlayChance);
    if (dp) {
      G.outs += 2; G.bases[0] = false; text = '병살';
    } else G.outs++;
  }
  if (kind === 'bb') scored = walkRunners();
  if (kind === 'hit' || kind === 'hr') { G.hits[side]++; scored = advanceRunners(kind === 'hr' ? 4 : info.bases); }
  G.runs[side] += scored;
  G.line[side][G.inning - 1] = (G.line[side][G.inning - 1] || 0) + scored;
  const bx = batterBox();
  bx.pa++; bx.rbi += scored;
  if (kind !== 'bb') bx.ab++; else bx.bb++;
  if (kind === 'hit' || kind === 'hr') bx.h++;
  if (kind === 'hr') bx.hr++;
  if (kind === 'k') bx.k++;
  if (kind === 'hit' || kind === 'hr') crowdCheer(kind === 'hr' ? 2 : 1);
  // 소리: 심판 콜과 관중 함성(audio.js)
  if (kind === 'k') { umpireCall('스트라이크 아웃!'); sfxCheer(1); }
  if (kind === 'out') umpireCall('아웃!');
  if (kind === 'hit') { umpireCall('세이프!'); sfxCheer(2); }
  if (kind === 'hr') sfxCheer(3);
  // 투수 기록(지금 던지는 투수)
  const fs = fieldingSide(), pi = G.pitcher[fs];
  const ps = G.pstats[fs][pi] || (G.pstats[fs][pi] = { outs: 0, h: 0, r: 0, k: 0 });
  ps.outs += G.outs - outsBefore; ps.r += scored;
  if (kind === 'hit' || kind === 'hr') ps.h++;
  if (kind === 'k') ps.k++;
  G.order[side] = (G.order[side] + 1) % 9;
  if (scored) sub = `${scored}점 득점 · ${sub}`;
  G.next = gameOverNow() ? 'over' : G.outs >= 3 ? 'switch' : 'pa';
  renderBoard();
  banner(text, sub, 0);
  S.phase = 'result';
  setTimeout(() => {
    if (S.phase !== 'result') return;   // 그 사이 메뉴로 나갔으면 버튼을 띄우지 않는다
    $('nextBtn').textContent = { pa: '다음 타석', switch: '공수 교대', over: '경기 결과' }[G.next];
    $('nextBtn').hidden = false; $('nextBtn').focus({ preventScroll: true });
  }, 600);
};
const nextPA = () => {
  $('nextBtn').hidden = true; $('banner').classList.remove('show');
  if (G.next === 'over') return showResult();
  if (G.next === 'switch') {
    if (G.top) G.top = false; else { G.top = true; G.inning++; }
    return startHalf();
  }
  resetCount(); preparePA(); landMark.isVisible = false; ball.isVisible = false; shadow.isVisible = false;
  S.phase = 'idle';
  if (S.mode === 'bat') setTimeout(startAIPitch, 700); else readyPitch();
};
const callPitch = (res, sub) => {
  // res: 'ball' | 'strike' | 'foul'
  if (res === 'ball') {
    G.balls++;
    umpireCall('볼!');
    if (G.balls >= 4) return startPlay({ kind: 'bb' }, sub);   // 주자가 걸어가는 짧은 플레이 뒤에 결과
    banner('볼', sub, 900);
  } else if (res === 'strike') {
    G.strikes++;
    if (G.strikes >= 3) return endPA('k', '삼진', sub);
    umpireCall('스트라이크!');
    banner('스트라이크', sub, 900);
  } else if (res === 'foul') {
    if (G.strikes < 2) G.strikes++;
    banner('파울', sub, 900);
  }
  renderBoard();
  S.phase = 'idle';
  setTimeout(() => { if (S.mode === 'bat') startAIPitch(); else readyPitch(); }, 1300);
};
