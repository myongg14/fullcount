// 경기 진행: 볼·스트라이크 판정 반영, 타석 끝내기, 다음 타석, 타격/투구 모드 바꾸기

// ---------- 진행 ----------
const resetCount = () => { S.balls = 0; S.strikes = 0; };
const endPA = (kind, text, sub) => {
  S.stats.pa++;
  if (kind === 'hit' || kind === 'hr') S.stats.hit++;
  if (kind === 'hr') S.stats.hr++;
  if (kind === 'k') S.stats.k++;
  if (kind === 'k' || kind === 'out') S.outs++;
  renderBoard();
  banner(text, sub, 0);
  S.phase = 'result';
  setTimeout(() => {
    $('nextBtn').textContent = S.outs >= 3 ? '공수 끝 · 다시 시작' : '다음 타석';
    $('nextBtn').hidden = false; $('nextBtn').focus({ preventScroll: true });
  }, 600);
};
const nextPA = () => {
  $('nextBtn').hidden = true; $('banner').classList.remove('show');
  if (S.outs >= 3) S.outs = 0;
  resetCount(); renderBoard(); landMark.isVisible = false; ball.isVisible = false; shadow.isVisible = false;
  S.phase = 'idle';
  if (S.mode === 'bat') setTimeout(startAIPitch, 700); else readyPitch();
};
const callPitch = (res, sub) => {
  // res: 'ball' | 'strike' | 'foul'
  if (res === 'ball') {
    S.balls++;
    if (S.balls >= 4) return endPA('bb', '볼넷', sub);
    banner('볼', sub, 900);
  } else if (res === 'strike') {
    S.strikes++;
    if (S.strikes >= 3) return endPA('k', '삼진', sub);
    banner('스트라이크', sub, 900);
  } else if (res === 'foul') {
    if (S.strikes < 2) S.strikes++;
    banner('파울', sub, 900);
  }
  renderBoard();
  S.phase = 'idle';
  setTimeout(() => { if (S.mode === 'bat') startAIPitch(); else readyPitch(); }, 1300);
};

const setMode = m => {
  if (S.phase === 'pitch' || S.phase === 'flight' || S.phase === 'windup') return;
  S.mode = m; S.outs = 0; S.stats = { pa: 0, hit: 0, hr: 0, k: 0 }; resetCount();
  $('modeBat').setAttribute('aria-pressed', m === 'bat'); $('modePitch').setAttribute('aria-pressed', m === 'pitch');
  $('batDock').hidden = m !== 'bat'; $('pitchDock').hidden = m !== 'pitch';
  $('nextBtn').hidden = true; $('banner').classList.remove('show');
  batter.getChildMeshes().forEach(x => { x.material.alpha = m === 'bat' ? 0.55 : 1; });
  renderBoard(); S.phase = 'idle';
  if (m === 'bat') { hint('공이 홈플레이트에 들어오는 순간, 공이 있는 곳을 탭하세요.'); setTimeout(startAIPitch, 900); }
  else readyPitch();
};
