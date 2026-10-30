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
let camTgt = camHome.tgt.clone();
scene.onBeforeRenderObservable.add(() => {
  const t = now();
  // 와인드업: 팔 돌리기 0.7초
  if (S.phase === 'windup') {
    const u = (t - windT) / 700;
    if (pitchArm) pitchArm.rotation.x = -u * Math.PI * 1.6;
    if (u >= 1) { if (pitchArm) pitchArm.rotation.x = 0.3; const cb = windCb; windCb = null; cb && cb(); }
  }
  // 스윙 애니메이션 0.18초
  const su = (t - swingAnim) / 180;
  if (su >= 0 && su <= 1) batPivot.rotation.set(0, -su * Math.PI * 1.1 * batSide, (-0.6 - su * 0.9) * batSide);
  else if (su > 2.5) batPivot.rotation.set(BAT_REST.x, BAT_REST.y * batSide, BAT_REST.z * batSide);
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

  if (flight) {
    const i = Math.max(0, Math.floor((t - flight.t0) / (1000 / 60) * 1.4));
    const pts = flight.pts;
    const p = pts[Math.min(i, pts.length - 1)];
    ball.position.copyFrom(p); shadow.position.set(p.x, 0.03, p.z);
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
  cam.position.copyFrom(camPos);
  cam.setTarget(camTgt);

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
  if (S.mode === 'bat') doSwing(e.clientX, e.clientY);
  else startAim(e.clientX, e.clientY);
});
window.addEventListener('pointermove', e => { if (aim.active) moveAim(e.clientX, e.clientY); });
window.addEventListener('pointerup', () => releaseAim());
window.addEventListener('pointercancel', () => releaseAim());
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

document.querySelectorAll('#newGame button').forEach(b => b.onclick = () => newGame(Number(b.dataset.innings)));
$('nextBtn').onclick = nextPA;
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
  newGame();
});
