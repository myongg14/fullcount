// 공통: 경기장 기본 치수, 게임 상태(S), 여러 파일이 함께 쓰는 작은 도구 함수

// ---------- 상수 ----------
const MOUND_Z = 18.44;            // 투수판~홈플레이트 거리(m)
const ZONE = { x: 0.22, yLo: 0.50, yHi: 1.10 };  // 스트라이크존(m)

// ---------- 상태 ----------
// 화면·조작 상태. 경기 규칙 상태(이닝, 점수, 주자, 카운트)는 game.js의 G에 있다.
const S = {
  mode: 'bat',        // bat(내가 타격) | pitch(내가 투구): 공수에 따라 game.js가 정한다
  phase: 'idle',      // idle | windup | pitch | flight | result
  pitch: null, swing: null, power: false, rookie: true,
  selPitch: 'four',   // 고른 구종(data/pitches.js의 키)
};

const $ = id => document.getElementById(id);
if (!window.BABYLON) $('loading').textContent = '3D 엔진을 불러오지 못했어요. 새로고침해 주세요.';

// ---------- 유틸 ----------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const inZone = p => Math.abs(p.x) <= ZONE.x + 0.037 && p.y >= ZONE.yLo - 0.037 && p.y <= ZONE.yHi + 0.037;
// 게임 시계(밀리초). 일시정지하면 멈춘다
let pausedAt = null, pausedTotal = 0;
const now = () => (pausedAt ?? performance.now()) - pausedTotal;
const isPaused = () => pausedAt != null;
const pauseClock = on => {
  if (on && pausedAt == null) pausedAt = performance.now();
  else if (!on && pausedAt != null) { pausedTotal += performance.now() - pausedAt; pausedAt = null; }
};
// 존 가운데에서 얼마나 멀리 있는지: 0 = 한가운데, 1 = 테두리, 1보다 크면 존 밖
const zoneEdge = p => Math.max(Math.abs(p.x) / ZONE.x, Math.abs(p.y - (ZONE.yLo + ZONE.yHi) / 2) / ((ZONE.yHi - ZONE.yLo) / 2));
// 치기 어려움(0~1): 존의 바깥쪽 절반부터 커져서 테두리와 존 밖에서 1
const edgeHardK = e => clamp((e - 0.5) / 0.5, 0, 1);
// 던지기 어려움(0~1): 테두리 근처에서 가장 크고, 존에서 멀리 벗어난 공(일부러 빼는 공)은 다시 줄어든다
const borderK = e => (e <= 1 ? edgeHardK(e) : clamp(1 - (e - 1) / 0.6, 0, 1));
