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
//  🕸️ OI 图论生成器（SVG）
// ============================================================
(function () {
  const svg = document.getElementById('graphSvg');
  const hint = document.getElementById('graphHint');
  let nodes = [];       // { id, x, y, label }
  let edges = [];       // { from, to, weight }
  let nextId = 1;
  let mode = 'addNode'; // 'addNode' | 'addEdge'
  let edgeFrom = null;
  let dragNode = null;
  let dragOffX = 0, dragOffY = 0;

  function render() {
    svg.innerHTML = '';
    // 画边
    edges.forEach(e => {
      const from = nodes.find(n => n.id === e.from);
      const to = nodes.find(n => n.id === e.to);
      if (!from || !to) return;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      // 箭头线
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / len, uy = dy / len;
      const ex = to.x - ux * 22, ey = to.y - uy * 22;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
      line.setAttribute('x2', ex); line.setAttribute('y2', ey);
      line.setAttribute('stroke', '#C4B5A5'); line.setAttribute('stroke-width', '2');
      line.setAttribute('marker-end', 'url(#arrowhead)');
      g.appendChild(line);

      // 边权标签
      if (e.weight !== undefined && e.weight !== null) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', (from.x + to.x) / 2); text.setAttribute('y', (from.y + to.y) / 2 - 8);
        text.setAttribute('text-anchor', 'middle'); text.setAttribute('fill', '#E11D48');
        text.setAttribute('font-size', '14'); text.setAttribute('font-weight', '600');
        text.textContent = e.weight;
        g.appendChild(text);
      }

      // 双击设权重
      g.style.cursor = 'pointer';
      g.addEventListener('dblclick', (ev) => {
        ev.stopPropagation();
        const w = prompt('设置边权（取消则删除权重）：', e.weight || '');
        if (w === null) return;
        if (w === '') { e.weight = null; }
        else { const v = parseFloat(w); if (!isNaN(v)) e.weight = v; }
        render();
      });

      svg.appendChild(g);
    });

    // 画节点
    nodes.forEach(n => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(' + n.x + ',' + n.y + ')');
      g.style.cursor = 'grab';

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', '20');
      circle.setAttribute('fill', '#1E293B');
      g.appendChild(circle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('text-anchor', 'middle'); text.setAttribute('dy', '6');
      text.setAttribute('fill', '#fff'); text.setAttribute('font-size', '13');
      text.setAttribute('font-weight', '600');
      text.textContent = n.label;
      g.appendChild(text);

      // 交互
      g.addEventListener('mousedown', (ev) => {
        ev.stopPropagation();
        if (mode === 'addEdge') {
          if (!edgeFrom) { edgeFrom = n.id; hint.textContent = '点击目标节点完成连边'; }
          else if (edgeFrom !== n.id) {
            if (!edges.find(e => e.from === edgeFrom && e.to === n.id)) {
              edges.push({ from: edgeFrom, to: n.id, weight: null });
              render();
            }
            edgeFrom = null;
            hint.textContent = '点击空白添加节点';
          }
          return;
        }
        dragNode = n;
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX; pt.y = ev.clientY;
        const ctm = svg.getScreenCTM().inverse();
        const svgPt = pt.matrixTransform(ctm);
        dragOffX = svgPt.x - n.x;
        dragOffY = svgPt.y - n.y;
        g.style.cursor = 'grabbing';
      });

      svg.appendChild(g);
    });

    // 箭头标记 defs
    if (edges.length > 0) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'arrowhead');
      marker.setAttribute('markerWidth', '10'); marker.setAttribute('markerHeight', '7');
      marker.setAttribute('refX', '9'); marker.setAttribute('refY', '3.5');
      marker.setAttribute('orient', 'auto');
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', '0 0, 10 3.5, 0 7');
      poly.setAttribute('fill', '#C4B5A5');
      marker.appendChild(poly);
      defs.appendChild(marker);
      svg.insertBefore(defs, svg.firstChild);
    }
  }

  // SVG 空白区域点击 → 添加节点
  svg.addEventListener('mousedown', (ev) => {
    if (ev.target !== svg) return;
    if (mode === 'addEdge') { edgeFrom = null; hint.textContent = '点击空白添加节点'; return; }
    const rect = svg.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    nodes.push({ id: nextId, x, y, label: '' + nextId });
    nextId++;
    render();
  });

  // 全局鼠标移动 → 拖拽节点
  document.addEventListener('mousemove', (ev) => {
    if (!dragNode) return;
    const rect = svg.getBoundingClientRect();
    dragNode.x = Math.max(20, Math.min(rect.width - 20, ev.clientX - rect.left - dragOffX));
    dragNode.y = Math.max(20, Math.min(rect.height - 20, ev.clientY - rect.top - dragOffY));
    render();
  });

  document.addEventListener('mouseup', () => { dragNode = null; });

  // 工具栏按钮
  document.getElementById('graphAddNode').addEventListener('click', () => {
    mode = 'addNode'; edgeFrom = null;
    hint.textContent = '点击空白添加节点';
    document.getElementById('graphAddNode').style.background = '#1E293B'; document.getElementById('graphAddNode').style.color = '#fff';
    document.getElementById('graphAddEdge').style.background = ''; document.getElementById('graphAddEdge').style.color = '';
  });
  document.getElementById('graphAddEdge').addEventListener('click', () => {
    mode = 'addEdge'; edgeFrom = null;
    hint.textContent = '点击起始节点';
    document.getElementById('graphAddEdge').style.background = '#1E293B'; document.getElementById('graphAddEdge').style.color = '#fff';
    document.getElementById('graphAddNode').style.background = ''; document.getElementById('graphAddNode').style.color = '';
  });
  document.getElementById('graphClear').addEventListener('click', () => {
    nodes = []; edges = []; nextId = 1; edgeFrom = null; mode = 'addNode';
    hint.textContent = '点击空白添加节点';
    document.getElementById('graphExportPanel').style.display = 'none';
    render();
  });
  document.getElementById('graphExport').addEventListener('click', () => {
    const n = nodes.length;
    // 构建邻接矩阵
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
    const idToIdx = {};
    nodes.forEach((nd, i) => idToIdx[nd.id] = i);
    edges.forEach(e => {
      const i = idToIdx[e.from], j = idToIdx[e.to];
      if (i !== undefined && j !== undefined) matrix[i][j] = e.weight !== null && e.weight !== undefined ? e.weight : 1;
    });
    // 边列表
    const edgeList = edges.map(e => {
      const fromNode = nodes.find(nd => nd.id === e.from);
      const toNode = nodes.find(nd => nd.id === e.to);
      const w = e.weight !== null && e.weight !== undefined ? e.weight : '';
      return (fromNode ? fromNode.label : e.from) + ' ' + (toNode ? toNode.label : e.to) + (w !== '' ? ' ' + w : '');
    }).join('\n');
    const matStr = matrix.map(row => row.join(' ')).join('\n');
    document.getElementById('graphExportText').value = n + '\n' + matStr + '\n\n--- 边列表 ---\n' + edgeList;
    document.getElementById('graphExportPanel').style.display = 'block';
  });
  document.getElementById('graphCopyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('graphExportText').value);
  });

  render();
})();

// ============================================================
//  ▶ 在线代码运行器（Piston API）
// ============================================================
(function () {
  const langMap = {
    cpp: { language: 'cpp', version: '10.2.0' },
    python: { language: 'python', version: '3.10.0' }
  };

  document.getElementById('runnerBtn').addEventListener('click', async () => {
    const langKey = document.getElementById('runnerLang').value;
    const code = document.getElementById('runnerCode').value;
    const rawInput = document.getElementById('runnerInput').value;
    const status = document.getElementById('runnerStatus');
    const output = document.getElementById('runnerOutput');
    const btn = document.getElementById('runnerBtn');

    if (!code.trim()) { output.innerHTML = '<p style="color:#DC2626">请输入代码</p>'; return; }

    // 分割多组输入
    const inputs = rawInput.split(/^===$/m).map(s => s.trim()).filter(s => s);
    if (inputs.length === 0) inputs.push('');

    btn.disabled = true; status.textContent = '运行中…';
    output.innerHTML = '<p style="color:#94A3B8">执行中……</p>';

    const results = [];
    for (let i = 0; i < inputs.length; i++) {
      try {
        const res = await fetch('https://emkc.org/api/v2/piston/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: langMap[langKey].language,
            version: langMap[langKey].version,
            files: [{ name: langKey === 'cpp' ? 'main.cpp' : 'main.py', content: code }],
            stdin: inputs[i],
            run_timeout: 5000,
            compile_timeout: 10000
          })
        });
        const data = await res.json();
        results.push({ index: i, input: inputs[i], data });
      } catch (e) {
        results.push({ index: i, input: inputs[i], error: e.message });
      }
    }

    // 渲染结果
    output.innerHTML = results.map(r => {
      if (r.error) return '<div class="runner-case"><div class="runner-case-title">测试 ' + (r.index + 1) + ' ❌</div><pre class="runner-pre runner-pre-err">' + escapeHtml(r.error) + '</pre></div>';
      const d = r.data;
      let statusText = '', statusCls = '';
      if (d.compile && d.compile.code !== 0) { statusText = 'CE (编译错误)'; statusCls = 'runner-ce'; }
      else if (d.run.signal === 'SIGKILL') { statusText = 'TLE/MLE (超时/超内存)'; statusCls = 'runner-tle'; }
      else if (d.run.signal && d.run.signal !== 'SIGKILL') { statusText = 'RE (运行错误: ' + d.run.signal + ')'; statusCls = 'runner-re'; }
      else if (d.run.code !== 0) { statusText = 'RE (退出码 ' + d.run.code + ')'; statusCls = 'runner-re'; }
      else { statusText = '通过 ✅'; statusCls = 'runner-ok'; }

      let compileOut = '';
      if (d.compile && (d.compile.stdout || d.compile.stderr)) {
        compileOut = '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:0.8rem;color:#94A3B8">编译输出</summary><pre class="runner-pre">' + escapeHtml(d.compile.stdout + d.compile.stderr) + '</pre></details>';
      }

      return '<div class="runner-case"><div class="runner-case-title">测试 ' + (r.index + 1) + ' <span class="' + statusCls + '">' + statusText + '</span>' + (r.input ? '<span style="font-size:0.75rem;color:#C4B5A5;margin-left:8px">输入: ' + escapeHtml(r.input.slice(0, 50)) + (r.input.length > 50 ? '…' : '') + '</span>' : '') + '</div><pre class="runner-pre">' + escapeHtml(d.run ? (d.run.stdout || '(无输出)') : '') + '</pre>' + (d.run && d.run.stderr ? '<pre class="runner-pre runner-pre-err">' + escapeHtml(d.run.stderr) + '</pre>' : '') + compileOut + '</div>';
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
