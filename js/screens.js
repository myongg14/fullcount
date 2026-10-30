// 화면: 시작 메뉴(팀·홈/원정·이닝·낮/밤·난이도), 경기 중 일시정지, 경기 결과(라인 스코어·내 선수 기록·최고 기록)

// ---------- 시작 메뉴 ----------
const SETTINGS_KEY = 'fullcount-settings';
// 마지막에 고른 설정을 기억한다(저장이 안 되는 환경이어도 게임은 된다)
const loadSettings = () => {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; }
};
const saveSettings = s => {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* 저장 못 해도 괜찮다 */ }
};
const menuState = {
  team: 0, home: false, innings: 3, night: GAME_SETTINGS.night, rookie: true,
  ...loadSettings(),
};
// 주소 끝에 ?night 를 붙여 열면 기억한 값보다 우선
if (/[?&]night\b/.test(location.search)) menuState.night = true;

const renderMenu = () => {
  $('teamPick').innerHTML = TEAMS.map((t, i) => `
    <button class="team-card" data-team="${i}" aria-pressed="${menuState.team === i}">
      <span class="swatch" style="background: linear-gradient(135deg, ${t.colors[0]} 50%, ${t.colors[1]} 50%)"></span>
      <span>${t.name}</span>
    </button>`).join('');
  $('teamPick').querySelectorAll('.team-card').forEach(b => b.onclick = () => { menuState.team = Number(b.dataset.team); renderMenu(); });
  const seg = (id, key, values) => {
    $(id).querySelectorAll('button').forEach((b, i) => {
      b.setAttribute('aria-pressed', menuState[key] === values[i]);
      b.onclick = () => { menuState[key] = values[i]; renderMenu(); };
    });
  };
  seg('pickSide', 'home', [false, true]);
  seg('pickInnings', 'innings', [3, 9]);
  seg('pickTime', 'night', [false, true]);
  seg('pickLevel', 'rookie', [true, false]);
};
// 하던 경기를 멈추고 정리한다(날아가던 공, 플레이, 버튼)
const abortGame = () => {
  play = null; flight = null;
  ball.isVisible = false; shadow.isVisible = false; landMark.isVisible = false;
  releaseAimCancel(); closeBullpen();
  ['nextBtn', 'ffBtn'].forEach(id => { $(id).hidden = true; });
  $('banner').classList.remove('show');
};
const showMenu = () => {
  closePause(); $('result').hidden = true;
  abortGame();
  renderMenu();
  $('menu').hidden = false;
  document.body.classList.add('in-menu');
  S.phase = 'menu';
  applyTimeOfDay(menuState.night);
};
const startGame = () => {
  saveSettings(menuState);
  GAME_SETTINGS.myTeam = menuState.team;
  GAME_SETTINGS.myHome = menuState.home;
  GAME_SETTINGS.night = menuState.night;
  S.rookie = menuState.rookie;
  $('slowBtn').setAttribute('aria-pressed', S.rookie);
  $('slowBtn').textContent = S.rookie ? '루키(느리게)' : '프로(실제 속도)';
  $('menu').hidden = true; $('result').hidden = true;
  document.body.classList.remove('in-menu');
  newGame(menuState.innings);
};

// ---------- 일시정지 ----------
// 게임 시계(now)를 멈추면 투구·타구·플레이·관객이 모두 그 자리에서 멈춘다
const openPause = () => {
  if (!$('menu').hidden || !$('result').hidden || isPaused()) return;
  if (aim.active) releaseAimCancel();
  pauseClock(true);
  $('pause').hidden = false;
};
const closePause = () => { $('pause').hidden = true; pauseClock(false); };
// 조준 중에 일시정지하면 던지지 않고 조준만 취소
const releaseAimCancel = () => { aim.active = false; $('aimTarget').hidden = true; $('aimShrink').hidden = true; };

// ---------- 경기 결과 ----------
const ipText = outs => `${Math.floor(outs / 3)}${outs % 3 ? ` ${outs % 3}/3` : ''}`;
const showResult = () => {
  const me = G.myHome ? 'home' : 'away', cpu = G.myHome ? 'away' : 'home';
  const d = G.runs[me] - G.runs[cpu];
  $('resultTitle').textContent = d > 0 ? '승리!' : d < 0 ? '패배' : '무승부';
  $('resultTitle').dataset.kind = d > 0 ? 'win' : d < 0 ? 'lose' : 'draw';
  $('resultScore').textContent = `${teamName(me)} ${G.runs[me]} : ${G.runs[cpu]} ${teamName(cpu)}`;
  // 라인 스코어
  const cols = Math.max(G.innings, G.inning);
  const head = `<tr><th></th>${Array.from({ length: cols }, (_, i) => `<th>${i + 1}</th>`).join('')}<th>R</th><th>H</th></tr>`;
  const row = side => `<tr${side === me ? ' class="mine"' : ''}><th>${teamName(side)}</th>${Array.from({ length: cols }, (_, i) =>
    `<td>${G.line[side][i] ?? (i === cols - 1 && side === 'home' && G.line.home[i] == null ? 'X' : '')}</td>`).join('')}<td class="tot">${G.runs[side]}</td><td class="tot">${G.hits[side]}</td></tr>`;
  $('lineScore').innerHTML = head + row('away') + row('home');
  // 내 타자 기록
  const myTeam = team(me);
  $('myBatting').innerHTML = '<tr><th>타순</th><th>이름</th><th>타수</th><th>안타</th><th>홈런</th><th>타점</th><th>삼진</th></tr>'
    + myTeam.batters.map((b, i) => { const x = G.box[me][i]; return `<tr><td>${i + 1}</td><td class="name">${b.name}</td><td>${x.ab}</td><td>${x.h}</td><td>${x.hr}</td><td>${x.rbi}</td><td>${x.k}</td></tr>`; }).join('');
  // 내 투수 기록(등판한 투수만)
  $('myPitching').innerHTML = '<tr><th>이름</th><th>이닝</th><th>투구 수</th><th>피안타</th><th>실점</th><th>탈삼진</th></tr>'
    + G.usedPitchers[me].map(i => { const p = myTeam.pitchers[i], x = G.pstats[me][i] || { outs: 0, h: 0, r: 0, k: 0 };
      return `<tr><td class="name">${p.name}</td><td>${ipText(x.outs)}</td><td>${G.pitchCount[me][i] || 0}</td><td>${x.h}</td><td>${x.r}</td><td>${x.k}</td></tr>`; }).join('');
  // 이번 경기 최고 기록
  const hr = G.records.hr, ev = G.records.ev;
  $('records').innerHTML = `
    <div><span>가장 긴 홈런</span><b>${hr ? `${hr.dist}m` : '-'}</b><small>${hr ? `${hr.name} (${hr.team})` : '홈런이 없었어요'}</small></div>
    <div><span>가장 빠른 타구</span><b>${ev ? `${ev.kmh}km/h` : '-'}</b><small>${ev ? `${ev.name} (${ev.team})` : ''}</small></div>`;
  $('batDock').hidden = true; $('pitchDock').hidden = true; $('banner').classList.remove('show');
  $('result').hidden = false;
  $('result').scrollTop = 0;
  G.next = 'final';
};

$('startBtn').onclick = startGame;
$('pauseBtn').onclick = openPause;
$('resumeBtn').onclick = closePause;
$('toMenuBtn').onclick = showMenu;
$('againBtn').onclick = startGame;
$('resultMenuBtn').onclick = showMenu;
