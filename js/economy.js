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
