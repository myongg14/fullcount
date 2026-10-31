// 구장: 그라운드·베이스·라인, 담장·관중석·조명탑, 하늘·산·구름·건물, 광고판, 관중(들썩임), 외야 전광판

add(
  new THREE.PlaneGeometry(700, 700),
  new THREE.MeshLambertMaterial({
    map: tex(
      256,
      512,
      c => {
        const W = 256,
          H = 512;
        c.fillStyle = '#46b852';
        c.fillRect(0, 0, W, H / 2);
        c.fillStyle = '#2f9a3d';
        c.fillRect(0, H / 2, W, H / 2);
        for (let i = 0; i < 9000; i++) {
          const x = rand() * W,
            y = rand() * H,
            l = 2 + rand() * 4;
          c.strokeStyle = rand() < 0.5 ? 'rgba(255,255,255,.09)' : 'rgba(0,45,0,.12)';
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + randRange(-1, 1), y - l);
          c.stroke();
        }
        for (let i = 0; i < 260; i++) {
          const x = rand() * W,
            y = rand() * H,
            r = 6 + rand() * 16,
            g = c.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, rand() < 0.5 ? 'rgba(255,255,200,.05)' : 'rgba(0,40,0,.06)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g;
          c.fillRect(x - r, y - r, 2 * r, 2 * r);
        }
      },
      [30, 58],
    ),
  }),
  0,
  0,
  -150,
  -Math.PI / 2,
);
// 흙(내야) 무늬 재질을 만든다
const dirtMat = (rx, ry) =>
  new THREE.MeshLambertMaterial({
    map: tex(
      256,
      256,
      c => {
        c.fillStyle = '#d98d55';
        c.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 3200; i++) {
          c.fillStyle = rand() < 0.5 ? 'rgba(120,60,20,.16)' : 'rgba(255,225,175,.14)';
          c.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 2);
        }
        for (let i = 0; i < 60; i++) {
          const x = rand() * 256,
            y = rand() * 256,
            r = 8 + rand() * 18,
            g = c.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, 'rgba(90,45,15,.10)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g;
          c.fillRect(x - r, y - r, 2 * r, 2 * r);
        }
      },
      [rx, ry],
    ),
  });
add(new THREE.CircleGeometry(29, 56), dirtMat(9, 9), 0, 0.02, -18.44, -Math.PI / 2);
add(new THREE.CircleGeometry(4.6, 32), dirtMat(2, 2), 0, 0.03, 0.4, -Math.PI / 2);
{
  const g = new THREE.PlaneGeometry(26, 26);
  g.rotateX(-Math.PI / 2);
  g.rotateY(Math.PI / 4);
  add(g, lambertMat(0x3aae47), 0, 0.04, -19.4);
}
add(new THREE.CylinderGeometry(2.7, 3.4, 0.25, 28), dirtMat(3, 1), 0, 0.13, -18.44);
add(new THREE.BoxGeometry(0.6, 0.05, 0.15), lambertMat(0xffffff), 0, 0.3, -18.44);
{
  const s = new THREE.Shape();
  [
    [-0.215, 0.43],
    [0.215, 0.43],
    [0.215, 0.215],
    [0, 0],
    [-0.215, 0.215],
  ].forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  add(g, lambertMat(0xffffff), 0, 0.06, 0.2);
}
// 1·2·3루 위치 [x, z](홈플레이트가 원점, -z가 외야 쪽)
const BASES = [
  [19.4, -19.4],
  [0, -38.8],
  [-19.4, -19.4],
];
BASES.forEach(b => add(new THREE.BoxGeometry(0.4, 0.1, 0.4), lambertMat(0xffffff), b[0], 0.08, b[1], 0, Math.PI / 4));
[
  [9.7, -9.7, Math.PI / 4],
  [9.7, -29.1, (3 * Math.PI) / 4],
  [-9.7, -29.1, -Math.PI / 4],
  [-9.7, -9.7, -Math.PI / 4],
].forEach(([x, z, r]) => add(new THREE.BoxGeometry(27.4, 0.02, 1.7), lambertMat(0xd98d55), x, 0.05, z, 0, r));
{
  const ln = (w, d, x, z) => add(new THREE.BoxGeometry(w, 0.015, d), lambertMat(0xffffff), x, 0.07, z);
  [-1, 1].forEach(sx => {
    ln(1.22, 0.05, sx * 0.78, -0.815);
    ln(1.22, 0.05, sx * 0.78, 1.015);
    ln(0.05, 1.83, sx * 0.78 - 0.61, 0.1);
    ln(0.05, 1.83, sx * 0.78 + 0.61, 0.1);
  });
}
[
  [Math.PI / 4, 42.4, -42.4],
  [(3 * Math.PI) / 4, -42.4, -42.4],
].forEach(l => add(new THREE.BoxGeometry(120, 0.02, 0.15), lambertMat(0xffffff), l[1], 0.06, l[2], 0, l[0]));
// 각도(도)에 따른 담장까지 거리(m), 3D 구장 모양용
const fenceMeters = a => 122 - 24 * (Math.abs(a) / 45) ** 1.5;
// 담장 모양을 따라 휘어지는 띠(담장·관중석·흙길)를 만든다
function ribbon(r0, h0, r1, h1, mat) {
  const P = [],
    U = [],
    I = [];
  let n = 0;
  for (let a = -62; a <= 62; a += 2) {
    const t = (a * Math.PI) / 180,
      s = Math.sin(t),
      c = -Math.cos(t),
      R0 = fenceMeters(a) + r0,
      R1 = fenceMeters(a) + r1;
    P.push(s * R0, h0, c * R0, s * R1, h1, c * R1);
    U.push((a + 62) / 124, 0, (a + 62) / 124, 1);
    n++;
  }
  for (let i = 0; i < n - 1; i++) {
    const k = i * 2;
    I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  scene.add(m);
}
// 앞뒤 양면을 그리는 설정
const doubleSide = THREE.DoubleSide;
ribbon(
  -7,
  0.05,
  0,
  0.05,
  (() => {
    const m = dirtMat(40, 1);
    m.side = doubleSide;
    return m;
  })(),
);
ribbon(
  0,
  0,
  0,
  5,
  new THREE.MeshBasicMaterial({
    side: doubleSide,
    map: tex(
      2048,
      32,
      c => {
        c.fillStyle = '#0b1b3d';
        c.fillRect(0, 0, 2048, 32);
        const bg = ['#0b1b3d', '#c8102e', '#ffffff', '#0b1b3d', '#e8e8ea', '#c8102e'],
          tx = ['EV6', '대방건설', 'KIA', '광주', 'EV6', '대방건설', 'KIA TIGERS', '광주'];
        c.font = 'bold 17px sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        for (let i = 0; i < 16; i++) {
          const b = bg[(i * 5 + (i % 3)) % 6];
          c.fillStyle = b;
          c.fillRect(i * 128 + 2, 2, 124, 28);
          c.fillStyle = b === '#ffffff' || b === '#e8e8ea' ? '#0b1b3d' : '#fff';
          c.fillText(tx[i % 8], i * 128 + 64, 17);
        }
        c.fillStyle = '#0b1b3d';
        c.fillRect(956, 0, 136, 32);
        c.fillStyle = '#ffd400';
        c.font = 'bold 22px sans-serif';
        c.fillText('121m', 1024, 17);
      },
      [1, 1],
    ),
  }),
);
ribbon(
  0,
  5,
  0,
  6.2,
  new THREE.MeshBasicMaterial({
    color: 0xf2c200,
    transparent: true,
    opacity: 0.3,
    side: doubleSide,
    depthWrite: false,
  }),
);
ribbon(
  1,
  5,
  34,
  30,
  new THREE.MeshBasicMaterial({
    side: doubleSide,
    color: 0xffffff,
    map: tex(
      256,
      128,
      c => {
        const g = c.createLinearGradient(0, 0, 0, 128);
        g.addColorStop(0, '#2f7a3a');
        g.addColorStop(1, '#58b04f');
        c.fillStyle = g;
        c.fillRect(0, 0, 256, 128);
        for (let y = 0; y < 128; y += 16) {
          c.fillStyle = (y / 16) % 2 ? 'rgba(0,50,0,.12)' : 'rgba(255,255,255,.06)';
          c.fillRect(0, y, 256, 16);
        }
        const p = ['#ffffff', '#c8102e', '#f1d3b0', '#e8453c', '#2a2a3a', '#f2c200'];
        for (let i = 0; i < 260; i++) {
          c.fillStyle = p[(rand() * 6) | 0];
          c.fillRect(rand() * 256, 40 + rand() * 88, 2, 3);
        }
      },
      [26, 3],
    ),
  }),
);
ribbon(34, 30, 34, 0, new THREE.MeshBasicMaterial({ side: doubleSide, color: 0x9fb4cc }));
[
  [-88, -52],
  [88, -52],
  [-62, -112],
  [62, -112],
].forEach(([x, z]) => {
  add(new THREE.CylinderGeometry(0.6, 0.9, 48, 6), lambertMat(0xd5dae2), x, 24, z);
  const l = add(new THREE.BoxGeometry(9, 5, 0.6), new THREE.MeshBasicMaterial({ color: 0xeef2f8 }), x, 50, z);
  l.lookAt(0, 30, 0);
});
{
  const mk = (w, h, fn) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    fn(c.getContext('2d'), w, h);
    return new THREE.CanvasTexture(c);
  };
  const sk = new THREE.Mesh(
    new THREE.SphereGeometry(520, 24, 16),
    new THREE.MeshBasicMaterial({
      fog: false,
      depthWrite: false,
      side: THREE.BackSide,
      map: mk(16, 256, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#2a82d4');
        g.addColorStop(0.5, '#6fbef0');
        g.addColorStop(0.85, '#cfeaf8');
        g.addColorStop(1, '#eef8fc');
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
      }),
    }),
  );
  sk.userData.nf = 1;
  scene.add(sk);
  window.SKY = sk;
  const hl = new THREE.Mesh(
    new THREE.CylinderGeometry(400, 400, 90, 48, 1, true),
    new THREE.MeshBasicMaterial({
      fog: false,
      transparent: true,
      side: THREE.BackSide,
      map: mk(1024, 128, (x, w, h) => {
        [
          ['#8fb3a0', 0.5, 0.012, 34],
          ['#5f9a62', 0.62, 0.02, 26],
          ['#3f8450', 0.75, 0.03, 16],
        ].forEach(([c, b, f, a], k) => {
          x.fillStyle = c;
          x.beginPath();
          x.moveTo(0, h);
          for (let i = 0; i <= w; i += 8)
            x.lineTo(i, h * b - a * Math.sin(i * f + k * 2) - a * 0.5 * Math.sin(i * f * 3.1 + k));
          x.lineTo(w, h);
          x.fill();
        });
      }),
    }),
  );
  hl.position.set(0, 32, -100);
  hl.userData.nf = 1;
  scene.add(hl);
  window.HL = hl;
  const ct = mk(256, 96, (x, w, h) => {
    const g = x.createRadialGradient(128, 48, 4, 128, 48, 110);
    g.addColorStop(0, 'rgba(255,255,255,.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.scale(1, 0.4);
    x.fillRect(0, -60, w, 300);
  });
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7 + 0.3,
      m = new THREE.Mesh(
        new THREE.PlaneGeometry(randRange(140, 230), randRange(40, 70)),
        new THREE.MeshBasicMaterial({ map: ct, transparent: true, fog: false, depthWrite: false }),
      );
    m.position.set(Math.sin(a) * 380, randRange(90, 170), -Math.abs(Math.cos(a)) * 380 - 40);
    m.lookAt(0, m.position.y, 0);
    m.userData.nf = 1;
    scene.add(m);
  }
  const sb = new THREE.Mesh(
    new THREE.BoxGeometry(46, 17, 1.5),
    [0, 1, 2, 3, 4, 5].map(i =>
      i === 4
        ? new THREE.MeshBasicMaterial({
            map: mk(512, 192, (x, w, h) => {
              const g = x.createLinearGradient(0, 0, w, h);
              g.addColorStop(0, '#0b2a66');
              g.addColorStop(1, '#1f5fb8');
              x.fillStyle = g;
              x.fillRect(0, 0, w, h);
              x.strokeStyle = '#f2f6ff';
              x.lineWidth = 6;
              x.strokeRect(4, 4, w - 8, h - 8);
              x.fillStyle = '#fff';
              x.textAlign = 'center';
              x.font = 'bold 70px sans-serif';
              x.fillText('DAY GAME', w / 2, 92);
              x.fillStyle = '#f2b632';
              x.font = 'bold 46px sans-serif';
              x.fillText('3D BASEBALL', w / 2, 150);
            }),
          })
        : new THREE.MeshLambertMaterial({ color: 0x3a4a63 }),
    ),
  );
  sb.position.set(0, 40, -153);
  sb.userData.nf = 1;
  sb.visible = false;
  scene.add(sb);
  {
    const win = mk(128, 256, (x, w, h) => {
      x.fillStyle = '#d9d4c8';
      x.fillRect(0, 0, w, h);
      for (let r = 0; r < 16; r++)
        for (let q = 0; q < 6; q++) {
          x.fillStyle = rand() < 0.25 ? '#f5e7a8' : '#6c8aa8';
          x.fillRect(6 + q * 20, 6 + r * 15, 12, 9);
        }
    });
    [
      [-150, -215, 26, 70, 22],
      [-118, -222, 22, 86, 22],
      [-88, -218, 28, 60, 22],
      [-60, -232, 20, 95, 20],
      [70, -225, 24, 64, 22],
      [104, -232, 26, 78, 22],
      [142, -222, 22, 58, 22],
    ].forEach(([x, z, w, hg, d]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, hg, d), new THREE.MeshBasicMaterial({ map: win }));
      b.position.set(x, hg / 2, z);
      scene.add(b);
      (window.APT = window.APT || []).push(b);
    });
  }
  function fx() {
    scene.traverse(o => {
      if (o.isMesh && !o.userData.nf) {
        const t = o.geometry.type;
        o.receiveShadow = true;
        o.castShadow = !/Plane|Circle|Shape|BufferGeometry/.test(t);
      }
    });
  }
  window.fx = fx;
}
{
  const mk = (w, h, fn) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      fn(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      return t;
    },
    DS = THREE.DoubleSide;
  const ad = mk(1024, 128, (x, w, h) => {
    x.fillStyle = '#10204a';
    x.fillRect(0, 0, w, h);
    const L = [
      ['#c8102e', 'KIA TIGERS'],
      ['#ffffff', 'EV6'],
      ['#f2b632', '대방건설'],
      ['#1f5fb8', '광주'],
    ];
    x.font = 'bold 54px sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    L.forEach((l, i) => {
      x.fillStyle = l[0];
      x.fillRect(i * 256 + 6, 10, 244, 108);
      x.fillStyle = l[0] === '#ffffff' || l[0] === '#f2b632' ? '#10204a' : '#fff';
      x.fillText(l[1], i * 256 + 128, 66);
    });
  });
  ad.repeat.set(3, 1);
  const nt = mk(32, 32, x => {
    x.strokeStyle = 'rgba(15,15,25,.6)';
    x.lineWidth = 2;
    x.strokeRect(0, 0, 32, 32);
  });
  nt.repeat.set(100, 22);
  const cw = mk(512, 256, (x, w, h) => {
    x.fillStyle = '#1b2236';
    x.fillRect(0, 0, w, h);
    const cs = ['#c8102e', '#ffffff', '#f2b632', '#1f5fb8', '#e7c9a5', '#2a2a3a'];
    for (let i = 0; i < 4000; i++) {
      x.fillStyle = cs[(rand() * 6) | 0];
      x.fillRect(rand() * w, rand() * h, 3, 4);
    }
  });
  cw.repeat.set(3, 1);
  add(new THREE.PlaneGeometry(40, 2.6), new THREE.MeshBasicMaterial({ map: ad, side: DS }), 0, 1.3, 15);
  add(
    new THREE.PlaneGeometry(40, 7),
    new THREE.MeshBasicMaterial({ map: nt, transparent: true, side: DS, depthWrite: false }),
    0,
    6.1,
    15.2,
  );
  add(new THREE.PlaneGeometry(120, 30), new THREE.MeshBasicMaterial({ map: cw, side: DS }), 0, 13, 26, 0.7);
}
// 관중 한 명 한 명의 위치와 흔들림
const FANS = [];
// 관중이 들썩이기 시작한 시각
let crowdT = -1e9;
{
  const n = 31 * 7,
    im = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.9, 1.3, 0.7),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      n,
    ),
    cs = [0x1f5fb8, 0xffffff, 0x1f5fb8, 0xe8453c, 0xf2b632, 0x2a2a3a];
  let k = 0;
  for (let ai = 0; ai < 31; ai++) {
    const a = -60 + ai * 4;
    for (let ri = 0; ri < 7; ri++) {
      const r0 = 4 + ri * 4.3,
        Rr = fenceMeters(a) + r0,
        t = (a * Math.PI) / 180;
      FANS.push({
        x: Math.sin(t) * Rr,
        z: -Math.cos(t) * Rr,
        h: 5 + (r0 - 1) * (25 / 33) + 0.5,
        a,
        ph: Math.random() * 6,
      });
      im.setColorAt(k, new THREE.Color(cs[k % cs.length]));
      k++;
    }
  }
  im.userData.nf = 1;
  im.frustumCulled = false;
  scene.add(im);
  window.CROWD = im;
}
// 관중이 들썩이는 애니메이션
function crowdUpdate(t) {
  const im = window.CROWD;
  if (!im) return;
  const m = new THREE.Matrix4(),
    u = (t - crowdT) / 1000,
    on = u >= 0 && u < 3.2;
  FANS.forEach((f, i) => {
    let y = f.h + Math.max(0, Math.sin(f.ph + t * 0.004)) * 0.05,
      sy = 1;
    if (on) {
      const up = Math.max(0, Math.sin(f.a * 0.09 - u * 3.2 + Math.PI / 2)) * (1 - u / 3.2);
      y += up * 1.6;
      sy = 1 + up * 0.5;
    }
    m.makeScale(1, sy, 1);
    m.setPosition(f.x, y, f.z);
    im.setMatrixAt(i, m);
  });
  im.instanceMatrix.needsUpdate = true;
}
// 전광판을 그리는 캔버스
const sbCanvas = document.createElement('canvas');
sbCanvas.width = 1024;
sbCanvas.height = 512;
// 전광판 캔버스 붓
const sbCtx = sbCanvas.getContext('2d');
// 전광판 텍스처
const sbTex = new THREE.CanvasTexture(sbCanvas);
sbTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
// 전광판은 그룹 하나로 묶어서 타이틀 화면과 외야 위치를 오간다
const scoreboard = new THREE.Group();
scene.add(scoreboard);
scoreboard.position.set(0, 34, -146);
scoreboard.scale.setScalar(0.85);
// 전광판 기둥(타이틀 화면에서는 숨김)
const scoreboardPosts = [];
{
  const face = new THREE.Mesh(new THREE.PlaneGeometry(44, 22), new THREE.MeshBasicMaterial({ map: sbTex }));
  face.position.z = 0.1;
  scoreboard.add(face);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(46, 24, 0.6), lambertMat(0x1a2440));
  fr.position.z = -0.3;
  scoreboard.add(fr);
  [-18, 18].forEach(x => {
    const po = new THREE.Mesh(new THREE.BoxGeometry(1.2, 28, 1.2), lambertMat(0x3a4468));
    po.position.set(x, -26, -0.3);
    scoreboard.add(po);
    scoreboardPosts.push(po);
  });
}
// 타이틀 화면에서 전광판을 띄울 위치
const SB_TITLE_POS = new THREE.Vector3(0, 2.3, -9);
// 전광판이 지금 타이틀 위치에 있는지
let sbTitle = null;
// 전광판 위치를 정한다(오류가 나도 게임은 계속)
function placeSB(t) {
  try {
    placeSBInner(t);
  } catch (e) {
    console.error('placeSB', e);
  }
}
// 타이틀 화면이면 전광판을 화면 앞으로, 경기 중이면 외야로
function placeSBInner(t) {
  if (t) {
    const d = camera.position.distanceTo(SB_TITLE_POS),
      hh = d * Math.tan((camera.fov * Math.PI) / 360),
      hw = hh * camera.aspect;
    scoreboard.position.copy(SB_TITLE_POS);
    scoreboard.scale.setScalar(Math.min((hw * 0.9) / 22, (hh * 0.6) / 11));
  } else {
    scoreboard.position.set(0, 34, -146);
    scoreboard.scale.setScalar(0.85);
  }
  if (sbTitle !== t) {
    sbTitle = t;
    scoreboardPosts.forEach(p => (p.visible = !t));
    ['#title h1', '#title .big'].forEach(q => {
      const el = document.querySelector(q);
      if (el) el.style.display = t ? 'none' : '';
    });
  }
}
// 전광판을 다시 그린다(오류가 나도 게임은 계속)
function boardUpd() {
  try {
    boardDraw();
  } catch (e) {
    console.error('scoreboard', e);
  }
}
// 전광판 캔버스에 득점표·타순·카운트를 그린다
function boardDraw() {
  const g = sbCtx,
    W = 1024,
    H = 512,
    n = Math.max(9, totalInnings || 9),
    I = inning || 1,
    P = !!pitcherMode,
    batting = P ? 'o' : 'm',
    cur = curBatter();
  const mineR = (myRuns || 0) + (P ? 0 : score || 0),
    oppR = (oppRuns || 0) + (P ? score || 0 : 0);
  g.fillStyle = '#0a1640';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#2a3a72';
  g.lineWidth = 6;
  g.strokeRect(3, 3, W - 6, H - 6);
  g.textBaseline = 'middle';
  g.fillStyle = '#dfe9ff';
  // 이닝별 득점표
  const colW = Math.min(62, 754 / (n + 3)),
    x0 = 250,
    cx = k => x0 + colW * (k + 0.5);
  g.font = '24px Jua, sans-serif';
  g.textAlign = 'center';
  for (let k = 0; k < n; k++) g.fillText(String(k + 1), cx(k), 34);
  g.fillText('R', cx(n), 34);
  g.fillText('H', cx(n + 1), 34);
  g.fillText('E', cx(n + 2), 34);
  [
    ['m', myLine || [], mineR, myHits || 0],
    ['o', oppLine || [], oppR, oppHits || 0],
  ].forEach(([k, arr, R, h], ri) => {
    const y = 74 + ri * 36;
    g.textAlign = 'left';
    g.fillStyle = '#fff';
    g.font = '26px Jua, sans-serif';
    g.fillText(TEAM_NAMES[k], 20, y);
    g.textAlign = 'center';
    g.font = '24px Jua, sans-serif';
    g.fillStyle = '#dfe9ff';
    for (let q = 0; q < n; q++) {
      let v = arr[q];
      if (k === batting && q === I - 1) v = score || 0;
      if (v !== undefined) g.fillText(String(v), cx(q), y);
    }
    g.fillStyle = '#ffd23f';
    g.fillText(String(R), cx(n), y);
    g.fillStyle = '#dfe9ff';
    g.fillText(String(h), cx(n + 1), y);
    g.fillText(String(ri ? oppErrors : myErrors), cx(n + 2), y);
  });
  g.fillStyle = '#2a3a72';
  g.fillRect(14, 118, W - 28, 3);
  // 양 팀 타순
  const lu = (k, x, al) => {
    LINEUPS[k].forEach((p, i) => {
      const y = 168 + i * 32;
      if (k === batting && i === cur) {
        g.fillStyle = '#e8453c';
        g.fillRect(x - (al === 'left' ? 4 : 216), y - 15, 220, 30);
      }
      g.textAlign = al;
      g.fillStyle = '#fff';
      g.font = '22px Jua, sans-serif';
      if (al === 'left') {
        g.fillText(String(i + 1), x, y);
        g.fillText(p[0], x + 30, y);
        g.fillStyle = '#8fa6e0';
        g.fillText(p[1], x + 150, y);
      } else {
        g.fillStyle = '#8fa6e0';
        g.fillText(p[1], x - 150, y);
        g.fillStyle = '#fff';
        g.fillText(p[0], x - 30, y);
        g.fillText(String(i + 1), x, y);
      }
    });
  };
  lu('m', 20, 'left');
  lu('o', 1004, 'right');
  // 가운데: 카운트 · 베이스 · 현재 상황
  g.textAlign = 'left';
  g.font = '24px Jua, sans-serif';
  [
    ['B', 3, orZero(balls), '#5fd16a'],
    ['S', 2, orZero(strikes), '#f2b632'],
    ['O', 2, orZero(outs), '#e8453c'],
  ].forEach(([lab, max, on, c], r) => {
    const y = 196 + r * 48;
    g.fillStyle = '#8fa6e0';
    g.fillText(lab, 300, y);
    for (let q = 0; q < max; q++) {
      g.beginPath();
      g.arc(360 + q * 40, y, 14, 0, Math.PI * 2);
      g.fillStyle = q < on ? c : '#2a3358';
      g.fill();
    }
  });
  const dia = (x, y, on) => {
    g.save();
    g.translate(x, y);
    g.rotate(Math.PI / 4);
    g.fillStyle = on ? '#f2b632' : '#2a3358';
    g.fillRect(-10, -10, 20, 20);
    g.restore();
  };
  dia(630, 262, bases[1]);
  dia(666, 300, bases[0]);
  dia(594, 300, bases[2]);
  g.textAlign = 'center';
  g.fillStyle = '#dfe9ff';
  g.font = '24px Jua, sans-serif';
  g.fillText(
    `${I}회${P ? ' 말' : ' 초'}  타자 ${LINEUPS[batting][cur][0]}(${curHand() < 0 ? '좌' : '우'}타)`,
    512,
    376,
  );
  g.fillText(
    `투수 ${PITCHERS[curPitcher].n}(${PITCHERS[curPitcher].hand === 'L' ? '좌' : '우'}완)${pitch && pitch.kmh ? '  ' + Math.round(pitch.kmh * SPEED_DISPLAY_SCALE) + 'km/h' : ''}`,
    512,
    412,
  );
  // 하단 바
  g.fillStyle = '#e8453c';
  g.fillRect(20, 448, W - 40, 40);
  g.fillStyle = '#fff';
  g.font = '24px Jua, sans-serif';
  g.fillText(
    `투수 ${PITCHERS[curPitcher].n}  ·  ${P ? '삼진 ' + (strikeouts || 0) + '  ·  피안타 ' + (oppHits || 0) : '안타 ' + (myHits || 0) + '  ·  홈런 ' + (homers || 0)}`,
    512,
    468,
  );
  sbTex.needsUpdate = true;
}
// 값이 없으면 0
function orZero(x) {
  return x || 0;
}
