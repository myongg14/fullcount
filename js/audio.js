// 소리: Web Audio로 만드는 관중 소리·함성·신호음·타격음·응원 오르간(외부 소리 파일 없음)

// 소리 장치(첫 터치 때 만든다)
let audioCtx;
// 첫 터치 때 소리 장치를 켠다
function unlockAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }
  startAmbient();
}
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
  g.connect(audioCtx.destination);
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
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + d);
}
// 배트에 맞는 "딱" 소리
function batCrack() {
  if (!audioCtx) return;
  const n = (audioCtx.sampleRate * 0.12) | 0,
    bf = audioCtx.createBuffer(1, n, audioCtx.sampleRate),
    d = bf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (rand() * 2 - 1) * (1 - i / n) ** 3;
  const s = audioCtx.createBufferSource(),
    g = audioCtx.createGain();
  g.gain.value = 0.8;
  s.buffer = bf;
  s.connect(g);
  g.connect(audioCtx.destination);
  s.start();
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
      g.connect(audioCtx.destination);
      o.start(t);
      o.stop(t + d + 0.02);
    });
    t += d;
  });
}
