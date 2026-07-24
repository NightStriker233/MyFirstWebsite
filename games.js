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

// ===================== 🕹 贪吃蛇 =====================
(function () {
  const CELL = 18, COLS = 25, ROWS = 22;
  const canvas = document.getElementById('snakeCanvas'), ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('snakeScore');
  let snake, food, dir, nextDir, score, interval, running;

  function init() {
    snake = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
    dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 };
    score = 0; running = true; clearInterval(interval);
    scoreEl.textContent = '0';
    canvas.width = COLS * CELL; canvas.height = ROWS * CELL;
    placeFood();
    interval = setInterval(tick, 100);
    draw();
  }

  function placeFood() {
    const occupied = new Set(snake.map(s => s.x + ',' + s.y));
    do { food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
    while (occupied.has(food.x + ',' + food.y));
  }

  function tick() {
    if (!running) return;
    dir = { ...nextDir };
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || snake.some(s => s.x === head.x && s.y === head.y)) { running = false; clearInterval(interval); scoreEl.textContent = score + ' 💀'; draw(); return; }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) { score += 10; scoreEl.textContent = score; placeFood(); }
    else snake.pop();
    draw();
  }

  function draw() {
    ctx.fillStyle = '#1E293B'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    snake.forEach((s, i) => { ctx.fillStyle = i === 0 ? '#4ADE80' : '#22C55E'; ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2); });
    ctx.fillStyle = '#EF4444'; ctx.beginPath(); ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2); ctx.fill();
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' && dir.y !== 1) nextDir = { x: 0, y: -1 };
    if (e.key === 'ArrowDown' && dir.y !== -1) nextDir = { x: 0, y: 1 };
    if (e.key === 'ArrowLeft' && dir.x !== 1) nextDir = { x: -1, y: 0 };
    if (e.key === 'ArrowRight' && dir.x !== -1) nextDir = { x: 1, y: 0 };
  });

  document.getElementById('snakeReset').addEventListener('click', init);
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
    ctx.fillStyle = '#1E293B'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c]) { ctx.fillStyle = '#4ADE80'; ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2); }
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
