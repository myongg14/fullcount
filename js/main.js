// 시작점: 매 프레임 애니메이션, 터치·버튼 입력 연결, 첫 화면 시작

// ---------- 매 프레임 ----------
let swingAnim = 0;
// 카메라: 타격은 포수 뒤, 투구는 투수 뒤 어깨 높이(글러브 쪽)에서 존을 확대해서 본다. 숫자를 바꿔 조절
const PITCH_VIEW = { fov: 0.13, back: 2.5, side: 0.9, height: 1.8 };
const camHome = { pos: new BABYLON.Vector3(0, 1.35, -4.6), tgt: new BABYLON.Vector3(0, 0.5, MOUND_Z), fov: 0.55 };
const pitchView = () => ({
  pos: new BABYLON.Vector3(PITCH_VIEW.side * pitchHand, PITCH_VIEW.height, MOUND_Z + PITCH_VIEW.back),
  tgt: new BABYLON.Vector3(0, (ZONE.yLo + ZONE.yHi) / 2, 0), fov: PITCH_VIEW.fov,
});
let camPos = camHome.pos.clone();
let lastT = 0;
let camTgt = camHome.tgt.clone();
scene.onBeforeRenderObservable.add(() => {
  const t = now();
  // 와인드업: 팔 돌리기 0.7초
  if (S.phase === 'windup') {
    const u = (t - windT) / 700;
    if (pitchArm) pitchArm.rotation.x = -u * Math.PI * 1.6;
    // 글러브 쪽 다리를 들었다가 내딛는다
    const pr = rigOf(pitcher);
    if (pr) {
      const g = pitchHand === 1 ? 'L' : 'R', lift = Math.sin(Math.PI * Math.min(u, 1));
      pointLimb(pr.hip[g], limbDir(1.3 * lift)); pointLimb(pr.knee[g], limbDir(-1.6 * lift));
      if (u >= 1) restPose(pr);
    }
    if (u >= 1) { if (pitchArm) pitchArm.rotation.x = 0.3; const cb = windCb; windCb = null; cb && cb(); }
  }
  // 스윙 애니메이션 0.18초
  const su = (t - swingAnim) / 180;
  const br = rigOf(batter);
  // 플레이 중이거나 배트를 내려놓은 뒤에는 스윙 동작을 건드리지 않는다
  if (!play && batPivot.position.y > 0.5) {
    if (su >= 0 && su <= 1) batPivot.rotation.set(0, -su * Math.PI * 1.1 * batSide, (-0.6 - su * 0.9) * batSide);
    else if (su > 2.5) batPivot.rotation.set(BAT_REST.x, BAT_REST.y * batSide, BAT_REST.z * batSide);
    // 스윙할 때 몸통이 투수 쪽으로 돈다
    if (br) br.spine.rotation.y = su >= 0 && su <= 2.5 ? -Math.min(su, 1) * 1.1 * batSide * (su > 1 ? Math.max(0, 1 - (su - 1) / 1.5) : 1) : 0;
  }
  // 포수 미트: 공이 들어올 곳으로 움직인다
  const mt = S.phase === 'pitch' && S.pitch ? new BABYLON.Vector3(S.pitch.target.x, S.pitch.target.y, MITT_REST.z) : MITT_REST;
  mitt.position = BABYLON.Vector3.Lerp(mitt.position, mt, 0.15);

  if (S.phase === 'pitch' && S.pitch) {
    const s = (t - S.pitch.t0) / (S.pitch.dur * 1000);
    const p = pitchPos(S.pitch, Math.min(s, 1.15));
    ball.position.copyFrom(p);
    shadow.position.set(p.x, 0.03, p.z);
    if (S.mode === 'bat') {
      if (S.swing && t >= S.swing.t && s >= 0) {
        // 스윙 시점 또는 공 도착 중 늦은 쪽에서 판정
        if (s >= 1 || t - S.swing.t > 60) { S.phase = 'judge'; resolveSwing(); }
      } else if (s >= 1.12) {
        S.phase = 'judge';
        const sub = `${S.pitch.name} ${S.pitch.kmh}km/h`;
        callPitch(inZone(S.pitch.target) ? 'strike' : 'ball', sub + (inZone(S.pitch.target) ? ' · 루킹' : ''));
      }
    } else if (s >= 0.93) {
      S.phase = 'judge'; aiBatterDecide();
    }
  }
  if (S.phase === 'judge' && !flight && S.mode === 'bat' && ball.position.z < -0.2) ball.isVisible = false;

  // 수비·주루 플레이(play.js): 카메라는 공과 주자가 잘 보이는 높은 곳에서 따라간다
  if (play) {
    updatePlay(Math.min(0.1, (t - (lastT || t)) / 1000));
    if (play) {
      camTgt = BABYLON.Vector3.Lerp(camTgt, playFocus(), 0.06);
      camPos = BABYLON.Vector3.Lerp(camPos, new BABYLON.Vector3(...PLAY_TUNING.camPos), 0.05);
      cam.fov += (PLAY_TUNING.camFov - cam.fov) * 0.05;
    }
  } else if (flight) {
    const i = Math.max(0, Math.floor((t - flight.t0) / (1000 / 60) * 1.4));
    const pts = flight.pts;
    const p = pts[Math.min(i, pts.length - 1)];
    ball.position.copyFrom(p); shadow.position.set(p.x, 0.03, p.z);
    // 공 그림자는 높이 뜰수록 크고 옅게, 떨어질 지점 표시는 깜빡이듯 커졌다 작아진다
    const hgt = Math.max(0, p.y);
    shadow.scaling.setAll(1 + hgt * 0.06); shadow.visibility = clamp(1 - hgt / 40, 0.35, 1);
    landMark.scaling.setAll(1.6 + Math.sin(t / 120) * 0.5);
    camTgt = BABYLON.Vector3.Lerp(camTgt, new BABYLON.Vector3(p.x, Math.max(1, p.y * 0.6), Math.max(p.z, 8)), 0.08);
    camPos = BABYLON.Vector3.Lerp(camPos, camHome.pos, 0.08);
    cam.fov += (camHome.fov - cam.fov) * 0.08;
    if (i >= pts.length - 1) finishFlight();
  } else {
    const v = S.mode === 'pitch' ? pitchView() : camHome;
    camTgt = BABYLON.Vector3.Lerp(camTgt, v.tgt, 0.08);
    camPos = BABYLON.Vector3.Lerp(camPos, v.pos, 0.08);
    cam.fov += (v.fov - cam.fov) * 0.08;
  }
  // 공이 숨으면 꼬리도 숨긴다. 타격 시점에서는 공이 홈플레이트를 지나 카메라 앞으로 오면 꼬리가 화면을 덮으니 숨긴다
  if (ballTrail) ballTrail.isVisible = ball.isVisible && !(S.mode === 'bat' && !flight && !play && ball.position.z < 0.3);
  ballHalo.isVisible = ball.isVisible;
  if (flight || play) landMark.scaling.setAll(1.6 + Math.sin(t / 120) * 0.5);
  if (!flight && !play) { shadow.scaling.setAll(1); shadow.visibility = 1; landMark.scaling.setAll(1); }
  cam.position.copyFrom(camPos);
  cam.setTarget(camTgt);
  lastT = t;

  if (aim.active) {
    const sc = shrinkScale(t - aim.start);
    $('aimShrink').style.transform = `translate(-50%, -50%) scale(${sc})`;
    const good = Math.abs(sc - 1) < 0.15 * aim.win;   // 테두리를 노리면 초록 구간도 좁아진다
    $('aimShrink').style.borderColor = good ? '#7CFF8A' : '';
  }
});

// ---------- 입력 ----------
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (S.phase === 'play') return skipPlay();   // 플레이 중 탭 = 건너뛰기
  if (S.mode === 'bat') doSwing(e.clientX, e.clientY);
  else startAim(e.clientX, e.clientY);
});
window.addEventListener('pointermove', e => { if (aim.active) moveAim(e.clientX, e.clientY); });
window.addEventListener('pointerup', () => releaseAim());
window.addEventListener('pointercancel', () => releaseAim());
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

$('nextBtn').onclick = nextPA;
$('ffBtn').onclick = () => { if (play) { play.speed = PLAY_TUNING.hrFast; $('ffBtn').hidden = true; } };
$('powerBtn').onclick = () => { S.power = !S.power; $('powerBtn').setAttribute('aria-pressed', S.power); };
$('slowBtn').onclick = () => {
  S.rookie = !S.rookie; $('slowBtn').setAttribute('aria-pressed', S.rookie);
  $('slowBtn').textContent = S.rookie ? '루키(느리게)' : '프로(실제 속도)';
};
$('changeBtn').onclick = openBullpen;
$('bullpenClose').onclick = closeBullpen;

window.addEventListener('resize', () => engine.resize());
engine.runRenderLoop(() => scene.render());
scene.executeWhenReady(() => {
  $('loading').hidden = true;
  showMenu();
});
