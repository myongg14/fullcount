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
