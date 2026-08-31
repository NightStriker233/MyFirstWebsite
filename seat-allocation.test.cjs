// 座位分配逻辑回归测试（运行：node --test seat-allocation.test.cjs）
// 覆盖：默认布局、导入解析、小组横移、整行后移、人调换+同性重算、保存数据往返、URL key 提取
'use strict';
const fs = require('fs');

/* ---------------- DOM mock ---------------- */
function makeEl(tag) {
  const cls = { values: new Set(), toggle: function (n, f) { if (f === undefined) f = !this.values.has(n); if (f) this.values.add(n); else this.values.delete(n); }, add: function (n) { this.values.add(n); }, remove: function (n) { this.values.delete(n); } };
  const el = { tag, children: [], className: '', textContent: '', dataset: {}, style: {}, value: '', disabled: false, addEventListener: () => {}, appendChild(c) { this.children.push(c); }, querySelectorAll: () => [], classList: cls, focus: () => {}, select: () => {}, click: () => {}, removeChild: () => {} };
  let ih = '';
  Object.defineProperty(el, 'innerHTML', { get: () => ih, set: (v) => { ih = v; if (v === '') el.children.length = 0; } });
  return el;
}
const store = {}; const els = {}; const alerts = [];
const ids = ['rowInput','colInput','genGridBtn','resetLayoutBtn','seatGrid','seatStatus','nameInput','nameCount','startBtn','skipBtn','clearBtn','copyTextBtn','copyExcelBtn','downloadCsvBtn','importText','importBtn','importFile','shiftLeftBtn','shiftBackBtn','saveKeyInput','saveBtn','copyLinkBtn','saveLink'];
ids.forEach(id => { els[id] = makeEl('div'); });
els.seatGrid.style = { setProperty: () => {} };
els.startBtn.textContent = 'S'; els.skipBtn.textContent = 'K'; els.clearBtn.textContent = 'C';
els.copyTextBtn.textContent = 'T'; els.copyExcelBtn.textContent = 'E'; els.downloadCsvBtn.textContent = 'D';
global.alert = (m) => alerts.push(m);
global.document = { getElementById: (id) => els[id], createElement: (t) => makeEl(t), querySelectorAll: () => [], addEventListener: () => {}, execCommand: () => true, body: makeEl('body') };
global.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => {} } }, configurable: true });
global.URL = { createObjectURL: () => 'blob:m', revokeObjectURL: () => {} };
global.window = { location: { search: '', pathname: '/SeatAllocation.html', origin: 'https://nightstriker.top' } };

/* ---------------- 加载生产代码 + 注册测试 ---------------- */
const code = fs.readFileSync(__dirname + '/seat-allocation.js', 'utf8');
const NL = String.fromCharCode(10);

const testBody = `
const { test } = require('node:test');
const assert = require('node:assert');

test('默认布局 6 行 x 8 座', () => {
  init();
  assert.strictEqual(state.rows, 6);
  assert.strictEqual(state.seatCols, 8);
  assert.strictEqual(state.grid.flat().filter(t => t === 'seat').length, 48);
});

test('导入文本：行列重建/空位/性别', () => {
  els.importText.value = ['\u5F20\u4E09\uFF08\u7537\uFF09 \u674E\u56DB\uFF08\u5973\uFF09 | \u738B\u4E94 \u7A7A', '\u5B59\u4E03 \u5468\u516B | \u5434\u4E5D \u90D1\u5341'].join(NL);
  importSeatText(els.importText.value);
  assert.strictEqual(state.rows, 2);
  assert.strictEqual(state.seatCols, 4);
  assert.strictEqual(state.assigned.size, 7);
  assert.strictEqual(state.grid.flat().filter(t => t === 'empty').length, 0);
  assert.strictEqual(state.genderMap['\u5F20\u4E09'], '\u7537');
});

test('导入兼容：BOM / 说明行 / 全角竖线 / CSV / 行不一致报错', () => {
  // BOM + 说明行 + 全角竖线
  els.importText.value = '\uFEFF' + ['甲 乙｜丙 丁', '戊 己 庚 辛', '（* 标注 = 同性同桌）'].join(NL);
  importSeatText(els.importText.value);
  assert.strictEqual(state.rows, 2);
  assert.strictEqual(state.seatCols, 4);
  assert.strictEqual(state.assigned.size, 8);
  // CSV（逗号分隔，过道空，两行名字数一致）
  els.importText.value = ['甲,乙,,丙,丁', '戊,己,,庚,辛'].join(NL);
  importSeatText(els.importText.value);
  assert.strictEqual(state.assigned.size, 8);
  // 行不一致应报友好错误（含行号）
  els.importText.value = ['甲 乙 丙', '丁 戊'].join(NL);
  assert.throws(() => importSeatText(els.importText.value), /第 2 行/);
});

test('向左横移：小组循环左移', () => {
  const before = new Map(state.assigned);
  shiftGroupsLeft();
  const after = new Map(state.assigned);
  assert.strictEqual(after.size, before.size);
  assert.deepStrictEqual([...before.values()].sort(), [...after.values()].sort());
  const g1old = [before.get('0,0'), before.get('0,1')].sort().join('|');
  const g2new = [after.get('0,3'), after.get('0,4')].sort().join('|');
  assert.strictEqual(g1old, g2new);
});

test('向后移：整行循环后移', () => {
  const beforeRowsBack = new Map(state.assigned);
  shiftRowsBack();
  const expectedRow0 = [...beforeRowsBack.entries()].filter(([k]) => k.startsWith('1,')).map(([k, v]) => v).sort().join('|');
  const actualRow0 = [...state.assigned.entries()].filter(([k]) => k.startsWith('0,')).map(([k, v]) => v).sort().join('|');
  assert.strictEqual(expectedRow0, actualRow0);
});

test('人调换：点选交换 + 同性重算', () => {
  els.nameInput.value = ['\u7532\uFF08\u7537\uFF09','\u4E59\uFF08\u7537\uFF09','\u4E19\uFF08\u5973\uFF09','\u4E01\uFF08\u5973\uFF09','\u620A\uFF08\u7537\uFF09','\u5DF1\uFF08\u5973\uFF09'].join(' ');
  startAssign();
  skipAnim();
  const beforeSwap = new Map(state.assigned);
  onCellClick(0, 0);
  assert.ok(state.selectedCell);
  const first = beforeSwap.get('0,0');
  const second = beforeSwap.get('0,1');
  onCellClick(0, 1);
  assert.strictEqual(state.assigned.get('0,0'), second);
  assert.strictEqual(state.assigned.get('0,1'), first);
  assert.strictEqual(state.selectedCell, null);
  assert.ok(state.sameSexKeys instanceof Set);
});
`;
eval(code + testBody);
