// 구단 역사·시즌 마무리: 시상(MVP·신인왕), 시즌 끝 순서 화면, 구단 역사, 처음부터 다시, 저장 용량 줄이기,
// 팀 편집 이름 반영, 한 경기·홈런더비 팀 고르기, 긴 목록(보이는 줄만 그리기)

// 구단 설정표(밸런스 숫자)
const CLUB = {
  // MVP·신인왕 점수: 타자 = 안타×hit + 홈런×hr + 타점×rbi + 도루×sb
  hit: 1,
  hr: 3,
  rbi: 1,
  sb: 0.7,
  // 투수 = (승×w + 세이브×sv + 탈삼진×k + 이닝×ip − 자책×er) × pitMul
  w: 5,
  sv: 2.5,
  k: 0.4,
  ip: 0.6,
  er: 1.2,
  pitMul: 1.8,
  mvpMinAb: 0.5, // MVP 타자 최소 타석: 타율 규정 타석 × 이 값
  saveLimitKB: 2000, // 저장이 이만큼(KB) 넘으면 오래된 기록을 요약만 남긴다(기기 저장 공간은 약 5MB)
  keepGames: 15, // 줄일 때 경기 기록을 자세히 남길 최근 경기 수
  keepNews: 30, // 이적 소식 남길 수
  keepRetired: 60, // 은퇴 선수 명단 남길 수
  rowH: 84, // 이적 시장 목록 한 줄 높이(px, 보이는 줄만 그릴 때)
};

// ---------- 시상: MVP·신인왕 ----------
// 선수 id로 지금 팀 줄임말(없으면 빈 글자)
function teamTagOf(id) {
  for (const [c, R] of Object.entries(league.rosters)) if ([...R.batters, ...R.pitchers].some(y => idOf(y) === id)) return teamShort(c);
  return league.fa.some(y => idOf(y) === id) ? 'FA' : '';
}
const batScore = x => x.h * CLUB.hit + x.hr * CLUB.hr + x.rbi * CLUB.rbi + x.sb * CLUB.sb;
const pitScore = x => (x.w * CLUB.w + x.sv * CLUB.sv + x.k * CLUB.k + (x.outs / 3) * CLUB.ip - x.er * CLUB.er) * CLUB.pitMul;
// 이번 시즌 기록이 있는 선수들(점수, 한 줄 기록)
function scoredPlayers() {
  const out = [];
  Object.entries(seasonStats.b).forEach(([id, x]) => {
    if (x.ab) out.push({ id, n: x.n, bat: true, ab: x.ab, s: batScore(x), line: `타율 ${(x.h / x.ab).toFixed(3).replace(/^0/, '')} · ${x.hr}홈런 · ${x.rbi}타점` });
  });
  Object.entries(seasonStats.p).forEach(([id, x]) => {
    if (x.outs) out.push({ id, n: x.n, bat: false, s: pitScore(x), line: `${x.w}승 ${x.l}패${x.sv ? ' ' + x.sv + '세이브' : ''} · 탈삼진 ${x.k} · 평균자책 ${((x.er * 27) / x.outs).toFixed(2)}` });
  });
  return out;
}
// 그 시즌 신인인지(드래프트로 들어와 첫 시즌)
function isRookieNow(id) {
  const r = league.recs && league.recs[id],
    e = league.extra && league.extra[id];
  const rec = r || e;
  return !!(rec && rec.rookie && rec.ds === (league.season || 1));
}
// MVP와 신인왕 { mvp, rookie } (없으면 null)
function seasonHonors() {
  const list = scoredPlayers(),
    minAb = league.sched.length * LEAGUE.minAbPerGame * CLUB.mvpMinAb,
    best = arr => arr.reduce((a, x) => (!a || x.s > a.s ? x : a), null),
    tag = x => x && { ...x, team: teamTagOf(x.id) };
  return {
    mvp: tag(best(list.filter(x => !x.bat || x.ab >= minAb))),
    rookie: tag(best(list.filter(x => isRookieNow(x.id)))),
  };
}
// 리그 타이틀 목록 뒤에 MVP·신인왕을 붙인다
function honorAwards() {
  const h = seasonHonors(),
    out = [];
  if (h.mvp) out.push({ title: '⭐ MVP', name: h.mvp.n, team: h.mvp.team, v: h.mvp.line });
  out.push(h.rookie ? { title: '🌱 신인왕', name: h.rookie.n, team: h.rookie.team, v: h.rookie.line } : { title: '🌱 신인왕', name: '해당 없음', team: '-', v: '' });
  return out;
}

// ---------- 구단 역사 ----------
// 포스트시즌에서 내 팀이 간 곳
function myPostResult() {
  const P = league.post,
    my = league.my;
  if (!P || !P.seeds.includes(my)) return '진출 실패';
  if (P.champ === my) return '🏆 한국시리즈 우승';
  const lost = P.done.find(s => (s.hi === my || s.lo === my) && s.winner !== my);
  return lost ? `${POST_ROUNDS[lost.r].label} 탈락` : '진출';
}
// 시즌이 끝날 때(시즌 마무리 버튼) 한 번 기록
function recordHistory() {
  league.history = league.history || [];
  const s = league.season || 1;
  if (league.history.some(h => h.s === s)) return;
  const t = league.table[league.my],
    mine = new Set([...LINEUPS.m, ...MY_BENCH, ...PITCHERS].map(idOf)),
    best = scoredPlayers()
      .filter(x => mine.has(x.id))
      .reduce((a, x) => (!a || x.s > a.s ? x : a), null),
    h = seasonHonors();
  league.history.push({
    s,
    rank: rankList().indexOf(league.my) + 1,
    w: t.w,
    l: t.l,
    d: t.d,
    post: myPostResult(),
    champ: league.post && league.post.champ,
    best: best ? `${best.n} (${best.line})` : '-',
    mvp: h.mvp ? `${h.mvp.n} (${h.mvp.team})` : '-',
    funds: league.funds[league.my],
  });
}
function renderHistory() {
  const H = league.history || [],
    cnt = f => H.filter(f).length,
    W = H.reduce((a, h) => a + h.w, 0),
    L = H.reduce((a, h) => a + h.l, 0);
  $('hiSum').innerHTML =
    `<b>${teamName(league.my)}</b> · ${H.length}시즌 · 통산 ${W}승 ${L}패<br>` +
    `🏆 한국시리즈 우승 <b>${cnt(h => h.champ === league.my)}</b>회 · 정규 시즌 1위 <b>${cnt(h => h.rank === 1)}</b>회 · 포스트시즌 진출 <b>${cnt(h => h.post !== '진출 실패')}</b>회`;
  $('hiTable').innerHTML =
    '<tr><th>시즌</th><th>순위</th><th>승패</th><th>포스트시즌</th><th>최고 선수</th><th>MVP</th><th>자금</th></tr>' +
    (H.slice()
      .reverse()
      .map(
        h =>
          `<tr class="${h.champ === league.my ? 'mine' : ''}"><td>${h.s}</td><td>${h.rank}위</td><td>${h.w}승 ${h.l}패${h.d ? ' ' + h.d + '무' : ''}</td><td>${h.post}</td><td>${h.best}</td><td>${h.mvp}</td><td>${moneyText(h.funds)}</td></tr>`,
      )
      .join('') || '<tr><td colspan="7">아직 끝난 시즌이 없어요</td></tr>');
  const R = (league.retired || []).slice(-12).reverse();
  $('hiRetired').innerHTML = R.length ? R.map(r => `${r.season}시즌 뒤 <b>${r.n}</b> (${r.team}, ${r.age}세, OVR ${r.ovr})`).join('<br>') : '아직 은퇴한 선수가 없어요';
}
function openHistory() {
  renderHistory();
  $('history').style.display = 'block';
}
$('history').addEventListener('pointerdown', e => e.stopPropagation());
$('hiClose').addEventListener('click', () => ($('history').style.display = 'none'));

// ---------- 시즌 끝 순서 화면 ----------
// 명예의 전당(시상) 다음: 상금 → 나이·성장·은퇴 → 신인 드래프트 → FA 시장 → 다음 시즌
const SEQ = [
  ['prize', '💰 상금'],
  ['aging', '🎂 나이·성장·은퇴'],
  ['draft', '🎓 신인 드래프트'],
  ['fa', '🔁 FA 시장'],
  ['next', '▶ 다음 시즌'],
];
// 내 차례 지명을 모두 자동으로(스카우트 평가가 좋은 신인)
function autoDraftMine() {
  if (!league.draft) return;
  draftRunCpu();
  while (draftTeam() === league.my) {
    const best = league.draft.pool.reduce((a, id) => (league.extra[id].scoutStars > league.extra[a].scoutStars ? id : a));
    draftPick(league.my, best);
    draftRunCpu();
  }
}
function renderSeasonEnd() {
  const i = clamp(league.seq || 0, 0, SEQ.length - 1),
    k = SEQ[i][0];
  $('seSteps').innerHTML = SEQ.map(([, l], j) => `<span class="${j === i ? 'on' : j < i ? 'done' : ''}">${l}</span>`).join('<b>→</b>');
  $('seTitle').textContent = `${league.season}번째 시즌 마무리 · ${SEQ[i][1]}`;
  let body = '',
    act = '';
  if (k === 'prize') {
    const P = league.prizes || [];
    body =
      (P.length ? P.map(p => `<div class="lg-res">${p.t} <b class="pos">+${moneyText(p.a)}</b></div>`).join('') : '<p class="mk-note">이번 시즌 상금이 없어요</p>') +
      `<p class="lg-money">상금 합계 <b>+${moneyText(won1(P.reduce((a, p) => a + p.a, 0)))}</b> · 시즌 수입 +${league.flow.in.toFixed(1)}억 / 지출 −${league.flow.out.toFixed(1)}억 · 지금 자금 <b>${moneyText(league.funds[league.my])}</b></p>`;
  } else if (k === 'aging') {
    const rep = league.report || [],
      ret = (league.retired || []).filter(r => r.season === league.season);
    body =
      `<h3>내 선수</h3>` +
      (rep.length ? `<div class="lg-report">${rep.join('<br>')}</div>` : '<p class="mk-note">능력이 바뀐 선수가 없어요</p>') +
      `<h3>리그 은퇴 선수 (${ret.length}명)</h3><p class="mk-note">${ret.map(r => `${r.n}(${r.team}, ${r.age}세)`).join(' · ') || '없음'}</p>`;
  } else if (k === 'draft') {
    const D = league.draft,
      done = draftDone(),
      mine = D ? D.log.filter(l => l.includes(` ${teamShort(league.my)}: `)) : [];
    body = done
      ? `<p>드래프트가 끝났어요. 뽑은 신인: <b>${mine.map(l => l.split(': ')[1]).join(', ') || '없음'}</b></p>`
      : `<p>가상의 신인 ${D.pool.length}명 · ${D.rounds}라운드 · 순위 역순(10위부터)</p><p class="mk-note">직접 고르거나, 스카우트 평가가 좋은 신인으로 자동으로 뽑을 수 있어요</p>`;
    if (!done) act = '<button id="seDraft" class="te-main">🎓 드래프트 하기</button><button id="seDraftAuto">자동으로 뽑기</button>';
  } else if (k === 'fa') {
    const fa = league.fa
      .slice()
      .sort((a, b) => playerCard(b).ovr - playerCard(a).ovr)
      .slice(0, 6);
    body =
      `<p>FA 선수 ${league.fa.length}명. 다음 시즌을 시작하면 남은 FA는 컴퓨터 팀이 데려가요.</p>` +
      fa.map(x => `<div class="lg-res">${nameOf(x)} · ${recordOf(x).age}세 · OVR ${playerCard(x).ovr} · 계약금 ${moneyText(won1(playerCard(x).value * MARKET.faSignRate))}</div>`).join('');
    act = '<button id="seMarket" class="te-main">🔁 이적 시장 열기</button>';
  } else {
    const lim = rosterLimit(league.my, 0, 0);
    body =
      `<p>타자 ${LINEUPS.m.length + MY_BENCH.length}명 · 투수 ${PITCHERS.length}명 · 자금 ${moneyText(league.funds[league.my])} · 연봉 합계 ${payrollOf(league.my).toFixed(1)}억/시즌</p>` +
      (lim ? `<p class="neg">선수단을 맞춰 주세요: ${lim}</p>` : '<p>일정·순위·개인 기록은 새로 시작하고, 선수단·자금·나이·성장은 이어져요.</p>');
    act = `<button id="seGo" class="te-main">▶ ${league.season + 1}번째 시즌 시작</button>${lim ? '<button id="seMarket">🔁 이적 시장 열기</button>' : ''}`;
  }
  $('seBody').innerHTML = body;
  $('seAct').innerHTML = act;
  $('sePrev').style.display = i ? '' : 'none';
  $('seNext').style.display = i < SEQ.length - 1 ? '' : 'none';
  $('seNext').disabled = k === 'draft' && !draftDone();
  $('seMsg').textContent = $('seNext').disabled ? '드래프트를 끝내야 다음으로 넘어가요' : '';
}
function openSeasonEnd() {
  if (!league || league.phase !== 'stove') return;
  renderSeasonEnd();
  $('seasonEnd').style.display = 'block';
}
$('seasonEnd').addEventListener('pointerdown', e => e.stopPropagation());
$('sePrev').addEventListener('click', () => {
  league.seq = Math.max(0, (league.seq || 0) - 1);
  saveLeague();
  renderSeasonEnd();
});
$('seNext').addEventListener('click', () => {
  if ($('seNext').disabled) return;
  league.seq = Math.min(SEQ.length - 1, (league.seq || 0) + 1);
  saveLeague();
  renderSeasonEnd();
});
$('seClose').addEventListener('click', () => {
  $('seasonEnd').style.display = 'none';
  renderHub();
});
$('seAct').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.id === 'seDraft') openDraft();
  else if (b.id === 'seDraftAuto') {
    autoDraftMine();
    saveLeague();
    renderSeasonEnd();
  } else if (b.id === 'seMarket') openMarket();
  else if (b.id === 'seGo') {
    const why = startNextSeason();
    if (why) {
      $('seMsg').textContent = why;
      return;
    }
    $('seasonEnd').style.display = 'none';
    enterLeagueTeam();
    renderHub();
  }
});
// 드래프트·이적 시장 창을 닫으면 순서 화면도 새로
['dfClose', 'mkClose'].forEach(id => $(id).addEventListener('click', () => $('seasonEnd').style.display === 'block' && renderSeasonEnd()));

// ---------- 처음부터 다시(확인 두 번) ----------
function resetLeague() {
  askChoice('처음부터 다시', `${teamName(league.my)} ${league.season}번째 시즌 진행을 지우고 처음부터 할까요?`, ['지우기', '취소'], k => {
    if (k) return;
    askChoice('정말 지울까요?', '선수단·자금·구단 역사가 모두 사라지고 되돌릴 수 없어요.', ['네, 모두 지워요', '아니요'], k2 => {
      if (k2) return;
      league.finished = true; // 나갈 때 다시 저장하지 않게
      clearLeagueSave();
      exitLeague();
      ['seasonEnd', 'history'].forEach(id => ($(id).style.display = 'none'));
      backToTitle();
      startLeagueSetup();
    });
  });
}

// ---------- 저장 용량 ----------
// 어느 팀에도, FA에도 없는 선수 id(은퇴·안 뽑힌 신인)
function liveIds() {
  return new Set([...Object.values(league.rosters).flatMap(R => [...R.batters, ...R.pitchers]), ...league.fa].map(idOf));
}
// hard=false: 다음 시즌 시작 때 정리(은퇴·안 뽑힌 신인 기록 지우기, 소식·은퇴 명단 줄이기)
// hard=true: 저장이 클 때 오래된 경기 기록은 점수만 남기고 내역·소식을 더 줄인다
function trimLeague(hard) {
  const live = liveIds(),
    pool = new Set(league.draft ? league.draft.pool : []);
  Object.keys(league.extra || {}).forEach(id => !live.has(id) && !pool.has(id) && delete league.extra[id]);
  Object.keys(league.recs || {}).forEach(id => !live.has(id) && !pool.has(id) && delete league.recs[id]);
  if (league.news) league.news.length = Math.min(league.news.length, hard ? 10 : CLUB.keepNews);
  if (league.retired && league.retired.length > CLUB.keepRetired) league.retired = league.retired.slice(-CLUB.keepRetired);
  if (hard) {
    const n = league.myLog.length - CLUB.keepGames;
    league.myLog = league.myLog.map((g, i) => (i < n ? { day: g.day, my: g.my, op: g.op } : g));
    league.ledger.length = Math.min(league.ledger.length, 20);
  }
}
// 저장할 글자(크면 줄여서)
function leagueSaveText() {
  let txt = JSON.stringify({ league, stats: seasonStats });
  if (txt.length / 1024 > CLUB.saveLimitKB) {
    trimLeague(true);
    txt = JSON.stringify({ league, stats: seasonStats });
  }
  return txt;
}

// ---------- 팀 편집에서 고친 이름을 리그 전체에 ----------
function applyKboNamesToLeague() {
  const fix = x => {
    const k = KBO_PLAYERS[idOf(x)];
    if (!k) return;
    if (isBatter(x)) x[0] = k.name;
    else x.n = k.name;
  };
  Object.values(league.rosters).forEach(R => [...R.batters, ...R.pitchers].forEach(fix));
  league.fa.forEach(fix);
  Object.values(league.recs || {}).forEach(r => KBO_PLAYERS[r.id] && (r.name = KBO_PLAYERS[r.id].name));
  ['b', 'p'].forEach(t => Object.entries(seasonStats[t] || {}).forEach(([id, x]) => KBO_PLAYERS[id] && (x.n = KBO_PLAYERS[id].name)));
}

// ---------- 한 경기·홈런더비: 10개 팀 중 두 팀 고르기 ----------
const MATCH_KEY = 'nb3_match';
let matchPick = { my: '', opp: '' }; // '' = 예전 그대로(내 팀 = 팀 편집한 팀, 상대 = BEARS)
try {
  Object.assign(matchPick, JSON.parse(localStorage.getItem(MATCH_KEY) || '{}'));
} catch (e) {}
{
  const opts = first => `<option value="">${first}</option>` + KBO_TEAMS.map(t => `<option value="${t.code}">${t.short}</option>`).join('');
  $('matchMy').innerHTML = opts('내 팀(편집)');
  $('matchOpp').innerHTML = opts('BEARS(기본)');
  $('matchMy').value = KBO_BY_CODE[matchPick.my] ? matchPick.my : '';
  $('matchOpp').value = KBO_BY_CODE[matchPick.opp] ? matchPick.opp : '';
  ['matchMy', 'matchOpp'].forEach(id =>
    $(id).addEventListener('change', () => {
      matchPick = { my: $('matchMy').value, opp: $('matchOpp').value };
      try {
        localStorage.setItem(MATCH_KEY, JSON.stringify(matchPick));
      } catch (e) {}
    }),
  );
}
const kboTeamColors = kboUniform;
// 한 경기 시작 때(리그가 아닐 때): 고른 팀을 내 팀·상대 팀으로
function applyMatchTeams() {
  const o = KBO_BY_CODE[matchPick.opp],
    m = KBO_BY_CODE[matchPick.my];
  if (o) {
    LINEUPS.o = kboBatters(o.code).map(kboBatterRow).slice(0, 9);
    cpuStaff = kboPitchers(o.code).map(kboPitcherObj);
    const sp = cpuStaff.map((P, i) => i).filter(i => cpuStaff[i].role !== 'RP');
    cpuIdx = sp[(rand() * sp.length) | 0] || 0;
    TEAM_NAMES.o = o.name;
    TEAM_COLORS.o = kboTeamColors(o);
    refreshHotZones();
  }
  if (m && !singleTeam) {
    singleTeam = { lineup: LINEUPS.m, bench: MY_BENCH, pitchers: [...PITCHERS], cur: curPitcher, name: TEAM_NAMES.m, colors: [...TEAM_COLORS.m] };
    const B = kboBatters(m.code).map(kboBatterRow);
    LINEUPS.m = B.slice(0, 9);
    MY_BENCH = B.slice(9);
    PITCHERS.splice(0, PITCHERS.length, ...kboPitchers(m.code).map(kboPitcherObj));
    TEAM_NAMES.m = m.name;
    TEAM_COLORS.m = kboTeamColors(m);
    curPitcher = 0;
    moundPitcher = null;
    refreshHotZones();
    renderPitcherButtons();
  }
}

// ---------- 긴 목록: 보이는 줄만 그리기 ----------
// el 안에 items를 줄 높이 rowH로 깔고, 화면에 보이는 줄(+앞뒤 몇 줄)만 실제로 만든다
function virtualList(el, items, rowH, rowHtml) {
  el.__vl = { items, rowH, rowHtml };
  el.classList.add('vlist');
  const draw = () => {
    const V = el.__vl;
    if (!V) return;
    const h = el.clientHeight || 400,
      a = Math.max(0, Math.floor(el.scrollTop / V.rowH) - 4),
      b = Math.min(V.items.length, Math.ceil((el.scrollTop + h) / V.rowH) + 4);
    let html = `<div class="vl-pad" style="height:${V.items.length * V.rowH}px">`;
    for (let i = a; i < b; i++) html += V.rowHtml(V.items[i], i).replace('<button ', `<button style="top:${i * V.rowH}px;height:${V.rowH - 6}px" `);
    el.innerHTML = html + '</div>';
  };
  if (!el.__vlBound) {
    el.__vlBound = true;
    let q = false;
    el.addEventListener('scroll', () => {
      if (q) return;
      q = true;
      requestAnimationFrame(() => {
        q = false;
        el.__vl && el.__vl.draw();
      });
    });
  }
  el.__vl.draw = draw;
  draw();
}
