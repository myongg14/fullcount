// 구종 데이터: 이름, 구속(km/h), 변화량[좌우, 상하]

const PITCHES = {
  fast:   { name: '직구',     kmh: 145, brk: [0.02, 0.10] },
  slider: { name: '슬라이더', kmh: 132, brk: [0.38, -0.10] },
  curve:  { name: '커브',     kmh: 118, brk: [0.15, -0.55] },
  change: { name: '체인지업', kmh: 125, brk: [-0.12, -0.30] },
};
