/* ============================================================
 * 座位分配器 seat-allocation.js
 * - 可视化绘制教室座位布局（座位 / 空位，同桌分组自动留过道）
 * - 姓名支持「张三（男）」性别标注，男女同桌优先，
 *   无法避免时同性同桌并以橙色标注
 * - 翻牌动画逐个揭晓（可跳过），结果直接显示在网格上
 * - 结果出来后锁定布局编辑，可清空结果重新编辑
 * - 导出：纯文本（含同性标注）/ 制表符表格 / 下载 CSV 文件
 * 布局持久化于 localStorage；名单每次输入，不持久化。
 * ============================================================ */
'use strict';

/* ---------------- 常量 ---------------- */

const STORAGE_KEY = 'seatAllocationLayout_v3';

// 画笔类型：只有 seat 参与分配；gap 为固定过道列，不可绘制
const PAINT_TYPES = ['seat', 'empty'];

const DEFAULT_ROWS = 6;
const DEFAULT_SEAT_COLS = 8; // 每排座位数（两列一组自动加过道列）
const GAP_WIDTH = '16px';    // 过道列宽（窄）

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
  animCells: [],       // 待翻牌的格子列表
  names: [],           // 本次解析出的名单 [{name, gender}]
  assigned: null,      // 分配结果 Map<"r,c", name>；null = 未分配
  sameSexKeys: null,   // 同性同桌的格子 key 集合
  filled: false,       // 是否已完成一次分配（网格显示名字，布局锁定）
};

/* ---------------- DOM 缓存 ---------------- */

const dom = {};

function cacheDom() {
  dom.rowInput = document.getElementById('rowInput');
  dom.colInput = document.getElementById('colInput');
  dom.genGridBtn = document.getElementById('genGridBtn');
  dom.resetLayoutBtn = document.getElementById('resetLayoutBtn');
  dom.seatGrid = document.getElementById('seatGrid');
  dom.seatStatus = document.getElementById('seatStatus');
  dom.nameInput = document.getElementById('nameInput');
  dom.nameCount = document.getElementById('nameCount');
  dom.startBtn = document.getElementById('startBtn');
  dom.skipBtn = document.getElementById('skipBtn');
  dom.clearBtn = document.getElementById('clearBtn');
  dom.copyTextBtn = document.getElementById('copyTextBtn');
  dom.copyExcelBtn = document.getElementById('copyExcelBtn');
  dom.downloadCsvBtn = document.getElementById('downloadCsvBtn');
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

// 按列类型设置列宽模板：座位列弹性自适应，过道列固定窄
function setGridColumns() {
  const widths = [];
  for (let c = 0; c < state.cols; c++) {
    widths.push(state.grid[0][c] === 'gap' ? GAP_WIDTH : 'minmax(26px, 1fr)');
  }
  dom.seatGrid.style.gridTemplateColumns = widths.join(' ');
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
  clearAssignment(true);
  setGridColumns();
  renderSeatGrid();
}

// 恢复默认布局
function resetLayout() {
  state.rows = DEFAULT_LAYOUT.rows;
  state.seatCols = DEFAULT_LAYOUT.seatCols;
  state.cols = DEFAULT_LAYOUT.grid[0].length;
  state.grid = DEFAULT_LAYOUT.grid.map((row) => row.slice());
  dom.rowInput.value = state.rows;
  dom.colInput.value = state.seatCols;
  saveLayout();
  clearAssignment(true);
  setGridColumns();
  renderSeatGrid();
}

// 渲染 #seatGrid（类型视图：座位/空位/过道）
function renderSeatGrid() {
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
  if (state.assigning || state.filled) return; // 动画中/结果出来后不可编辑
  const cell = e.target.closest('.seat-cell');
  if (!cell) return;
  e.preventDefault();
  state.painting = true;
  applyPaint(parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10));
}

function onGridMouseOver(e) {
  if (!state.painting || state.assigning || state.filled) return;
  const cell = e.target.closest('.seat-cell');
  if (!cell) return;
  applyPaint(parseInt(cell.dataset.row, 10), parseInt(cell.dataset.col, 10));
}

/* ---------------- 名单解析与随机分配 ---------------- */

// 解析名单：空格/换行/逗号/顿号/分号分隔；姓名后可带（男）/（女）标注
function parseNames() {
  return dom.nameInput.value
    .split(/[\s,，、;；]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const m = s.match(/^(.+?)[（(]\s*(男|女)\s*[）)]$/);
      if (m) return { name: m[1].trim(), gender: m[2] };
      return { name: s, gender: '' };
    });
}

// 可用座位数（只有 seat 类型参与分配）
function seatSlotCount() {
  return state.grid.flat().filter((t) => t === 'seat').length;
}

// 实时统计名单人数（含性别分布）
function updateNameCount() {
  const names = parseNames();
  const warn = names.length > seatSlotCount();
  const males = names.filter((p) => p.gender === '男').length;
  const females = names.filter((p) => p.gender === '女').length;
  const unknown = names.length - males - females;
  let info = '已识别 <strong>' + names.length + '</strong> 人（男 ' + males + ' · 女 ' + females;
  if (unknown > 0) info += ' · 未标注 ' + unknown;
  info += '）';
  if (warn) info += '，超过座位数 <strong>' + seatSlotCount() + '</strong>，多出的人不会被分配';
  dom.nameCount.innerHTML = info;
  dom.nameCount.classList.toggle('warn', warn);
  updateStatus();
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

// 按行优先收集座位「同桌组」（每 2 个相邻座位一组）
function collectSeatGroups() {
  const groups = [];
  for (let r = 0; r < state.rows; r++) {
    let pair = [];
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c] === 'seat') {
        pair.push([r, c]);
        if (pair.length === 2) { groups.push(pair); pair = []; }
      }
    }
    if (pair.length) groups.push(pair);
  }
  return groups;
}

// 按性别配对学生：男女同桌优先，剩余同类配对（标记同性），未知性别自由搭配
function buildStudentGroups() {
  const males = [], females = [], unknowns = [];
  for (const p of state.names) {
    if (p.gender === '男') males.push(p.name);
    else if (p.gender === '女') females.push(p.name);
    else unknowns.push(p.name);
  }

  const groups = [];

  // 1. 男女同桌（优先）
  while (males.length && females.length) {
    groups.push({ seats: [males.pop(), females.pop()], sameSex: false });
  }

  // 2. 剩余同类配对（男多或女多），标注同性
  const rest = males.length ? males : females;
  while (rest.length >= 2) {
    groups.push({ seats: [rest.pop(), rest.pop()], sameSex: true });
  }

  // 3. 剩余单人先与未标注性别者搭配
  const leftover = [];
  if (rest.length) leftover.push(rest.pop());
  while (unknowns.length && leftover.length) {
    groups.push({ seats: [leftover.pop(), unknowns.pop()], sameSex: false });
  }

  // 4. 未标注者两两搭配
  while (unknowns.length >= 2) {
    groups.push({ seats: [unknowns.pop(), unknowns.pop()], sameSex: false });
  }
  if (unknowns.length) leftover.push(unknowns.pop());

  // 5. 总人数为奇数时，最后一人单独成组
  if (leftover.length) {
    groups.push({ seats: [leftover.pop()], sameSex: false });
  }

  // 随机化：组顺序与组内顺序都打乱
  shuffle(groups);
  for (const g of groups) shuffle(g.seats);
  return groups;
}

// 将配对结果填入座位：返回 { assigned, sameSexKeys }
function assignSeats() {
  const seatGroups = collectSeatGroups();
  const studentGroups = buildStudentGroups();
  const assigned = new Map();
  const sameSexKeys = new Set();
  const n = Math.min(seatGroups.length, studentGroups.length);
  for (let i = 0; i < n; i++) {
    const sg = seatGroups[i];
    const g = studentGroups[i];
    for (let j = 0; j < g.seats.length && j < sg.length; j++) {
      const [r, c] = sg[j];
      assigned.set(r + ',' + c, g.seats[j]);
      if (g.sameSex) sameSexKeys.add(r + ',' + c);
    }
  }
  return { assigned, sameSexKeys };
}

/* ---------------- 编辑锁定 ---------------- */

// 结果出来后 / 动画中锁定布局编辑；「清空结果」可解锁
function updateEditLock() {
  const locked = state.assigning || state.filled;
  dom.genGridBtn.disabled = locked;
  dom.resetLayoutBtn.disabled = locked;
  document.querySelectorAll('.paint-btn').forEach((b) => { b.disabled = locked; });
  dom.clearBtn.disabled = !state.filled;
}

/* ---------------- 演示动画（翻牌揭晓） ---------------- */

// 将待分配座位设为「背面」状态并收集翻牌列表（不提前显示名字）
function prepareAnimCells(assigned, sameSexKeys) {
  const cells = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = dom.seatGrid.children[r * state.cols + c];
      if (!cell) continue;
      if (state.grid[r][c] === 'seat') {
        const name = assigned.get(r + ',' + c) || '';
        if (name) {
          const same = sameSexKeys.has(r + ',' + c);
          cell.className = 'seat-cell type-seat pending';
          cell.textContent = '?';
          cells.push({ cell, name, same });
        } else {
          cell.className = 'seat-cell type-seat';
          cell.textContent = '';
        }
      }
    }
  }
  return cells;
}

// 填充名字到格子（含同性同桌标注）
function fillCell(cell, name, same, withAnim) {
  cell.className = 'seat-cell type-seat filled' + (same ? ' same' : '') + (withAnim ? ' flip' : '');
  cell.innerHTML = name + (same ? '<span class="same-tag">同</span>' : '');
}

// 开始分配：解析名单 → 配对洗牌 → 翻牌动画
function startAssign() {
  if (state.assigning) return;
  const names = parseNames();
  if (names.length === 0) {
    alert('请先在「输入名单」中填写姓名（空格分隔，姓名后可加（男/女））。');
    dom.nameInput.focus();
    return;
  }
  if (seatSlotCount() === 0) {
    alert('当前布局没有可用的「座位」格，请先用画笔把格子画为座位。');
    return;
  }
  state.names = names;
  const { assigned, sameSexKeys } = assignSeats();
  state.assigned = assigned;
  state.sameSexKeys = sameSexKeys;

  const animCells = prepareAnimCells(state.assigned, state.sameSexKeys);
  if (animCells.length === 0) { finishAssign(); return; }

  state.assigning = true;
  state.animCells = animCells;
  state.animIndex = 0;
  dom.startBtn.disabled = true;
  dom.skipBtn.disabled = false;
  dom.copyTextBtn.disabled = true;
  dom.copyExcelBtn.disabled = true;
  dom.downloadCsvBtn.disabled = true;
  updateEditLock();
  updateStatus();

  state.animTimer = setInterval(() => {
    if (state.animIndex >= state.animCells.length) {
      clearInterval(state.animTimer);
      finishAssign();
      return;
    }
    const { cell, name, same } = state.animCells[state.animIndex++];
    fillCell(cell, name, same, true); // 翻牌
  }, 260);
}

// 跳过动画：立即翻完所有牌
function skipAnim() {
  if (!state.assigning) return;
  clearInterval(state.animTimer);
  for (const { cell, name, same } of state.animCells) {
    fillCell(cell, name, same, false);
  }
  finishAssign();
}

// 动画结束收尾：更新按钮状态与统计（布局锁定）
function finishAssign() {
  state.assigning = false;
  state.animCells = [];
  state.filled = true;
  dom.startBtn.disabled = false;
  dom.startBtn.textContent = '🔄 再抽一次';
  dom.skipBtn.disabled = true;
  dom.copyTextBtn.disabled = false;
  dom.copyExcelBtn.disabled = false;
  dom.downloadCsvBtn.disabled = false;
  updateEditLock();
  updateStatus();
}

// 清空分配结果，恢复编辑模式
function clearAssignment(skipRender) {
  if (!state.filled && !state.assigned && !state.assigning) {
    updateEditLock();
    if (!skipRender) renderSeatGrid();
    return;
  }
  if (state.assigning) clearInterval(state.animTimer);
  state.assigning = false;
  state.animCells = [];
  state.assigned = null;
  state.sameSexKeys = null;
  state.filled = false;
  dom.startBtn.disabled = false;
  dom.startBtn.textContent = '🎲 开始分配';
  dom.skipBtn.disabled = true;
  dom.copyTextBtn.disabled = true;
  dom.copyExcelBtn.disabled = true;
  dom.downloadCsvBtn.disabled = true;
  updateEditLock();
  if (!skipRender) {
    renderSeatGrid();
    updateStatus();
  }
}

// 网格上方状态行：座位 / 已分配 / 空座 / 名单 / 同性同桌
function updateStatus() {
  const total = seatSlotCount();
  const filled = state.filled && state.assigned ? state.assigned.size : 0;
  const sameGroups = state.sameSexKeys ? Math.round(state.sameSexKeys.size / 2) : 0;
  let html = '座位 <strong>' + total + '</strong>'
    + ' · 已分配 <strong>' + filled + '</strong>'
    + ' · 空座 <strong>' + (total - filled) + '</strong>'
    + ' · 名单 <strong>' + state.names.length + '</strong> 人';
  if (sameGroups > 0) html += ' · <span style="color:#B45309">同性同桌 ' + sameGroups + ' 组</span>';
  dom.seatStatus.innerHTML = html;
}

/* ---------------- 导出 ---------------- */

// 计算字符串显示宽度（中文等宽字符按 2 计）
function displayWidth(s) {
  return [...s].reduce((n, ch) => n + (/[^\x00-\xff]/.test(ch) ? 2 : 1), 0);
}

// 生成纯文本座位表（同性同桌名字后加 *，末尾附说明）
function buildResultText() {
  const rows = [];
  for (let r = 0; r < state.rows; r++) {
    const line = [];
    for (let c = 0; c < state.cols; c++) {
      const type = state.grid[r][c];
      const name = state.assigned ? (state.assigned.get(r + ',' + c) || '') : '';
      let text;
      if (type === 'seat') {
        text = name || '空';
        if (name && state.sameSexKeys && state.sameSexKeys.has(r + ',' + c)) text += '*';
      } else if (type === 'empty') text = '✕';
      else text = ' '; // gap 过道
      line.push(text);
    }
    const maxW = Math.max(...line.map(displayWidth));
    rows.push(line.map((t) => t + ' '.repeat(maxW - displayWidth(t))).join(' ').trimEnd());
  }
  if (state.sameSexKeys && state.sameSexKeys.size > 0) {
    rows.push('');
    rows.push('（* 标注 = 同性同桌）');
  }
  return rows.join('\n');
}

function csvEscape(s) {
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// 生成 CSV 文件内容（逗号分隔 + BOM，供下载；不含标注保持干净）
function buildCsvFile() {
  const rows = [];
  for (let r = 0; r < state.rows; r++) {
    const line = [];
    for (let c = 0; c < state.cols; c++) {
      const type = state.grid[r][c];
      if (type !== 'seat') { line.push(''); continue; }
      line.push(csvEscape(state.assigned ? (state.assigned.get(r + ',' + c) || '') : ''));
    }
    rows.push(line.join(','));
  }
  return '\uFEFF' + rows.join('\r\n');
}

// 生成制表符分隔表格（Excel 粘贴自动分列；不含标注保持干净）
function buildTsv() {
  const rows = [];
  for (let r = 0; r < state.rows; r++) {
    const line = [];
    for (let c = 0; c < state.cols; c++) {
      const type = state.grid[r][c];
      if (type !== 'seat') { line.push(''); continue; }
      line.push(state.assigned ? (state.assigned.get(r + ',' + c) || '') : '');
    }
    rows.push(line.join('\t'));
  }
  return rows.join('\r\n');
}

// 复制到剪贴板（优先 Clipboard API，失败回退 execCommand）
function copyText(text, btn) {
  const orig = btn.textContent;
  const done = () => {
    btn.textContent = '✓ 已复制';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    done();
  } catch (e) { /* 忽略 */ }
  document.body.removeChild(ta);
}

function copyResultText() {
  if (!state.filled || !state.assigned) return;
  copyText(buildResultText(), dom.copyTextBtn);
}

function copyResultExcel() {
  if (!state.filled || !state.assigned) return;
  copyText(buildTsv(), dom.copyExcelBtn);
}

// 下载 .csv 文件（Excel 打开不乱码、自动分列）
function downloadCsv() {
  if (!state.filled || !state.assigned) return;
  const blob = new Blob([buildCsvFile()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '座位表.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------------- 事件绑定 ---------------- */

function bindEvents() {
  dom.genGridBtn.addEventListener('click', genGrid);
  dom.resetLayoutBtn.addEventListener('click', resetLayout);
  dom.clearBtn.addEventListener('click', () => clearAssignment(false));

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

  // 分配、跳过、导出
  dom.startBtn.addEventListener('click', startAssign);
  dom.skipBtn.addEventListener('click', skipAnim);
  dom.copyTextBtn.addEventListener('click', copyResultText);
  dom.copyExcelBtn.addEventListener('click', copyResultExcel);
  dom.downloadCsvBtn.addEventListener('click', downloadCsv);
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
  setGridColumns();
  renderSeatGrid();
  updateEditLock();
  updateStatus();
}

document.addEventListener('DOMContentLoaded', init);
