// 선수 모델: 관절(어깨·팔꿈치·엉덩이·무릎)로 움직이는 카툰 선수, 유니폼(팀 색·줄무늬·가슴 팀 이름·등번호), 타자·투수·포수, 배트와 미트

// ---------- 공통 도형: 모양마다 한 번만 만들고 인스턴스(또는 복제)로 재사용 ----------
// 원본 도형을 숨기면 인스턴스까지 안 보이므로, 원본은 켜 둔 채 땅속 멀리(y = -500) 둔다
const SHAPE_MAKERS = {
  head:     () => BABYLON.MeshBuilder.CreateSphere('head', { diameter: 0.34, segments: 14 }, scene),
  neck:     () => BABYLON.MeshBuilder.CreateCylinder('neck', { diameter: 0.12, height: 0.14, tessellation: 10 }, scene),
  torso:    () => BABYLON.MeshBuilder.CreateCapsule('torso', { radius: 0.2, height: 0.6, tessellation: 14 }, scene),
  hips:     () => BABYLON.MeshBuilder.CreateSphere('hips', { diameter: 0.38, segments: 12 }, scene),
  upperArm: () => BABYLON.MeshBuilder.CreateCapsule('uarm', { radius: 0.065, height: 0.32, tessellation: 10 }, scene),
  foreArm:  () => BABYLON.MeshBuilder.CreateCapsule('farm', { radius: 0.055, height: 0.28, tessellation: 10 }, scene),
  hand:     () => BABYLON.MeshBuilder.CreateSphere('hand', { diameter: 0.1, segments: 8 }, scene),
  thigh:    () => BABYLON.MeshBuilder.CreateCapsule('thigh', { radius: 0.09, height: 0.46, tessellation: 10 }, scene),
  shin:     () => BABYLON.MeshBuilder.CreateCapsule('shin', { radius: 0.075, height: 0.44, tessellation: 10 }, scene),
  shoe:     () => BABYLON.MeshBuilder.CreateBox('shoe', { width: 0.12, height: 0.08, depth: 0.26 }, scene),
  eye:      () => BABYLON.MeshBuilder.CreateSphere('eye', { diameter: 0.045, segments: 6 }, scene),
  brow:     () => BABYLON.MeshBuilder.CreateBox('brow', { width: 0.08, height: 0.018, depth: 0.02 }, scene),
  capTop:   () => BABYLON.MeshBuilder.CreateSphere('cap', { diameter: 0.36, segments: 12, slice: 0.5 }, scene),
  brim:     () => BABYLON.MeshBuilder.CreateCylinder('brim', { diameter: 0.24, height: 0.02, tessellation: 16 }, scene),
  helmet:   () => BABYLON.MeshBuilder.CreateSphere('helmet', { diameter: 0.4, segments: 12, slice: 0.55 }, scene),
  earflap:  () => BABYLON.MeshBuilder.CreateCylinder('flap', { diameter: 0.15, height: 0.04, tessellation: 12 }, scene),
  glove:    () => BABYLON.MeshBuilder.CreateSphere('glove', { diameter: 0.22, segments: 10 }, scene),
  mask:     () => BABYLON.MeshBuilder.CreateBox('mask', { width: 0.26, height: 0.26, depth: 0.04 }, scene),
  pad:      () => BABYLON.MeshBuilder.CreateBox('pad', { width: 0.36, height: 0.44, depth: 0.08 }, scene),
};
const SHAPE_SRC = {};
const baseShape = shape => {
  if (!SHAPE_SRC[shape]) {
    const m = SHAPE_MAKERS[shape]();
    m.position.y = -500; m.isPickable = false;
    SHAPE_SRC[shape] = m;
  }
  return SHAPE_SRC[shape];
};
// 같은 모양 + 같은 재질은 원본 하나를 공유한다(인스턴스는 원본의 재질을 따라가므로)
const instanceSource = (shape, material) => {
  const key = shape + '|' + material.uniqueId;
  if (!SHAPE_SRC[key]) {
    const m = baseShape(shape).clone(key);
    m.material = material; m.position.y = -500;
    SHAPE_SRC[key] = m;
  }
  return SHAPE_SRC[key];
};

// ---------- 공통 재질 ----------
const PMAT = {
  skin: mat('#f2c9a0'), shoe: mat('#25252a'), eye: mat('#1a1a1a'), brow: mat('#4a3322'),
  glove: mat('#8a4f24'), mask: mat('#3a3d42'),
  shadow: mat('#000000', { alpha: 0.3 }),
};
// 발밑 가짜 그림자(실제 그림자 계산은 무거워서 쓰지 않는다)
SHAPE_MAKERS.shadow = () => {
  const d = BABYLON.MeshBuilder.CreateDisc('pshadow', { radius: 0.42, tessellation: 20 }, scene);
  d.bakeTransformIntoVertices(BABYLON.Matrix.RotationX(Math.PI / 2));
  return d;
};
// 글자를 그린 투명 텍스처(가슴 팀 이름, 등번호)
const textMat = (text, color, w, h, font) => {
  const tex = new BABYLON.DynamicTexture('t' + text, { width: w, height: h }, scene, true);
  tex.hasAlpha = true;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = h * 0.08; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.strokeText(text, w / 2, h / 2 + h * 0.04);
  ctx.fillStyle = color; ctx.fillText(text, w / 2, h / 2 + h * 0.04);
  tex.update();
  const m = new BABYLON.StandardMaterial('tm' + text, scene);
  m.diffuseTexture = tex; m.useAlphaFromDiffuseTexture = true;
  m.specularColor = new BABYLON.Color3(0, 0, 0); m.backFaceCulling = true;
  return m;
};
// 흰 바탕 + 팀 색 세로 줄무늬 천
const stripeMat = (base, line) => {
  const tex = new BABYLON.DynamicTexture('stripe' + line, { width: 64, height: 64 }, scene, true);
  const ctx = tex.getContext();
  ctx.fillStyle = base; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = line; ctx.fillRect(14, 0, 4, 64); ctx.fillRect(46, 0, 4, 64);
  tex.update();
  tex.uScale = 4; tex.vScale = 2;
  const m = mat(base); m.diffuseColor = new BABYLON.Color3(1, 1, 1); m.diffuseTexture = tex;
  return m;
};

// 이 선수만 쓰는 재질(투명도를 따로 바꾸려고). 텍스처는 복사하지 않고 함께 쓴다
// (material.clone은 글자·줄무늬 텍스처까지 새로 만들면서 내용이 비어 버린다)
const ownCopy = (src, alpha) => {
  const m = new BABYLON.StandardMaterial(src.name + '-own', scene);
  m.diffuseColor = src.diffuseColor.clone(); m.specularColor = src.specularColor.clone();
  m.emissiveColor = src.emissiveColor.clone();
  m.diffuseTexture = src.diffuseTexture; m.useAlphaFromDiffuseTexture = src.useAlphaFromDiffuseTexture;
  m.backFaceCulling = src.backFaceCulling; m.alpha = alpha;
  return m;
};

// ---------- 유니폼 ----------
// 홈팀: 흰 바탕 + 팀 색 줄무늬, 원정팀: 팀 색 바탕 + 회색 바지. 모자·양말은 팀 색
const KITS = {};
const kitFor = (teamIdx, home) => {
  const key = teamIdx + (home ? 'h' : 'a');
  if (KITS[key]) return KITS[key];
  const T = TEAMS[teamIdx], [c1, c2] = T.colors;
  const font = '"Do Hyeon", "Apple SD Gothic Neo", sans-serif';
  const shortName = T.name.split(' ').pop();
  const k = {
    key, teamIdx, home, c1, c2, font,
    shirt: home ? stripeMat('#f4f3ee', c1) : mat(c1),
    pants: home ? stripeMat('#f4f3ee', c1) : mat('#c4c8cf'),
    cap: mat(c1), sock: mat(home ? c1 : c2), accent: mat(c2),
    chest: textMat(shortName, home ? c1 : '#ffffff', 256, 64, `52px ${font}`),
    nums: {},
  };
  KITS[key] = k;
  return k;
};
const numberMat = (kit, num) => {
  if (!kit.nums[num]) kit.nums[num] = textMat(String(num), kit.home ? kit.c1 : '#ffffff', 128, 128, `bold 96px ${kit.font}`);
  return kit.nums[num];
};

// ---------- 뼈대(관절) ----------
const DOWN = new BABYLON.Vector3(0, -1, 0);
// 관절을 돌려서, 아래로 늘어진 팔·다리가 dir(부모 관절 기준 방향)을 향하게 한다
const pointLimb = (node, dir) => {
  const q = new BABYLON.Quaternion();
  BABYLON.Quaternion.FromUnitVectorsToRef(DOWN, dir.normalizeToNew(), q);
  node.rotation = q.toEulerAngles();
};
// 몸(rig) 기준 방향을 부모 관절 기준 방향으로 바꾼다
const toLocalDir = (parent, dir) => {
  const r = parent.rotation;
  const inv = BABYLON.Quaternion.RotationYawPitchRoll(r.y, r.x, r.z); inv.invertInPlace();
  return dir.applyRotationQuaternion(inv);
};

// 선수 한 명을 root 아래에 만든다. 앞(+z)을 바라보고 발이 y = 0에 닿는다.
// role: 'batter' | 'pitcher' | 'catcher' | 'fielder', own: true면 재질을 따로 가져서 이 선수만 반투명하게 할 수 있음
// hand: 1 = 오른손잡이(우투·우타), -1 = 왼손잡이
const buildRig = (root, { role, kit, num, own = false, alpha = 1, hand = 1 }) => {
  const rig = { root, role, mats: [], meshes: [] };
  const ownMats = {};
  const node = (name, parent, x, y, z) => {
    const n = new BABYLON.TransformNode(name, scene);
    n.parent = parent; n.position.set(x, y, z);
    return n;
  };
  const part = (shape, material, parent, x, y, z) => {
    let m;
    if (own) {
      if (!ownMats[material.uniqueId]) {
        const c = ownCopy(material, alpha);
        ownMats[material.uniqueId] = c; rig.mats.push(c);
      }
      m = baseShape(shape).clone(shape); m.material = ownMats[material.uniqueId];
    } else {
      m = instanceSource(shape, material).createInstance(shape);
    }
    m.parent = parent; m.position.set(x, y, z); m.isPickable = false;
    rig.meshes.push(m);
    return m;
  };
  const label = (material, parent, x, y, z, w, h, back) => {
    const p = BABYLON.MeshBuilder.CreatePlane('label', { width: w, height: h }, scene);
    p.parent = parent; p.position.set(x, y, z); p.isPickable = false;
    if (!back) p.rotation.y = Math.PI;      // 가슴 글자는 앞(+z)에서 읽히게 돌린다
    if (own) { const c = ownCopy(material, alpha); rig.mats.push(c); p.material = c; }
    else p.material = material;
    rig.meshes.push(p);
    return p;
  };

  const HIP_Y = 0.88;
  rig.pelvis = node('pelvis', root, 0, HIP_Y, 0);
  part('hips', kit.pants, rig.pelvis, 0, 0, 0).scaling.set(1, 0.7, 0.85);
  // 몸통
  rig.spine = node('spine', rig.pelvis, 0, 0.05, 0);
  part('torso', kit.shirt, rig.spine, 0, 0.3, 0).scaling.set(1.22, 1, 0.82);
  label(kit.chest, rig.spine, 0, 0.42, 0.17, 0.3, 0.075, false);
  label(numberMat(kit, num), rig.spine, 0, 0.36, -0.17, 0.2, 0.2, true);
  // 목·머리·얼굴
  part('neck', PMAT.skin, rig.spine, 0, 0.64, 0);
  rig.head = node('head', rig.spine, 0, 0.7, 0);
  part('head', PMAT.skin, rig.head, 0, 0.15, 0);
  [-1, 1].forEach(s => {
    part('eye', PMAT.eye, rig.head, s * 0.065, 0.17, 0.148);
    part('brow', PMAT.brow, rig.head, s * 0.065, 0.225, 0.15).rotation.z = s * 0.15;
  });
  // 모자 / 헬멧 / 포수 장비
  if (role === 'batter') {
    part('helmet', kit.cap, rig.head, 0, 0.17, 0);
    part('brim', kit.cap, rig.head, 0, 0.2, 0.13).scaling.z = 0.8;
    // 귀 보호대는 투수를 바라보는 쪽(우타는 왼쪽)
    part('earflap', kit.cap, rig.head, -0.19 * hand, 0.12, 0).rotation.z = Math.PI / 2;
  } else if (role === 'catcher') {
    part('helmet', kit.cap, rig.head, 0, 0.17, 0);
    part('mask', PMAT.mask, rig.head, 0, 0.14, 0.17);
    part('pad', kit.accent, rig.spine, 0, 0.32, 0.17);
  } else {
    part('capTop', kit.cap, rig.head, 0, 0.2, 0);
    part('brim', kit.cap, rig.head, 0, 0.2, 0.14).scaling.z = 0.9;
  }
  // 팔: 어깨 → 팔꿈치 → 손. 위팔은 유니폼, 아래팔과 손은 피부
  rig.shoulder = {}; rig.elbow = {}; rig.hand = {};
  for (const [k, s] of [['R', 1], ['L', -1]]) {
    const sh = rig.shoulder[k] = node('sh' + k, rig.spine, s * 0.27, 0.55, 0);
    sh.rotation.z = s * 0.12;
    part('upperArm', kit.shirt, sh, 0, -0.16, 0);
    const el = rig.elbow[k] = node('el' + k, sh, 0, -0.32, 0);
    part('foreArm', PMAT.skin, el, 0, -0.14, 0);
    rig.hand[k] = node('hd' + k, el, 0, -0.29, 0);
    part('hand', PMAT.skin, rig.hand[k], 0, 0, 0);
  }
  // 다리: 엉덩이 → 무릎 → 발. 허벅지는 바지, 정강이는 양말
  rig.hip = {}; rig.knee = {}; rig.foot = {};
  for (const [k, s] of [['R', 1], ['L', -1]]) {
    const hp = rig.hip[k] = node('hp' + k, rig.pelvis, s * 0.1, -0.04, 0);
    part('thigh', kit.pants, hp, 0, -0.22, 0);
    const kn = rig.knee[k] = node('kn' + k, hp, 0, -0.44, 0);
    part('shin', kit.sock, kn, 0, -0.2, 0);
    rig.foot[k] = node('ft' + k, kn, 0, -0.38, 0);
    part('shoe', PMAT.shoe, rig.foot[k], 0, -0.02, 0.05);
  }
  // 글러브: 던지지 않는 손(우투는 왼손)
  if (role === 'pitcher' || role === 'fielder') {
    const g = part('glove', PMAT.glove, rig.hand[hand === 1 ? 'L' : 'R'], 0, -0.04, 0.03);
    g.scaling.set(0.6, 1, 1);
  }
  rig.throwArm = rig.shoulder[hand === 1 ? 'R' : 'L'];
  // 발밑 그림자: 투명도가 선수와 따로 놀도록 항상 공용 재질의 인스턴스로
  if (role !== 'catcher') {
    const sh = instanceSource('shadow', PMAT.shadow).createInstance('shadow');
    sh.parent = root; sh.position.set(0, 0.03, 0); sh.scaling.set(1, 1, 0.8); sh.isPickable = false;
  }
  return rig;
};
const disposeRig = root => {
  const rig = root.metadata && root.metadata.rig;
  if (!rig) return;
  root.getChildren().forEach(c => c.dispose(false, false));
  rig.mats.forEach(m => m.dispose(false, false));     // 텍스처는 유니폼끼리 공유하므로 남긴다
  root.metadata.rig = null;
};
// 같은 차림이면 다시 만들지 않는다
const dressRig = (root, opts) => {
  const key = [opts.role, opts.kit.key, opts.num, opts.own, opts.alpha, opts.hand].join('|');
  if (root.metadata && root.metadata.key === key) return root.metadata.rig;
  disposeRig(root);
  const rig = buildRig(root, opts);
  root.metadata = { rig, key };
  POSES[opts.role] && POSES[opts.role](rig, opts.hand || 1);
  return rig;
};

// ---------- 자세 ----------
const POSES = {
  // 투수: 팔을 자연스럽게 내리고 다리를 조금 벌림
  pitcher: rig => {
    rig.hip.R.rotation.z = 0.08; rig.hip.L.rotation.z = -0.08;
    rig.elbow.R.rotation.x = -0.4; rig.elbow.L.rotation.x = -0.6;
    rig.throwArm.rotation.x = 0.3;
  },
  fielder: rig => POSES.pitcher(rig),
  // 타자: 무릎을 굽히고 두 손을 배트 손잡이(몸 앞 가슴 높이) 쪽으로
  batter: (rig, hand) => {
    rig.pelvis.position.y -= 0.06;
    rig.spine.rotation.x = 0.12;
    for (const [k, s] of [['R', 1], ['L', -1]]) {
      rig.hip[k].rotation.z = s * 0.18;
      rig.knee[k].rotation.x = 0.25; rig.hip[k].rotation.x = -0.12;
    }
    // 손이 모이는 곳: 몸 앞, 뒤쪽 어깨 가까이(우타는 오른쪽)
    const grip = new BABYLON.Vector3(0.12 * hand, -0.35, 0.32);
    for (const [k, s] of [['R', 1], ['L', -1]]) {
      const sh = rig.shoulder[k];
      sh.rotation.set(0, 0, 0);
      pointLimb(sh, grip.subtract(new BABYLON.Vector3(s * 0.27, 0, 0)));
      rig.elbow[k].rotation.x = -0.35;
    }
  },
  // 포수: 쪼그려 앉기. 허벅지는 앞으로 눕히고 정강이는 아래로
  catcher: rig => {
    rig.pelvis.position.y = 0.48;
    rig.spine.rotation.x = 0.3;
    for (const [k, s] of [['R', 1], ['L', -1]]) {
      const hp = rig.hip[k];
      pointLimb(hp, new BABYLON.Vector3(s * 0.45, -0.05, 1));
      pointLimb(rig.knee[k], toLocalDir(hp, new BABYLON.Vector3(0, -1, -0.15)));
      pointLimb(rig.shoulder[k], new BABYLON.Vector3(s * 0.35, -0.6, 1));
      rig.elbow[k].rotation.x = -0.5;
    }
  },
};

// ---------- 경기장에 선 선수들 ----------
const pitcher = new BABYLON.TransformNode('pitcher', scene);
pitcher.position.set(0, 0.24, MOUND_Z); pitcher.rotation.y = Math.PI;
let pitchArm = null;          // 와인드업 때 돌리는 어깨(던지는 팔)

const batter = new BABYLON.TransformNode('batter', scene);
batter.position.set(-0.95, 0, 0.1); batter.rotation.y = Math.PI / 2;
const batPivot = new BABYLON.TransformNode('bp', scene);
batPivot.position.set(-0.62, 1.1, 0.1);
const bat = BABYLON.MeshBuilder.CreateCylinder('bat', { diameterTop: 0.07, diameterBottom: 0.035, height: 0.86 }, scene);
bat.material = mat('#d9a066'); bat.parent = batPivot; bat.position.set(0, 0.43, 0);
const BAT_REST = new BABYLON.Vector3(0.0, 0, -0.6);
batPivot.rotation.copyFrom(BAT_REST);

// 포수와 미트. 투구 모드(투수 시점)에서만 보인다.
// 투수 눈높이에서는 포수가 존 뒤에 겹쳐 보이므로, 쪼그려 앉힌 몸을 땅에 조금 묻고 반투명하게 한다. 숫자를 바꿔 조절
const CATCHER_VIEW = { y: -0.55, scale: 0.9, alpha: 0.35, mittAlpha: 0.6 };
const catcher = new BABYLON.TransformNode('catcher', scene);
catcher.position.set(0, CATCHER_VIEW.y, -0.95); catcher.scaling.setAll(CATCHER_VIEW.scale);
const mitt = BABYLON.MeshBuilder.CreateSphere('mitt', { diameter: 0.26, segments: 12 }, scene);
mitt.scaling.z = 0.5; mitt.material = mat('#7a4520', { alpha: CATCHER_VIEW.mittAlpha }); mitt.isPickable = false;
const MITT_REST = new BABYLON.Vector3(0, 0.75, -0.45);
mitt.position.copyFrom(MITT_REST);
catcher.setEnabled(false); mitt.setEnabled(false);

// 왼손/오른손에 맞게 서는 쪽 바꾸기. batSide: 우타 1, 좌타 -1 (좌타는 좌우를 거울처럼 뒤집음)
let batSide = 1;
const setBatterSide = bats => {
  batSide = bats === 'L' ? -1 : 1;
  batter.position.x = -0.95 * batSide; batter.rotation.y = batSide * Math.PI / 2;
  batPivot.position.x = -0.62 * batSide;
  batPivot.rotation.set(BAT_REST.x, BAT_REST.y * batSide, BAT_REST.z * batSide);
};
// 던지는 팔: 우투는 투수의 오른쪽(포수가 볼 때 왼쪽), 좌투는 반대
let pitchHand = 1;
const setPitcherHand = throws => { pitchHand = throws === 'L' ? -1 : 1; };

// 지금 타자·투수·포수에게 유니폼을 입힌다(공격팀 = 타자, 수비팀 = 투수·포수)
const dressPlayers = () => {
  const bs = battingSide(), fs = fieldingSide();
  const bKit = kitFor(teamIndex(bs), bs === 'home'), fKit = kitFor(teamIndex(fs), fs === 'home');
  dressRig(batter, { role: 'batter', kit: bKit, num: currentBatter().num, own: true,
    alpha: S.mode === 'bat' ? 0.55 : 1, hand: batSide });
  pitchArm = dressRig(pitcher, { role: 'pitcher', kit: fKit, num: currentPitcher().num, hand: pitchHand }).throwArm;
  dressRig(catcher, { role: 'catcher', kit: fKit, num: 2, own: true, alpha: CATCHER_VIEW.alpha });
};
