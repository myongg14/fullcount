// 팀 데이터: 내 팀·상대 팀 타순과 능력치, 팀 이름·유니폼 색, 시즌 상대 팀, 타자별 핫/콜드 존

// 시즌 상대 팀(이름, 줄임말, 색)
const SEASON_OPPS = [
  { n: '두산 베어스', s: '두산', c: 0x14235a },
  { n: 'LG 트윈스', s: 'LG', c: 0x8a1a4a },
  { n: 'KT 위즈', s: 'KT', c: 0x222222 },
  { n: 'SSG 랜더스', s: 'SSG', c: 0x7a1f2b },
  { n: 'NC 다이노스', s: 'NC', c: 0x315288 },
  { n: '삼성 라이온즈', s: '삼성', c: 0x074ca1 },
  { n: '롯데 자이언츠', s: '롯데', c: 0x041e42 },
  { n: '한화 이글스', s: '한화', c: 0xe06a00 },
  { n: '키움 히어로즈', s: '키움', c: 0x570514 },
];
// 타순: [이름, 포지션, 주력, 컨택, 좌우타(R/L)]. m 내 팀, o 상대 팀
const LINEUPS = {
  m: [
    ['김도영', 'SS', 9, 8, 'R'],
    ['이정진', 'CF', 6, 6, 'L'],
    ['나성범', 'DH', 4, 7, 'L'],
    ['최형우', 'LF', 3, 8, 'L'],
    ['김선빈', '2B', 5, 6, 'R'],
    ['이우성', 'RF', 6, 5, 'R'],
    ['황대인', '1B', 3, 6, 'R'],
    ['한준수', 'C', 2, 4, 'L'],
    ['최정용', '3B', 4, 5, 'R'],
  ],
  o: [
    ['정수빈', 'CF', 9, 6, 'L'],
    ['김재호', 'SS', 6, 5, 'R'],
    ['양석환', 'DH', 3, 7, 'R'],
    ['김재환', 'LF', 3, 8, 'R'],
    ['강승호', '1B', 3, 6, 'R'],
    ['박계범', '2B', 5, 5, 'R'],
    ['허경민', '3B', 5, 6, 'R'],
    ['장승현', 'C', 2, 4, 'R'],
    ['조수행', 'RF', 7, 5, 'L'],
  ],
};
// 전광판 팀 이름(m 내 팀, o 상대 팀)
const TEAM_NAMES = { m: 'TIGERS', o: 'BEARS' };
// 타자별 9칸 핫/콜드 기본 성향
const HOT_ZONES = { m: [], o: [] };
// 선수 이름으로 9칸 핫/콜드 존 성향을 만든다(항상 같은 값)
const hotZoneProfile = name => {
  let h = 7;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  const raw = [...Array(9)].map((_, i) => {
    const x = Math.sin((h + i * 97) * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  });
  const m = raw.reduce((a, b) => a + b, 0) / 9,
    mx = Math.max(...raw.map(v => Math.abs(v - m))) || 1;
  return raw.map(v => ((v - m) / mx) * 0.9);
};
LINEUPS.m.forEach(p => HOT_ZONES.m.push(hotZoneProfile(p[0])));
LINEUPS.o.forEach(p => HOT_ZONES.o.push(hotZoneProfile(p[0])));
// 유니폼: [상의, 모자, 바지, 가슴 글자, 글자색]
const TEAM_COLORS = {
  m: [0xc8102e, 0xc8102e, 0xeceadf, 'TIGERS', '#fff'],
  o: [0x14235a, 0x14235a, 0xdedbd0, 'BEARS', '#fff'],
};
// 내 팀 후보 타자 3명: [이름, 포지션, 주력, 컨택, 좌우타]
const MY_BENCH_DATA = [
  ['윤도현', 'C', 3, 5, 'R'],
  ['박민재', '2B', 7, 5, 'L'],
  ['정우람', 'LF', 6, 6, 'R'],
];
// 시즌 상대 팀마다 강점(선수 능력치에 더하는 값). SEASON_OPPS와 같은 순서
// spd: 주력, con: 컨택, cmd: 투수 제구(0.01 단위), velo: 투수 구속(km/h)
const OPP_STYLE = [
  { tag: '발 빠른 팀', spd: 2, con: 0, cmd: 0, velo: 0 },
  { tag: '정교한 타선', spd: 0, con: 2, cmd: 0, velo: 0 },
  { tag: '강속구 투수진', spd: 0, con: 0, cmd: -2, velo: 5 },
  { tag: '균형 잡힌 팀', spd: 1, con: 1, cmd: 2, velo: 1 },
  { tag: '제구파 투수진', spd: 0, con: 0, cmd: 8, velo: -2 },
  { tag: '전통의 강타선', spd: -1, con: 2, cmd: 0, velo: 2 },
  { tag: '기동력 야구', spd: 2, con: 1, cmd: -2, velo: 0 },
  { tag: '젊은 투수진', spd: 0, con: -1, cmd: 3, velo: 4 },
  { tag: '끈질긴 타선', spd: 1, con: 2, cmd: -3, velo: 0 },
];
// ---------- KBO 데이터(kbo-data.js) → 선수 기록·게임 형식 ----------
// 팀 편집에서 고친 KBO 선수 이름(선수 id → 이름)
const KBO_NAME_KEY = 'nb3_kbo_names';
function loadKboNames() {
  try {
    return JSON.parse(localStorage.getItem(KBO_NAME_KEY)) || {};
  } catch (e) {
    return {};
  }
}
// 선수 기록(id → 기록). 타자: type 'B', 투수: type 'P'
const KBO_PLAYERS = {};
// 팀 코드 → 팀
const KBO_BY_CODE = {};
{
  const names = loadKboNames();
  KBO_TEAMS.forEach(t => {
    KBO_BY_CODE[t.code] = t;
    t.batters.forEach(([id, name, age, pos, hand, con, pow, spd, def, pot, v]) => {
      KBO_PLAYERS[id] = { id, team: t.code, type: 'B', name: names[id] || name, name0: name, age, pos, hand, con, pow, spd, def, pot, v: !!v };
    });
    t.pitchers.forEach(([id, name, age, hand, role, slot, velo, ctrl, pitches, sta, pot, v]) => {
      KBO_PLAYERS[id] = {
        id, team: t.code, type: 'P', name: names[id] || name, name0: name, age, hand, role, slot, velo, ctrl,
        pitches: pitches.split(','), sta, pot, v: !!v,
      };
    });
  });
}
// 팀의 선수 기록 목록
const kboBatters = code => KBO_BY_CODE[code].batters.map(r => KBO_PLAYERS[r[0]]);
const kboPitchers = code => KBO_BY_CODE[code].pitchers.map(r => KBO_PLAYERS[r[0]]);
// 이름으로 KBO 선수 찾기(처음 내 팀 선수의 능력치를 채울 때)
const kboFindByName = (name, type) => Object.values(KBO_PLAYERS).find(p => p.name0 === name && p.type === type);
// 타자 기록 → 타순 배열 [이름, 포지션, 주력, 컨택, 좌우타, id, 원래 이름, 파워, 수비]
const kboBatterRow = r => [r.name, r.pos, r.spd, r.con, r.hand === 'L' ? 'L' : 'R', r.id, r.name0, r.pow, r.def];
// 구종 → [이름, 비행 시간, 최고 구속에서 뺄 구속 범위(낮은 쪽, 높은 쪽)]
const KBO_PITCH = {
  fast: ['직구', 850, -9, 0],
  sinker: ['싱커', 930, -12, -3],
  slider: ['슬라이더', 980, -20, -10],
  change: ['체인지업', 1250, -24, -14],
  fork: ['포크', 1200, -20, -11],
  curve: ['커브', 1150, -34, -22],
  knuckle: ['너클볼', 1250, -45, -33],
};
// 투구폼 → 게임 투구폼 번호(ARM_SLOTS)와 이름, 투수 시점 카메라 높이
const KBO_SLOT = { O: [0, '오버핸드'], T: [0, '스리쿼터'], S: [1, '사이드암'], U: [2, '언더핸드'], M: [3, '서브마린'] };
const SLOT_CAM_Y = [2.05, 1.85, 1.6, 1.35];
// 투수 기록 → PITCHERS 형식(pitching.js의 pitchDef를 쓰므로 그 파일을 읽은 뒤에 부른다)
function kboPitcherObj(r) {
  const [slot, slotName] = KBO_SLOT[r.slot] || KBO_SLOT.O,
    ars = r.pitches.filter(k => KBO_PITCH[k]).map(k => {
      const [n, d, lo, hi] = KBO_PITCH[k];
      return pitchDef(k, n, d, [r.velo + lo, r.velo + hi]);
    });
  return {
    n: r.name,
    n0: r.name0,
    id: r.id,
    hand: r.hand,
    role: r.role,
    cmd: 0.45 + r.ctrl * 0.04, // 제구 1 → 0.49, 10 → 0.85
    s: `${slotName} · ${(ars[1] || ars[0]).n}`,
    slot,
    cy: SLOT_CAM_Y[slot],
    ars,
  };
}
// 파워·수비가 경기에 주는 아주 작은 효과(±5% 안쪽). 값이 없는 선수(예전 데이터)는 효과 없음
const ATTR_EFFECT = { perPoint: 0.01, max: 0.05 };
const attrFactor = v => (v == null ? 1 : 1 + clamp((v - 5) * ATTR_EFFECT.perPoint, -ATTR_EFFECT.max, ATTR_EFFECT.max));
