// 화면 표시: 위쪽 전광판(이닝, 점수, 주자, 볼·스트라이크·아웃, 지금 타자·투수), 구종 카드, 투수 교체 창, 결과 배너, 안내 문구

// ---------- 전광판 ----------
const renderBoard = () => {
  const set = (cls, n) => document.querySelectorAll('.' + cls + ' .bulb').forEach((b, i) => b.classList.toggle('on', i < n));
  set('b', G.balls); set('s', G.strikes); set('o', G.outs);
  $('inning').textContent = inningText();
  for (const side of ['away', 'home']) {
    $(side + 'Name').textContent = teamName(side);
    $(side + 'Runs').textContent = G.runs[side];
    $(side + 'Row').classList.toggle('at-bat', side === battingSide());
  }
  G.bases.forEach((on, i) => $('base' + (i + 1)).classList.toggle('on', on));
  drawScoreboard();
  const b = currentBatter(), p = currentPitcher();
  $('stats').textContent = `${G.order[battingSide()] + 1}번 ${b.name}(${b.bats === 'L' ? '좌' : '우'}타)`
    + ` vs ${p.name}(${p.throws === 'L' ? '좌' : '우'}투 · ${currentPitchCount()}구)`;
};

// ---------- 구종 카드: 지금 투수가 가진 구종만 ----------
const renderPitchCards = () => {
  const p = currentPitcher();
  const types = Object.keys(p.pitches);
  if (!types.includes(S.selPitch)) S.selPitch = types[0];
  $('pitchCards').innerHTML = types.map(k =>
    `<button class="card" data-pitch="${k}" aria-pressed="${k === S.selPitch}">${PITCHES[k].name}`
    + `<small>${PITCHES[k].desc}</small><small>숙련 ${p.pitches[k]}</small></button>`).join('');
  $('pitchCards').querySelectorAll('.card').forEach(c => c.onclick = () => {
    S.selPitch = c.dataset.pitch;
    $('pitchCards').querySelectorAll('.card').forEach(x => x.setAttribute('aria-pressed', x === c));
  });
};

// ---------- 투수 교체 창 ----------
const openBullpen = () => {
  // 공을 던지기 전이나, 다음 타석이 남은 결과 화면에서만 바꿀 수 있다
  const canChange = S.mode === 'pitch' && !aim.active && (S.phase === 'idle' || (S.phase === 'result' && G.next === 'pa'));
  if (!canChange) return hint('공이 오가는 동안에는 투수를 바꿀 수 없어요. 공을 던지기 전에 눌러 주세요.');
  const opts = bullpenOptions();
  const cur = currentPitcher();
  const fat = Math.round((1 - pitcherFatigue()) * 100);
  $('bullpenNow').textContent = `지금: ${cur.name} · ${currentPitchCount()}구 · 힘 ${fat}%`;
  $('bullpenList').innerHTML = opts.length
    ? opts.map(({ p, i }) => `<button class="pick" data-i="${i}">${p.name} <small>${p.throws === 'L' ? '좌투' : '우투'}`
      + ` · 제구 ${p.control} · 체력 ${p.stamina}<br>${Object.keys(p.pitches).map(k => PITCHES[k].name).join(', ')}</small></button>`).join('')
    : '<p>남은 불펜 투수가 없어요.</p>';
  $('bullpenList').querySelectorAll('.pick').forEach(btn => btn.onclick = () => {
    closeBullpen(); changePitcher(Number(btn.dataset.i));
  });
  $('bullpen').hidden = false;
};
const closeBullpen = () => { $('bullpen').hidden = true; };
// ---------- 관중석 위 큰 전광판: 상태가 바뀔 때만 다시 그린다 ----------
let boardKey = '';
const drawScoreboard = () => {
  const bs = battingSide(), b = currentBatter(), p = currentPitcher(), bx = batterBox();
  const cols = Math.max(G.innings, G.inning);
  const data = {
    names: [teamName('away'), teamName('home')], line: G.line, runs: G.runs, hits: G.hits, cols,
    inning: G.inning, top: G.top, bso: [G.balls, G.strikes, G.outs],
    batter: `${G.order[bs] + 1}번 ${b.name}`, rec: boxText(bx),
    pitcher: `${p.name}`, pc: currentPitchCount(), last: G.lastPitch,
  };
  const key = JSON.stringify(data);
  if (key === boardKey) return;
  boardKey = key;
  const ctx = boardTex.getContext(), W = BOARD_W, H = BOARD_H;
  const F = '"Do Hyeon", "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = '#0b1610'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#2c5a3c'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6);
  ctx.textBaseline = 'middle';
  // 라인 스코어: 팀 | 이닝 1..n | R H
  const x0 = 24, nameW = 290, rhW = 75, colW = Math.min(64, (W - x0 * 2 - nameW - rhW * 2) / cols);
  const rowY = [46, 104, 158];
  ctx.font = `30px ${F}`; ctx.fillStyle = '#9fb8a8'; ctx.textAlign = 'center';
  for (let i = 0; i < cols; i++) ctx.fillText(String(i + 1), x0 + nameW + colW * (i + 0.5), rowY[0]);
  ctx.fillText('R', x0 + nameW + colW * cols + rhW * 0.5, rowY[0]);
  ctx.fillText('H', x0 + nameW + colW * cols + rhW * 1.5, rowY[0]);
  ['away', 'home'].forEach((side, r) => {
    const y = rowY[r + 1], atBat = side === bs;
    ctx.textAlign = 'left'; ctx.font = `38px ${F}`; ctx.fillStyle = atBat ? '#ffc23d' : '#f3f1e6';
    ctx.fillText((atBat ? '▶ ' : '   ') + teamName(side), x0, y);
    ctx.textAlign = 'center'; ctx.fillStyle = '#f3f1e6';
    for (let i = 0; i < cols; i++) {
      const v = G.line[side][i];
      if (v != null) ctx.fillText(String(v), x0 + nameW + colW * (i + 0.5), y);
    }
    ctx.fillStyle = '#ffc23d'; ctx.font = `44px ${F}`;
    ctx.fillText(String(G.runs[side]), x0 + nameW + colW * cols + rhW * 0.5, y);
    ctx.fillStyle = '#f3f1e6';
    ctx.fillText(String(G.hits[side]), x0 + nameW + colW * cols + rhW * 1.5, y);
  });
  ctx.fillStyle = '#2c5a3c'; ctx.fillRect(x0, 192, W - x0 * 2, 3);
  // 볼·스트라이크·아웃 불
  const bulbs = (label, n, max, color, y) => {
    ctx.textAlign = 'left'; ctx.font = `36px ${F}`; ctx.fillStyle = '#f3f1e6'; ctx.fillText(label, x0 + 6, y);
    for (let i = 0; i < max; i++) {
      ctx.beginPath(); ctx.arc(x0 + 60 + i * 40, y, 13, 0, Math.PI * 2);
      ctx.fillStyle = i < n ? color : '#24372b'; ctx.fill();
    }
  };
  bulbs('B', G.balls, 3, '#ffc23d', 240); bulbs('S', G.strikes, 2, '#ff5a4a', 296); bulbs('O', G.outs, 2, '#ff5a4a', 352);
  ctx.textAlign = 'left'; ctx.font = `30px ${F}`; ctx.fillStyle = '#ffc23d';
  ctx.fillText(`${G.inning}회 ${G.top ? '초' : '말'}`, x0 + 6, 408);
  // 타자·투수·마지막 공
  const tx = 230;
  ctx.font = `30px ${F}`; ctx.fillStyle = '#9fb8a8'; ctx.fillText('타자', tx, 240);
  ctx.font = `40px ${F}`; ctx.fillStyle = '#f3f1e6'; ctx.fillText(`${data.batter}  ·  ${data.rec}`, tx + 80, 240);
  ctx.font = `30px ${F}`; ctx.fillStyle = '#9fb8a8'; ctx.fillText('투수', tx, 300);
  ctx.font = `40px ${F}`; ctx.fillStyle = '#f3f1e6'; ctx.fillText(`${p.name}  ·  투구 수 ${data.pc}`, tx + 80, 300);
  ctx.font = `30px ${F}`; ctx.fillStyle = '#9fb8a8'; ctx.fillText('직전 공', tx, 360);
  ctx.font = `44px ${F}`; ctx.fillStyle = '#ffc23d';
  ctx.fillText(G.lastPitch ? `${G.lastPitch.name}  ${G.lastPitch.kmh}km/h` : '-', tx + 110, 360);
  boardTex.update();
};

let bannerTimer = 0;
const banner = (text, sub = '', ms = 1300) => {
  const b = $('banner');
  b.innerHTML = text + (sub ? `<span class="sub">${sub}</span>` : '');
  b.classList.add('show');
  clearTimeout(bannerTimer);
  if (ms) bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
};
const hint = t => { $('hint').textContent = t; };
