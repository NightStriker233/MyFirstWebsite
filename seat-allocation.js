/* ============================================================
 * 座位分配器 seat-allocation.js
 * - 可视化绘制教室座位布局（座位 / 空位，同桌分组自动留过道）
 * - 空格分隔输入名单，Fisher-Yates 随机分配
 * - 逐个座位动画演示（可跳过），结果可复制
 * 布局持久化于 localStorage；名单每次输入，不持久化。
 * ============================================================ */
'use strict';

/* ---------------- 常量 ---------------- */

const STORAGE_KEY = 'seatAllocationLayout_v2';

// 画笔类型：只有 seat 参与分配；gap 为固定过道列，不可绘制
const PAINT_TYPES = ['seat', 'empty'];

const DEFAULT_ROWS = 8;
const DEFAULT_SEAT_COLS = 7; // 每排座位数（两列一组自动加过道列）

// 生成布局：每两列座位为一组（同桌），组与组之间插入一列过道(gap)
function buildLayout(rows, seatCols) {
  const groups = Math.ceil(seatCols / 2);
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    let remaining = seatCols;
    for (let g = 0; g < groups; g++) {
      row.push('seat');
      remaining--;
      if (remaining > 0) { row.push('seat'); remaining--; }
      if (g < groups - 1) row.push('gap');
    }
    grid.push(row);
  }
  return { rows, seatCols, grid };
}

const DEFAULT_LAYOUT = buildLayout(DEFAULT_ROWS, DEFAULT_SEAT_COLS);

/* ---------------- 状态 ---------------- */

const state = {
  rows: DEFAULT_LAYOUT.rows,
  seatCols: DEFAULT_LAYOUT.seatCols,
  cols: DEFAULT_LAYOUT.grid[0].length, // 总列数（含过道列）
  grid: null,          // rows × cols 二维数组，值为 seat / empty / gap
  paint: 'seat',       // 当前画笔
  painting: false,     // 是否处于拖拽绘制中
  assigning: false,    // 是否正在动画分配中
  animTimer: null,     // 动画定时器句柄
  animIndex: 0,        // 动画当前进度
  names: [],           // 本次解析出的名单
  assigned: null,      // 本次分配结果 Map<"r,c", name>
  lastResultText: '',  // 最近一次结果文本（供复制）
};

/* ---------------- DOM 缓存 ---------------- */

const dom = {};

function cacheDom() {
  dom.rowInput = document.getElementById('rowInput');
  dom.colInput = document.getElementById('colInput');
  dom.genGridBtn = document.getElementById('genGridBtn');
  dom.resetLayoutBtn = document.getElementById('resetLayoutBtn');
  dom.seatGrid = document.getElementById('seatGrid');
  dom.nameInput = document.getElementById('nameInput');
  dom.nameCount = document.getElementById('nameCount');
  dom.startBtn = document.getElementById('startBtn');
  dom.skipBtn = document.getElementById('skipBtn');
  dom.againBtn = document.getElementById('againBtn');
  dom.copyBtn = document.getElementById('copyBtn');
  dom.seatResult = document.getElementById('seatResult');
  dom.resultGrid = document.getElementById('resultGrid');
  dom.resultStats = document.getElementById('resultStats');
  dom.resultText = document.getElementById('resultText');
  dom.copyTip = document.getElementById('copyTip');
}

/* ---------------- localStorage ---------------- */

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.grid) || !data.grid.length) return null;
    const validTypes = ['seat', 'empty', 'gap'];
    const w = data.grid[0].length;
    for (const row of data.grid) {
      if (!Array.isArray(row) || row.length !== w) return null;
      for (const t of row) if (!validTypes.includes(t)) return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

function saveLayout() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      rows: state.rows,
      seatCols: state.seatCols,
      grid: state.grid,
    }));
  } catch (e) { /* localStorage 不可用时静默忽略 */ }
}

/* ---------------- 布局编辑器 ---------------- */

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

// 每种格子类型的显示文字
function cellLabel(type) {
  switch (type) {
    case 'empty': return '✕';
    default:      return '';
  }
}

// 按输入的行列数生成「座位 + 过道」网格
function genGrid() {
  const rows = clamp(parseInt(dom.rowInput.value, 10) || 0, 1, 20);
  const seatCols = clamp(parseInt(dom.colInput.value, 10) || 0, 1, 20);
  dom.rowInput.value = rows;
  dom.colInput.value = seatCols;
  state.rows = rows;
  state.seatCols = seatCols;
  const layout = buildLayout(rows, seatCols);
  state.cols = layout.grid[0].length;
  state.grid = layout.grid;
  saveLayout();
  renderSeatGrid();
}

// 恢复默认布局（8 排，每排 7 座，两列一组自动过道）
function resetLayout() {
  state.rows = DEFAULT_LAYOUT.rows;
  state.seatCols = DEFAULT_LAYOUT.seatCols;
  state.cols = DEFAULT_LAYOUT.grid[0].length;
  state.grid = DEFAULT_LAYOUT.grid.map((row) => row.slice());
  dom.rowInput.value = state.rows;
  dom.colInput.value = state.seatCols;
  saveLayout();
  renderSeatGrid();
}

// 渲染 #seatGrid（编辑器网格）
function renderSeatGrid() {
  dom.seatGrid.style.setProperty('--cols', state.cols);
  dom.seatGrid.innerHTML = '';
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'seat-cell type-' + state.grid[r][c];
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.textContent = cellLabel(state.grid[r][c]);
      dom.seatGrid.appendChild(cell);
    }
  }
}

// 对指定格子应用当前画笔并持久化（过道列不可绘制）
function applyPaint(r, c) {
  if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) return;
  if (state.grid[r][c] === 'gap') return;
  state.grid[r][c] = state.paint;
  const cell = dom.seatGrid.children[r * state.cols + c];
  if (cell) {
    cell.className = 'seat-cell type-' + state.paint;
    cell.textContent = cellLabel(state.paint);
  }
  saveLayout();
}

function onGridMouseDown(e) {
  if (state.assigning) return;
  const cell = e.target.closest('.seat-cell');
  if (!cell) return;
  e.preventDefault();
  state.painting = true;
  applyPaint(parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10));
}

function onGridMouseOver(e) {
  if (!state.painting || state.assigning) return;
  const cell = e.target.closest('.seat-cell');
  if (!cell) return;
  applyPaint(parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10));
}

/* ---------------- 名单解析与随机分配 ---------------- */

// 解析名单：空格/换行/逗号/顿号/分号均可分隔
function parseNames() {
  return dom.nameInput.value
    .split(/[\s,，、;；]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// 可用座位数（只有 seat 类型参与分配）
function seatSlotCount() {
  return state.grid.flat().filter((t) => t === 'seat').length;
}

// 实时统计名单人数
function updateNameCount() {
  const names = parseNames();
  const warn = names.length > seatSlotCount();
  dom.nameCount.innerHTML = '已识别 <strong>' + names.length + '</strong> 人'
    + (warn ? '（超过座位数 <strong>' + seatSlotCount() + '</strong>，多出的人不会被分配）' : '');
  dom.nameCount.classList.toggle('warn', warn);
  return names.length;
}

// Fisher-Yates 洗牌（不修改原数组）
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 将名单随机填入可用座位：返回 Map<"r,c", name>，行优先填充
function assignSeats() {
  const slots = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c] === 'seat') slots.push([r, c]);
    }
  }
  const shuffled = shuffle(state.names);
  const assigned = new Map();
  const count = Math.min(slots.length, shuffled.length);
  for (let i = 0; i < count; i++) {
    assigned.set(slots[i][0] + ',' + slots[i][1], shuffled[i]);
  }
  return assigned;
}

/* ---------------- 演示动画与结果展示 ---------------- */

// 清空座位格，收集待填充的格子（按行优先，只含 seat 且被分配名字的）
function prepareAnimCells(assigned) {
  const cells = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = dom.seatGrid.children[r * state.cols + c];
      if (!cell) continue;
      if (state.grid[r][c] === 'seat') {
        const name = assigned.get(r + ',' + c) || '';
        cell.className = 'seat-cell type-seat' + (name ? ' filled' : '');
        cell.textContent = name;
        if (name) cells.push({ cell, name });
      }
    }
  }
  return cells;
}

// 开始分配：解析名单 → 洗牌 → 逐格动画
function startAssign() {
  if (state.assigning) return;
  const names = parseNames();
  if (names.length === 0) {
    alert('请先在「输入名单」中填写姓名（空格分隔）。');
    dom.nameInput.focus();
    return;
  }
  if (seatSlotCount() === 0) {
    alert('当前布局没有可用的「座位」格，请先用画笔把格子画为座位。');
    return;
  }
  state.names = names;
  state.assigned = assignSeats();

  const animCells = prepareAnimCells(state.assigned);
  if (animCells.length === 0) { finishAssign(); return; }

  state.assigning = true;
  state.animCells = animCells;
  state.animIndex = 0;
  dom.startBtn.classList.add('running');
  dom.skipBtn.disabled = false;
  dom.seatResult.classList.remove('visible');

  state.animTimer = setInterval(() => {
    if (state.animIndex >= state.animCells.length) {
      clearInterval(state.animTimer);
      finishAssign();
      return;
    }
    const { cell, name } = state.animCells[state.animIndex++];
    cell.className = 'seat-cell type-seat filled anim-pop';
    cell.textContent = name;
  }, 250);
}

// 跳过动画：立即填完所有格子
function skipAnim() {
  if (!state.assigning) return;
  clearInterval(state.animTimer);
  for (const { cell, name } of state.animCells) {
    cell.className = 'seat-cell type-seat filled';
    cell.textContent = name;
  }
  finishAssign();
}

// 动画结束收尾：更新按钮状态并展示完整结果
function finishAssign() {
  state.assigning = false;
  state.animCells = [];
  dom.startBtn.classList.remove('running');
  dom.skipBtn.disabled = true;
  dom.againBtn.disabled = false;
  dom.copyBtn.disabled = false;
  showResult();
}

// 计算字符串显示宽度（中文等宽字符按 2 计）
function displayWidth(s) {
  return [...s].reduce((n, ch) => n + (/[^\x00-\xff]/.test(ch) ? 2 : 1), 0);
}

// 生成可复制的纯文本座位表
function buildResultText() {
  const rows = [];
  for (let r = 0; r < state.rows; r++) {
    const line = [];
    for (let c = 0; c < state.cols; c++) {
      const type = state.grid[r][c];
      const name = state.assigned.get(r + ',' + c) || '';
      let text;
      if (type === 'seat') text = name || '空';
      else if (type === 'empty') text = '✕';
      else text = ' '; // gap 过道
      line.push(text);
    }
    // 按显示宽度对齐（补空格）
    const maxW = Math.max(...line.map(displayWidth));
    rows.push(line.map((t) => t + ' '.repeat(maxW - displayWidth(t))).join(' ').trimEnd());
  }
  return rows.join('\n');
}

// 展示完整结果：静态结果网格 + 统计 + 纯文本
function showResult() {
  dom.resultGrid.style.setProperty('--cols', state.cols);
  dom.resultGrid.innerHTML = '';
  let filled = 0;
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const type = state.grid[r][c];
      const name = state.assigned.get(r + ',' + c) || '';
      const cell = document.createElement('div');
      if (type === 'seat' && name) {
        cell.className = 'result-cell type-seat filled';
        cell.textContent = name;
        filled++;
      } else if (type === 'seat') {
        cell.className = 'result-cell type-seat';
        cell.textContent = '';
      } else {
        cell.className = 'result-cell type-' + type;
        cell.textContent = cellLabel(type);
      }
      dom.resultGrid.appendChild(cell);
    }
  }
  const total = seatSlotCount();
  dom.resultStats.innerHTML = '座位数 <strong>' + total + '</strong>'
    + ' · 已分配 <strong>' + filled + '</strong>'
    + ' · 空座 <strong>' + (total - filled) + '</strong>'
    + ' · 名单 <strong>' + state.names.length + '</strong> 人';
  dom.resultText.value = buildResultText();
  dom.seatResult.classList.add('visible');
  dom.seatResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 复制纯文本结果到剪贴板
function copyResult() {
  const text = dom.resultText.value;
  const done = () => {
    dom.copyTip.classList.add('show');
    setTimeout(() => dom.copyTip.classList.remove('show'), 2000);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  dom.resultText.style.display = 'block';
  dom.resultText.select();
  try {
    document.execCommand('copy');
    done();
  } catch (e) { /* 忽略 */ }
  dom.resultText.style.display = 'none';
}

/* ---------------- 事件绑定 ---------------- */

function bindEvents() {
  dom.genGridBtn.addEventListener('click', genGrid);
  dom.resetLayoutBtn.addEventListener('click', resetLayout);

  // 画笔切换
  const paintBtns = document.querySelectorAll('.paint-btn');
  paintBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.paint = btn.dataset.paint;
      paintBtns.forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  // 格子点击 / 拖拽绘制
  dom.seatGrid.addEventListener('mousedown', onGridMouseDown);
  dom.seatGrid.addEventListener('mouseover', onGridMouseOver);
  document.addEventListener('mouseup', () => { state.painting = false; });

  // 名单实时统计
  dom.nameInput.addEventListener('input', updateNameCount);

  // 分配与结果
  dom.startBtn.addEventListener('click', startAssign);
  dom.skipBtn.addEventListener('click', skipAnim);
  dom.againBtn.addEventListener('click', startAssign);
  dom.copyBtn.addEventListener('click', copyResult);
}

/* ---------------- 启动 ---------------- */

function init() {
  cacheDom();
  const saved = loadLayout();
  if (saved) {
    state.rows = saved.rows;
    state.seatCols = saved.seatCols;
    state.cols = saved.grid[0].length;
    state.grid = saved.grid;
  } else {
    state.rows = DEFAULT_LAYOUT.rows;
    state.seatCols = DEFAULT_LAYOUT.seatCols;
    state.cols = DEFAULT_LAYOUT.grid[0].length;
    state.grid = DEFAULT_LAYOUT.grid.map((row) => row.slice());
  }
  dom.rowInput.value = state.rows;
  dom.colInput.value = state.seatCols;
  bindEvents();
  renderSeatGrid();
}

document.addEventListener('DOMContentLoaded', init);
