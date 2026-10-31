// 시작: 카메라 위치, 화면 탭 처리, 매 프레임 경기 진행(update)과 그리기(frame), 시작할 때 한 번 하는 일

// 카메라가 바라보는 점
const camLook = new THREE.Vector3(0, 1, -10);
// 타자 시점 카메라 위치
const camHome = new THREE.Vector3(0, 1.0, 4.0);
// 화면 탭 처리(스윙, 경기 시작, 추가 진루, 태그업, 건너뛰기). e: 탭 이벤트(정밀 타격용 위치)
function input(e) {
  if (paused) return;
  unlockAudio();
  if ($('hof').style.display === 'flex') return;
  if ($('season-modal').style.display === 'flex') return;
  if (isReplay) {
    endReplay();
    return;
  }
  if (trot && now - trot.t0 > 500) {
    skipTrot();
    return;
  }
  if (phase === 'hit' && hit && hit.hold && hit.k === 'fo' && !pitcherMode && !hit.tag && !hit.fumble) {
    const i = tagUpCandidate();
    if (i >= 0) {
      hit.tag = { i, ok: rand() < clamp((i === 2 ? 0.5 : 0.6) + (runnerSpeed(i) - 5) * 0.03, 0.1, 0.9) };
      $('hint').textContent = hit.tag.ok ? '태그업 GO!' : '태그업 GO! (아웃 위험)';
      return;
    }
  }
  if (phase === 'title' || (phase === 'over' && now - phaseStart > 600)) {
    startGame(false, true);
    return;
  }
  if (phase === 'wait' && extraBase != null) {
    doExtra();
    return;
  }
  if (phase === 'pitch' && !swing && !pitcherMode)
    swing = {
      t0: now,
      contactT: now + 90,
      miss: false,
      done: false,
      bunt: buntReq,
      tap: e && e.clientX != null ? { x: e.clientX, y: e.clientY } : null, // 정밀 타격: 탭한 화면 위치
    };
}
gameCanvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (paused) return;
  if (pitcherMode && phase === 'aim') {
    unlockAudio();
    aimPointer = e.pointerId;
    try {
      gameCanvas.setPointerCapture(e.pointerId);
    } catch (_) {}
    aimMove(e);
    return;
  }
  input(e);
});
gameCanvas.addEventListener('pointermove', e => {
  if (aimPointer === e.pointerId) aimMove(e);
});
gameCanvas.addEventListener('pointerup', e => {
  if (aimPointer !== e.pointerId) return;
  aimPointer = null;
  aimEl.style.display = 'none';
  if (phase === 'aim') {
    const q = aimXY(e);
    aimTap(q[0], q[1]);
  }
});
gameCanvas.addEventListener('pointercancel', () => {
  aimPointer = null;
  aimEl.style.display = 'none';
});
$('title').addEventListener('pointerdown', e => {
  if (phase === 'title') {
    unlockAudio();
    startGame(false, true);
  }
});
$('btn-ex').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  unlockAudio();
  startSeasonModal();
});
$('season-next').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  unlockAudio();
  $('season-modal').style.display = 'none';
  startGame(false, true);
});
$('end').addEventListener('pointerdown', input);
addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    input();
  }
});
// 경기 한 프레임 처리(투구, 스윙, 타구, 카메라)
function update(dt) {
  frameDt = dt;
  batSide = curHand();
  if (isReplay) replayBall();
  catcher.visible = umpireRig.root.visible = pitcherMode;
  stepParticles(dt);
  stepTweens();
  updateControls();
  if (fwEnd > now && now >= fwNext) {
    fwNext = now + 260;
    const c = [
        [1, 0.8, 0.2],
        [1, 0.3, 0.3],
        [0.4, 0.7, 1],
        [0.5, 1, 0.5],
      ][(rand() * 4) | 0],
      fw = camLook.clone().sub(camera.position).normalize();
    burst(
      camera.position.x + fw.x * 45 + randRange(-18, 18),
      camera.position.y + randRange(14, 32),
      camera.position.z + fw.z * 45 + randRange(-10, 10),
      70,
      c,
      14,
      1.5,
    );
  }
  if (pitch && pitch.t0 && phase !== 'windup') pitcherAnim(1, clamp((now - pitch.t0) / 500, 0, 1));
  if (phase === 'windup' && pickoffBase >= 0) {
    const i = stealReq && stealer() >= 0 ? stealer() : pickoffBase;
    doPick(i, stealReq && i === stealer());
  } else if (phase === 'windup') {
    const w = clamp((now - phaseStart) / 1050, 0, 1);
    pitcherAnim(w, 0);
    pitcherRoot.updateMatrixWorld(true);
    ball.visible = true;
    (pitcherLefty ? pitcherRig.La : pitcherRig.Ra).hd.getWorldPosition(ball.position);
    if (w >= 1 && pickoffBase >= 0) {
      const i = stealReq && stealer() >= 0 ? stealer() : pickoffBase;
      doPick(i, stealReq && i === stealer());
    } else if (w >= 1) {
      phase = 'pitch';
      pitch.t0 = now;
      pitch.rel = ball.position.clone();
      pitch.t.d = Math.round(89000 / (pitch.kmh * 1.18) / (pitcherMode ? 1 : level().pitchSpeed));
      startSteal();
      if (pitcherMode) aiSwing();
      $('info').textContent =
        `${pitch.t.n} ${Math.round(pitch.kmh * SPEED_DISPLAY_SCALE)}km/h` +
        (pitcherMode ? '' : ` · 투수체력 ${Math.round(cpuStamina)}%`) +
        (!pitcherMode && (infieldShift || outfieldShift)
          ? ` · 시프트${infieldShift ? ' 내야' : ''}${outfieldShift ? ' 외야' : ''}`
          : '');
      $('info').style.borderColor = PITCH_COLORS[pitch.t.k] || '#ffb3bf';
      $('hint').textContent = pitcherMode ? '' : '공이 홈플레이트에 닿을 때 탭!';
    }
  }
  if (phase === 'pitch') {
    const t = (now - pitch.t0) / pitch.t.d;
    if (t <= 1.02) ball.position.copy(pitchPos(pitch, Math.min(t, 1)));
    else ball.visible = false;
    if (t <= 1.02) addTrail(ball.position);
    if (swing && !swing.done && now >= swing.contactT) {
      swing.done = true;
      resolveSwing();
    }
    // 판정 시점: 공이 지나간 뒤 조금(루키는 늦은 스윙도 받아주도록 더 기다린다)
    const judgeT = pitcherMode ? 1.08 : Math.max(1.08, 1 + (level().lateWindow * 1000) / pitch.t.d);
    if (phase === 'pitch' && t >= judgeT) {
      // 너무 늦게 휘두른 스윙(맞기 전에 판정)도 타이밍 미터에 보여준다
      if (swing && !swing.done && !pitcherMode)
        showTimingMeter((swing.contactT - (pitch.t0 + pitch.t.d)) / 1000 / level().swingWindow);
      let k = swing ? 'swingmiss' : inZone(pitch) ? 'strike' : 'ball';
      if (k === 'swingmiss' && (pitch.warp || pitch.fake)) $('info').textContent = '속았다!';
      if (
        k === 'ball' &&
        pitch.xT * batSide < -0.34 &&
        pitch.xT * batSide > -1.05 &&
        pitch.yT > 0.2 &&
        pitch.yT < 1.5 &&
        rand() < 0.6
      ) {
        k = 'hbp';
        hbpUntil = now + 800;
        burst(pitch.xT, pitch.yT, 0.1, 24, [1, 1, 1], 5, 0.6);
      }
      pitchMark.position.set(pitch.xT, pitch.yT, 0.05);
      pitchMark.material.color.set(inZone(pitch) ? 0x5fd16a : 0xe8453c);
      pitchMark.visible = true;
      {
        const ss = endSteal(false);
        showBanner(ss.e ? ss.t : countPitch(k), ss.e ? '' : ss.t, false);
      }
      updateHud();
      phase = 'wait';
      waitUntil = now + 1100;
      tone(120, 0.08);
      if (k !== 'ball') cheer(0.22, 0.9);
    }
  }
  let su = -1;
  if (swing) su = swingProgress(now - swing.t0);
  {
    let tg = 0;
    if (phase === 'pitch') tg = smoothstep(0, 0.45, (now - pitch.t0) / pitch.t.d);
    else if (phase === 'hit') tg = 1;
    batLoad += (tg - batLoad) * Math.min(1, dt * 16);
  }
  if (trot) trotStep(dt);
  else batterAnim(su, batLoad, now);
  updateBenchClear(now);
  crowdUpdate(now);
  if (hbpUntil > now) {
    const u = clamp((1 - (hbpUntil - now) / 800) * 1.4, 0, 1),
      w = Math.sin(Math.PI * u);
    batterRig.root.rotation.z = 0.45 * w * batSide;
    batterRig.root.position.x = batSide * (-0.78 - 0.25 * w);
  } else if (!trot) {
    hbpUntil = 0;
    batterRig.root.rotation.z = 0;
    batterRig.root.position.x = -0.78 * batSide;
  }
  if (phase === 'hit') stepHit(dt);
  if (phase === 'wait' && now >= waitUntil) {
    if (twoWay && pitcherMode && inning >= totalInnings && oppRuns + score > myRuns) {
      oppRuns += score;
      score = 0;
      endGame();
    } else if (inning > totalInnings) endGame();
    else nextPitch();
  }
  fielders.forEach((f, i) => {
    if (f.mv > 1) runPose(f.r, dt, f.mv);
    else {
      readyPose(f.r);
      if (hit && hit.hold && hit.fi === i && hit.pu != null) fieldPose(hit.pu, hit.pi, f);
    }
    f.mv = 0;
  });
  // 공 그림자와 공 크기(멀어도 보이게 키움)
  shadow.visible = ball.visible;
  if (ball.visible) {
    if (phase === 'pitch' && !pitcherMode)
      burst(ball.position.x, ball.position.y, ball.position.z, 1, [1, 1, 1], 0.15, 0.3);
    const d = ball.position.distanceTo(camera.position),
      r = clamp(d * 0.0035, 0.045, 0.5) * (phase === 'pitch' && !pitcherMode ? 1.5 : 1);
    ball.scale.setScalar(r);
    ball.rotation.x -= dt * (phase === 'pitch' ? 28 : 14);
    shadow.position.set(ball.position.x, 0.07, ball.position.z);
    shadow.scale.setScalar(r * 0.9);
  }
  // 카메라
  if (isReplay) {
    replayCam(dt);
    return;
  }
  if (phase === 'hit' && hit) {
    const p = ball.position,
      dr = hit.dir,
      want = new THREE.Vector3(p.x - dr.x * 16, Math.max(5, p.y * 0.5 + 5), p.z - dr.z * 16);
    if (p.z > -6) want.set(camHome.x * (1 - p.z / -6), Math.max(want.y, 2), Math.max(want.z, camHome.z * 0.5));
    if (camera.zoom !== 1) {
      camera.zoom = 1;
      camera.updateProjectionMatrix();
    }
    const k = 1 - Math.exp(-2.2 * dt);
    camera.position.lerp(want, k);
    camLook.lerp(p, 1 - Math.exp(-4 * dt));
    camera.lookAt(camLook);
  } else if (trot) {
    if (camera.zoom !== 1) {
      camera.zoom = 1;
      camera.updateProjectionMatrix();
    }
    camera.position.lerp(TROT_CAM, 1 - Math.exp(-2 * dt));
    camLook.lerp(batterRig.root.position, 1 - Math.exp(-3 * dt));
    camLook.y = 1;
    camera.lookAt(camLook);
  } else {
    const zt = pitcherMode ? 3.6 : 1;
    if (camera.zoom !== zt) {
      camera.zoom = zt;
      camera.updateProjectionMatrix();
    }
    camera.position.lerp(pitcherMode ? pitcherCam : camHome, 1 - Math.exp(-5 * dt));
    camera.lookAt(pitcherMode ? camLook.set(0, 0.9, 0) : camLook.set(0, 1, -10));
  }
  if (shake > 0.003) {
    camera.position.x += randRange(-1, 1) * shake;
    camera.position.y += randRange(-1, 1) * shake;
    shake *= Math.exp(-7 * dt);
  }
}
// 이번 프레임 시간(초)
let frameDt = 0.016;
// 화면 크기에 맞춰 렌더러와 카메라를 맞춘다
function resize() {
  const w = innerWidth,
    h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? (2 * Math.atan(Math.tan((18 * Math.PI) / 180) / (w / h)) * 180) / Math.PI : 32;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
// 직전 프레임 시각
let lastFrameT = 0;
// 일시정지·히트 스톱으로 멈춘 시간(게임 시계 now에서 뺀다)
let clockOffset = 0;
// 히트 스톱이 끝나는 시각(실제 시간)
let hitStopEnd = 0;
// 매 프레임: 경기 진행 후 화면을 그린다
function frame(t) {
  countFps(t);
  // 일시정지 중: 게임 시계를 멈추고 화면도 새로 그리지 않는다(마지막 화면이 그대로 남는다)
  if (paused) {
    clockOffset += t - lastFrameT;
    lastFrameT = t;
    requestAnimationFrame(frame);
    return;
  }
  // 히트 스톱: 맞힌 직후 아주 잠깐 게임 시계를 멈춘다(화면도 그대로)
  if (t < hitStopEnd) {
    clockOffset += t - lastFrameT;
    lastFrameT = t;
    requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min(0.05, (t - lastFrameT) / 1000 || 0);
  lastFrameT = t;
  now = t - clockOffset;
  updatePauseButton();
  if ((window.fxc = (window.fxc || 0) + 1) % 30 === 1) fx();
  if (window.fxc % 6 === 0) {
    boardUpd();
    zoneUpd();
    zone3DUpd();
    try {
      cardUpd();
    } catch (e) {}
  }
  placeSB(phase === 'title');
  if (phase === 'title') {
    camera.position.set(Math.sin(t / 4000) * 3, 2.4, 5);
    camera.lookAt(0, 1, -12);
    catcher.visible = true;
  } else update(dt * (now < slowUntil ? 0.25 : 1));
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
bases = [0, 0, 0];
upgradeRealisticStadium();
setTimeOfDay(titleTod());
// 첫 프레임 시작(모든 파일을 다 읽은 뒤)
requestAnimationFrame(frame);
