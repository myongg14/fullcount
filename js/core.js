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
// 기기에 기억하는 설정 이름
const SETTINGS_KEY = 'nb3_settings';
// 기억해 둔 설정을 읽는다(저장이 안 되는 환경이면 빈 설정)
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch (e) {
    return {};
  }
}
// 설정을 기기에 기억한다(못 하면 그냥 넘어간다)
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS));
  } catch (e) {}
}
// 타이틀 화면에서 고르는 경기 설정
const SETTINGS = Object.assign(
  {
    level: 'pro', // 난이도: 'rookie' 루키, 'pro' 프로
    innings: 9, // 한 경기 이닝 수(3, 6, 9). 시즌은 항상 9회
    tod: 'auto', // 시간: 'auto' 이닝 따라 바뀜, 'day' 낮, 'evening' 저녁, 'night' 밤
    sound: true, // 소리 켜기/끄기
    volume: 0.8, // 음량(0~1)
    hotZoneOverlay: false, // 타석 존 위에 핫존 색칸을 옅게 보여줄지(끄면 테두리만)
    precisionBat: false, // 정밀 타격: 공이 있는 곳을 탭해야 맞음(위면 땅볼, 아래면 뜬공)
  },
  loadSettings(),
);
// 난이도 설정표
const LEVELS = {
  rookie: {
    pitchSpeed: 0.85, // 내가 칠 때 공 속도 배율(0.85 = 15% 느리게)
    swingWindow: 1.35, // 스윙 판정 시간 폭 배율(클수록 빠르거나 늦어도 맞음)
    lateWindow: 0.09, // 공이 지나간 뒤에도 스윙이 인정되는 시간(초)
    aiTimingError: 1.6, // 컴퓨터 타자 타이밍 오차 배율(클수록 못 침)
    aiQuality: -0.12, // 컴퓨터 타자 타구 질 보정(음수면 약한 타구)
    ringTime: 1.3, // 투구 링이 줄어드는 시간 배율(클수록 느림)
    ringWindow: 1.6, // 투구 완벽 판정 폭 배율(클수록 쉬움)
  },
  pro: { pitchSpeed: 1, swingWindow: 1, lateWindow: 0, aiTimingError: 1, aiQuality: 0, ringTime: 1, ringWindow: 1 },
};
// 지금 난이도 설정
const level = () => LEVELS[SETTINGS.level] || LEVELS.pro;
// 핫존 보이기 설정표
const HOT_ZONE_VIEW = {
  overlayHot: [0.12, 0.25], // '존 위 핫존' 켰을 때 뜨거운 칸 투명도 [기본, 뜨거울수록 더함]
  overlayCold: [0.05, 0.1], // 차가운 칸 투명도 [기본, 차가울수록 더함]
};
// 시간 설정 → 시간대 번호(0 낮, 1 저녁, 2 밤, 3 노을)
const TOD_INDEX = { day: 0, evening: 1, night: 2 };
// 타이틀 화면에서 보여줄 시간대(자동이면 노을)
const titleTod = () => (SETTINGS.tod in TOD_INDEX ? TOD_INDEX[SETTINGS.tod] : 3);
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
