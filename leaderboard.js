/* 合成 Tipsy🔥 · 本机排行榜（无网络、无第三方写入） */
(function () {
  'use strict';

  const BOARD_KEY = 'tipsy.board.v1';
  const NAME_KEY = 'tipsy.player.v1';
  const DEFAULT_NAME = '默认用户';
  const LIMIT = 20;

  const $ = (id) => document.getElementById(id);
  const listEl = $('boardList');
  const modal = $('boardModal');
  const msgEl = $('submitMsg');
  const nickInput = $('nickInput');
  const nameLabel = $('myNameLabel');
  const submitBtn = $('submitBtn');
  let lastScore = null;
  let lastRecordAt = 0;

  function cleanName(raw) {
    return String(raw || '')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 12);
  }

  function loadName() {
    try {
      return cleanName(localStorage.getItem(NAME_KEY));
    } catch (e) {
      return '';
    }
  }

  function myName() {
    return loadName() || DEFAULT_NAME;
  }

  function loadBoard() {
    try {
      const rows = JSON.parse(localStorage.getItem(BOARD_KEY) || '[]');
      if (!Array.isArray(rows)) return [];
      return rows
        .filter((row) => row && Number.isFinite(Number(row.score)))
        .map((row) => ({
          name: cleanName(row.name) || DEFAULT_NAME,
          score: Math.max(0, Math.floor(Number(row.score))),
          t: Number(row.t) || 0
        }))
        .sort((a, b) => (b.score - a.score) || (b.t - a.t))
        .slice(0, LIMIT);
    } catch (e) {
      return [];
    }
  }

  function saveBoard(rows) {
    try {
      localStorage.setItem(BOARD_KEY, JSON.stringify(rows));
    } catch (e) {
      /* 隐私模式或空间不足时，本局仍可正常玩。 */
    }
  }

  function paintName() {
    const name = myName();
    if (nameLabel) nameLabel.textContent = name;
    if (nickInput && document.activeElement !== nickInput) nickInput.value = loadName();
  }

  function setMsg(text) {
    if (msgEl) msgEl.textContent = text;
  }

  function renderBoard(myScore) {
    if (!listEl) return;
    const rows = loadBoard();
    listEl.textContent = '';

    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'board-empty';
      empty.textContent = '这台设备还没有成绩，先来一局吧！';
      listEl.appendChild(empty);
      return;
    }

    let marked = false;
    rows.forEach((row, index) => {
      const line = document.createElement('div');
      line.className = 'board-row';
      if (index === 0) line.classList.add('r1');
      if (index === 1) line.classList.add('r2');
      if (index === 2) line.classList.add('r3');
      if (!marked && myScore != null && row.score === myScore) {
        line.classList.add('is-mine');
        marked = true;
      }

      const rank = document.createElement('span');
      rank.className = 'board-rank';
      rank.textContent = index < 3 ? ['🥇', '🥈', '🥉'][index] : String(index + 1);

      const name = document.createElement('span');
      name.className = 'board-name';
      name.textContent = row.name;

      const score = document.createElement('span');
      score.className = 'board-score';
      score.textContent = row.score;

      line.appendChild(rank);
      line.appendChild(name);
      line.appendChild(score);
      listEl.appendChild(line);
    });
  }

  function open() {
    if (!modal) return;
    paintName();
    renderBoard(lastScore);
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  function close() {
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }

  function commitName() {
    const name = cleanName(nickInput && nickInput.value) || DEFAULT_NAME;
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch (e) {
      /* 忽略存储失败。 */
    }
    if (nickInput) nickInput.value = name === DEFAULT_NAME ? '' : name;
    paintName();
    renderBoard(lastScore);
  }

  function onGameOver(score) {
    const value = Math.max(0, Math.floor(Number(score) || 0));
    const now = Date.now();
    if (value === lastScore && now - lastRecordAt < 1000) return;

    lastScore = value;
    lastRecordAt = now;
    const rows = loadBoard();
    rows.push({ name: myName(), score: value, t: now });
    rows.sort((a, b) => (b.score - a.score) || (b.t - a.t));
    saveBoard(rows.slice(0, LIMIT));

    setMsg('本机成绩已记录');
    if (submitBtn) submitBtn.hidden = true;
    paintName();
    renderBoard(value);
  }

  function bind() {
    paintName();
    renderBoard(null);
    if (submitBtn) submitBtn.hidden = true;

    ['boardBtn', 'boardBtn2'].forEach((id) => {
      const button = $(id);
      if (button) button.addEventListener('click', open);
    });

    const closeBtn = $('boardClose');
    if (closeBtn) closeBtn.addEventListener('click', close);

    const refreshBtn = $('boardRefresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        paintName();
        renderBoard(lastScore);
      });
    }

    const editBtn = $('editNameBtn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        open();
        if (nickInput) {
          nickInput.focus();
          nickInput.select();
        }
      });
    }

    if (nickInput) {
      nickInput.addEventListener('change', commitName);
      nickInput.addEventListener('blur', commitName);
      nickInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          commitName();
          close();
        }
      });
    }

    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) close();
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.TipsyBoard = { open, close, onGameOver };
})();
