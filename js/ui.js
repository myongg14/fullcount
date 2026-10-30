// 화면 표시: 위쪽 전광판(볼·스트라이크·아웃, 기록), 결과 배너, 안내 문구

// ---------- 전광판 ----------
const renderBoard = () => {
  const set = (cls, n) => document.querySelectorAll('.' + cls + ' .bulb').forEach((b, i) => b.classList.toggle('on', i < n));
  set('b', S.balls); set('s', S.strikes); set('o', S.outs);
  const st = S.stats;
  $('stats').textContent = S.mode === 'bat'
    ? `타석 ${st.pa} · 안타 ${st.hit} · 홈런 ${st.hr} · 삼진 ${st.k}`
    : `상대 타자 ${st.pa} · 피안타 ${st.hit} · 피홈런 ${st.hr} · 탈삼진 ${st.k}`;
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
