// ============================================================
//  工具箱 — Tab 切换
// ============================================================
document.querySelectorAll('.tools-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tools-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tools-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ============================================================
//  🔐 Base64 编解码
// ============================================================
(function () {
  const input = document.getElementById('base64Input');
  const output = document.getElementById('base64Output');
  const fb = document.getElementById('base64Feedback');

  function show(msg, type) { fb.textContent = msg; fb.className = 'form-feedback ' + type; fb.style.display = 'block'; setTimeout(() => fb.style.display = 'none', 3000); }

  document.getElementById('base64EncodeBtn').addEventListener('click', () => {
    try { output.value = btoa(unescape(encodeURIComponent(input.value))); show('编码成功', 'success'); }
    catch (e) { show('编码失败：' + e.message, 'error'); }
  });

  document.getElementById('base64DecodeBtn').addEventListener('click', () => {
    try { input.value = decodeURIComponent(escape(atob(output.value.trim()))); show('解码成功', 'success'); }
    catch (e) { show('解码失败：Base64 格式不正确', 'error'); }
  });

  document.getElementById('base64CopyBtn').addEventListener('click', () => {
    const val = output.value || input.value;
    if (!val) return show('没有可复制的内容', 'error');
    navigator.clipboard.writeText(val).then(() => show('已复制到剪贴板', 'success')).catch(() => show('复制失败', 'error'));
  });
})();

// ============================================================
//  🔍 Diff 对比器
// ============================================================
(function () {
  function lcs(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    const result = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) { result.unshift({ type: 'same', line: a[i - 1] }); i--; j--; }
      else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { result.unshift({ type: 'add', line: b[j - 1] }); j--; }
      else { result.unshift({ type: 'del', line: a[i - 1] }); i--; }
    }
    return result;
  }

  document.getElementById('diffBtn').addEventListener('click', () => {
    const oldLines = document.getElementById('diffOld').value.split('\n');
    const newLines = document.getElementById('diffNew').value.split('\n');
    const out = document.getElementById('diffOutput');
    const diff = lcs(oldLines, newLines);
    out.innerHTML = diff.map(d => {
      const cls = d.type === 'add' ? 'diff-add' : d.type === 'del' ? 'diff-del' : 'diff-same';
      const sym = d.type === 'add' ? '+' : d.type === 'del' ? '-' : ' ';
      return '<div class="diff-line ' + cls + '"><span class="diff-sym">' + sym + '</span>' + escapeHtml(d.line) + '</div>';
    }).join('');
    out.style.display = 'block';
  });

  document.getElementById('diffClearBtn').addEventListener('click', () => {
    document.getElementById('diffOld').value = '';
    document.getElementById('diffNew').value = '';
    document.getElementById('diffOutput').style.display = 'none';
  });
})();

// ============================================================
//  🎲 随机数生成器
// ============================================================
(function () {
  document.getElementById('randBtn').addEventListener('click', () => {
    const min = parseFloat(document.getElementById('randMin').value) || 1;
    const max = parseFloat(document.getElementById('randMax').value) || 100;
    const count = parseInt(document.getElementById('randCount').value) || 10;
    const decimals = parseInt(document.getElementById('randDecimals').value) || 0;
    const unique = document.getElementById('randUnique').checked;
    const sort = document.getElementById('randSort').checked;
    const out = document.getElementById('randOutput');

    if (min > max) { out.value = '错误：最小值不能大于最大值'; return; }
    if (unique && count > (max - min + 1) * Math.pow(10, decimals)) { out.value = '错误：去重时生成数量超过可能值总数'; return; }

    const result = [];
    const seen = new Set();
    const factor = Math.pow(10, decimals);
    const range = Math.floor((max - min) * factor) + 1;
    let attempts = 0;
    while (result.length < count && attempts < count * 100) {
      attempts++;
      const r = min + Math.floor(Math.random() * range) / factor;
      const key = r.toFixed(decimals);
      if (unique && seen.has(key)) continue;
      seen.add(key);
      result.push(parseFloat(key));
    }
    if (sort) result.sort((a, b) => a - b);
    out.value = result.join(decimals === 0 ? ' ' : '\n');
  });

  document.getElementById('randCopyBtn').addEventListener('click', () => {
    const val = document.getElementById('randOutput').value;
    if (!val) return;
    navigator.clipboard.writeText(val);
  });
})();

// ============================================================
//  📋 剪切板分享
// ============================================================
(function () {
  document.getElementById('clipsCreateBtn').addEventListener('click', async () => {
    const content = document.getElementById('clipsContent').value.trim();
    if (!content) { showClipsFeedback('请输入内容', 'error'); return; }
    const burn = document.getElementById('clipsBurn').checked;
    const expire = parseInt(document.getElementById('clipsExpire').value) || 0;
    const btn = document.getElementById('clipsCreateBtn');
    btn.disabled = true; btn.textContent = '生成中…';
    try {
      const res = await fetch('/api/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, burn_after_read: burn, expire_hours: expire || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建失败');
      const fullUrl = window.location.origin + data.url;
      document.getElementById('clipsResult').style.display = 'block';
      document.getElementById('clipsResult').innerHTML =
        '<p style="font-weight:600;color:#16A34A">✅ 分享链接已生成</p>' +
        '<div class="clips-url-box"><code>' + fullUrl + '</code></div>' +
        '<button class="btn-secondary btn-sm" onclick="navigator.clipboard.writeText(\'' + fullUrl + '\')">📋 复制链接</button>' +
        (data.burn_after_read ? '<p style="color:#DC2626;font-size:0.8rem;margin-top:8px">⚠️ 阅后即焚：查看一次后自动删除</p>' : '');
    } catch (err) {
      showClipsFeedback(err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '生成分享链接';
    }
  });

  function showClipsFeedback(msg, type) {
    const fb = document.getElementById('clipsFeedback');
    fb.textContent = msg; fb.className = 'form-feedback ' + type; fb.style.display = 'block';
    setTimeout(() => fb.style.display = 'none', 4000);
  }
})();

// ============================================================
//  🕸️ OI 图论生成器（文本输入构建 + SVG 显示）
// ============================================================
(function () {
  const svg = document.getElementById('graphSvg');
  const hint = document.getElementById('graphHint');
  const stats = document.getElementById('graphStats');

  function showHint(msg, type) {
    hint.textContent = msg; hint.className = 'form-feedback ' + (type || '');
    hint.style.display = 'block'; setTimeout(() => hint.style.display = 'none', 3500);
  }

  function buildGraph() {
    const rawN = parseInt(document.getElementById('graphNodeCount').value);
    const raw = document.getElementById('graphEdgeInput').value.trim();
    const idxMode = parseInt(document.querySelector('#graphIndexMode .toggle-btn.active').dataset.val);
    const directed = document.querySelector('#graphDirected .toggle-btn.active').dataset.val === '1';

    // 先从边数据推断最大节点编号
    let maxNode = 0;
    if (raw) {
      raw.split('\n').forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const a = parseInt(parts[0]), b = parseInt(parts[1]);
          if (!isNaN(a)) maxNode = Math.max(maxNode, a);
          if (!isNaN(b)) maxNode = Math.max(maxNode, b);
        }
      });
    }
    // 节点数：优先手动设置，否则自动推断（至少 1）
    const n = (!isNaN(rawN) && rawN > 0) ? rawN : Math.max(1, maxNode - idxMode + 1);
    if (n < 1 || n > 26) { showHint('节点数量需在 1~26 之间', 'error'); return; }

    const edges = [];
    if (raw) {
      const lines = raw.split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;
        const from = parseInt(parts[0]), to = parseInt(parts[1]);
        if (isNaN(from) || isNaN(to)) continue;
        const minV = idxMode, maxV = n + idxMode - 1;
        if (from < minV || from > maxV || to < minV || to > maxV) { showHint('节点编号超出范围：' + line, 'error'); return; }
        const weight = parts.length >= 3 ? parseFloat(parts[2]) : null;
        edges.push({ from, to, weight: isNaN(weight) ? null : weight });
      }
    }

    stats.textContent = n + ' 节点 · ' + edges.length + ' 条边 · ' + (directed ? '有向' : '无向');
    renderGraph(n, edges, idxMode, directed);
  }

  function renderGraph(n, edges, idxMode, directed) {
    const size = Math.max(520, Math.min(700, svg.clientWidth || 600));
    const cx = size / 2, cy = size / 2;
    const nodeR = 24;
    const margin = nodeR + 20;
    const r = Math.min(size / 2 - margin, 240);

    const positions = [];
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }

    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.style.height = Math.min(500, size) + 'px';
    svg.innerHTML = '';

    // 网格背景点
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (let gx = 20; gx < size; gx += 25) {
      for (let gy = 20; gy < size; gy += 25) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', gx); dot.setAttribute('cy', gy);
        dot.setAttribute('r', '1'); dot.setAttribute('fill', '#E0DCD7');
        bg.appendChild(dot);
      }
    }
    svg.appendChild(bg);

    // defs: arrowhead
    if (directed) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'arrowhead');
      marker.setAttribute('markerWidth', '12'); marker.setAttribute('markerHeight', '8');
      marker.setAttribute('refX', '10'); marker.setAttribute('refY', '4');
      marker.setAttribute('orient', 'auto');
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', '0 0, 12 4, 0 8');
      poly.setAttribute('fill', '#94A3B8');
      marker.appendChild(poly);
      defs.appendChild(marker);
      svg.appendChild(defs);
    }

    // 画边
    const drawnEdges = new Set();
    edges.forEach(e => {
      const fi = e.from - idxMode, ti = e.to - idxMode;
      const from = positions[fi], to = positions[ti];
      if (!from || !to) return;

      // 无向图：去重（只画一条）
      if (!directed) {
        const key = Math.min(fi, ti) + '_' + Math.max(fi, ti);
        if (drawnEdges.has(key)) return;
        drawnEdges.add(key);
      }

      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / len, uy = dy / len;

      // 自环
      if (fi === ti) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const sx = from.x, sy = from.y;
        path.setAttribute('d', 'M ' + (sx + nodeR) + ' ' + sy + ' C ' + (sx + 50) + ' ' + (sy - 36) + ' ' + (sx) + ' ' + (sy - 36) + ' ' + (sx - nodeR) + ' ' + sy);
        path.setAttribute('stroke', '#94A3B8'); path.setAttribute('stroke-width', '2.5');
        path.setAttribute('fill', 'none');
        if (directed) path.setAttribute('marker-end', 'url(#arrowhead)');
        g.appendChild(path);
        if (e.weight !== null) {
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', sx + 38); text.setAttribute('y', sy - 44);
          text.setAttribute('text-anchor', 'middle'); text.setAttribute('fill', '#E11D48');
          text.setAttribute('font-size', '14'); text.setAttribute('font-weight', '700');
          text.textContent = e.weight; g.appendChild(text);
        }
        svg.appendChild(g);
        return;
      }

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const ex = to.x - ux * (nodeR + 5), ey = to.y - uy * (nodeR + 5);
      const sx = from.x + ux * (nodeR + 5), sy = from.y + uy * (nodeR + 5);

      // 粗透明线（增加视觉层次）
      const lineWide = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      lineWide.setAttribute('x1', sx); lineWide.setAttribute('y1', sy);
      lineWide.setAttribute('x2', ex); lineWide.setAttribute('y2', ey);
      lineWide.setAttribute('stroke', '#CBD5E1'); lineWide.setAttribute('stroke-width', '4');
      lineWide.setAttribute('opacity', '0.5');
      g.appendChild(lineWide);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', sx); line.setAttribute('y1', sy);
      line.setAttribute('x2', ex); line.setAttribute('y2', ey);
      line.setAttribute('stroke', '#64748B'); line.setAttribute('stroke-width', '2.5');
      if (directed) line.setAttribute('marker-end', 'url(#arrowhead)');
      g.appendChild(line);

      // 边权标签（带白色背景框）
      if (e.weight !== null) {
        const mx = (sx + ex) / 2, my = (sy + ey) / 2 - 6;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const w = ('' + e.weight).length * 9 + 8;
        rect.setAttribute('x', mx - w / 2); rect.setAttribute('y', my - 14);
        rect.setAttribute('width', w); rect.setAttribute('height', '20');
        rect.setAttribute('rx', '4'); rect.setAttribute('fill', '#fff');
        rect.setAttribute('stroke', '#FECDD3'); rect.setAttribute('stroke-width', '1');
        g.appendChild(rect);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', mx); text.setAttribute('y', my + 1);
        text.setAttribute('text-anchor', 'middle'); text.setAttribute('fill', '#E11D48');
        text.setAttribute('font-size', '14'); text.setAttribute('font-weight', '700');
        text.textContent = e.weight; g.appendChild(text);
      }
      svg.appendChild(g);
    });

    // 画节点
    positions.forEach((pos, i) => {
      const label = '' + (i + idxMode);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + pos.x + ',' + pos.y + ')');

      // 外圈阴影
      const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      shadow.setAttribute('r', nodeR + 2); shadow.setAttribute('fill', 'rgba(0,0,0,0.06)');
      g.appendChild(shadow);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', nodeR); circle.setAttribute('fill', '#fff');
      circle.setAttribute('stroke', '#475569'); circle.setAttribute('stroke-width', '2.5');
      g.appendChild(circle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('text-anchor', 'middle'); text.setAttribute('dy', '5');
      text.setAttribute('fill', '#1E293B'); text.setAttribute('font-size', '15');
      text.setAttribute('font-weight', '700');
      text.textContent = label; g.appendChild(text);
      svg.appendChild(g);
    });
  }

  // 事件：实时渲染
  let debounceTimer;
  function scheduleRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(buildGraph, 200);
  }
  document.getElementById('graphEdgeInput').addEventListener('input', scheduleRender);
  document.getElementById('graphNodeCount').addEventListener('input', scheduleRender);

  // Toggle 按钮切换
  function setupToggle(groupId) {
    const group = document.getElementById(groupId);
    group.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        buildGraph();
      });
    });
  }
  setupToggle('graphIndexMode');
  setupToggle('graphDirected');

  document.getElementById('graphClearBtn').addEventListener('click', () => {
    document.getElementById('graphEdgeInput').value = '';
    document.getElementById('graphNodeCount').value = '';
    svg.innerHTML = '';
    stats.textContent = '';
    document.getElementById('graphExportPanel').style.display = 'none';
  });
  document.getElementById('graphExportBtn').addEventListener('click', () => {
    const n = parseInt(document.getElementById('graphNodeCount').value) || 6;
    const raw = document.getElementById('graphEdgeInput').value.trim();
    const idxMode = parseInt(document.querySelector('#graphIndexMode .toggle-btn.active').dataset.val);
    const directed = document.querySelector('#graphDirected .toggle-btn.active').dataset.val === '1';
    const edges = [];
    if (raw) {
      raw.split('\n').forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) return;
        const from = parseInt(parts[0]), to = parseInt(parts[1]);
        if (isNaN(from) || isNaN(to)) return;
        const w = parts.length >= 3 ? parseFloat(parts[2]) : null;
        edges.push({ from, to, weight: isNaN(w) ? null : w });
      });
    }
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
    const seen = new Set();
    edges.forEach(e => {
      const fi = e.from - idxMode, ti = e.to - idxMode;
      if (fi >= 0 && fi < n && ti >= 0 && ti < n) {
        matrix[fi][ti] = e.weight !== null ? e.weight : 1;
        if (!directed) matrix[ti][fi] = matrix[fi][ti];
      }
    });
    const matStr = matrix.map(row => row.join(' ')).join('\n');
    const edgeStr = edges.map(e => e.from + ' ' + e.to + (e.weight !== null ? ' ' + e.weight : '')).join('\n');
    document.getElementById('graphExportText').value = n + '\n' + matStr + '\n\n--- 边列表 ---\n' + edgeStr;
    document.getElementById('graphExportPanel').style.display = 'block';
  });
  document.getElementById('graphCopyBtn2').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('graphExportText').value);
  });

  // 初始渲染
  buildGraph();
})();

// ============================================================
//  ▶ 在线代码运行器（Wandbox API）
// ============================================================
(function () {
  const wandboxMap = {
    cpp: 'gcc-head',
    python: 'cpython-3.12.0'
  };

  // CodeMirror 编辑器
  const editor = CodeMirror(document.getElementById('runnerEditor'), {
    value: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  int a, b;\n  cin >> a >> b;\n  cout << a + b << endl;\n  return 0;\n}\n',
    mode: 'text/x-c++src',
    theme: 'material-darker',
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    matchBrackets: true,
    autoCloseBrackets: true
  });
  editor.setSize('100%', '100%');

  // 语言切换
  document.getElementById('runnerLang').addEventListener('change', () => {
    const lang = document.getElementById('runnerLang').value;
    if (lang === 'cpp') {
      editor.setOption('mode', 'text/x-c++src');
    } else {
      editor.setOption('mode', 'text/x-python');
    }
  });

  document.getElementById('runnerBtn').addEventListener('click', async () => {
    const langKey = document.getElementById('runnerLang').value;
    const code = editor.getValue();
    const rawInput = document.getElementById('runnerInput').value;
    const status = document.getElementById('runnerStatus');
    const output = document.getElementById('runnerOutput');
    const btn = document.getElementById('runnerBtn');

    if (!code.trim()) { output.innerHTML = '<p style="color:#DC2626">请输入代码</p>'; return; }

    const inputs = rawInput.split(/^===$/m).map(s => s.trim()).filter(s => s);
    if (inputs.length === 0) inputs.push('');

    btn.disabled = true; status.textContent = '运行中…';
    output.innerHTML = '<p style="color:#94A3B8">执行中……</p>';

    const results = [];
    for (let i = 0; i < inputs.length; i++) {
      try {
        const body = JSON.stringify({
          compiler: wandboxMap[langKey],
          code: code,
          stdin: inputs[i],
          'compiler-option-raw': langKey === 'cpp' ? '-std=c++20' : ''
        });
        const res = await fetch('https://wandbox.org/api/compile.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body
        });
        const data = await res.json();
        results.push({ index: i, input: inputs[i], data });
      } catch (e) {
        results.push({ index: i, input: inputs[i], error: e.message });
      }
    }

    output.innerHTML = results.map(r => {
      if (r.error) return '<div class="runner-case"><div class="runner-case-title">测试 ' + (r.index + 1) + ' ❌</div><pre class="runner-pre runner-pre-err">网络错误: ' + escapeHtml(r.error) + '</pre></div>';
      const d = r.data;
      let out = '';
      if (d.compiler_message) out += d.compiler_message + '\n';
      if (d.program_message) out += d.program_message;
      if (!out) out = d.status || '(无输出)';

      let statusText = '', statusCls = '';
      if (d.status === '0') { statusText = '通过 ✅'; statusCls = 'runner-ok'; }
      else if (d.status === '1') { statusText = 'CE (编译错误)'; statusCls = 'runner-ce'; }
      else if (d.status === '2') { statusText = 'RE/TLE (运行错误/超时)'; statusCls = 'runner-tle'; }
      else { statusText = d.status || '完成'; statusCls = 'runner-ok'; }

      return '<div class="runner-case"><div class="runner-case-title">测试 ' + (r.index + 1) + ' <span class="' + statusCls + '">' + statusText + '</span>' + (r.input ? '<span style="font-size:0.75rem;color:#C4B5A5;margin-left:8px">输入: ' + escapeHtml(r.input.slice(0, 40)) + (r.input.length > 40 ? '…' : '') + '</span>' : '') + '</div><pre class="runner-pre">' + escapeHtml(out) + '</pre></div>';
    }).join('');

    status.textContent = '完成 (' + results.length + ' 组)';
    btn.disabled = false;
  });
})();

// ============================================================
//  工具函数
// ============================================================
function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
