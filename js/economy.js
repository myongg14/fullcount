// 경제: 종합 능력(OVR), 몸값·연봉(억 원) 계산. 숫자는 맨 위 ECONOMY 설정표에

// 몸값 설정표
const ECONOMY = {
  valueBase: 0.4, // 기본 몸값 = valueBase × (OVR/10)^valueExp  → OVR 90 ≈ 121억, 70 ≈ 63억, 50 ≈ 26억, 30 ≈ 7억
  valueExp: 2.6,
  youngAge: 23, // 이 나이 이하: × (1 + (잠재력 − OVR) × youngPotRate)
  youngPotRate: 0.015,
  ageFactor: [
    [29, 1.0], // 24~29세
    [32, 0.85], // 30~32세
    [35, 0.65], // 33~35세
    [99, 0.45], // 36세 이상
  ],
  perfMax: 0.2, // 이번 시즌 성적 보정 최대 ±20%
  posBonus: { C: 1.1, SS: 1.1 }, // 포수·유격수
  spBonus: 1.1, // 선발 투수
  minValue: 1, // 최소 몸값(억)
  salaryRate: 0.12, // 연봉 = 몸값 × 이 값
  startMoney: [80, 150], // 시작 자금(억): 인기도 0.6 → 80억, 1.4 → 150억
  // 구단 수입(억)
  homeGate: 1.2, // 홈 경기 관중 수입 = homeGate × 인기도 × 순위 보정 × (연승 중이면 1 + streakBonus)
  rankGate: [1.3, 0.8], // 순위 보정: 1위 1.3 ~ 10위 0.8
  streakBonus: 0.1,
  awayGate: 0.3, // 원정 경기 수입
  winBonus: 0.8, // 승리 수당
  highlight: { hr: 0.1, k: 0.05, dive: 0.2 }, // 명장면 보너스(내가 직접 한 경기만): 홈런, 삼진 잡기, 다이빙 캐치
  rankPrize: [40, 30, 24, 18, 14, 10, 9, 8, 7, 6], // 정규 시즌 순위 상금(1~10위)
  postEntry: 10, // 포스트시즌 진출
  postSeriesWin: 8, // 포스트시즌 시리즈 이길 때마다
  ksChampion: 50, // 한국시리즈 우승
  ledgerMax: 50, // 자금 내역 보관 건수
};
// 타자 OVR = (컨택×0.35 + 파워×0.35 + 주력×0.15 + 수비×0.15) × 10
const batterOvr = r => Math.round((r.con * 0.35 + r.pow * 0.35 + r.spd * 0.15 + r.def * 0.15) * 10);
// 구속 점수: 130km/h → 1, 160km/h → 10
const veloScore = v => clamp(1 + ((v - 130) / 30) * 9, 1, 10);
// 구종 수 점수: 2개 → 4, 3개 → 6, 4개 → 8, 5개 이상 → 10
const pitchCountScore = n => clamp(2 * n, 2, 10);
// 투수 OVR = (구속 점수×0.35 + 제구×0.4 + 구종 수 점수×0.1 + 체력×0.15) × 10
const pitcherOvr = r =>
  Math.round((veloScore(r.velo) * 0.35 + r.ctrl * 0.4 + pitchCountScore(r.pitches.length) * 0.1 + r.sta * 0.15) * 10);
const ovrOf = r => clamp(r.type === 'P' ? pitcherOvr(r) : batterOvr(r), 1, 99);

// 게임 안 선수(타순 배열·투수 객체)의 기록 찾기. KBO 선수는 KBO_PLAYERS, 아니면 이름으로 찾거나 대략 만든다
const EST_RECORDS = {};
function recordOf(x) {
  if (!x) return null;
  if (x.type) return x; // 이미 기록
  const bat = Array.isArray(x),
    id = bat ? x[5] : x.id;
  if (KBO_PLAYERS[id]) return KBO_PLAYERS[id];
  if (EST_RECORDS[id]) return EST_RECORDS[id];
  const found = kboFindByName(bat ? x[6] || x[0] : x.n0 || x.n, bat ? 'B' : 'P');
  let r;
  if (found) r = Object.assign({}, found, { id });
  else if (bat)
    // 데이터에 없는 선수: 컨택·주력에서 파워·수비를 대략 정한다
    r = { id, type: 'B', name0: x[6] || x[0], age: 28, pos: x[1], hand: x[4], con: x[3], spd: x[2], pow: x[7] || Math.max(2, x[3] - 1), def: x[8] || 5 };
  else {
    const top = Math.max(...x.ars.map(a => a.v[1]));
    r = { id, type: 'P', name0: x.n0 || x.n, age: 30, hand: x.hand, role: 'SP', velo: top, ctrl: Math.round((x.cmd - 0.45) / 0.04), pitches: x.ars.map(a => a.k), sta: 6 };
  }
  r.pot = r.pot || ovrOf(r);
  return (EST_RECORDS[id] = r);
}
// 나이 보정
function ageFactor(r, ovr) {
  if (r.age <= ECONOMY.youngAge) return Math.max(0.5, 1 + ((r.pot || ovr) - ovr) * ECONOMY.youngPotRate);
  return ECONOMY.ageFactor.find(([max]) => r.age <= max)[1];
}
// 이번 시즌 성적 보정(기록이 있을 때만, ±20% 안): 타자는 타율·홈런, 투수는 탈삼진·승리
function perfFactor(r) {
  if (typeof seasonStats === 'undefined' || !seasonStats) return 1;
  const M = ECONOMY.perfMax;
  if (r.type === 'B') {
    const s = seasonStats.b && seasonStats.b[r.id];
    if (!s || s.ab < 10) return 1;
    return 1 + clamp((s.h / s.ab - 0.27) * 1.5 + (s.hr / s.ab - 0.03) * 3, -M, M);
  }
  const s = seasonStats.p && seasonStats.p[r.id];
  if (!s || !s.g) return 1;
  return 1 + clamp((s.w / s.g - 0.4) * 0.3 + (s.k / s.g - 5) * 0.02, -M, M);
}
// 몸값(억 원, 정수, 최소 1억)
function valueOf(r) {
  const ovr = ovrOf(r);
  let v = ECONOMY.valueBase * Math.pow(ovr / 10, ECONOMY.valueExp) * ageFactor(r, ovr) * perfFactor(r);
  if (r.type === 'B') v *= ECONOMY.posBonus[r.pos] || 1;
  else if (r.role === 'SP') v *= ECONOMY.spBonus;
  return Math.max(ECONOMY.minValue, Math.round(v));
}
// 연봉(억 원, 소수 첫째 자리)
const salaryOf = r => Math.round(valueOf(r) * ECONOMY.salaryRate * 10) / 10;
// 선수 카드: 이름·OVR·몸값·연봉(게임 안 선수 또는 기록 어느 쪽이든)
function playerCard(x) {
  const r = recordOf(x);
  if (!r) return null;
  return { name: Array.isArray(x) ? x[0] : x.n || r.name, ovr: ovrOf(r), value: valueOf(r), salary: salaryOf(r), age: r.age, pot: r.pot, virtual: !!r.v, rec: r };
}
// 시작 자금(억 원): 인기 구단이 조금 더 많이
const startMoney = t => Math.round(ECONOMY.startMoney[0] + ((t.pop - 0.6) / 0.8) * (ECONOMY.startMoney[1] - ECONOMY.startMoney[0]));

// ---------- 구단 자금(리그) ----------
const won1 = v => Math.round(v * 100) / 100; // 0.01억(100만 원) 단위로 계산, 화면에는 0.1억 단위
// 자금 표시(억 원)
const moneyText = v => `${v < 0 ? '−' : ''}${Math.abs(v) < 0.1 && v ? Math.abs(won1(v)).toFixed(2) : Math.abs(won1(v)).toFixed(1)}억`;
// 리그를 시작할 때: 팀마다 시작 자금, 선수마다 이번 시즌 연봉, 내역
function initFunds() {
  league.funds = Object.fromEntries(KBO_TEAMS.map(t => [t.code, startMoney(t)]));
  league.salary = {};
  Object.values(league.rosters).forEach(R => [...R.batters, ...R.pitchers].forEach(x => (league.salary[idOf(x)] = playerCard(x).salary)));
  league.ledger = [];
  league.flow = { in: 0, out: 0 };
}
// 팀 연봉 합계(억/시즌)
function payrollOf(code) {
  const R = league.rosters[code];
  return won1([...R.batters, ...R.pitchers].reduce((s, x) => s + (league.salary[idOf(x)] != null ? league.salary[idOf(x)] : playerCard(x).salary), 0));
}
// 돈이 들어오고 나간다. 내 팀이면 내역과 이번 시즌 수입/지출에 남긴다
function addMoney(code, amt, text) {
  amt = won1(amt);
  if (!amt) return;
  league.funds[code] = won1(league.funds[code] + amt);
  if (code !== league.my) return;
  league.ledger.unshift({ d: league.phase === 'reg' ? `${Math.min(league.day + 1, league.sched.length)}일째` : '포스트시즌', t: text, a: amt });
  league.ledger.length = Math.min(league.ledger.length, ECONOMY.ledgerMax);
  if (amt > 0) league.flow.in = won1(league.flow.in + amt);
  else league.flow.out = won1(league.flow.out - amt);
}
// 홈 관중 수입: 인기도 × 순위 보정 × 연승 보너스
function homeGate(code) {
  const E = ECONOMY,
    rank = rankList().indexOf(code),
    rf = E.rankGate[0] + ((E.rankGate[1] - E.rankGate[0]) * rank) / (KBO_TEAMS.length - 1),
    t = league.table[code];
  return E.homeGate * KBO_BY_CODE[code].pop * rf * (t.streak >= 2 ? 1 + E.streakBonus : 1);
}
// 한 경기 돈 정리(두 팀): 관중·승리 수당·연봉(정규 시즌만), 내 팀은 명장면 보너스도. 내 팀이면 한 줄 요약을 돌려준다
function gameFinance(r, hl) {
  let line = '';
  [
    [r.h, true, r.hs, r.as],
    [r.a, false, r.as, r.hs],
  ].forEach(([c, home, rf, ra]) => {
    const parts = [],
      gate = home ? homeGate(c) : ECONOMY.awayGate;
    let inc = 0;
    const put = (amt, label) => {
      amt = won1(amt);
      if (!amt) return;
      addMoney(c, amt, label);
      if (amt > 0) inc += amt;
    };
    put(gate, home ? '홈 관중 수입' : '원정 경기 수입');
    parts.push(`관중 ${won1(gate)}`);
    if (rf > ra) {
      put(ECONOMY.winBonus, '승리 수당');
      parts.push(`승리 ${ECONOMY.winBonus}`);
    }
    if (c === league.my && hl) {
      const H = ECONOMY.highlight,
        add = (n, unit, label, word) => {
          if (!n) return;
          put(n * unit, `명장면: ${label} ${n}개`);
          parts.push(`${word} ${n}개 ${won1(n * unit)}`);
        };
      add(hl.hr, H.hr, '홈런', '홈런');
      add(hl.k, H.k, '삼진', '삼진');
      add(hl.dive, H.dive, '다이빙 캐치', '다이빙');
    }
    let pay = 0;
    if (league.phase === 'reg') {
      pay = won1(payrollOf(c) / league.sched.length);
      addMoney(c, -pay, '연봉');
    }
    if (c === league.my) line = `오늘 수입 +${won1(inc).toFixed(1)}억 (${parts.join(' · ')})${pay ? ` / 연봉 −${pay.toFixed(1)}억` : ''}`;
  });
  return line;
}
// 내가 직접 한 경기의 명장면 세기(홈런·삼진 잡기·다이빙 캐치)
function leagueHighlight(kind) {
  if (league && isSeason && league.hl) league.hl[kind]++;
}
