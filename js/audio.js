// 소리: 타격음, 관중 웅성거림·함성(Web Audio로 코드에서 만듦), 심판 콜(브라우저 음성 합성). 외부 소리 파일은 쓰지 않는다

// ---------- 설정 ----------
const sound = { on: true, volume: 0.8 };   // 메뉴·일시정지 화면에서 바꾼다
const AUDIO_TUNING = {
  ambient: 0.05,      // 평소 관중 웅성거림 크기
  cheer: [0, 0.18, 0.32, 0.5],   // 함성 크기: 1 = 삼진, 2 = 안타, 3 = 홈런
  cheerSec: [0, 1.4, 2.2, 3.8],  // 함성 길이(초)
  bat: 0.9,           // 타격음 크기
  callRate: 1.25,     // 심판 콜 말하기 속도(빠를수록 늦지 않게)
};

let actx = null, master = null, noiseBuf = null, ambientGain = null;
// iPad Safari는 화면을 한 번 눌러야 소리가 난다: '경기 시작' 버튼을 누를 때 부른다
const initAudio = () => {
  try {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      master = actx.createGain(); master.connect(actx.destination);
      // 2초짜리 흰 잡음(타격음·관중 소리의 재료)
      noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      startAmbient();
    }
    if (actx.state === 'suspended') actx.resume();
    applyVolume();
    // 음성 합성도 첫 터치 때 한 번 깨워 둔다(아이폰·아이패드)
    if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
  } catch (e) { actx = null; }
};
const applyVolume = () => { if (master) master.gain.setTargetAtTime(sound.on ? sound.volume : 0, actx.currentTime, 0.05); };
const setSound = (on, volume) => { sound.on = on; sound.volume = volume; applyVolume(); if (!on && 'speechSynthesis' in window) speechSynthesis.cancel(); };
// 일시정지하면 소리도 멈춘다
const pauseAudio = on => { try { if (actx) on ? actx.suspend() : actx.resume(); } catch (e) { /* 무시 */ } };

const noiseSrc = loop => { const s = actx.createBufferSource(); s.buffer = noiseBuf; s.loop = loop; return s; };
const filter = (type, freq, q = 1) => { const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; };
// 소리 크기 모양: 빠르게 올라갔다가 decay초 동안 줄어든다
const envGain = (t, peak, attack, decay) => {
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
};

// 평소 관중 웅성거림: 낮게 거른 잡음 + 천천히 커졌다 작아졌다
const startAmbient = () => {
  const src = noiseSrc(true), bp = filter('bandpass', 420, 0.6), lp = filter('lowpass', 1100);
  ambientGain = actx.createGain(); ambientGain.gain.value = AUDIO_TUNING.ambient;
  const lfo = actx.createOscillator(), lfoGain = actx.createGain();
  lfo.frequency.value = 0.23; lfoGain.gain.value = AUDIO_TUNING.ambient * 0.4;
  lfo.connect(lfoGain); lfoGain.connect(ambientGain.gain);
  src.connect(bp); bp.connect(lp); lp.connect(ambientGain); ambientGain.connect(master);
  src.start(); lfo.start();
};

// 타격음. q: 타구 질(0 빗맞음 ~ 1 정타), foul: 파울이면 짧게
const sfxBat = (q, foul) => {
  if (!actx || !sound.on) return;
  const t = actx.currentTime + 0.005, V = AUDIO_TUNING.bat * (foul ? 0.6 : 1);
  // 1) "딱": 짧은 잡음. 정타일수록 높고 짧고 날카롭게
  const n = noiseSrc(false), bp = filter('bandpass', 900 + 2600 * q, 1 + 4 * q);
  const g1 = envGain(t, V * (0.5 + 0.5 * q), 0.002, (foul ? 0.03 : 0.05) + 0.1 * (1 - q));
  n.connect(bp); bp.connect(g1); g1.connect(master); n.start(t); n.stop(t + 0.3);
  // 2) 맑은 울림(정타일 때 크게)
  const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = 1000 + 800 * q;
  const g2 = envGain(t, V * 0.35 * q * q + 0.0002, 0.002, foul ? 0.06 : 0.14);
  o.connect(g2); g2.connect(master); o.start(t); o.stop(t + 0.3);
  // 3) 둔한 "퍽"(빗맞을수록 크게)
  const n2 = noiseSrc(false), lp = filter('lowpass', 380);
  const g3 = envGain(t, V * 0.7 * (1 - q) + 0.0002, 0.004, 0.12);
  n2.connect(lp); lp.connect(g3); g3.connect(master); n2.start(t); n2.stop(t + 0.3);
};
// 관중 함성: 1 = 삼진(작게), 2 = 안타, 3 = 홈런(가장 크게)
const sfxCheer = level => {
  if (!actx || !sound.on) return;
  const t = actx.currentTime, peak = AUDIO_TUNING.cheer[level], dur = AUDIO_TUNING.cheerSec[level];
  [[700, 0.6, 1], [1600, 0.9, 0.55], [2900, 1.4, 0.3]].forEach(([f, q, mix]) => {
    const s = noiseSrc(true), bp = filter('bandpass', f, q);
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak * mix, t + 0.25);
    g.gain.setValueAtTime(peak * mix, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(master);
    s.start(t, Math.random()); s.stop(t + dur + 0.1);
  });
};
// 심판 콜: "스트라이크!", "볼!", "아웃!", "세이프!". 음성 합성이 안 되면 조용히 넘어간다
const umpireCall = text => {
  if (!sound.on || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();   // 앞 콜이 밀려서 늦게 나오지 않게
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = AUDIO_TUNING.callRate; u.pitch = 0.75; u.volume = sound.volume;
    speechSynthesis.speak(u);
  } catch (e) { /* 소리 없이 진행 */ }
};
