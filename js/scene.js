// 장면: 렌더러·카메라·조명·그림자, 공통 텍스처/도형 함수, 공과 그림자, 불꽃 파티클, 시간대(낮·저녁·밤) 하늘과 조명

const gameCanvas = $('cv');
const renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fcdf2);
scene.fog = new THREE.Fog(0xcfe9f7, 220, 520);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);
const hemi = new THREE.HemisphereLight(0xffffff, 0x7fae6a, 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfffbe8, 0.8);
sun.position.set(-40, 80, 40);
sun.target.position.set(0, 0, -20);
scene.add(sun, sun.target);
sun.castShadow = true;
// 그림자 지도 크기(기기가 되면 4096)
const SHADOW_MAP_SIZE = (renderer.capabilities.maxTextureSize || 2048) >= 4096 ? 4096 : 2048;
sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 220 });
sun.shadow.bias = -0.0006;
sun.shadow.radius = 4;
// 반대쪽에서 비추는 보조 조명
const fillLight = new THREE.DirectionalLight(0xbcd0ff, 0.3);
fillLight.position.set(35, 25, 60);
scene.add(fillLight);
// 빛을 받는 기본 재질을 만든다
const lambertMat = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
// 캔버스에 그림을 그려 반복 무늬 텍스처를 만든다
function tex(w, h, fn, rep) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  fn(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep[0], rep[1]);
  return t;
}
// 도형을 만들어 위치·회전을 정하고 장면에 넣는다
function add(geo, mat, x, y, z, rx, ry) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  scene.add(m);
  return m;
}
// 공
const ball = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 24),
  new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0x2a2a2a,
    map: tex(
      256,
      128,
      c => {
        c.fillStyle = '#f7f3ea';
        c.fillRect(0, 0, 256, 128);
        for (let i = 0; i < 500; i++) {
          c.fillStyle = 'rgba(120,100,70,.05)';
          c.fillRect(rand() * 256, rand() * 128, 1 + rand() * 2, 1);
        }
        c.strokeStyle = '#c8102e';
        c.lineWidth = 2.2;
        const sa = (cx, cy, r, a0, a1) => {
          c.beginPath();
          c.arc(cx, cy, r, a0, a1);
          c.stroke();
          c.lineWidth = 1.4;
          for (let a = a0; a <= a1; a += 0.13) {
            c.beginPath();
            c.moveTo(cx + Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5));
            c.lineTo(cx + Math.cos(a) * (r + 5), cy + Math.sin(a) * (r + 5));
            c.stroke();
          }
          c.lineWidth = 2.2;
        };
        [40, 168].forEach(x => {
          sa(x, 64, 48, -1.1, 1.1);
          sa(x + 48, 64, 48, Math.PI - 1.1, Math.PI + 1.1);
        });
      },
      [1, 1],
    ),
  }),
);
scene.add(ball);
ball.visible = false;
// 공 그림자
const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(1, 16),
  new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4 }),
);
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);
shadow.visible = false;
// 이 시각까지 슬로모션
let slowUntil = 0;
// 화면 흔들림 세기
let shake = 0;
// 홈런 불꽃놀이가 끝나는 시각
let fwEnd = 0;
// 다음 불꽃을 쏠 시각
let fwNext = 0;
// 불꽃 파티클 최대 개수
const MAX_PARTICLES = 500;
const particlePos = new Float32Array(MAX_PARTICLES * 3).fill(-999);
const particleBaseColor = new Float32Array(MAX_PARTICLES * 3);
const particleColor = new Float32Array(MAX_PARTICLES * 3);
const particleVel = new Float32Array(MAX_PARTICLES * 3);
const particleLife = new Float32Array(MAX_PARTICLES);
const particleMaxLife = new Float32Array(MAX_PARTICLES);
// 다음에 쓸 파티클 칸
let particleIdx = 0;
const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColor, 3));
const particlePoints = new THREE.Points(
  particleGeo,
  new THREE.PointsMaterial({
    size: 0.55,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
particlePoints.frustumCulled = false;
scene.add(particlePoints);
// 불꽃 파티클을 한 번에 여러 개 뿌린다
function burst(x, y, z, n, c, sp, life) {
  for (let k = 0; k < n; k++) {
    const i = (particleIdx = (particleIdx + 1) % MAX_PARTICLES),
      a = randRange(0, 6.283),
      u = randRange(-1, 1),
      r = Math.sqrt(1 - u * u),
      s = sp * randRange(0.3, 1);
    particlePos[i * 3] = x;
    particlePos[i * 3 + 1] = y;
    particlePos[i * 3 + 2] = z;
    particleVel[i * 3] = r * Math.cos(a) * s;
    particleVel[i * 3 + 1] = u * s + sp * 0.3;
    particleVel[i * 3 + 2] = r * Math.sin(a) * s;
    particleBaseColor.set(c, i * 3);
    particleLife[i] = particleMaxLife[i] = life * randRange(0.6, 1);
  }
}
// 파티클을 움직이고 수명이 다하면 숨긴다
function stepParticles(dt) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (particleLife[i] <= 0) {
      if (particlePos[i * 3 + 1] > -900) particlePos[i * 3 + 1] = -999;
      continue;
    }
    particleLife[i] -= dt;
    const k = i * 3,
      f = Math.max(0, particleLife[i] / particleMaxLife[i]);
    particlePos[k] += particleVel[k] * dt;
    particlePos[k + 1] += particleVel[k + 1] * dt;
    particlePos[k + 2] += particleVel[k + 2] * dt;
    particleVel[k + 1] -= 6 * dt;
    particleColor[k] = particleBaseColor[k] * f;
    particleColor[k + 1] = particleBaseColor[k + 1] * f;
    particleColor[k + 2] = particleBaseColor[k + 2] * f;
  }
  particleGeo.attributes.position.needsUpdate = true;
  particleGeo.attributes.color.needsUpdate = true;
}
// 시간대별 하늘·조명 색(0 낮, 1 저녁, 2 밤, 3 노을)
const TIME_OF_DAY = [
  {
    t: '#2a82d4',
    m: '#6fbef0',
    b: '#eef8fc',
    fog: 0xcfe9f7,
    hc: 0xffffff,
    hg: 0x7fae6a,
    hi: 1.05,
    sc: 0xfffbe8,
    si: 0.8,
    tint: 0xffffff,
    t2: 0xffffff,
    sp: [-40, 80, 40],
  },
  {
    t: '#3b3f8f',
    m: '#e8895a',
    b: '#ffd9a0',
    fog: 0xe8b890,
    hc: 0xffd9c0,
    hg: 0x6a6a4a,
    hi: 0.85,
    sc: 0xffb070,
    si: 0.6,
    tint: 0xffb890,
    t2: 0xffc9a0,
    sp: [-70, 30, 40],
  },
  {
    t: '#050a1c',
    m: '#0e1a3c',
    b: '#1b2a55',
    fog: 0x0c1433,
    hc: 0xaabbff,
    hg: 0x203a28,
    hi: 0.6,
    sc: 0xcfe0ff,
    si: 0.35,
    tint: 0x35456b,
    t2: 0x6a78a8,
    sp: [-40, 80, 40],
  },
  {
    t: '#101a52',
    m: '#3a62b0',
    b: '#f2b07a',
    fog: 0x9aa8c8,
    hc: 0xc8d0f0,
    hg: 0x4a6a4a,
    hi: 0.8,
    sc: 0xffd0a0,
    si: 0.45,
    tint: 0x8a96c0,
    t2: 0xb8bedc,
    sp: [-60, 45, 40],
  },
];
// 지금 시간대 번호
let todIdx = -1;
// 시간대(낮·저녁·밤·노을)에 맞게 하늘과 조명을 바꾼다
function setTimeOfDay(k) {
  if (k === todIdx || !window.SKY) return;
  todIdx = k;
  const T = TIME_OF_DAY[k],
    c = document.createElement('canvas');
  c.width = 16;
  c.height = 256;
  const x = c.getContext('2d'),
    g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, T.t);
  g.addColorStop(0.5, T.m);
  g.addColorStop(1, T.b);
  x.fillStyle = g;
  x.fillRect(0, 0, 16, 256);
  SKY.material.map = new THREE.CanvasTexture(c);
  SKY.material.needsUpdate = true;
  scene.background = new THREE.Color(T.fog);
  scene.fog.color.set(T.fog);
  hemi.color.set(T.hc);
  hemi.groundColor.set(T.hg);
  hemi.intensity = T.hi;
  sun.color.set(T.sc);
  sun.intensity = T.si;
  sun.position.set(...T.sp);
  HL.material.color.set(T.tint);
  (window.APT || []).forEach(m => m.material.color.set(T.t2));
  scene.traverse(o => {
    if (o.isMesh && o.geometry.type === 'BufferGeometry' && o.material.isMeshBasicMaterial) {
      if (!o.userData.c0) o.userData.c0 = o.material.color.clone();
      o.material.color.copy(o.userData.c0).multiply(new THREE.Color(T.t2));
    }
  });
}
// 모든 기본 재질을 사실적인 재질로 바꾸고 조명탑 스포트라이트를 단다
function upgradeRealisticStadium() {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  scene.traverse(o => {
    if (!o.isMesh || o === window.SKY) return;
    if (o.material && o.material.isMeshLambertMaterial) {
      const old = o.material;
      o.material = new THREE.MeshStandardMaterial({
        color: old.color,
        map: old.map || null,
        bumpMap: old.map || null,
        bumpScale: old.map ? 0.035 : 0,
        roughness: old.map ? 0.88 : 0.45,
        metalness: 0.05,
      });
      o.material.color = old.color;
      // 유니폼 색 변경(dress)이 계속 반영되도록 Color 공유
      o.receiveShadow = true;
    }
  });
  [
    [-88, -52],
    [88, -52],
    [-62, -112],
    [62, -112],
  ].forEach(([x, z]) => {
    const spot = new THREE.SpotLight(0xfff6e5, 2.2, 320, Math.PI / 3, 0.6, 1);
    spot.position.set(x, 49, z);
    spot.target.position.set(0, 0, -35);
    scene.add(spot, spot.target);
  });
}
