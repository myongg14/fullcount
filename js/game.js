// 경기 진행: 한 경기의 규칙과 상태(이닝, 점수, 주자, 볼·스트라이크·아웃, 타순)를 이 파일에서만 바꾼다

// ---------- 경기 설정 (숫자만 바꿔서 조절) ----------
// 시작 메뉴는 10단계에서 만든다. 그 전까지는 여기 값으로 정하고, 경기가 끝나면 3/9이닝을 골라 새 경기를 할 수 있다.
const GAME_SETTINGS = {
  innings: 3,            // 3 또는 9
  myHome: false,         // false = 내 팀이 원정(초에 공격), true = 내 팀이 홈(말에 공격)
  myTeamName: '내 팀',
  cpuTeamName: '상대 팀',
  doublePlayChance: 0.3, // 땅볼 아웃 때 1루 주자가 있고 0·1아웃이면 병살이 될 확률
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
  next: 'pa',                            // 결과 화면 뒤에 할 일: pa(다음 타석) | switch(공수 교대) | over(경기 끝) | final(새 경기 고르기)
};

const battingSide = () => (G.top ? 'away' : 'home');
const isMine = side => (side === 'home') === G.myHome;
const teamName = side => (isMine(side) ? GAME_SETTINGS.myTeamName : GAME_SETTINGS.cpuTeamName);
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

// ---------- 공수와 모드 ----------
// 내 팀이 공격이면 타격, 수비면 투구
const applyMode = () => {
  const m = isMine(battingSide()) ? 'bat' : 'pitch';
  S.mode = m;
  $('batDock').hidden = m !== 'bat'; $('pitchDock').hidden = m !== 'pitch';
  batter.getChildMeshes().forEach(x => { x.material.alpha = m === 'bat' ? 0.55 : 1; });
};
const startHalf = () => {
  const side = battingSide();
  G.outs = 0; G.bases = [false, false, false]; resetCount();
  G.line[side][G.inning - 1] = 0;
  applyMode(); renderBoard();
  landMark.isVisible = false; ball.isVisible = false; shadow.isVisible = false;
  banner(inningText(), `${teamName(side)} 공격 · ${S.mode === 'bat' ? '내가 타격' : '내가 투구'}`, 1500);
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
  });
  $('nextBtn').hidden = true; $('newGame').hidden = true;
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

// ---------- 진행 ----------
const resetCount = () => { G.balls = 0; G.strikes = 0; };
// kind: 'hit' | 'hr' | 'out' | 'k' | 'bb', info: { bases, groundOut }
const endPA = (kind, text, sub, info = {}) => {
  const side = battingSide();
  let scored = 0;
  if (kind === 'k') G.outs++;
  if (kind === 'out') {
    if (info.groundOut && G.bases[0] && G.outs < 2 && Math.random() < GAME_SETTINGS.doublePlayChance) {
      G.outs += 2; G.bases[0] = false; text = '병살';
    } else G.outs++;
  }
  if (kind === 'bb') scored = walkRunners();
  if (kind === 'hit' || kind === 'hr') { G.hits[side]++; scored = advanceRunners(kind === 'hr' ? 4 : info.bases); }
  G.runs[side] += scored;
  G.line[side][G.inning - 1] += scored;
  G.order[side] = (G.order[side] + 1) % 9;
  if (scored) sub = `${scored}점 득점 · ${sub}`;
  G.next = gameOverNow() ? 'over' : G.outs >= 3 ? 'switch' : 'pa';
  renderBoard();
  banner(text, sub, 0);
  S.phase = 'result';
  setTimeout(() => {
    $('nextBtn').textContent = { pa: '다음 타석', switch: '공수 교대', over: '경기 결과' }[G.next];
    $('nextBtn').hidden = false; $('nextBtn').focus({ preventScroll: true });
  }, 600);
};
const showFinal = () => {
  const me = G.myHome ? 'home' : 'away', cpu = G.myHome ? 'away' : 'home';
  const d = G.runs[me] - G.runs[cpu];
  banner(d > 0 ? '승리!' : d < 0 ? '패배' : '무승부',
    `${GAME_SETTINGS.myTeamName} ${G.runs[me]} : ${G.runs[cpu]} ${GAME_SETTINGS.cpuTeamName}`, 0);
  hint('경기 끝. 몇 이닝으로 새 경기를 할지 고르세요.');
  $('stats').textContent = '경기 끝';
  $('batDock').hidden = true; $('pitchDock').hidden = true;
  G.next = 'final';
  $('newGame').hidden = false;
};
const nextPA = () => {
  $('nextBtn').hidden = true; $('banner').classList.remove('show');
  if (G.next === 'over') return showFinal();
  if (G.next === 'switch') {
    if (G.top) G.top = false; else { G.top = true; G.inning++; }
    return startHalf();
  }
  resetCount(); renderBoard(); landMark.isVisible = false; ball.isVisible = false; shadow.isVisible = false;
  S.phase = 'idle';
  if (S.mode === 'bat') setTimeout(startAIPitch, 700); else readyPitch();
};
const callPitch = (res, sub) => {
  // res: 'ball' | 'strike' | 'foul'
  if (res === 'ball') {
    G.balls++;
    if (G.balls >= 4) return endPA('bb', '볼넷', sub);
    banner('볼', sub, 900);
  } else if (res === 'strike') {
    G.strikes++;
    if (G.strikes >= 3) return endPA('k', '삼진', sub);
    banner('스트라이크', sub, 900);
  } else if (res === 'foul') {
    if (G.strikes < 2) G.strikes++;
    banner('파울', sub, 900);
  }
  renderBoard();
  S.phase = 'idle';
  setTimeout(() => { if (S.mode === 'bat') startAIPitch(); else readyPitch(); }, 1300);
};
