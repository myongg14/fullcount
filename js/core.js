// 공통: 설정값(CFG), 스트라이크존 크기, 자주 쓰는 작은 함수(무작위 수, 범위 자르기, 부드러운 보간), 트윈(시간에 따라 값 바꾸기)

// id로 화면 요소를 찾는다
const $ = id => document.getElementById(id);
// 0~1 사이 무작위 수
const rand = Math.random;
// a~b 사이 무작위 수
const randRange = (a, b) => a + rand() * (b - a);
// 값을 a~b 범위 안으로 자른다
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 경기 확률 설정표(숫자만 바꿔서 난이도 조절)
const CFG = {
  flyCatch: 0.8, // 잡을 수 있는 거리의 뜬공을 잡을 확률
  foulCatch: 0.5, // 파울 플라이를 잡을 확률
  flyMiss: 0.1, // 수비수가 먼 뜬공을 그래도 잡을 확률
  lineOut: 0.1, // 라인드라이브가 잡혀 아웃될 확률
  fumble: 0.04, // 수비 실책 확률
  buntHit: 0.15, // 번트 안타 기본 확률
  buntSpd: 0.03, // 주력 1점당 번트 안타 확률 변화
  aiZone: 0.85, // 컴퓨터 타자가 존 안 공에 스윙할 확률
  aiOut: 0.3, // 컴퓨터 타자가 존 밖 공에 스윙할 확률
  strikeBase: 0.62, // 컴퓨터 투수가 존 안에 던질 기본 확률
  strikePerInn: 0.012, // 이닝이 지날 때마다 줄어드는 존 안 확률
  tagOk: [0.5, 0.6], // (지금은 쓰지 않음)
  stealBase: 0.12, // (지금은 쓰지 않음)
  extraBase: 0.5, // (지금은 쓰지 않음)
};
// 경기 이닝 수(동점이면 연장으로 늘어남)
let totalInnings = 9;
// 스트라이크존 가로 반폭(m)
const ZONE_HALF_W = 0.215;
// 스트라이크존 아래 높이(m)
const ZONE_BOTTOM = 0.5;
// 스트라이크존 위 높이(m)
const ZONE_TOP = 1.1;
// 중력(m/s²)
const GRAVITY = 9.8;
// a~b 사이에서 0→1로 부드럽게 바뀌는 값
const smoothstep = (a, b, w) => {
  const x = clamp((w - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
// 새 3D 벡터
const V3 = () => new THREE.Vector3();
// 진행 중인 트윈 목록
const tweens = [];
// dur(ms) 동안 매 프레임 fn(진행도)을 부르고 끝나면 done
function tween(dur, fn, done) {
  tweens.push({ t0: now, dur, fn, done });
}
// 진행 중인 트윈을 한 프레임 진행한다
function stepTweens() {
  for (let k = tweens.length - 1; k >= 0; k--) {
    const a = tweens[k],
      u = clamp((now - a.t0) / a.dur, 0, 1);
    a.fn(u);
    if (u >= 1) {
      tweens.splice(k, 1);
      if (a.done) a.done();
    }
  }
}
