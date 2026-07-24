// Tab 切换
document.querySelectorAll('.tools-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tools-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tools-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ===================== 💣 扫雷 =====================
(function () {
  const ROWS = 12, COLS = 12, MINES = 16, CELL = 36;
  const canvas = document.getElementById('mineCanvas'), ctx = canvas.getContext('2d');
  const status = document.getElementById('mineStatus'), timerEl = document.getElementById('mineTimer');
  let board, revealed, flagged, gameOver, mineCount, timer, startTime;

  function init() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    revealed = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    flagged = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    gameOver = false; mineCount = MINES; clearInterval(timer); timer = null; startTime = null;
    status.textContent = '💣 ' + MINES; timerEl.textContent = '⏱ 0';
    // 随机布雷
    let placed = 0;
    while (placed < MINES) {
      const r = Math.floor(Math.random() * ROWS), c = Math.floor(Math.random() * COLS);
      if (board[r][c] === -1) continue;
      board[r][c] = -1; placed++;
    }
    // 计算数字
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] === -1) continue;
        let cnt = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === -1) cnt++;
          }
        board[r][c] = cnt;
      }
    canvas.width = COLS * CELL; canvas.height = ROWS * CELL;
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const x = c * CELL, y = r * CELL;
        if (revealed[r][c]) {
          ctx.fillStyle = '#E8E4E0'; ctx.fillRect(x, y, CELL, CELL);
          if (board[r][c] === -1) { ctx.fillStyle = '#DC2626'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💣', x + CELL / 2, y + CELL / 2 + 7); }
          else if (board[r][c] > 0) { const colors = ['', '#2563EB', '#16A34A', '#DC2626', '#7C3AED', '#B45309', '#0891B2', '#1E293B', '#64748B']; ctx.fillStyle = colors[board[r][c]]; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(board[r][c], x + CELL / 2, y + CELL / 2 + 6); }
        } else {
          ctx.fillStyle = flagged[r][c] ? '#FEF2F2' : '#fff';
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          ctx.strokeStyle = '#C4B5A5'; ctx.strokeRect(x + 0.5, y + 0.5, CELL, CELL);
          if (flagged[r][c]) { ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🚩', x + CELL / 2, y + CELL / 2 + 6); }
        }
        if (gameOver && board[r][c] === -1 && !revealed[r][c] && !flagged[r][c]) { ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💣', x + CELL / 2, y + CELL / 2 + 6); }
      }
  }

  function reveal(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS || revealed[r][c] || flagged[r][c] || gameOver) return;
    revealed[r][c] = true;
    if (board[r][c] === -1) { gameOver = true; clearInterval(timer); status.textContent = '💥 输了'; draw(); return; }
    if (board[r][c] === 0) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) reveal(r + dr, c + dc);
    // 检查胜利
    let win = true;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!revealed[r][c] && board[r][c] !== -1) win = false;
    if (win) { gameOver = true; clearInterval(timer); status.textContent = '🎉 赢了！'; }
    draw();
  }

  canvas.addEventListener('click', e => {
    if (gameOver) return;
    if (!startTime) { startTime = Date.now(); timer = setInterval(() => { timerEl.textContent = '⏱ ' + Math.floor((Date.now() - startTime) / 1000); }, 200); }
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / CELL), r = Math.floor((e.clientY - rect.top) / CELL);
    reveal(r, c);
  });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / CELL), r = Math.floor((e.clientY - rect.top) / CELL);
    if (revealed[r][c]) return;
    flagged[r][c] = !flagged[r][c];
    mineCount += flagged[r][c] ? -1 : 1;
    status.textContent = '💣 ' + mineCount;
    draw();
  });

  document.getElementById('mineReset').addEventListener('click', init);
  init();
})();

// ===================== 🔢 2048 =====================
(function () {
  const boardEl = document.getElementById('tfeBoard'), scoreEl = document.getElementById('tfeScore');
  let grid, score, gameOver;
  const SIZE = 4;

  function init() {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    score = 0; gameOver = false; scoreEl.textContent = '0';
    addTile(); addTile(); render();
  }

  function addTile() {
    const empty = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] === 0) empty.push({ r, c });
    if (empty.length === 0) return;
    const { r, c } = empty[Math.floor(Math.random() * empty.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }

  function slide(row) { const arr = row.filter(v => v); for (let i = 0; i < arr.length - 1; i++) if (arr[i] === arr[i + 1]) { arr[i] *= 2; score += arr[i]; arr.splice(i + 1, 1); } while (arr.length < SIZE) arr.push(0); return arr; }

  function move(dx, dy) {
    let moved = false;
    const old = grid.map(r => [...r]);
    if (dx !== 0) for (let r = 0; r < SIZE; r++) { const row = grid[r]; const arr = dx > 0 ? slide([...row].reverse()).reverse() : slide(row); for (let c = 0; c < SIZE; c++) grid[r][c] = arr[c]; }
    if (dy !== 0) for (let c = 0; c < SIZE; c++) { const col = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]]; const arr = dy > 0 ? slide([...col].reverse()).reverse() : slide(col); for (let r = 0; r < SIZE; r++) grid[r][c] = arr[r]; }
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] !== old[r][c]) moved = true;
    if (moved) { addTile(); render(); scoreEl.textContent = score; }
  }

  function render() {
    boardEl.innerHTML = '';
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'tfe-cell tfe-' + grid[r][c];
      cell.textContent = grid[r][c] || '';
      boardEl.appendChild(cell);
    }
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') move(0, -1);
    if (e.key === 'ArrowDown') move(0, 1);
    if (e.key === 'ArrowLeft') move(-1, 0);
    if (e.key === 'ArrowRight') move(1, 0);
  });

  // 触屏滑动
  let touchStartX = 0, touchStartY = 0;
  boardEl.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  boardEl.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    e.preventDefault();
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
    else move(0, dy > 0 ? 1 : -1);
  });

  document.getElementById('tfeReset').addEventListener('click', init);
  init();
})();

// ===================== 🧩 生命游戏 =====================
(function () {
  const CELL = 12, ROWS = 35, COLS = 50;
  const canvas = document.getElementById('lifeCanvas'), ctx = canvas.getContext('2d');
  const genEl = document.getElementById('lifeGen');
  let grid, gen, playing, timer;

  function init() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    gen = 0; playing = false; clearInterval(timer);
    genEl.textContent = '0';
    document.getElementById('lifePlay').textContent = '▶ 播放';
    canvas.width = COLS * CELL; canvas.height = ROWS * CELL;
    draw();
  }

  function step() {
    const next = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = (r + dr + ROWS) % ROWS, nc = (c + dc + COLS) % COLS;
          if (grid[nr][nc]) n++;
        }
        if (grid[r][c]) next[r][c] = (n === 2 || n === 3) ? 1 : 0;
        else next[r][c] = (n === 3) ? 1 : 0;
      }
    grid = next; gen++;
    genEl.textContent = gen;
    draw();
  }

  function draw() {
    const w = COLS * CELL, h = ROWS * CELL;
    if (!draw.buf || draw.buf.width !== w || draw.buf.height !== h) {
      draw.buf = ctx.createImageData(w, h);
    }
    const data = draw.buf.data;
    // 背景色 #1E293B
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 30; data[i + 1] = 41; data[i + 2] = 59; data[i + 3] = 255;
    }
    // 活细胞 #4ADE80，留 1px 间隙
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (!grid[r][c]) continue;
        const x0 = c * CELL + 1, y0 = r * CELL + 1;
        const x1 = x0 + CELL - 2, y1 = y0 + CELL - 2;
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const i = (y * w + x) * 4;
            data[i] = 74; data[i + 1] = 222; data[i + 2] = 128; data[i + 3] = 255;
          }
      }
    ctx.putImageData(draw.buf, 0, 0);
  }

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / CELL), r = Math.floor((e.clientY - rect.top) / CELL);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) { grid[r][c] = grid[r][c] ? 0 : 1; draw(); }
  });

  document.getElementById('lifePlay').addEventListener('click', () => {
    playing = !playing;
    document.getElementById('lifePlay').textContent = playing ? '⏸ 暂停' : '▶ 播放';
    if (playing) timer = setInterval(step, 120); else clearInterval(timer);
  });
  document.getElementById('lifeStep').addEventListener('click', step);
  document.getElementById('lifeClear').addEventListener('click', init);

  init();
})();
