// 화면 표시: 위쪽 전광판(이닝, 점수, 주자, 볼·스트라이크·아웃, 지금 타자), 결과 배너, 안내 문구

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
  const side = battingSide();
  $('stats').textContent = `${teamName(side)} ${G.order[side] + 1}번 타자 · ${S.mode === 'bat' ? '내가 타격' : '내가 투구'}`;
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
