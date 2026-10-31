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
  applyOppRoster(); // 시즌이면 상대 팀 자기 선수단(타순·투수진), 아니면 예전 상대
  if (isSeason) {
    const o = SEASON_OPPS[(seasonGame - 1) % SEASON_OPPS.length];
    TEAM_NAMES.o = o.n;
    TEAM_COLORS.o = [o.c, o.c, 0xdedbd0, o.s, '#fff'];
  } else {
    TEAM_NAMES.o = 'BEARS';
    TEAM_COLORS.o = [0x14235a, 0x14235a, 0xdedbd0, 'BEARS', '#fff'];
  }
}
// 페넌트레이스 창의 성적·다음 상대를 그린다
function updateSeasonModal() {
  const o = SEASON_OPPS[(seasonGame - 1) % SEASON_OPPS.length],
    g = seasonWins + seasonLosses;
  $('season-info').innerHTML =
    (seasonLast ? `<small style="color:#9fb0e8">지난 경기: ${seasonLast}</small><br>` : '') +
    `<b>성적</b> ${seasonWins}승 ${seasonLosses}패${seasonDraws ? ' ' + seasonDraws + '무' : ''} (승률 ${(g ? seasonWins / g : 0).toFixed(3)})<br><b>다음 경기 ${seasonGame}/${SEASON_LEN}</b> · VS ${o.n}<br><span style="color:#9fb0e8;font-size:14px">${SEASON_LEN}경기 중 6승 이상이면 페넌트레이스 우승!</span>`;
  $('season-next').textContent = seasonGame === 1 ? '시즌 개막!' : '다음 경기 시작';
  const closed = marketOpen();
  $('btn-market').textContent = '🔁 이적 시장' + (closed ? ' (마감)' : ` (남은 이적 ${TRADE_TUNING.perSeason - tradesUsed}번)`);
}
// ---------- 시즌 저장(며칠에 걸쳐 하기) ----------
const SEASON_KEY = 'nb3_season';
// 시즌 진행(몇 번째 경기, 승패, 선수 기록)을 기기에 저장한다(못 하면 넘어간다)
function saveSeason() {
  try {
    localStorage.setItem(
      SEASON_KEY,
      JSON.stringify({
        game: seasonGame,
        w: seasonWins,
        l: seasonLosses,
        d: seasonDraws,
        last: seasonLast,
        stats: seasonStats,
        roster: rosterState(), // 선수단(이적 결과)도 같이
      }),
    );
  } catch (e) {}
  renderSeasonButton();
}
// 저장된 시즌(없거나 깨졌으면 null)
function loadSeasonSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SEASON_KEY));
    return s && s.game >= 1 && s.game <= SEASON_LEN && s.stats && s.stats.b ? s : null;
  } catch (e) {
    return null;
  }
}
function clearSeasonSave() {
  try {
    localStorage.removeItem(SEASON_KEY);
  } catch (e) {}
  renderSeasonButton();
}
// 저장된 시즌이 있으면 타이틀에 '시즌 이어하기' 버튼
function renderSeasonButton() {
  const s = loadSeasonSave();
  $('btn-cont').style.display = s ? 'inline-block' : 'none';
  if (s) $('btn-cont').textContent = `▶ 시즌 이어하기 (${s.game}/${SEASON_LEN}경기 · ${s.w}승 ${s.l}패)`;
}
// 저장된 시즌을 이어서 페넌트레이스 창을 연다
function continueSeason() {
  const s = loadSeasonSave();
  if (!s) return;
  ssReset();
  if (Array.isArray(s.stats.b)) {
    // 예전 저장(타순 순서별 기록) → 선수 id별로 옮긴다
    s.stats.b.forEach((x, i) => LINEUPS.m[i] && Object.assign(ssB(LINEUPS.m[i]), x));
    (s.stats.p || []).forEach((x, i) => PITCHERS[i] && Object.assign(ssP(PITCHERS[i]), x));
  } else {
    seasonStats.b = s.stats.b || {};
    seasonStats.p = s.stats.p || {};
    seasonStats.trades = s.stats.trades || [];
  }
  ['rs', 'ra', 'dv'].forEach(k => (seasonStats[k] = s.stats[k] || 0));
  if (s.roster) applyRosterState(s.roster);
  isSeason = true;
  seasonGame = s.game;
  seasonWins = s.w;
  seasonLosses = s.l;
  seasonDraws = s.d;
  seasonLast = s.last || '';
  $('title').style.display = 'none';
  updateSeasonModal();
  $('season-modal').style.display = 'flex';
}
// 새 시즌을 시작하고 페넌트레이스 창을 연다(저장된 시즌이 있으면 확인 후 지운다)
function startSeasonModal() {
  const saved = loadSeasonSave();
  if (saved && !confirm(`저장된 시즌(${saved.game}경기째, ${saved.w}승 ${saved.l}패)이 있어요.\n새 시즌을 시작하면 지워져요. 새로 시작할까요?`))
    return;
  clearSeasonSave();
  // 이적으로 선수단이 바뀌어 있으면 유지할지 묻는다
  if (rosterChanged())
    askChoice('새 시즌 선수단', '지난 이적으로 바뀐 선수단을 그대로 쓸까요?', ['선수단 유지', '처음 선수단으로'], k =>
      beginNewSeason(k === 0),
    );
  else beginNewSeason(true);
}
// 새 시즌 시작(keep: 선수단 유지)
function beginNewSeason(keep) {
  if (!keep) resetRoster();
  newSeasonMarket();
  ssReset();
  isSeason = true;
  seasonGame = 1;
  seasonWins = 0;
  seasonLosses = 0;
  seasonDraws = 0;
  seasonLast = '';
  saveSeason();
  $('title').style.display = 'none';
  updateSeasonModal();
  $('season-modal').style.display = 'flex';
}
// 시즌 경기 결과를 기록하고 다음 경기 또는 시즌 종료로 간다
function seasonResult() {
  ssGame();
  const r = myRuns > oppRuns ? '승' : myRuns < oppRuns ? '패' : '무',
    o = SEASON_OPPS[(seasonGame - 1) % SEASON_OPPS.length];
  if (r === '승') seasonWins++;
  else if (r === '패') seasonLosses++;
  else seasonDraws++;
  seasonLast = `${seasonGame}경기 vs ${o.n} ${myRuns}:${oppRuns} ${r}`;
  seasonGame++;
  if (seasonGame > SEASON_LEN) {
    isSeason = false;
    clearSeasonSave(); // 시즌이 끝나면 저장 지우기
    keepRoster(); // 다음 시즌에 '선수단 유지'를 고를 수 있게
    $('fs').textContent = `${seasonWins}승 ${seasonLosses}패${seasonDraws ? ' ' + seasonDraws + '무' : ''}`;
    $('fd').textContent = seasonWins >= 6 ? '🏆 페넌트레이스 우승!' : '가을야구 진출 실패...';
    $('fb').textContent = '시즌 종료 · 마지막 경기 ' + seasonLast;
    showHof(seasonWins >= 6);
    return;
  }
  saveSeason(); // 경기가 끝날 때마다 저장
  updateSeasonModal();
  $('season-modal').style.display = 'flex';
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
// 타자 p(타순 배열)의 시즌 기록 칸(없으면 만든다)
function ssB(p) {
  const id = p[5] || p[0];
  if (!seasonStats.b[id]) seasonStats.b[id] = { n: p[0], pos: p[1], ab: 0, h: 0, hr: 0 };
  seasonStats.b[id].n = p[0];
  return seasonStats.b[id];
}
// 투수 P의 시즌 기록 칸(없으면 만든다)
function ssP(P) {
  const id = P.id || P.n;
  if (!seasonStats.p[id]) seasonStats.p[id] = { n: P.n, w: 0, k: 0, g: 0 };
  seasonStats.p[id].n = P.n;
  return seasonStats.p[id];
}
// 시즌 타격 기록을 더한다
function ssBat(k) {
  if (!isSeason || pitcherMode || k === 'foul') return;
  const p = LINEUPS.m[curBatter()];
  if (!p) return;
  const x = ssB(p);
  if (['1b', '2b', '3b', 'hr', 'bh'].includes(k)) {
    x.ab++;
    x.h++;
    if (k === 'hr') x.hr++;
  } else if (k === 'go' || k === 'fo') x.ab++;
}
// 시즌 삼진 기록을 더한다
function ssK() {
  if (!isSeason) return;
  if (pitcherMode) ssP(PITCHERS[curPitcher]).k++;
  else {
    const p = LINEUPS.m[curBatter()];
    if (p) ssB(p).ab++;
  }
}
// 한 경기가 끝나면 시즌 득실점과 투수 등판·승리를 더한다(가장 많이 던진 투수가 승리)
function ssGame() {
  if (!seasonStats) return;
  seasonStats.rs += myRuns;
  seasonStats.ra += oppRuns;
  let best = null;
  PITCHERS.forEach(P => {
    const n = seasonStats.gp[P.id] || 0;
    if (!n) return;
    ssP(P).g++;
    if (!best || n > (seasonStats.gp[best.id] || 0)) best = P;
  });
  if (myRuns > oppRuns && best) ssP(best).w++;
  seasonStats.gp = {};
}
// 시즌 종료 기록실·명예의 전당 화면
function showHof(champ) {
  const f = x => (x.ab ? (x.h / x.ab).toFixed(3).replace(/^0/, '') : '.000'),
    // 지금 내 선수(타순+후보)와 시즌 중 기록이 있는 선수(이적해 간 선수 포함)
    bt = [...LINEUPS.m, ...MY_BENCH].map(p => ssB(p)).concat(
      Object.values(seasonStats.b).filter(x => ![...LINEUPS.m, ...MY_BENCH].some(p => ssB(p) === x)),
    ),
    av = bt.filter(x => x.ab > 0).sort((a, b) => b.h / b.ab - a.h / a.ab || b.h - a.h)[0],
    hk = [...bt].sort((a, b) => b.hr - a.hr || b.h - a.h)[0],
    pt = Object.values(seasonStats.p).sort(
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
    `<div style="height:62vh"></div><div class="big">${champ ? '🏆' : '⚾'}</div><h1>${champ ? '페넌트레이스 우승!' : '시즌 종료'}</h1><p style="color:#9fb0e8">${champ ? '당신의 팀이 정상에 올랐습니다' : '내년엔 더 높이 날아올라요'}</p>
 <h3>팀 성적</h3><div class="card"><b>${seasonWins}승 ${seasonLosses}패${seasonDraws ? ' ' + seasonDraws + '무' : ''}</b> · 승률 ${pc}<br>득점 ${seasonStats.rs} · 실점 ${seasonStats.ra} · 득실차 ${seasonStats.rs - seasonStats.ra > 0 ? '+' : ''}${seasonStats.rs - seasonStats.ra}</div>
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
  $('end').style.display = 'flex';
});
$('btn-cont').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  unlockAudio();
  continueSeason();
});
renderSeasonButton();
