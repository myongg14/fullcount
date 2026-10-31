// 시즌: 페넌트레이스(9경기), 홈런더비(10구), 시즌 기록, 기록실·명예의 전당

// 시즌 경기 수
const SEASON_LEN = 9;
// 시즌 경기 중인지
let isSeason = false;
// 시즌 몇 번째 경기인지
let seasonGame = 1;
// 시즌 승
let seasonWins = 0;
// 시즌 패
let seasonLosses = 0;
// 시즌 무
let seasonDraws = 0;
// 지난 경기 결과 글자
let seasonLast = '';
// 시즌이면 이번 상대 팀 이름·색을 정한다
function applyOpp() {
  // KBO 리그 경기면 오늘 상대·선발을 리그 일정에서
  if (isSeason && league) {
    leagueApplyMatch();
    return;
  }
  applyOppRoster(); // 시즌이면 상대 팀 자기 선수단(타순·투수진), 아니면 예전 상대
  if (isSeason) {
    const o = SEASON_OPPS[(seasonGame - 1) % SEASON_OPPS.length];
    const k = KBO_TEAMS.find(t => t.name === o.n);
    TEAM_NAMES.o = o.n;
    // 유니폼: KBO 팀 색(상의, 모자, 바지, 가슴 글자, 글자색)
    TEAM_COLORS.o = k ? [k.colors[0], k.colors[1], k.colors[2], k.nick, k.colors[3]] : [o.c, o.c, 0xdedbd0, o.s, '#fff'];
  } else {
    TEAM_NAMES.o = 'BEARS';
    TEAM_COLORS.o = [0x14235a, 0x14235a, 0xdedbd0, 'BEARS', '#fff'];
    applyMatchTeams(); // 타이틀에서 고른 두 팀(안 고르면 예전 그대로)
  }
}
// 예전 9경기 시즌은 KBO 리그(league.js)로 바뀌었다. 다른 파일에서 부르는 이름은 리그로 이어 준다
// 리그 화면을 다시 그린다
function updateSeasonModal() {
  if (league) renderHub();
}
// 시즌(리그) 저장
function saveSeason() {
  saveLeague();
}
// 타이틀의 '시즌 이어하기' 버튼
function renderSeasonButton() {
  renderLeagueButton();
}
// 새 시즌: 내 팀 고르기
function startSeasonModal() {
  startLeagueSetup();
}
// 저장된 시즌 이어하기
function continueSeason() {
  continueLeague();
}
// 홈런더비 중인지
let derby = false;
// 다음 경기를 홈런더비로 시작할지
let derbyQueued = false;
// 홈런더비에서 던진 공 수
let derbyPitches = 0;
// 홈런더비 홈런 수
let derbyHR = 0;
// 홈런더비를 시작한다
function startDerby() {
  derbyQueued = true;
  startGame(false, false);
}
// 홈런더비를 끝내고 결과를 보여준다
function endDerby() {
  phase = 'over';
  phaseStart = now;
  derby = false;
  $('fs').textContent = 'HR ' + derbyHR;
  $('fd').textContent = derbyHR >= 6 ? '🏆 홈런왕!' : derbyHR >= 3 ? '좋은 스윙!' : '연습이 필요해요';
  $('fb').textContent = '홈런더비 · 10구';
  $('end').style.display = 'flex';
  $('hud').style.display = 'none';
  organ(derbyHR >= 3 ? 'hr' : 'sad');
}
{
  const b = document.createElement('button');
  b.textContent = '🏆 홈런더비 (10구)';
  b.style.cssText =
    'font:inherit;font-size:16px;color:var(--cream);background:rgba(20,26,60,.88);border:2px solid var(--gold);border-radius:12px;padding:8px 14px;touch-action:manipulation';
  b.addEventListener('pointerdown', e => {
    e.stopPropagation();
    unlockAudio();
    startDerby();
  });
  $('title').appendChild(b);
}
// 시즌 기록(타자·투수·득실점·다이빙 캐치)
let seasonStats = null;
// 시즌 기록을 0으로(선수 id별로 모은다: 이적·타순이 바뀌어도 기록이 선수를 따라간다)
function ssReset() {
  seasonStats = { b: {}, p: {}, gp: {}, rs: 0, ra: 0, dv: 0, trades: [] };
}
ssReset();
// 타자 p(타순 배열)의 시즌 기록 칸(없으면 만든다): 타수·안타·홈런·타점·도루
function ssB(p) {
  const id = p[5] || p[0];
  if (!seasonStats.b[id]) seasonStats.b[id] = { n: p[0], pos: p[1], ab: 0, h: 0, hr: 0, rbi: 0, sb: 0 };
  seasonStats.b[id].n = p[0];
  return seasonStats.b[id];
}
// 투수 P의 시즌 기록 칸(없으면 만든다): 승·패·세이브·탈삼진·등판·잡은 아웃·자책점
function ssP(P) {
  const id = P.id || P.n;
  if (!seasonStats.p[id]) seasonStats.p[id] = { n: P.n, w: 0, l: 0, sv: 0, k: 0, g: 0, outs: 0, er: 0 };
  seasonStats.p[id].n = P.n;
  return seasonStats.p[id];
}
// 이번 타석의 타자·투수(타점·자책점을 나중에 붙이려고 기억)
let ssAtBat = null;
// 시즌 타격 기록을 더한다(리그에서는 두 팀 모두)
function ssBat(k) {
  if (!isSeason || k === 'foul') return;
  const p = LINEUPS[pitcherMode ? 'o' : 'm'][curBatter()];
  if (!p) return;
  const x = ssB(p);
  ssAtBat = { x, P: activePitcher() };
  if (league) gainExp(p, GROWTH.expPerPA); // 타석 경험치
  if (['1b', '2b', '3b', 'hr', 'bh'].includes(k)) {
    x.ab++;
    x.h++;
    if (k === 'hr') x.hr++;
  } else if (k === 'go' || k === 'fo') x.ab++;
}
// 타점(applyHit에서 낸 점수)
function ssRbi(r) {
  if (isSeason && ssAtBat && r > 0) ssAtBat.x.rbi += r;
}
// 시즌 삼진 기록을 더한다(타자 타수, 투수 탈삼진)
function ssK() {
  if (!isSeason) return;
  const p = LINEUPS[pitcherMode ? 'o' : 'm'][curBatter()];
  if (p) ssB(p).ab++;
  ssP(activePitcher()).k++;
  if (league && p) gainExp(p, GROWTH.expPerPA);
  if (pitcherMode) leagueHighlight('k'); // 내 투수가 삼진
}
// 이번 경기 투수별 잡은 아웃(승·패·세이브를 정할 때)
let gameOuts = {};
// 아웃을 잡은 투수 기록
function ssOuts(n) {
  if (!isSeason || !twoWay) return;
  const P = activePitcher();
  ssP(P).outs += n;
  if (league) gainExp(P, n * GROWTH.expPerOut); // 아웃 경험치
  gameOuts[P.id] = (gameOuts[P.id] || 0) + n;
}
// 반 이닝에 낸 점수를 지금 마운드 투수의 자책점으로
function ssRuns(n) {
  if (isSeason && twoWay && n > 0) ssP(activePitcher()).er += n;
}
// 도루 성공(주자 칸의 값 = 타순+1)
function ssSteal(tag) {
  if (!isSeason || !tag) return;
  const p = LINEUPS[pitcherMode ? 'o' : 'm'][tag - 1];
  if (p) ssB(p).sb++;
}
// 한 경기가 끝나면: 등판, 승리·패전(가장 많은 아웃을 잡은 투수), 세이브(3점 차 이내, 마지막 불펜), 득실점
function ssGame() {
  if (!seasonStats) return;
  seasonStats.rs += myRuns;
  seasonStats.ra += oppRuns;
  const side = (list, won, lost) => {
    // 나온 순서대로(마지막 투수 = 세이브 후보)
    const used = Object.keys(gameOuts)
      .map(id => list.find(P => P.id === id))
      .filter(Boolean);
    used.forEach(P => ssP(P).g++);
    if (!used.length) return;
    const top = used.reduce((a, P) => (gameOuts[P.id] > gameOuts[a.id] ? P : a));
    if (won) {
      ssP(top).w++;
      const last = used[used.length - 1];
      if (last !== top && last.role === 'RP' && Math.abs(myRuns - oppRuns) <= 3) ssP(last).sv++;
    }
    if (lost) ssP(top).l++;
  };
  side(PITCHERS, myRuns > oppRuns, myRuns < oppRuns);
  if (cpuStaff) side(cpuStaff, oppRuns > myRuns, oppRuns < myRuns);
  gameOuts = {};
}
// 시즌 종료 기록실·명예의 전당 화면
function showHof(champ) {
  const f = x => (x.ab ? (x.h / x.ab).toFixed(3).replace(/^0/, '') : '.000'),
    // 지금 내 선수(타순+후보)와 시즌 중 기록이 있는 선수(이적해 간 선수 포함)
    bt = [...LINEUPS.m, ...MY_BENCH].map(p => ssB(p)).concat(
      (leagueEnding ? [] : Object.values(seasonStats.b)).filter(x => ![...LINEUPS.m, ...MY_BENCH].some(p => ssB(p) === x)),
    ),
    av = bt.filter(x => x.ab > 0).sort((a, b) => b.h / b.ab - a.h / a.ab || b.h - a.h)[0],
    hk = [...bt].sort((a, b) => b.hr - a.hr || b.h - a.h)[0],
    pt = (leagueEnding ? PITCHERS.map(ssP) : Object.values(seasonStats.p)).sort(
      (a, b) => b.w - a.w || b.k - a.k || b.g - a.g,
    )[0],
    g = seasonWins + seasonLosses,
    pc = g ? (seasonWins / g).toFixed(3).replace(/^0/, '') : '.000';
  let H = { s: 0, t: 0, w: 0 };
  try {
    H = Object.assign(H, JSON.parse(localStorage.getItem('nb3_hof') || '{}'));
  } catch (e) {}
  H.s++;
  if (champ) H.t++;
  H.w += seasonWins;
  try {
    localStorage.setItem('nb3_hof', JSON.stringify(H));
  } catch (e) {}
  $('hof-in').innerHTML =
    `<div style="height:62vh"></div><div class="big">${champ ? '🏆' : '⚾'}</div><h1>${champ ? (leagueEnding ? '한국시리즈 우승!' : '페넌트레이스 우승!') : '시즌 종료'}</h1><p style="color:#9fb0e8">${champ ? '당신의 팀이 정상에 올랐습니다' : leagueEnding ? `한국시리즈 우승: ${teamName(leagueEnding.champ)}` : '내년엔 더 높이 날아올라요'}</p>
 <h3>팀 성적</h3><div class="card"><b>${seasonWins}승 ${seasonLosses}패${seasonDraws ? ' ' + seasonDraws + '무' : ''}</b> · 승률 ${pc}<br>득점 ${seasonStats.rs} · 실점 ${seasonStats.ra} · 득실차 ${seasonStats.rs - seasonStats.ra > 0 ? '+' : ''}${seasonStats.rs - seasonStats.ra}</div>
${leagueEnding ? `<h3>🏅 리그 타이틀</h3><div class="card">${leagueEnding.awards.map(a => `${a.title} <b>${a.name}</b> (${a.team}) ${a.v}`).join('<br>') || '기록 없음'}</div>` : ''}
 <h3>🥇 타율왕</h3><div class="card">${av ? `<b>${av.n}</b> (${av.pos})<br>타율 ${f(av)} · ${av.ab}타수 ${av.h}안타` : '기록 없음'}</div>
 <h3>💥 홈런왕</h3><div class="card">${hk && hk.hr ? `<b>${hk.n}</b> (${hk.pos})<br>${hk.hr}홈런` : '홈런 기록 없음'}</div>
 <h3>⚾ 다승왕</h3><div class="card">${pt && (pt.w || pt.g) ? `<b>${pt.n}</b><br>${pt.w}승 · 탈삼진 ${pt.k} · ${pt.g}경기 등판` : '등판 기록 없음'}</div>
 <h3>🤿 슈퍼캐치</h3><div class="card">다이빙 캐치 성공 <b>${seasonStats.dv}</b>회</div>
 <h3>타선 기록</h3><div class="card"><table><tr><th>선수</th><th>타수</th><th>안타</th><th>HR</th><th>타율</th></tr>${bt.map(x => `<tr><td>${x.n}</td><td>${x.ab}</td><td>${x.h}</td><td>${x.hr}</td><td>${f(x)}</td></tr>`).join('')}</table></div>
 <h3>🔁 이적 기록</h3><div class="card">${(seasonStats.trades || []).length ? seasonStats.trades.map(t => '· ' + t).join('<br>') : '이번 시즌 이적 없음'}</div>
 <h3>🏛 명예의 전당</h3>${
   [av && ['타율왕', av.n], hk && hk.hr && ['홈런왕', hk.n], pt && pt.w && ['다승왕', pt.n]]
     .filter(Boolean)
     .map(x => `<div class="card"><b>${x[1]}</b><br>${x[0]} 헌액</div>`)
     .join('') || '<div class="card">이번 시즌 헌액자 없음</div>'
 }
 ${league && league.retired && league.retired.length ? `<h3>👋 은퇴 선수</h3><div class="card">${league.retired.slice(-15).reverse().map(r => `${r.season}시즌 뒤 <b>${r.n}</b> (${r.team}, ${r.age}세, OVR ${r.ovr})`).join('<br>')}</div>` : ''}
 <h3>통산 기록</h3><div class="card">시즌 ${H.s}회 · 우승 ${H.t}회 · 통산 ${H.w}승</div>
 <h3 style="margin-top:46px">Thank you for playing</h3><p style="color:#9fb0e8">나이트 베이스볼 3D</p>`;
  const hf = $('hof'),
    rl = $('hof-roll');
  hf.style.display = 'flex';
  rl.scrollTop = 0;
  let on = true;
  const stop = () => {
    on = false;
  };
  rl.addEventListener('touchstart', stop, { once: true });
  rl.addEventListener('wheel', stop, { once: true });
  const stp = () => {
    if (!on || hf.style.display !== 'flex') return;
    rl.scrollTop += 1;
    if (rl.scrollTop + rl.clientHeight < rl.scrollHeight - 1) requestAnimationFrame(stp);
  };
  requestAnimationFrame(stp);
}
$('hof-next').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  $('hof').style.display = 'none';
  // 리그 시즌이 끝났으면 타이틀로
  if (leagueEnding) {
    // 리그 시즌이 끝났으면 스토브리그로(나이·성장·은퇴 → 드래프트 → FA → 다음 시즌)
    leagueEnding = null;
    if (league) {
      startOffseason();
      showHub();
      openSeasonEnd(); // 상금 → 나이·성장·은퇴 → 드래프트 → FA → 다음 시즌
    } else backToTitle();
    return;
  }
  $('end').style.display = 'flex';
});
$('btn-cont').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  unlockAudio();
  continueSeason();
});
