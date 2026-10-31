// 소리: Web Audio로 만드는 관중 소리·함성·신호음·타격음·응원 오르간(외부 소리 파일 없음)

// 소리 설정표
const AUDIO_TUNING = {
  bat: 0.9, // 타격음 크기
  ting: 0.22, // 정타 때 겹치는 높은 '팅' 크기
  mitt: [0.25, 0.7], // 미트 '팡' 크기 [느린 공(110km/h), 빠른 공(155km/h)]
  roar: { strike: 0.18, hit: 0.32, strikeout: 0.28, play: 0.4, hr: 0.55 }, // 함성 크기
  roarSec: { strike: 0.9, hit: 2.0, strikeout: 1.6, play: 2.2, hr: 3.8 }, // 함성 길이(초)
  callRate: 1.3, // 심판 콜 말하기 속도(빠를수록 늦게 들리지 않음)
  callPitch: 0.75, // 심판 목소리 높낮이
};

// 소리 장치(첫 터치 때 만든다)
let audioCtx;
// 전체 음량 조절기(모든 소리가 여기를 거쳐 나간다)
let masterGain;
// 소리가 나갈 곳
const audioOut = () => masterGain || audioCtx.destination;
// 설정의 소리 켜기/끄기와 음량을 적용한다
function applyVolume() {
  if (masterGain) masterGain.gain.value = SETTINGS.sound ? SETTINGS.volume : 0;
}
// 첫 터치 때 소리 장치를 켠다
function unlockAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.connect(audioCtx.destination);
      applyVolume();
    } catch (e) {}
  }
  unlockSpeech();
  // iPad는 터치할 때 소리 장치를 다시 깨워야 할 때가 있다(일시정지 중이면 깨우지 않음)
  try {
    if (audioCtx && audioCtx.state === 'suspended' && !paused) audioCtx.resume();
  } catch (e) {}
  startAmbient();
}
// iPad Safari는 손가락을 '뗄 때'(touchend·click)만 소리를 켜 준다.
// 게임의 탭은 모두 손가락을 '댈 때'(pointerdown) 처리돼서, 그것만으로는 소리 장치가 잠긴 채 남아 소리가 안 났다.
// 그래서 손을 뗄 때마다 소리 장치를 깨우고, 처음 한 번은 빈 소리를 틀어 잠금을 확실히 푼다.
let gestureUnlocked = false;
// 손을 뗄 때(또는 키를 누를 때) 소리 장치와 심판 목소리를 깨운다
function unlockFromGesture() {
  if (paused) return;
  unlockAudio();
  if (!audioCtx) return;
  try {
    if (audioCtx.state !== 'running') audioCtx.resume(); // iPad에서 다른 앱에 갔다 오면 'interrupted'가 되기도 한다
  } catch (e) {}
  if (gestureUnlocked) return;
  gestureUnlocked = true;
  try {
    const b = audioCtx.createBuffer(1, 1, 22050),
      s = audioCtx.createBufferSource();
    s.buffer = b;
    s.connect(audioCtx.destination);
    s.start(0);
  } catch (e) {}
  speechReady = false; // 손을 댈 때 깨운 것은 iPad에서 무시되므로 여기서 다시 깨운다
  unlockSpeech();
}
['touchend', 'pointerup', 'click', 'keydown'].forEach(t =>
  addEventListener(t, unlockFromGesture, { capture: true, passive: true }),
);
// 관중 웅성거림 크기 조절기
let ambientGain;
// 관중 웅성거림 배경음을 튼다
function startAmbient() {
  if (!audioCtx || ambientGain) return;
  const n = (audioCtx.sampleRate * 2) | 0,
    bf = audioCtx.createBuffer(1, n, audioCtx.sampleRate),
    d = bf.getChannelData(0);
  let l = 0;
  for (let i = 0; i < n; i++) {
    l = l * 0.97 + (rand() * 2 - 1) * 0.03;
    d[i] = l * 3;
  }
  const s = audioCtx.createBufferSource(),
    f = audioCtx.createBiquadFilter(),
    g = audioCtx.createGain();
  s.buffer = bf;
  s.loop = true;
  f.type = 'lowpass';
  f.frequency.value = 700;
  g.gain.value = 0.12;
  s.connect(f);
  f.connect(g);
  g.connect(audioOut());
  s.start();
  ambientGain = g;
}
// 관중 함성을 잠깐 키운다(v: 크기, d: 길이)
function cheer(v, d) {
  if (v >= 0.5) crowdT = now;
  if (!ambientGain) return;
  const t = audioCtx.currentTime;
  ambientGain.gain.cancelScheduledValues(t);
  ambientGain.gain.setValueAtTime(ambientGain.gain.value, t);
  ambientGain.gain.linearRampToValueAtTime(v, t + 0.15);
  ambientGain.gain.linearRampToValueAtTime(0.12, t + d);
}
// 짧은 신호음을 낸다
function tone(f, d, v = 0.12, t = 'square') {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(),
    g = audioCtx.createGain();
  o.type = t;
  o.frequency.value = f;
  g.gain.setValueAtTime(v, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
  o.connect(g);
  g.connect(audioOut());
  o.start();
  o.stop(audioCtx.currentTime + d);
}
// 응원 오르간 멜로디를 연주한다
function organ(k) {
  if (!audioCtx) return;
  const nt = {
    charge: [
      [392, 0.13],
      [523, 0.13],
      [659, 0.13],
      [784, 0.28],
      [659, 0.13],
      [784, 0.6],
    ],
    hr: [
      [523, 0.12],
      [659, 0.12],
      [784, 0.12],
      [1047, 0.35],
      [784, 0.12],
      [1047, 0.7],
    ],
    tense: [
      [330, 0.16],
      [330, 0.16],
      [392, 0.16],
      [330, 0.16],
      [294, 0.36],
    ],
    sad: [
      [392, 0.22],
      [370, 0.22],
      [349, 0.22],
      [330, 0.6],
    ],
  }[k];
  let t = audioCtx.currentTime + 0.05;
  nt.forEach(([f, d]) => {
    [1, 2, 0.5].forEach((m, i) => {
      const o = audioCtx.createOscillator(),
        fl = audioCtx.createBiquadFilter(),
        g = audioCtx.createGain(),
        v = i ? 0.03 : 0.06;
      o.type = i ? 'sine' : 'sawtooth';
      o.frequency.value = f * m;
      fl.type = 'lowpass';
      fl.frequency.value = 1600;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.02);
      g.gain.setValueAtTime(v, t + d * 0.8);
      g.gain.linearRampToValueAtTime(0, t + d);
      o.connect(fl);
      fl.connect(g);
      g.connect(audioOut());
      o.start(t);
      o.stop(t + d + 0.02);
    });
    t += d;
  });
}
// ---------- 타격음·미트·함성(코드로 만든 소리) ----------
let noiseBuf = null;
// 2초짜리 흰 잡음(타격음·함성의 재료). 한 번만 만든다
function noise() {
  if (!noiseBuf) {
    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = audioCtx.createBufferSource();
  s.buffer = noiseBuf;
  return s;
}
// 소리 크기 모양: 빠르게 올라갔다가 decay초 동안 줄어든다
function envelope(t, peak, attack, decay) {
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}
function bandFilter(type, freq, q) {
  const f = audioCtx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q || 1;
  return f;
}
// 타격음. q: 타구 질(0 빗맞음 ~ 1 정타). 정타는 맑은 '딱!' + 높은 '팅', 빗맞음은 둔하게, 파울은 짧게
function batSound(q, foul) {
  if (!audioCtx || !SETTINGS.sound) return;
  const t = audioCtx.currentTime + 0.005,
    V = AUDIO_TUNING.bat * (foul ? 0.6 : 1);
  // 1) '딱': 짧은 잡음. 정타일수록 높고 짧고 날카롭게
  const n = noise(),
    bp = bandFilter('bandpass', 900 + 2600 * q, 1 + 4 * q),
    g1 = envelope(t, V * (0.5 + 0.5 * q), 0.002, (foul ? 0.03 : 0.05) + 0.1 * (1 - q));
  n.connect(bp);
  bp.connect(g1);
  g1.connect(audioOut());
  n.start(t);
  n.stop(t + 0.3);
  // 2) 정타면 높은 '팅'을 아주 짧게
  if (q > 0.7 && !foul) {
    const o = audioCtx.createOscillator(),
      g2 = envelope(t, AUDIO_TUNING.ting * q, 0.002, 0.09);
    o.type = 'sine';
    o.frequency.value = 2400 + 600 * q;
    o.connect(g2);
    g2.connect(audioOut());
    o.start(t);
    o.stop(t + 0.15);
  }
  // 3) 둔한 '퍽'(빗맞을수록 크게)
  const n2 = noise(),
    lp = bandFilter('lowpass', 380),
    g3 = envelope(t, V * 0.7 * (1 - q) + 0.0002, 0.004, 0.12);
  n2.connect(lp);
  lp.connect(g3);
  g3.connect(audioOut());
  n2.start(t);
  n2.stop(t + 0.3);
}
// 포수 미트에 공이 꽂히는 '팡'. 빠른 공일수록 크게
function mittPop(kmh) {
  if (!audioCtx || !SETTINGS.sound) return;
  const t = audioCtx.currentTime + 0.003,
    [v0, v1] = AUDIO_TUNING.mitt,
    v = v0 + (v1 - v0) * clamp((kmh - 110) / 45, 0, 1);
  const n = noise(),
    bp = bandFilter('bandpass', 1300, 1.2),
    g = envelope(t, v, 0.002, 0.07);
  n.connect(bp);
  bp.connect(g);
  g.connect(audioOut());
  n.start(t);
  n.stop(t + 0.2);
  // 가죽이 울리는 낮은 '퉁'
  const o = audioCtx.createOscillator(),
    g2 = envelope(t, v * 0.5, 0.002, 0.08);
  o.type = 'sine';
  o.frequency.value = 180;
  o.connect(g2);
  g2.connect(audioOut());
  o.start(t);
  o.stop(t + 0.15);
}
// 관중 함성: kind = 'strike', 'hit', 'strikeout', 'play'(호수비), 'hr'
function roar(kind) {
  if (!audioCtx || !SETTINGS.sound) return;
  const t = audioCtx.currentTime,
    peak = AUDIO_TUNING.roar[kind],
    dur = AUDIO_TUNING.roarSec[kind];
  [
    [700, 0.6, 1],
    [1600, 0.9, 0.55],
    [2900, 1.4, 0.3],
  ].forEach(([f, q, mix]) => {
    const s = noise(),
      bp = bandFilter('bandpass', f, q),
      g = audioCtx.createGain();
    s.loop = true;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak * mix, t + 0.25);
    g.gain.setValueAtTime(peak * mix, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp);
    bp.connect(g);
    g.connect(audioOut());
    s.start(t, Math.random());
    s.stop(t + dur + 0.1);
  });
}
// ---------- 심판 콜(브라우저 음성 합성) ----------
let speechReady = false;
// iPad는 첫 터치 때 음성 합성을 빈 소리로 한 번 깨워야 한다
function unlockSpeech() {
  if (speechReady || !('speechSynthesis' in window)) return;
  speechReady = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch (e) {}
}
// 심판 콜: "스트라이크!", "볼!", "아웃!", "세이프!", "삼진!". 안 되면 조용히 넘어간다
function umpireCall(text) {
  if (!SETTINGS.sound || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel(); // 앞 콜이 밀려서 늦게 나오지 않게
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = AUDIO_TUNING.callRate;
    u.pitch = AUDIO_TUNING.callPitch;
    u.volume = SETTINGS.volume;
    speechSynthesis.speak(u);
  } catch (e) {}
}
// 배너 글자를 보고 알맞은 심판 콜을 고른다(없으면 콜 없음)
function umpireForBanner(t, sub) {
  const s = t + ' ' + (sub || '');
  if (/삼진/.test(t)) return '삼진!';
  if (/^(스트라이크|헛스윙!)$/.test(t)) return '스트라이크!';
  if (/^볼/.test(t)) return '볼!';
  if (/아웃|병살|견제사|트리플|다이빙 캐치!!|희생|도루 실패/.test(s)) return '아웃!';
  if (/세이프|성공|태그업 진루/.test(s)) return '세이프!';
  return '';
}
