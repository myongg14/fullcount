// 이적 시장(리그): 돈으로 선수 사기·팔기·방출, 자유계약(FA), 컴퓨터 팀 이적, 스토브리그 FA 시장

// 이적 시장 설정표
const MARKET = {
  buyRate: 1.15, // 다른 팀 선수 이적료 = 몸값 × 이 값
  coreRate: 1.5, // 그 팀 OVR 상위(핵심 선수)는 이적료를 이 배로
  coreCount: 3, // 핵심 선수 수
  faSignRate: 0.5, // FA 계약금 = 몸값 × 이 값(이적료 없음)
  sellRate: 0.85, // 내 선수를 팔 때 받는 돈 = 몸값 × 이 값(사는 팀 사정에 따라 조금 더)
  sellNeedBonus: 0.05, // 그 포지션이 모자란 팀은 이만큼 더 준다
  sellRichBonus: 0.05, // 자금이 넉넉한(richFunds 이상) 팀은 이만큼 더 준다
  richFunds: 100,
  batters: [12, 16], // 한 팀 타자 수(최소, 최대)
  pitchers: [8, 12], // 한 팀 투수 수(최소, 최대)
  minSP: 5, // 선발 투수 최소 수(모자라면 불펜에서 채움)
  faStart: 6, // 리그 시작 때 FA 선수 수(가상 선수)
  cpuMoveChance: 0.1, // 3연전마다 컴퓨터 팀이 이적할 확률
  stoveFaAge: 31, // 시즌이 끝나면 이 나이 이상 선수 중 일부가 FA로
  stoveFaChance: 0.3,
  newsMax: 8, // 이적 소식 보관 수
};

// ---------- 선수 찾기 ----------
// 선수 x가 있는 팀 코드('FA'면 자유계약)
function teamOf(x) {
  const id = idOf(x);
  for (const [c, R] of Object.entries(league.rosters)) if ([...R.batters, ...R.pitchers].some(y => idOf(y) === id)) return c;
  return league.fa.some(y => idOf(y) === id) ? 'FA' : null;
}
// 시장에 보이는 모든 선수 [{ x, team }]
function marketPlayers() {
  const out = [];
  Object.entries(league.rosters).forEach(([c, R]) => [...R.batters, ...R.pitchers].forEach(x => out.push({ x, team: c })));
  league.fa.forEach(x => out.push({ x, team: 'FA' }));
  return out;
}
// 받침에 맞는 조사: josa('KT 위즈', '이', '가') → 'KT 위즈가'
const josa = (w, withB, noB) => {
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  return w + (c >= 0 && c <= 11171 && c % 28 ? withB : noB);
};
const teamShort = c => (c === 'FA' ? 'FA' : KBO_BY_CODE[c].short);
// 잠재력 별(★1~5, 정확한 숫자는 숨긴다)
const potStars = r => clamp(Math.round(((r.pot || 50) - 35) / 12), 1, 5);
// 이번 시즌 기록 한 줄
function seasonLine(x) {
  const r = recordOf(x);
  if (r.type === 'B') {
    const s = seasonStats.b[r.id];
    return s && s.ab ? `타율 ${(s.h / s.ab).toFixed(3).replace(/^0/, '')} · ${s.hr}홈런 · ${s.rbi || 0}타점` : '기록 없음';
  }
  const s = seasonStats.p[r.id];
  return s && s.g ? `${s.w}승 ${s.l || 0}패 · 평균자책 ${s.outs ? ((s.er * 27) / s.outs).toFixed(2) : '-'} · ${s.k}K${s.sv ? ` · ${s.sv}세이브` : ''}` : '기록 없음';
}

// ---------- 값 ----------
// 팀의 핵심 선수(OVR 상위) id
function coreOf(code) {
  const R = league.rosters[code];
  return [...R.batters, ...R.pitchers]
    .map(x => [idOf(x), playerCard(x).ovr])
    .sort((a, b) => b[1] - a[1])
    .slice(0, MARKET.coreCount)
    .map(a => a[0]);
}
// 사는 값: 다른 팀 선수는 이적료(핵심 선수는 더 비쌈), FA는 계약금
function buyPrice(x, team) {
  const v = playerCard(x).value;
  if (team === 'FA') return won1(v * MARKET.faSignRate);
  return won1(v * MARKET.buyRate * (coreOf(team).includes(idOf(x)) ? MARKET.coreRate : 1));
}
// 시장이 열렸는지(열렸으면 '', 아니면 이유)
function marketOpen() {
  if (!league) return '리그에서만 열려요';
  if (league.phase === 'stove') return '';
  if (league.phase !== 'reg') return '포스트시즌 중에는 이적 시장이 닫혀요';
  const m = todayMatch();
  if (league.day > 0 && m && m.g !== 1) return '3연전 중에는 닫혀요. 3연전과 3연전 사이에 열려요';
  return '';
}
// 팀 선수 수
const countB = code => league.rosters[code].batters.length;
const countP = code => league.rosters[code].pitchers.length;
// 그 팀이 x를 내주면 대신할 선수가 없는지(없으면 이유)
function cantLetGo(code, x) {
  const R = league.rosters[code];
  if (isBatter(x)) {
    if (R.batters.filter(p => p[1] === x[1]).length <= 1 || R.batters.length - 1 < MARKET.batters[0]) return '대신할 선수가 없어 안 팔아요';
  } else if ((x.role === 'SP' && R.pitchers.filter(P => P.role === 'SP').length <= MARKET.minSP) || R.pitchers.length - 1 < MARKET.pitchers[0])
    return '대신할 선수가 없어 안 팔아요';
  return '';
}
// 선수 수 한도(dB, dP: 늘거나 줄 수). 넘치거나 모자라면 이유
function rosterLimit(code, dB, dP) {
  const b = countB(code) + dB,
    p = countP(code) + dP,
    [b0, b1] = MARKET.batters,
    [p0, p1] = MARKET.pitchers;
  if (b > b1) return `타자는 ${b1}명까지예요`;
  if (p > p1) return `투수는 ${p1}명까지예요`;
  if (b < b0) return `타자는 ${b0}명 이상 있어야 해요`;
  if (p < p0) return `투수는 ${p0}명 이상 있어야 해요`;
  return '';
}

// ---------- 선수단에서 빼고 넣기 ----------
// 팀에서 x를 뺀다(내 팀은 타순·후보·투수 목록에서)
function removeFromTeam(code, x) {
  const id = idOf(x);
  if (code === league.my) {
    LINEUPS.m = LINEUPS.m.filter(p => p[5] !== id);
    MY_BENCH = MY_BENCH.filter(p => p[5] !== id);
    const i = PITCHERS.findIndex(P => P.id === id);
    if (i >= 0) {
      PITCHERS.splice(i, 1);
      if (curPitcher >= PITCHERS.length || curPitcher === i) curPitcher = 0;
      else if (i < curPitcher) curPitcher--;
    }
    syncMyRoster();
  } else if (code === 'FA') league.fa = league.fa.filter(y => idOf(y) !== id);
  else {
    const R = league.rosters[code];
    R.batters = R.batters.filter(p => p[5] !== id);
    R.pitchers = R.pitchers.filter(P => P.id !== id);
  }
}
// 팀에 x를 넣는다. 내 팀 타자는 같은 포지션 주전보다 좋으면 타순에, 아니면 후보로
function addToTeam(code, x) {
  if (code === league.my) {
    if (isBatter(x)) {
      const i = LINEUPS.m.findIndex(p => p[1] === x[1] && playerCard(p).ovr < playerCard(x).ovr);
      if (i >= 0) {
        MY_BENCH.push(LINEUPS.m[i]);
        LINEUPS.m[i] = x;
      } else MY_BENCH.push(x);
    } else PITCHERS.push(x);
    syncMyRoster();
  } else if (code === 'FA') league.fa.push(x);
  else {
    const R = league.rosters[code];
    if (isBatter(x)) R.batters.push(x);
    else R.pitchers.push(x);
  }
}
// 타순 9명·선발 5명이 비면 자동으로 채운다. 채웠으면 알림 글자
function autoFill(code) {
  const notes = [];
  if (code === league.my) {
    while (LINEUPS.m.length < 9 && MY_BENCH.length) {
      const best = MY_BENCH.reduce((a, p) => (playerCard(p).ovr > playerCard(a).ovr ? p : a));
      MY_BENCH = MY_BENCH.filter(p => p !== best);
      LINEUPS.m.push(best);
      notes.push(`타순 빈자리에 ${best[0]}`);
    }
  }
  const P = code === league.my ? PITCHERS : league.rosters[code].pitchers;
  while (P.filter(x => x.role === 'SP').length < MARKET.minSP && P.some(x => x.role === 'RP')) {
    const best = P.filter(x => x.role === 'RP').reduce((a, x) => (playerCard(x).ovr > playerCard(a).ovr ? x : a));
    best.role = 'SP';
    notes.push(`선발 빈자리에 ${best.n}`);
  }
  if (code === league.my) {
    syncMyRoster();
    refreshHotZones();
    renderPitcherButtons();
  }
  return notes.length ? ` (자동으로 채움: ${notes.join(', ')}. 타순 바꾸기로 다시 고칠 수 있어요)` : '';
}
// 이적 소식 한 줄
function addNews(t) {
  league.news.unshift(t);
  league.news.length = Math.min(league.news.length, MARKET.newsMax);
}

// ---------- 사기·팔기·방출 ----------
// 사기 전 확인: 살 수 있으면 { price }, 아니면 { why }
function checkBuy(x) {
  const team = teamOf(x),
    f = league.funds[league.my],
    price = buyPrice(x, team);
  const closed = marketOpen();
  if (closed) return { why: closed };
  if (team === league.my) return { why: '이미 내 선수예요' };
  if (f < 0) return { why: '자금이 마이너스라 살 수 없어요. 선수를 팔거나 방출해 연봉을 줄이세요' };
  if (f < price) return { why: `자금이 모자라요 (필요 ${price.toFixed(1)}억 · 있음 ${moneyText(f)})` };
  const lim = rosterLimit(league.my, isBatter(x) ? 1 : 0, isBatter(x) ? 0 : 1);
  if (lim) return { why: lim };
  if (team !== 'FA') {
    const no = cantLetGo(team, x);
    if (no) return { why: `${teamShort(team)}: ${no}` };
  }
  return { price, team };
}
// 사기(확인 창: 자금 변화와 연봉 합계 변화)
function buyPlayer(x) {
  const c = checkBuy(x);
  if (c.why) return setMarketMsg(c.why);
  const f = league.funds[league.my],
    sal = playerCard(x).salary;
  askChoice(
    c.team === 'FA' ? 'FA 계약' : '선수 사기',
    `${nameOf(x)} (${teamShort(c.team)}) · ${c.team === 'FA' ? '계약금' : '이적료'} ${c.price.toFixed(1)}억\n자금 ${moneyText(f)} → ${moneyText(f - c.price)}, 연봉 합계 +${sal.toFixed(1)}억/시즌`,
    [c.team === 'FA' ? '계약하기' : '사기', '취소'],
    k => {
      if (k !== 0) return;
      removeFromTeam(c.team, x);
      addToTeam(league.my, x);
      addMoney(league.my, -c.price, `${c.team === 'FA' ? 'FA 계약' : '이적료'}: ${nameOf(x)}`);
      if (c.team !== 'FA') league.funds[c.team] = won1(league.funds[c.team] + c.price);
      league.salary[idOf(x)] = sal;
      if (c.team !== 'FA') autoFill(c.team); // 판 팀의 빈자리
      addNews(`${teamShort(league.my)}, ${teamShort(c.team)}에서 ${nameOf(x)} 영입 (${c.price.toFixed(1)}억)`);
      afterMarketChange(`${nameOf(x)} 영입! ${isBatter(x) ? (LINEUPS.m.includes(x) ? '타순에 들어갔어요' : '후보로 들어갔어요') : x.role === 'SP' ? '선발 로테이션에 들어갔어요' : '불펜에 들어갔어요'}`);
    },
  );
}
// 내 선수를 사겠다는 팀과 값(가장 많이 주는 팀). 없으면 null
function bestOffer(x) {
  const v = playerCard(x).value;
  let best = null;
  KBO_TEAMS.forEach(t => {
    const c = t.code;
    if (c === league.my || rosterLimit(c, isBatter(x) ? 1 : 0, isBatter(x) ? 0 : 1)) return;
    const R = league.rosters[c],
      need = isBatter(x) ? R.batters.filter(p => p[1] === x[1]).length <= 1 : x.role === 'SP' && R.pitchers.filter(P => P.role === 'SP').length <= MARKET.minSP,
      price = won1(v * MARKET.sellRate * (1 + (need ? MARKET.sellNeedBonus : 0) + (league.funds[c] >= MARKET.richFunds ? MARKET.sellRichBonus : 0)));
    if (league.funds[c] < price) return;
    if (!best || price > best.price) best = { team: c, price };
  });
  return best;
}
// 팔기(가장 많이 주는 팀에)
function sellPlayer(x) {
  const closed = marketOpen();
  if (closed) return setMarketMsg(closed);
  const lim = rosterLimit(league.my, isBatter(x) ? -1 : 0, isBatter(x) ? 0 : -1);
  if (lim) return setMarketMsg(lim);
  const o = bestOffer(x);
  if (!o) return setMarketMsg('살 수 있는 팀이 없어요(자금이나 자리가 모자라요)');
  askChoice('선수 팔기', `${josa(KBO_BY_CODE[o.team].name, '이', '가')} ${josa(nameOf(x), '을', '를')} ${o.price.toFixed(1)}억에 사겠대요.\n자금 ${moneyText(league.funds[league.my])} → ${moneyText(league.funds[league.my] + o.price)}`, ['팔기', '취소'], k => {
    if (k !== 0) return;
    removeFromTeam(league.my, x);
    addToTeam(o.team, x);
    addMoney(league.my, o.price, `선수 판매: ${nameOf(x)}`);
    league.funds[o.team] = won1(league.funds[o.team] - o.price);
    addNews(`${teamShort(league.my)}, ${josa(nameOf(x), '을', '를')} ${teamShort(o.team)}에 판매 (${o.price.toFixed(1)}억)`);
    afterMarketChange(`${nameOf(x)} 판매!${autoFill(league.my)}`);
  });
}
// 방출: 돈은 안 받고 연봉만 사라진다. 그 선수는 FA로
function releasePlayer(x) {
  const closed = marketOpen();
  if (closed) return setMarketMsg(closed);
  const lim = rosterLimit(league.my, isBatter(x) ? -1 : 0, isBatter(x) ? 0 : -1);
  if (lim) return setMarketMsg(lim);
  askChoice('방출', `${josa(nameOf(x), '을', '를')} 방출할까요? 돈은 받지 못하고 연봉 ${playerCard(x).salary.toFixed(1)}억/시즌이 사라져요.`, ['방출', '취소'], k => {
    if (k !== 0) return;
    removeFromTeam(league.my, x);
    addToTeam('FA', x);
    delete league.salary[idOf(x)];
    addNews(`${teamShort(league.my)}, ${nameOf(x)} 방출`);
    afterMarketChange(`${nameOf(x)} 방출${autoFill(league.my)}`);
  });
}
// 거래 뒤: 저장·다시 그리기
function afterMarketChange(msg) {
  market.sel = null;
  setMarketMsg(msg);
  saveLeague();
  renderMarket();
  renderHub();
}

// ---------- 컴퓨터 팀 ----------
// 3연전마다(낮은 확률로): FA 사기 또는 다른 컴퓨터 팀과 비슷한 몸값 선수 1명씩 바꾸기
function cpuMarketMoves() {
  KBO_TEAMS.forEach(t => {
    const c = t.code;
    if (c === league.my || rand() >= MARKET.cpuMoveChance) return;
    const fa = league.fa
      .filter(x => buyPrice(x, 'FA') <= league.funds[c] && !rosterLimit(c, isBatter(x) ? 1 : 0, isBatter(x) ? 0 : 1))
      .sort((a, b) => playerCard(b).ovr - playerCard(a).ovr)[0];
    if (fa && rand() < 0.5) {
      const price = buyPrice(fa, 'FA');
      removeFromTeam('FA', fa);
      addToTeam(c, fa);
      league.funds[c] = won1(league.funds[c] - price);
      league.salary[idOf(fa)] = playerCard(fa).salary;
      addNews(`${t.short}, FA ${nameOf(fa)} 계약`);
      return;
    }
    // 맞바꾸기
    const others = KBO_TEAMS.filter(o => o.code !== c && o.code !== league.my),
      o = others[(rand() * others.length) | 0].code,
      core = [...coreOf(c), ...coreOf(o)],
      mine = [...league.rosters[c].batters, ...league.rosters[c].pitchers].filter(x => !core.includes(idOf(x)) && !cantLetGo(c, x)),
      x = mine[(rand() * mine.length) | 0];
    if (!x) return;
    const vx = playerCard(x).value,
      y = [...league.rosters[o].batters, ...league.rosters[o].pitchers].find(
        y => isBatter(y) === isBatter(x) && !core.includes(idOf(y)) && !cantLetGo(o, y) && Math.abs(playerCard(y).value - vx) <= vx * 0.2,
      );
    if (!y) return;
    removeFromTeam(c, x);
    removeFromTeam(o, y);
    addToTeam(c, y);
    addToTeam(o, x);
    autoFill(c);
    autoFill(o);
    addNews(`트레이드: ${t.short} ${nameOf(x)} ↔ ${teamShort(o)} ${nameOf(y)}`);
  });
}
// 시즌 끝 스토브리그: 계약이 끝난(나이 많은 선수 중 일부) 컴퓨터 팀 선수가 FA로 나온다
function stoveFreeAgents() {
  KBO_TEAMS.forEach(t => {
    const c = t.code;
    if (c === league.my) return;
    [...league.rosters[c].batters, ...league.rosters[c].pitchers].forEach(x => {
      const r = recordOf(x);
      if (r.age >= MARKET.stoveFaAge && rand() < MARKET.stoveFaChance && !cantLetGo(c, x)) {
        removeFromTeam(c, x);
        addToTeam('FA', x);
        delete league.salary[idOf(x)];
        addNews(`FA 시장: ${nameOf(x)} (${t.short})`);
      }
    });
  });
}
// 스토브리그 끝: 컴퓨터 팀이 남은 FA를 데려간다(자금과 자리가 되면, 좋은 선수부터)
function cpuSignFreeAgents() {
  [...league.fa]
    .sort((a, b) => playerCard(b).ovr - playerCard(a).ovr)
    .forEach(x => {
      const price = buyPrice(x, 'FA'),
        c = KBO_TEAMS.map(t => t.code).find(
          c => c !== league.my && league.funds[c] >= price && !rosterLimit(c, isBatter(x) ? 1 : 0, isBatter(x) ? 0 : 1),
        );
      if (!c) return;
      removeFromTeam('FA', x);
      addToTeam(c, x);
      league.funds[c] = won1(league.funds[c] - price);
      league.salary[idOf(x)] = playerCard(x).salary;
      addNews(`${teamShort(c)}, FA ${nameOf(x)} 계약`);
    });
}
// 리그 시작 때 FA 선수(가상 선수: 코드로 만든 한국식 이름)
function makeVirtualFa() {
  const r = seededRand(77031 + (league.season || 1) * 131),
    out = [];
  for (let i = 0; i < MARKET.faStart; i++) {
    const id = `FA${league.season || 1}-${i + 1}`,
      name = makeName(r),
      age = ri(r, 27, 34);
    let rec;
    if (i % 2 === 0) {
      const pos = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'][ri(r, 0, 7)];
      rec = { id, type: 'B', name, name0: name, age, pos, hand: r() < 0.3 ? 'L' : 'R', con: ri(r, 4, 7), pow: ri(r, 3, 7), spd: ri(r, 3, 7), def: ri(r, 4, 7), v: true };
    } else
      rec = {
        id, type: 'P', name, name0: name, age, hand: r() < 0.3 ? 'L' : 'R', role: i % 4 === 1 ? 'SP' : 'RP', slot: 'O', velo: ri(r, 142, 150), ctrl: ri(r, 4, 7),
        pitches: ['fast', 'slider', ['change', 'fork', 'curve'][ri(r, 0, 2)]], sta: i % 4 === 1 ? ri(r, 5, 7) : 3, v: true,
      };
    rec.pot = ovrOf(rec) + ri(r, 0, 4);
    league.extra[id] = rec;
    out.push(rec.type === 'B' ? kboBatterRow(rec) : kboPitcherObj(rec));
  }
  return out;
}
// 리그를 시작하거나 예전 저장을 불러올 때 시장 준비
function initMarket() {
  if (!league.extra) league.extra = {};
  if (!league.news) league.news = [];
  if (!league.fa) league.fa = makeVirtualFa();
}

// ---------- 이적 시장 화면 ----------
const market = { tab: 'all', team: '', pos: '', age: '', price: '', sort: 'ovr', sel: null, msg: '' };
function setMarketMsg(t) {
  market.msg = t;
  if ($('mkMsg')) $('mkMsg').textContent = t;
}
// 탭·걸러 보기·정렬에 맞는 선수들
function marketList() {
  let list = marketPlayers().filter(({ x, team }) => {
    const r = recordOf(x),
      c = playerCard(x);
    if (market.tab === 'bat' && r.type !== 'B') return false;
    if (market.tab === 'pit' && r.type !== 'P') return false;
    if (market.tab === 'fa' && team !== 'FA') return false;
    if (market.tab === 'mine' && team !== league.my) return false;
    if (market.team && team !== market.team) return false;
    if (market.pos && (r.type === 'B' ? r.pos : r.role) !== market.pos) return false;
    if (market.age && r.age > Number(market.age)) return false;
    if (market.price) {
      const [lo, hi] = market.price.split('-').map(Number);
      if (c.value < lo || c.value > hi) return false;
    }
    return true;
  });
  const key = {
    ovr: ({ x }) => -playerCard(x).ovr,
    value: ({ x }) => -playerCard(x).value,
    age: ({ x }) => recordOf(x).age,
    perf: ({ x }) => {
      const r = recordOf(x),
        s = r.type === 'B' ? seasonStats.b[r.id] : seasonStats.p[r.id];
      if (!s) return 0;
      return r.type === 'B' ? -(s.ab ? s.h / s.ab + s.hr * 0.02 : 0) : -(s.w * 2 + s.k * 0.05);
    },
  }[market.sort];
  return list.sort((a, b) => key(a) - key(b));
}
// 시장 화면 그리기
function renderMarket() {
  if (!league) return;
  const closed = marketOpen();
  $('mkInfo').textContent =
    (closed ? `🔒 ${closed}` : '🔓 이적 시장이 열려 있어요') + ` · 내 자금 ${moneyText(league.funds[league.my])} · 타자 ${LINEUPS.m.length + MY_BENCH.length}명 · 투수 ${PITCHERS.length}명`;
  $('mkTabs').innerHTML = [
    ['all', '전체'],
    ['bat', '타자'],
    ['pit', '투수'],
    ['fa', '자유계약(FA)'],
    ['mine', '내 선수'],
  ]
    .map(([k, l]) => `<button data-t="${k}" class="${market.tab === k ? 'on' : ''}">${l}</button>`)
    .join('');
  const list = marketList();
  $('mkList').innerHTML = list.length
    ? list
        .map(({ x, team }) => {
          const r = recordOf(x),
            c = playerCard(x);
          return `<button class="pl${market.sel === idOf(x) ? ' on' : ''}" data-id="${idOf(x)}">
          <b>${nameOf(x)} <small>${teamShort(team)} · ${r.type === 'B' ? r.pos : r.role === 'SP' ? '선발' : '불펜'} · ${r.age}세${r.v ? ' · 가상' : ''}</small></b>
          <span>OVR ${c.ovr} · ${'★'.repeat(potStars(r))}${'☆'.repeat(5 - potStars(r))} · 몸값 <i>${c.value}억</i> · 연봉 ${c.salary.toFixed(1)}억</span>
          <span>${seasonLine(x)}</span></button>`;
        })
        .join('')
    : '<p class="mk-note">조건에 맞는 선수가 없어요</p>';
  renderMarketDetail();
  $('mkMsg').textContent = market.msg;
}
// 선수 자세히: 능력치 막대, 기록, 몸값 계산 이유, 사기/팔기/방출 버튼
function renderMarketDetail() {
  const found = market.sel && marketPlayers().find(({ x }) => idOf(x) === market.sel);
  if (!found) {
    $('mkDetail').innerHTML = '<p class="mk-note">선수를 누르면 자세히 볼 수 있어요</p>';
    return;
  }
  const { x, team } = found,
    r = recordOf(x),
    c = playerCard(x),
    bar = (label, v, max = 10) => `<div class="bar-row"><span>${label}</span><div class="bar"><i style="width:${(v / max) * 100}%"></i></div><em>${v}</em></div>`,
    ovr = ovrOf(r),
    base = ECONOMY.valueBase * Math.pow(ovr / 10, ECONOMY.valueExp),
    posF = r.type === 'B' ? ECONOMY.posBonus[r.pos] || 1 : r.role === 'SP' ? ECONOMY.spBonus : 1;
  const bars =
    r.type === 'B'
      ? bar('컨택', r.con) + bar('파워', r.pow) + bar('주력', r.spd) + bar('수비', r.def)
      : bar('구속', r.velo, 160) + bar('제구', r.ctrl) + bar('구종', r.pitches.length, 5) + bar('체력', r.sta);
  let btns = '';
  if (team === league.my) btns = `<button data-act="sell" class="te-main">팔기</button><button data-act="release">방출</button>`;
  else btns = `<button data-act="buy" class="te-main">${team === 'FA' ? `FA 계약 ${buyPrice(x, 'FA').toFixed(1)}억` : `사기 ${buyPrice(x, team).toFixed(1)}억`}</button>`;
  $('mkDetail').innerHTML = `<h3>${nameOf(x)} <small>${team === 'FA' ? '자유계약' : KBO_BY_CODE[team].name} · ${r.type === 'B' ? r.pos + ' · ' + (r.hand === 'L' ? '좌타' : '우타') : (r.role === 'SP' ? '선발' : '불펜') + ' · ' + (r.hand === 'L' ? '좌완' : '우완')} · ${r.age}세</small></h3>
    <p>OVR <b>${c.ovr}</b> · 잠재력 ${'★'.repeat(potStars(r))}${'☆'.repeat(5 - potStars(r))} · 몸값 <b>${c.value}억</b> · 연봉 ${c.salary.toFixed(1)}억${coreOf(team === 'FA' ? league.my : team).includes(idOf(x)) && team !== 'FA' ? ' · 핵심 선수' : ''}</p>
    ${bars}
    <p>이번 시즌: ${seasonLine(x)}</p>
    <p class="mk-note">몸값 계산: 기본 ${base.toFixed(1)}억(OVR ${ovr}) × 나이 ${ageFactor(r, ovr).toFixed(2)} × 성적 ${perfFactor(r).toFixed(2)} × 포지션 ${posF.toFixed(2)} = ${c.value}억</p>
    <div class="te-btns">${btns}</div>`;
}
function openMarket() {
  market.sel = null;
  market.msg = '';
  // 걸러 보기 고르기 칸
  $('mkTeam').innerHTML = '<option value="">모든 팀</option>' + KBO_TEAMS.map(t => `<option value="${t.code}">${t.short}</option>`).join('') + '<option value="FA">FA</option>';
  renderMarket();
  $('market').style.display = 'block';
}
$('market').addEventListener('pointerdown', e => e.stopPropagation());
$('mkTabs').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  market.tab = b.dataset.t;
  renderMarket();
});
[
  ['mkTeam', 'team'],
  ['mkPos', 'pos'],
  ['mkAge', 'age'],
  ['mkPrice', 'price'],
  ['mkSort', 'sort'],
].forEach(([id, k]) =>
  $(id).addEventListener('change', () => {
    market[k] = $(id).value;
    renderMarket();
  }),
);
$('mkList').addEventListener('click', e => {
  const b = e.target.closest('.pl');
  if (!b) return;
  market.sel = b.dataset.id;
  market.msg = '';
  renderMarket();
});
$('mkDetail').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const found = marketPlayers().find(({ x }) => idOf(x) === market.sel);
  if (!found) return;
  ({ buy: buyPlayer, sell: sellPlayer, release: releasePlayer })[b.dataset.act](found.x);
});
$('mkClose').addEventListener('click', () => ($('market').style.display = 'none'));
