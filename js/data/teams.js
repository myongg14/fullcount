// 팀·선수 데이터: 가상 팀 2개(이름, 팀 색, 타자 9명, 선발 1명 + 불펜 2명)

// 타자: bats 'R'(우타) | 'L'(좌타), contact 컨택, power 파워, eye 선구안, speed 주력 (모두 0~100)
// 투수: throws 'R'(우투) | 'L'(좌투), velo 구속 보정(km/h), control 제구, stamina 체력 (0~100)
//       pitches: { 구종 이름(data/pitches.js의 키): 숙련도(0~100) }. pitchers[0]이 선발, 나머지는 불펜.
const TEAMS = [
  {
    name: '바다 고래즈', colors: ['#1d3f8f', '#5ec8f2'],
    batters: [
      { name: '한빛나', bats: 'L', contact: 78, power: 35, eye: 72, speed: 88 },
      { name: '도윤재', bats: 'R', contact: 72, power: 45, eye: 66, speed: 70 },
      { name: '마루한', bats: 'L', contact: 76, power: 72, eye: 68, speed: 55 },
      { name: '고은산', bats: 'R', contact: 60, power: 92, eye: 55, speed: 38 },
      { name: '남궁태', bats: 'R', contact: 64, power: 76, eye: 50, speed: 45 },
      { name: '오세린', bats: 'L', contact: 68, power: 55, eye: 62, speed: 60 },
      { name: '표지환', bats: 'R', contact: 58, power: 50, eye: 52, speed: 50 },
      { name: '차도율', bats: 'R', contact: 55, power: 40, eye: 48, speed: 66 },
      { name: '윤솔',   bats: 'L', contact: 62, power: 28, eye: 58, speed: 82 },
    ],
    pitchers: [
      { name: '류하람', throws: 'R', velo: 2, control: 72, stamina: 85,
        pitches: { four: 82, slider: 76, change: 64, curve: 60 } },
      { name: '진무결', throws: 'L', velo: 0, control: 62, stamina: 45,
        pitches: { two: 70, sweeper: 82, circle: 66, knuckle: 60 } },
      { name: '백두열', throws: 'R', velo: 5, control: 55, stamina: 40,
        pitches: { four: 86, splitter: 76, cutter: 68, fork: 60, eephus: 50 } },
    ],
  },
  {
    name: '숲속 여우스', colors: ['#d4462a', '#f2b33d'],
    batters: [
      { name: '여다온', bats: 'R', contact: 75, power: 30, eye: 70, speed: 90 },
      { name: '설지후', bats: 'L', contact: 70, power: 48, eye: 64, speed: 68 },
      { name: '봉태하', bats: 'R', contact: 74, power: 70, eye: 66, speed: 52 },
      { name: '탁무진', bats: 'L', contact: 58, power: 94, eye: 52, speed: 35 },
      { name: '은가람', bats: 'R', contact: 66, power: 72, eye: 56, speed: 48 },
      { name: '감초롱', bats: 'R', contact: 64, power: 50, eye: 60, speed: 62 },
      { name: '빈서우', bats: 'L', contact: 60, power: 46, eye: 50, speed: 55 },
      { name: '목하진', bats: 'R', contact: 54, power: 44, eye: 46, speed: 58 },
      { name: '단비',   bats: 'L', contact: 63, power: 25, eye: 62, speed: 85 },
    ],
    pitchers: [
      { name: '서리온', throws: 'R', velo: 1, control: 70, stamina: 85,
        pitches: { sinker: 78, cutter: 70, kcurve: 74, splitter: 66 } },
      { name: '하얀돌', throws: 'R', velo: 0, control: 58, stamina: 50,
        pitches: { knuckle: 86, four: 55, eephus: 70 } },
      { name: '여울',   throws: 'L', velo: 3, control: 60, stamina: 40,
        pitches: { four: 78, slurve: 74, screw: 66, palm: 60 } },
    ],
  },
];
