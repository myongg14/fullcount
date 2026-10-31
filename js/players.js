// 선수 모델: 관절이 있는 사람 모델, 자세(차렷·달리기·준비), 팔 IK, 투수·타자·포수·심판·수비수·주자, 투구폼·스윙 애니메이션, 유니폼, 벤치 클리어링

// 선수 발밑 그림자 도형
const SHADOW_GEO = new THREE.CircleGeometry(1, 14);
// 선수 발밑 그림자 재질
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35 });
// 피부색 후보
const SKINS = [0xe3b890, 0xd9a77f, 0xcf9a73, 0xe9c19b, 0xc58f68];
// 머리색 후보
const HAIRS = [0x15110e, 0x1a1410, 0x241a14, 0x2e2018];
// 사실적인 PBR 재질을 만든다
const standardMat = (c, map, r) =>
  new THREE.MeshStandardMaterial({ color: c, map: map || null, roughness: r || 0.82, metalness: 0 });
// 외곽선 재질(지금은 쓰지 않음)
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1226, side: THREE.BackSide, visible: false });
outlineMat.onBeforeCompile = h => {
  h.vertexShader = h.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed=position+normal*0.009;');
};
// 0xRRGGBB 숫자를 CSS 색 글자로 바꾼다
const hexCss = n => '#' + n.toString(16).padStart(6, '0');
// 등번호 텍스처를 만든다
function numTex(n, col) {
  return tex(
    64,
    64,
    c => {
      c.font = 'bold 46px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.strokeStyle = 'rgba(0,0,0,.4)';
      c.lineWidth = 5;
      c.fillStyle = col;
      c.strokeText(n, 32, 34);
      c.fillText(n, 32, 34);
    },
    [1, 1],
  );
}
// 모자 무늬
const capTexture = tex(
  256,
  128,
  c => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 256, 128);
    c.strokeStyle = 'rgba(0,0,0,.28)';
    c.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const x = (i * 256) / 6;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 128);
      c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,.16)';
    c.fillRect(0, 118, 256, 10);
  },
  [1, 1],
);
// 유니폼 줄무늬
const jerseyTexture = tex(
  128,
  128,
  c => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = 'rgba(0,0,0,.05)';
    for (let y = 0; y < 128; y += 4) c.fillRect(0, y, 128, 2);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.fillRect(0, 0, 3, 128);
    c.fillRect(125, 0, 3, 128);
  },
  [1, 1],
);
const geoCache = {};
// 같은 도형은 한 번만 만들어 재사용한다
const cachedGeo = (k, f) => geoCache[k] || (geoCache[k] = f());
const SPHERE_GEO = cachedGeo('sp', () => new THREE.SphereGeometry(1, 16, 12));
const HEAD_GEO = cachedGeo('skg', () => new THREE.SphereGeometry(1, 24, 18));
// 관절이 있는 사람 모델(선수)을 만든다
function human(o) {
  const root = new THREE.Group(),
    skc = o.skin || SKINS[(rand() * SKINS.length) | 0],
    bg = !!o.helmet && !o.gloveSide,
    sk = standardMat(skc, null, 0.5),
    sh = standardMat(o.shirt, jerseyTexture, 0.7),
    pa = standardMat(o.pants || 0xeceadf, null, 0.65),
    dk = standardMat(0x15151c, null, 0.3),
    ct = standardMat(o.cap, o.helmet ? null : capTexture, o.helmet ? 0.18 : 0.65),
    hr = standardMat(o.hair || HAIRS[(rand() * HAIRS.length) | 0]),
    so = standardMat(o.sock || o.cap),
    wh = standardMat(0xf4f4f4, null, 0.5),
    sl = standardMat(o.sleeve || 0x1c2233, null, 0.55),
    lt = standardMat(0x6b3410, null, 0.4),
    gd = standardMat(0xfbbf24, null, 0.2);
  if (o.helmet) ct.metalness = 0.25;
  const mk = (g, mt, x, y, z, par, s) => {
    const m = new THREE.Mesh(g, mt);
    m.position.set(x, y, z);
    if (s) m.scale.set(s[0], s[1], s[2]);
    par.add(m);
    return m;
  };
  const seg = (par, r0, r1, len, mt) => {
    mk(SPHERE_GEO, mt, 0, 0, 0, par, [r0 * 0.98, r0 * 0.98, r0 * 0.98]);
    par.add(
      new THREE.Mesh(
        cachedGeo('c' + r0 + '_' + r1 + '_' + len, () => {
          const P = [new THREE.Vector2(0, -len)];
          for (let i = 0; i <= 8; i++) {
            const t = 1 - i / 8;
            P.push(
              new THREE.Vector2((r0 + (r1 - r0) * t) * (1 + 0.1 * Math.sin(Math.PI * Math.min(1, t / 0.5))), -len * t),
            );
          }
          return new THREE.LatheGeometry(P, 14);
        }),
        mt,
      ),
    );
  };
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  root.add(hips);
  mk(
    cachedGeo('hp', () => new THREE.CylinderGeometry(0.165, 0.155, 0.22, 20).scale(1.15, 1, 0.82)),
    pa,
    0,
    0,
    0,
    hips,
  );
  mk(
    cachedGeo('bl', () => new THREE.CylinderGeometry(0.168, 0.168, 0.04, 20).scale(1.16, 1, 0.84)),
    dk,
    0,
    0.09,
    0,
    hips,
  );
  mk(
    cachedGeo('bk', () => new THREE.BoxGeometry(0.06, 0.05, 0.03)),
    gd,
    0,
    0.09,
    0.14,
    hips,
  );
  const spine = new THREE.Group();
  spine.position.y = 0.1;
  hips.add(spine);
  const L = ((o.shirt >> 16) & 255) * 0.3 + ((o.shirt >> 8) & 255) * 0.59 + (o.shirt & 255) * 0.11,
    dkT = L > 170;
  const TP = [
      [0, 0.162],
      [0.1, 0.15],
      [0.22, 0.168],
      [0.34, 0.192],
      [0.42, 0.196],
      [0.47, 0.178],
      [0.51, 0.13],
      [0.54, 0.09],
      [0.565, 0.055],
    ],
    rr = y => {
      for (let i = 1; i < TP.length; i++)
        if (y <= TP[i][0]) {
          const a = TP[i - 1],
            b = TP[i];
          return a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]);
        }
      return TP[TP.length - 1][1];
    },
    tz = y => 0.78 * rr(y) + 0.004;
  mk(
    cachedGeo('ch2', () =>
      new THREE.LatheGeometry(
        new THREE.SplineCurve(TP.map(q => new THREE.Vector2(q[1], q[0]))).getPoints(40),
        28,
      ).scale(1.22, 1, 0.78),
    ),
    sh,
    0,
    0,
    0,
    spine,
  );
  mk(
    cachedGeo('nk', () => new THREE.CylinderGeometry(0.068, 0.078, 0.11, 16)),
    sk,
    0,
    0.55,
    0,
    spine,
  );
  [0.12, 0.2, 0.28].forEach(y => mk(SPHERE_GEO, wh, 0, y, tz(y), spine, [0.008, 0.008, 0.006]));
  const np = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.2),
    new THREE.MeshBasicMaterial({
      map: numTex(o.num || (1 + rand() * 98) | 0, dkT ? '#1a1a2a' : '#fff'),
      transparent: true,
    }),
  );
  np.position.set(0, 0.3, -tz(0.3) - 0.002);
  np.rotation.y = Math.PI;
  spine.add(np);
  const cz = document.createElement('canvas');
  cz.width = 128;
  cz.height = 48;
  const cx2 = cz.getContext('2d'),
    ctx2 = new THREE.CanvasTexture(cz),
    cpl = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.09),
      new THREE.MeshBasicMaterial({ map: ctx2, transparent: true }),
    );
  cpl.position.set(0, 0.4, tz(0.4) + 0.003);
  spine.add(cpl);
  const setChest = (t, col) => {
    cx2.clearRect(0, 0, 128, 48);
    cx2.font = 'bold 30px sans-serif';
    cx2.textAlign = 'center';
    cx2.textBaseline = 'middle';
    cx2.lineWidth = 4;
    cx2.strokeStyle = 'rgba(0,0,0,.55)';
    cx2.fillStyle = col;
    cx2.strokeText(t, 64, 26);
    cx2.fillText(t, 64, 26);
    ctx2.needsUpdate = true;
  };
  const head = new THREE.Group();
  head.position.y = 0.6;
  spine.add(head);
  mk(HEAD_GEO, sk, 0, 0.11, 0, head, [0.106, 0.129, 0.113]);
  mk(
    cachedGeo('ns', () => new THREE.ConeGeometry(0.02, 0.05, 8)),
    sk,
    0,
    0.045,
    0.1,
    head,
  ).rotation.x = Math.PI * 0.5;
  mk(
    cachedGeo('mo', () => new THREE.BoxGeometry(0.034, 0.006, 0.006)),
    dk,
    0,
    0.005,
    0.06,
    head,
  );
  [-1, 1].forEach(x => {
    mk(SPHERE_GEO, dk, x * 0.04, 0.072, 0.104, head, [0.011, 0.012, 0.008]);
    mk(
      cachedGeo('eb', () => new THREE.BoxGeometry(0.032, 0.01, 0.01)),
      dk,
      x * 0.042,
      0.052,
      0.102,
      head,
    );
    mk(SPHERE_GEO, sk, x * 0.108, 0.07, 0, head, [0.012, 0.03, 0.022]);
    if (o.helmet) mk(SPHERE_GEO, ct, x * 0.11, 0.075, 0.01, head, [0.02, 0.055, 0.07]);
  });
  mk(SPHERE_GEO, hr, 0, 0.075, -0.05, head, [0.1, 0.08, 0.085]);
  mk(
    cachedGeo('cr', () => new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58)),
    ct,
    0,
    0.115,
    0,
    head,
    [0.118, 0.128, 0.127],
  );
  mk(
    cachedGeo('br', () =>
      new THREE.CylinderGeometry(0.12, 0.12, 0.012, 20, 1, false, -Math.PI * 0.35, Math.PI * 0.7).scale(0.95, 1, 1.35),
    ),
    ct,
    0,
    0.095,
    0.055,
    head,
  ).rotation.x = 0.12;
  mk(SPHERE_GEO, ct, 0, 0.245, 0, head, [0.012, 0.012, 0.012]);
  const glove = () => {
    const g = new THREE.Group();
    mk(SPHERE_GEO, lt, 0, 0, 0, g, [0.145, 0.16, 0.07]);
    mk(SPHERE_GEO, standardMat(0x4a2910), 0, 0, 0.05, g, [0.075, 0.09, 0.03]);
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.34,
        f = mk(
          cachedGeo('gf', () => new THREE.CylinderGeometry(0.03, 0.036, 0.19, 10)),
          lt,
          Math.sin(a) * (i ? 0.12 : 0.13),
          -0.1 - Math.cos(a) * 0.05,
          0.03,
          g,
        );
      f.rotation.z = -a * 0.6;
      f.rotation.x = -0.35;
    }
    mk(
      cachedGeo('gw', () => new THREE.BoxGeometry(0.09, 0.12, 0.025)),
      lt,
      -0.085,
      -0.07,
      0.035,
      g,
    ).rotation.z = 0.4;
    return g;
  };
  const leg = s => {
    const th = new THREE.Group();
    th.position.set(0.105 * s, -0.02, 0);
    hips.add(th);
    seg(th, 0.098, 0.074, 0.45, pa);
    const sn = new THREE.Group();
    sn.position.y = -0.45;
    th.add(sn);
    seg(sn, 0.072, 0.05, 0.44, pa);
    mk(
      cachedGeo('sx', () => new THREE.CylinderGeometry(0.064, 0.054, 0.24, 14)),
      so,
      0,
      -0.31,
      0,
      sn,
    );
    const an = new THREE.Group();
    an.position.y = -0.44;
    sn.add(an);
    mk(
      cachedGeo('sh', () => new THREE.BoxGeometry(0.105, 0.075, 0.25)),
      dk,
      0,
      -0.025,
      0.055,
      an,
    );
    mk(
      cachedGeo('st', () => new THREE.BoxGeometry(0.11, 0.022, 0.12)),
      wh,
      0,
      -0.02,
      0.05,
      an,
    ).rotation.x = 0.15;
    mk(
      cachedGeo('so', () => new THREE.BoxGeometry(0.1, 0.02, 0.26)),
      wh,
      0,
      -0.07,
      0.055,
      an,
    );
    return { th, sn };
  };
  const arm = s => {
    const ua = new THREE.Group();
    ua.position.set(0.245 * s, 0.46, 0);
    spine.add(ua);
    seg(ua, 0.068, 0.055, 0.3, sh);
    mk(SPHERE_GEO, sh, 0, -0.035, 0, ua, [0.082, 0.11, 0.09]);
    const fa = new THREE.Group();
    fa.position.y = -0.3;
    ua.add(fa);
    seg(fa, 0.054, 0.04, 0.3, sl);
    mk(
      cachedGeo('wb', () => new THREE.CylinderGeometry(0.045, 0.044, 0.05, 14)),
      sl,
      0,
      -0.25,
      0,
      fa,
    );
    const hd = new THREE.Group();
    hd.position.y = -0.32;
    fa.add(hd);
    if (o.gloveSide === s) hd.add(glove()).position.set(0, -0.01, 0.03);
    else {
      mk(SPHERE_GEO, bg ? wh : sk, 0, 0, 0, hd, [0.046, 0.058, 0.034]);
      mk(SPHERE_GEO, bg ? wh : sk, 0.034 * s, 0.02, 0.026, hd, [0.017, 0.028, 0.018]);
    }
    return { ua, fa, hd };
  };
  const sd = new THREE.Mesh(SHADOW_GEO, SHADOW_MAT);
  sd.rotation.x = -Math.PI / 2;
  sd.position.y = 0.07;
  sd.scale.set(0.5, 0.38, 1);
  root.add(sd);
  scene.add(root);
  return {
    root,
    hips,
    spine,
    head,
    L: leg(1),
    Rl: leg(-1),
    La: arm(1),
    Ra: arm(-1),
    ph: 0,
    mats: [sh, sh, ct, pa],
    chest: setChest,
  };
}
// 선수 관절을 차렷 자세로 되돌린다
function resetPose(h, hy) {
  h.hips.position.y = hy || 0.95;
  h.hips.rotation.set(0, 0, 0);
  h.spine.rotation.set(0, 0, 0);
  h.head.rotation.set(0, 0, 0);
  [h.L, h.Rl].forEach(l => {
    l.th.rotation.set(0, 0, 0);
    l.sn.rotation.set(0, 0, 0);
  });
  h.La.ua.rotation.set(0, 0, 0.1);
  h.Ra.ua.rotation.set(0, 0, -0.1);
  h.La.fa.rotation.set(-0.3, 0, 0);
  h.Ra.fa.rotation.set(-0.3, 0, 0);
}
// 달리기 자세(팔다리 흔들기)
function runPose(h, dt, sp) {
  h.ph += dt * (5 + sp * 0.9);
  const p = h.ph,
    s = Math.sin(p);
  resetPose(h, 0.93 + 0.03 * Math.abs(Math.cos(p)));
  h.L.th.rotation.x = -s * 0.9;
  h.Rl.th.rotation.x = s * 0.9;
  h.L.sn.rotation.x = 0.25 + 0.9 * Math.max(0, Math.sin(p + 1.7));
  h.Rl.sn.rotation.x = 0.25 + 0.9 * Math.max(0, -Math.sin(p + 1.7));
  h.La.ua.rotation.x = s * 0.8;
  h.Ra.ua.rotation.x = -s * 0.8;
  h.La.fa.rotation.x = -1.1;
  h.Ra.fa.rotation.x = -1.1;
  h.spine.rotation.x = 0.25;
  h.spine.rotation.y = s * 0.2;
}
// 수비 준비 자세(무릎 굽힘)
function readyPose(h) {
  resetPose(h, 0.84);
  h.L.th.rotation.set(-0.55, 0, 0.12);
  h.Rl.th.rotation.set(-0.55, 0, -0.12);
  h.L.sn.rotation.x = 1;
  h.Rl.sn.rotation.x = 1;
  h.spine.rotation.x = 0.35;
  h.La.ua.rotation.x = -0.75;
  h.Ra.ua.rotation.x = -0.6;
  h.La.fa.rotation.x = -0.8;
  h.Ra.fa.rotation.x = -0.9;
  h.head.rotation.x = -0.25;
}
// 관절(뼈)이 목표 지점을 향하게 돌린다
function aimDown(g, T) {
  g.updateWorldMatrix(true, false);
  const p = g.getWorldPosition(V3()),
    dir = T.clone().sub(p).normalize(),
    q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir),
    pq = g.parent.getWorldQuaternion(new THREE.Quaternion());
  g.quaternion.copy(pq.invert().multiply(q));
  g.updateMatrixWorld(true);
}
// 손이 목표 지점에 닿도록 위팔·아래팔 각도를 계산한다(IK)
function armIK(arm, T, pole) {
  arm.ua.updateWorldMatrix(true, false);
  const S = arm.ua.getWorldPosition(V3()),
    L1 = 0.3,
    L2 = 0.32,
    d0 = T.clone().sub(S),
    dl = d0.length() || 1,
    d = Math.min(dl, L1 + L2 - 0.01),
    dir = d0.divideScalar(dl),
    a = (L1 * L1 - L2 * L2 + d * d) / (2 * d),
    hh = Math.sqrt(Math.max(0, L1 * L1 - a * a)),
    pp = pole
      .clone()
      .sub(dir.clone().multiplyScalar(pole.dot(dir)))
      .normalize(),
    E = S.clone().addScaledVector(dir, a).addScaledVector(pp, hh);
  aimDown(arm.ua, E);
  aimDown(arm.fa, T);
}
// 거리 함수로 정의한 매끈한 몸통을 삼각형 메시로 만든다
function buildSDFMesh(f, min, max, h) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1,
    ny = Math.ceil((max[1] - min[1]) / h) + 1,
    nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const idx = (i, j, k) => i + nx * (j + ny * k);
  const v = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) v[idx(i, j, k)] = f(min[0] + i * h, min[1] + j * h, min[2] + k * h);
  const cellId = new Int32Array(Math.max(1, (nx - 1) * (ny - 1) * (nz - 1))).fill(-1);
  const cidx = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const CO = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ];
  const EDG = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const vals = CO.map(c => v[idx(i + c[0], j + c[1], k + c[2])]);
        let sx = 0,
          sy = 0,
          sz = 0,
          n = 0;
        for (const [a, b] of EDG) {
          if (vals[a] < 0 !== vals[b] < 0) {
            const t = vals[a] / (vals[a] - vals[b]);
            sx += CO[a][0] + (CO[b][0] - CO[a][0]) * t;
            sy += CO[a][1] + (CO[b][1] - CO[a][1]) * t;
            sz += CO[a][2] + (CO[b][2] - CO[a][2]) * t;
            n++;
          }
        }
        if (n) {
          cellId[cidx(i, j, k)] = pos.length / 3;
          pos.push(min[0] + (i + sx / n) * h, min[1] + (j + sy / n) * h, min[2] + (k + sz / n) * h);
        }
      }
  const tri = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) {
      tri.push(a, c, b, a, d, c);
    } else {
      tri.push(a, b, c, a, c, d);
    }
  };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const s0 = v[idx(i, j, k)] < 0;
        // 부호가 바뀌는 모서리마다 둘레 4칸의 점을 이어 사각형 면을 만든다
        if (i < nx - 1 && j > 0 && k > 0 && j < ny - 1 && k < nz - 1 && s0 !== v[idx(i + 1, j, k)] < 0) {
          quad(
            cellId[cidx(i, j - 1, k - 1)],
            cellId[cidx(i, j, k - 1)],
            cellId[cidx(i, j, k)],
            cellId[cidx(i, j - 1, k)],
            s0,
          );
        }
        if (j < ny - 1 && i > 0 && k > 0 && i < nx - 1 && k < nz - 1 && s0 !== v[idx(i, j + 1, k)] < 0) {
          quad(
            cellId[cidx(i - 1, j, k - 1)],
            cellId[cidx(i - 1, j, k)],
            cellId[cidx(i, j, k)],
            cellId[cidx(i, j, k - 1)],
            s0,
          );
        }
        if (k < nz - 1 && i > 0 && j > 0 && i < nx - 1 && j < ny - 1 && s0 !== v[idx(i, j, k + 1)] < 0) {
          quad(
            cellId[cidx(i - 1, j - 1, k)],
            cellId[cidx(i, j - 1, k)],
            cellId[cidx(i, j, k)],
            cellId[cidx(i - 1, j, k)],
            s0,
          );
        }
      }
  const e = 0.002,
    nrm = [];
  for (let q = 0; q < pos.length; q += 3) {
    const x = pos[q],
      y = pos[q + 1],
      z = pos[q + 2];
    let gx = f(x + e, y, z) - f(x - e, y, z),
      gy = f(x, y + e, z) - f(x, y - e, z),
      gz = f(x, y, z + e) - f(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    nrm.push(gx / l, gy / l, gz / l);
  }
  for (let t = 0; t < tri.length; t += 3) {
    const x = tri[t + 1];
    tri[t + 1] = tri[t + 2];
    tri[t + 2] = x;
  } // 면이 바깥을 향하도록 꼭짓점 순서를 뒤집는다
  return { positions: new Float32Array(pos), normals: new Float32Array(nrm), indices: new Uint32Array(tri) };
}
// 타원체까지의 거리
const sdEll = (x, y, z, cx, cy, cz, rx, ry, rz) => {
  const qx = (x - cx) / rx,
    qy = (y - cy) / ry,
    qz = (z - cz) / rz;
  return (Math.hypot(qx, qy, qz) - 1) * Math.min(rx, ry, rz);
};
// 캡슐까지의 거리
const sdCap = (x, y, z, ax, ay, az, bx, by, bz, r) => {
  const pax = x - ax,
    pay = y - ay,
    paz = z - az,
    bax = bx - ax,
    bay = by - ay,
    baz = bz - az;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - r;
};
// 두 거리를 부드럽게 합친다
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
// 몸통 모양 거리 함수
function torsoField(x, y, z) {
  let d = sdEll(x, y, z, 0, 0.28, 0, 0.19, 0.27, 0.115);
  d = smin(d, sdEll(x, y, z, 0, 0.02, 0, 0.165, 0.12, 0.11), 0.06);
  d = smin(d, sdEll(x, y, z, 0, -0.1, 0, 0.185, 0.1, 0.12), 0.05);
  d = smin(d, sdCap(x, y, z, -0.2, 0.44, 0, 0.2, 0.44, 0, 0.075), 0.07);
  d = smin(d, sdCap(x, y, z, 0, 0.44, 0, 0, 0.6, 0, 0.05), 0.05);
  return d;
}
const TM_T = buildSDFMesh(torsoField, [-0.3, -0.25, -0.2], [0.3, 0.68, 0.2], 0.012);
// 매끈한 몸통 도형
const TORSO_GEO = new THREE.BufferGeometry();
TORSO_GEO.setAttribute('position', new THREE.BufferAttribute(TM_T.positions, 3));
TORSO_GEO.setAttribute('normal', new THREE.BufferAttribute(TM_T.normals, 3));
TORSO_GEO.setIndex(new THREE.BufferAttribute(TM_T.indices, 1));
// 우완 투수 모델
const pitcherRigR = human({ shirt: 0x1d3f8f, cap: 0x1d3f8f, gloveSide: 1 });
// 좌완 투수 모델
const pitcherRigL = human({ shirt: 0x1d3f8f, cap: 0x1d3f8f, gloveSide: -1 });
// 지금 마운드에 선 투수 모델
let pitcherRig = pitcherRigR;
// 투수 모델의 뿌리(위치·회전)
let pitcherRoot = pitcherRig.root;
// 지금 투수가 좌완인지
let pitcherLefty = false;
pitcherRigR.root.position.set(0, 0.25, -18.44);
pitcherRigL.root.position.set(0, 0.25, -18.44);
pitcherRigL.root.visible = false;
// 투구폼 팔 각도(null 오버핸드, 그 밖은 ARM_SLOTS 값)
var armSlot = null;
// 투구폼 애니메이션(w: 와인드업 진행 0~1, e: 팔로스루)
function pitcherAnim(w, e) {
  const h = pitcherRig;
  resetPose(h, 0.95);
  h.La.ua.rotation.order = 'XYZ';
  h.Ra.ua.rotation.order = armSlot ? 'ZXY' : 'XYZ';
  const lf = smoothstep(0.1, 0.42, w),
    sr = smoothstep(0.45, 0.78, w),
    g = smoothstep(0.42, 0.72, w),
    q = smoothstep(0.78, 1, w),
    u = smoothstep(0.5, 1, w),
    cc = Math.pow(u, 1.7),
    hl = lf * (1 - sr),
    tn = smoothstep(0.05, 0.4, w),
    ar = smoothstep(0.42, 0.58, w),
    ln = -0.1 * hl + 0.55 * Math.pow(smoothstep(0.72, 1, w), 2) + 0.35 * e;
  h.hips.position.y = 0.95 - 0.05 * hl - 0.1 * sr - 0.05 * e;
  pitcherRoot.position.z = -18.44 + 1.3 * sr + 0.35 * e;
  h.hips.rotation.y = -0.55 * tn * (1 - smoothstep(0.5, 0.8, w)) + 0.3 * smoothstep(0.7, 1, w) + 0.15 * e;
  h.spine.rotation.set(ln, -0.95 * tn * (1 - smoothstep(0.66, 1, w)) + 0.35 * e, -0.22 * q + 0.15 * e);
  h.head.rotation.set(-0.85 * ln, clamp(-0.9 * (h.hips.rotation.y + h.spine.rotation.y), -1.3, 1.3), 0);
  h.L.th.rotation.set(-1.6 * hl - 0.6 * sr, 0, 0.1 * hl + 0.05 * sr);
  h.L.sn.rotation.x = 1.25 * hl + 0.15 * sr;
  h.Rl.th.rotation.x = (0.1 + 0.35 * sr) * (1 - e) - 1.0 * e;
  h.Rl.sn.rotation.x = (0.3 + 0.4 * sr) * (1 - e) + 1.2 * e;
  h.La.ua.rotation.set(-0.9 - 0.6 * g + 0.95 * q + 0.4 * e, 0, -0.35 * (1 - g) + 0.25 * g * (1 - q) - 0.2 * q);
  h.La.fa.rotation.x = -1.2 + 0.9 * g * (1 - q) - 0.3 * q;
  h.Ra.ua.rotation.set(
    -0.9 + 5.3 * cc + 1.5 * e,
    0,
    0.35 * (1 - ar) - 0.1 * ar - 0.85 * Math.sin(Math.PI * cc) - 0.3 * cc + 0.4 * e,
  );
  h.Ra.fa.rotation.x = -1.2 + 1.0 * smoothstep(0.5, 0.62, w) - 1.0 * Math.sin(Math.PI * cc) - 0.8 * e;
  if (armSlot) {
    const bs = smoothstep(0.25, 0.52, w),
      fw = Math.pow(smoothstep(0.55, 1, w), 1.6),
      k = smoothstep(0.2, 0.6, w),
      r = smoothstep(0.6, 1, w);
    h.Ra.ua.rotation.set(
      armSlot.a0 + (armSlot.a1 - armSlot.a0) * bs + (armSlot.a2 - armSlot.a1) * fw + armSlot.ft * e,
      0,
      0.35 * (1 - k) + armSlot.ph * k,
    );
    h.Ra.fa.rotation.x = -1.2 + 1.05 * smoothstep(0.5, 0.95, w) - 0.2 * e;
    h.spine.rotation.x += armSlot.lx * r;
    h.spine.rotation.z += armSlot.lz * smoothstep(0.5, 1, w);
    h.head.rotation.x -= 0.8 * armSlot.lx * r;
    h.hips.position.y -= armSlot.dy * smoothstep(0.4, 1, w);
  }
  if (pitcherLefty) mirrorPose(h);
}
// 좌완 투수용으로 자세를 좌우 대칭으로 뒤집는다
function mirrorPose(h) {
  const sw = (a, b) => {
    const ra = a.rotation.clone(),
      rb = b.rotation.clone();
    a.rotation.set(rb.x, -rb.y, -rb.z, rb.order);
    b.rotation.set(ra.x, -ra.y, -ra.z, ra.order);
  };
  [h.hips, h.spine, h.head].forEach(g => {
    g.rotation.y *= -1;
    g.rotation.z *= -1;
  });
  sw(h.La.ua, h.Ra.ua);
  sw(h.La.fa, h.Ra.fa);
  sw(h.L.th, h.Rl.th);
  sw(h.L.sn, h.Rl.sn);
}
// 타자 모델
const batterRig = human({ shirt: 0xc93a30, cap: 0xc93a30, helmet: true });
batterRig.root.position.set(-0.78, 0, 0.1);
// 배트(손잡이 쪽 기준점)
const bat = new THREE.Group();
// 배트 몸통
const batInner = new THREE.Group();
bat.position.set(-0.5, 1.2, 0.05);
bat.add(batInner);
{
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.02, 0.95, 12), lambertMat(0xd9b27c));
  m.rotation.z = -Math.PI / 2;
  m.position.x = 0.45;
  batInner.add(m);
}
scene.add(bat);
// 1 우타, -1 좌타
let batSide = 1;
// U자 스윙: 임팩트(탭 후 90ms)는 그대로 두고, 임팩트 이후 팔로스루를 길게 늘림
const SWING_MS = 360;
// 스윙에서 임팩트가 오는 비율(탭 후 90ms)
const SWING_CONTACT_FRAC = 90 / SWING_MS;
// 스윙 시작 후 시간(ms)을 스윙 진행도(0~1)로 바꾼다
function swingProgress(ms) {
  const u = clamp(ms / SWING_MS, 0, 1);
  return u < SWING_CONTACT_FRAC
    ? 0.5 * (u / SWING_CONTACT_FRAC)
    : 0.5 + 0.5 * (1 - Math.pow(1 - (u - SWING_CONTACT_FRAC) / (1 - SWING_CONTACT_FRAC), 2));
}
// 타자 자세와 배트 위치(u: 스윙 진행, ld: 다리 들기, tm: 시간)
function batterAnim(u, ld = 0, tm = 0) {
  const h = batterRig,
    m = batSide,
    FA = m > 0 ? h.La : h.Ra,
    BA = m > 0 ? h.Ra : h.La,
    FL = m > 0 ? h.L : h.Rl,
    BL = m > 0 ? h.Rl : h.L,
    p = clamp(u, 0, 1),
    k = ld * (1 - smoothstep(0, 0.18, p)),
    sd = smoothstep(0, 0.35, p),
    e1 = smoothstep(0, 0.5, p),
    e2 = smoothstep(0.5, 1, p),
    id = (1 - ld) * (1 - p);
  resetPose(h, 0.9 - 0.04 * ld - 0.03 * p);
  const hy = -0.25 - 0.1 * ld + 0.45 * smoothstep(0, 0.62, p),
    tw = -0.2 - 0.12 * ld + 0.35 * smoothstep(0.08, 0.8, p);
  h.root.rotation.y = m * (Math.PI / 2 + hy);
  h.spine.rotation.set(0.2 + 0.1 * p, m * tw, m * 0.1 * ld * (1 - p));
  h.hips.rotation.y = m * 0.18 * smoothstep(0.02, 0.42, p);
  FL.th.rotation.set(-0.52 - 0.85 * k, 0, m * (0.22 + 0.28 * sd));
  FL.sn.rotation.x = 1 + 0.6 * k - 0.1 * sd;
  BL.th.rotation.set(-0.45 - 0.05 * p, 0, m * (-0.22 - 0.04 * ld));
  BL.sn.rotation.x = 1 + 0.35 * p;
  h.head.rotation.set(0.12, m * clamp(1.55 - hy - tw, 0.4, 1.45), 0);
  bat.position.set(
    m * (-0.62 + 0.04 * e1 - 0.14 * e2 - 0.03 * ld * (1 - p)),
    1.38 - 0.4 * e1 + 0.57 * e2 + 0.012 * Math.sin(tm / 170) * id,
    0.3 - 0.25 * e1 - 0.1 * e2 + 0.06 * ld * (1 - p),
  );
  bat.rotation.y = m * (-1.4 + 2.9 * p + 1.8 * smoothstep(0.5, 1, p));
  batInner.scale.x = m;
  batInner.rotation.z =
    m *
    (1.25 * (1 - smoothstep(0, 0.55, p)) +
      0.04 +
      0.75 * smoothstep(0.5, 1, p) +
      (0.08 * ld + 0.06 * Math.sin(tm / 140) * (1 - ld)) * (1 - p));
  h.root.updateMatrixWorld(true);
  bat.updateMatrixWorld(true);
  armIK(FA, batInner.localToWorld(new THREE.Vector3(0.06, 0, 0)), new THREE.Vector3(-0.2 * m, -1, -0.6));
  armIK(
    BA,
    batInner.localToWorld(new THREE.Vector3(0.2, 0, 0)),
    new THREE.Vector3(-0.15 * m, -0.3 - 0.7 * p, 0.9 - 0.5 * p),
  );
}
// 포수 모델
const catcherRig = human({ shirt: 0x222a44, pants: 0x222a44, cap: 0x222a44, helmet: true, gloveSide: 1 });
// 포수 모델의 뿌리
const catcher = catcherRig.root;
catcher.position.set(0, 0, 1.0);
catcher.rotation.y = Math.PI;
resetPose(catcherRig, 0.55);
catcherRig.L.th.rotation.set(-1.35, 0, 0.3);
catcherRig.Rl.th.rotation.set(-1.35, 0, -0.3);
catcherRig.L.sn.rotation.x = 1.6;
catcherRig.Rl.sn.rotation.x = 1.6;
catcherRig.spine.rotation.x = 0.55;
catcherRig.head.rotation.x = -0.5;
catcher.updateMatrixWorld(true);
armIK(catcherRig.La, new THREE.Vector3(-0.1, 0.8, 0.4), new THREE.Vector3(0, -1, 0));
armIK(catcherRig.Ra, new THREE.Vector3(0.12, 0.62, 0.62), new THREE.Vector3(0, -1, 0));
// 심판 모델
const umpireRig = human({ shirt: 0x2b2f38, cap: 0x15181d, pants: 0x6f7683 });
resetPose(umpireRig, 0.9);
umpireRig.spine.rotation.x = 0.3;
umpireRig.root.position.set(0, 0, 2.1);
umpireRig.root.rotation.y = Math.PI;
umpireRig.root.visible = false;
// 수비수 7명(1루수, 2루수, 유격수, 3루수, 좌익수, 중견수, 우익수)
const fielders = [
  [16, -24],
  [8, -34],
  [-8, -34],
  [-16, -24],
  [-45, -75],
  [0, -90],
  [45, -75],
].map(p => {
  const r = human({ shirt: 0xf0ece0, cap: 0x2f7de1, pants: 0xdedbd0, gloveSide: 1 });
  readyPose(r);
  return { r, g: r.root, h: new THREE.Vector3(p[0], 0, p[1]), mv: 0 };
});
// 1·2·3루 주자 모델
const runnerRigs = BASES.map(b => {
  const r = human({ shirt: 0xf2b632, cap: 0xf2b632, pants: 0xeceadf });
  readyPose(r);
  r.root.position.set(b[0] + 0.7, 0, b[1] + 0.7);
  r.root.rotation.y = -2.3;
  r.root.visible = false;
  return r;
});
// 1·2·3루 주자 모델의 뿌리
const runnerRoots = runnerRigs.map(r => r.root);
pitcherAnim(0, 0);
batterAnim(-1);
// 벤치 클리어링 때 뛰어나오는 선수들
const benchClearers = [];
// 벤치 클리어링 시작 시각
let benchClearT = -1e9;
// 벤치 클리어링 선수들을 뛰어나오게 한다
function startBenchClear(t) {
  if (!benchClearers.length)
    for (let i = 0; i < 6; i++) {
      const h = human({
        shirt: [0x1d3f8f, 0xc93a30, 0xf2b632, 0x222a44, 0xf0ece0, 0x1d3f8f][i],
        cap: 0x2f7de1,
        pants: 0xdedbd0,
        helmet: i % 2 === 0,
        gloveSide: 1,
      });
      scene.add(h.root);
      benchClearers.push(h);
    }
  benchClearT = t;
  benchClearers.forEach((h, i) => {
    const side = i < 3 ? -1 : 1,
      j = (i % 3) - 1;
    h.s = new THREE.Vector3(side * 16, 0, 6);
    h.g = new THREE.Vector3(side * 1.6 + j * 0.5, 0, 1.6);
  });
}
// 벤치 클리어링 선수들을 움직인다
function updateBenchClear(t) {
  const u = (t - benchClearT) / 1000;
  benchClearers.forEach(h => {
    if (u < 0 || u > 5) {
      h.root.visible = false;
      return;
    }
    h.root.visible = true;
    let k = 1,
      run = 0;
    if (u < 1.3) {
      k = u / 1.3;
      run = 1;
    } else if (u < 3.8) {
      k = 1;
    } else {
      k = 1 - (u - 3.8) / 1.2;
      run = 1;
    }
    h.root.position.lerpVectors(h.s, h.g, clamp(k, 0, 1));
    h.root.position.y = run ? 0.06 * Math.abs(Math.sin(u * 16)) : 0;
    h.root.lookAt(-0.78 * batSide, 0, 0.1);
  });
}
// 선수 유니폼 색과 가슴 글자를 바꾼다
function dress(h, a, b, c, t, tc) {
  h.mats[0].color.setHex(a);
  h.mats[1].color.setHex(a);
  h.mats[2].color.setHex(b);
  h.mats[3].color.setHex(c);
  h.chest(t, tc);
}
// 공격·수비 팀에 맞게 모든 선수 유니폼을 입힌다
function dressAll() {
  const bc = TEAM_COLORS[pitcherMode ? 'o' : 'm'],
    fc = TEAM_COLORS[pitcherMode ? 'm' : 'o'];
  dress(batterRig, ...bc);
  runnerRigs.forEach(r => dress(r, ...bc));
  [pitcherRigR, pitcherRigL, catcherRig, ...fielders.map(f => f.r)].forEach(h => dress(h, ...fc));
}
