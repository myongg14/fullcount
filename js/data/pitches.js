// 구종 데이터: 이름, 평균 구속(km/h), 좌우·상하 변화(m), 꺾이는 시점, 카드 설명

// h: 좌우 변화. 오른손 투수 기준, 포수가 볼 때 +는 1루 쪽(투수 글러브 쪽), -는 3루 쪽(투수 팔 쪽). 왼손 투수는 자동으로 반대.
// v: 상하 변화. +는 덜 떨어짐(떠오르는 느낌), -는 떨어짐.
// late: true = 홈플레이트 가까이에서 늦게 꺾임, false = 일찍부터 휘어 들어옴.
// knuckle: 회전이 거의 없어 날아오는 내내 불규칙하게 흔들림. arc: 위로 크게 뜨는 포물선 높이(m).
const PITCHES = {
  four:     { name: '포심',       kmh: 148, h: -0.08, v:  0.12, late: true,  desc: '빠르고 곧게' },
  two:      { name: '투심',       kmh: 145, h: -0.25, v: -0.05, late: true,  desc: '팔 쪽으로 휨' },
  sinker:   { name: '싱커',       kmh: 145, h: -0.22, v: -0.22, late: true,  desc: '휘며 가라앉음' },
  cutter:   { name: '커터',       kmh: 140, h:  0.16, v:  0.02, late: true,  desc: '끝에서 살짝' },
  slider:   { name: '슬라이더',   kmh: 134, h:  0.36, v: -0.12, late: true,  desc: '옆으로 휨' },
  sweeper:  { name: '스위퍼',     kmh: 129, h:  0.55, v: -0.05, late: false, desc: '옆으로 크게' },
  curve:    { name: '커브',       kmh: 120, h:  0.18, v: -0.55, late: false, desc: '크게 떨어짐' },
  kcurve:   { name: '너클 커브',  kmh: 126, h:  0.15, v: -0.50, late: true,  desc: '날카롭게 낙하' },
  slurve:   { name: '슬러브',     kmh: 125, h:  0.38, v: -0.38, late: false, desc: '대각선으로' },
  change:   { name: '체인지업',   kmh: 130, h: -0.18, v: -0.28, late: true,  desc: '느리게 떨어짐' },
  circle:   { name: '서클 체인지업', kmh: 128, h: -0.30, v: -0.25, late: true,  desc: '팔 쪽으로 낙하' },
  splitter: { name: '스플리터',   kmh: 138, h: -0.06, v: -0.40, late: true,  desc: '뚝 떨어짐' },
  fork:     { name: '포크볼',     kmh: 132, h:  0.00, v: -0.55, late: true,  desc: '크게 뚝' },
  knuckle:  { name: '너클볼',     kmh: 110, h:  0.00, v: -0.15, late: false, desc: '불규칙하게', knuckle: true },
  screw:    { name: '스크루볼',   kmh: 125, h: -0.40, v: -0.30, late: false, desc: '반대로 휨' },
  palm:     { name: '팜볼',       kmh: 118, h: -0.10, v: -0.35, late: false, desc: '느리게 낙하' },
  eephus:   { name: '이퓨스',     kmh:  80, h:  0.00, v:  0.00, late: false, desc: '아주 느린 포물선', arc: 1.8 },
};
