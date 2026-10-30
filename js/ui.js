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
let bannerTimer = 0;
const banner = (text, sub = '', ms = 1300) => {
  const b = $('banner');
  b.innerHTML = text + (sub ? `<span class="sub">${sub}</span>` : '');
  b.classList.add('show');
  clearTimeout(bannerTimer);
  if (ms) bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
};
const hint = t => { $('hint').textContent = t; };
