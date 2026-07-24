const POSTS_API = '/api/posts';

// 配置 marked
marked.setOptions({ breaks: true, gfm: true });

// DOM 元素
const listView = document.getElementById('listView');
const editorView = document.getElementById('editorView');
const detailView = document.getElementById('detailView');
const postsList = document.getElementById('postsList');
const passwordOverlay = document.getElementById('passwordOverlay');
const passwordInput = document.getElementById('passwordInput');
const passwordError = document.getElementById('passwordError');

let authPassword = localStorage.getItem('blog_key') || '';
let editingPostId = null; // null = 新建, number = 编辑

// 如果已保存 key，自动写入供 API 使用
if (authPassword) {
  console.log('🔗 管理链接已激活');
}

// ---- Markdown + LaTeX 渲染 ----
function renderContent(text) {
  if (!text) return '';
  // 第一步：保护代码块，避免被后续正则干扰
  const codeBlocks = [];
  let processed = text.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return '%%CODEBLOCK_' + (codeBlocks.length - 1) + '%%';
  });
  // 第二步：渲染 LaTeX 公式
  // $$...$$ 块公式
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) => {
    try { return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false }); }
    catch (e) { return '<span class="katex-error">公式错误: ' + escapeHtml(formula) + '</span>'; }
  });
  // $...$ 行内公式（不匹配 $$）
  processed = processed.replace(/(?<!\$)\$(?!\$)([^$]+?)\$(?!\$)/g, (_, formula) => {
    try { return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false }); }
    catch (e) { return '<span class="katex-error">公式错误: ' + escapeHtml(formula) + '</span>'; }
  });
  // 第三步：渲染 Markdown
  let html = marked.parse(processed);
  // 第四步：还原代码块（marked 已经渲染了它们，但占位符在 HTML 里，需要恢复原内容）
  codeBlocks.forEach((block, i) => {
    const rendered = marked.parse(block);
    html = html.replace('%%CODEBLOCK_' + i + '%%', rendered);
  });
  return html;
}

// 去掉 Markdown 标记，生成纯文本摘要
function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, ' [代码块] ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' [公式] ')
    .replace(/\$[^$]+?\$/g, '')
    .replace(/[#*>`~\[\]()_|-]/g, '')
    .replace(/\n+/g, ' ')
    .substring(0, 200)
    .trim();
}

// ---- 视图切换 ----
function showList() {
  listView.style.display = 'block';
  editorView.style.display = 'none';
  detailView.style.display = 'none';
  loadPosts();
}
function showEditor() {
  listView.style.display = 'none';
  editorView.style.display = 'block';
  detailView.style.display = 'none';
}
function showDetail() {
  listView.style.display = 'none';
  editorView.style.display = 'none';
  detailView.style.display = 'block';
}

// ---- 加载文章列表 ----
async function loadPosts() {
  try {
    const res = await fetch(POSTS_API);
    if (!res.ok) throw new Error('加载失败');
    const data = await res.json();
    const posts = data.posts || [];
    if (posts.length === 0) {
      postsList.innerHTML = '<div class="blog-empty"><div style="font-size:3rem;margin-bottom:12px">📭</div><p>还没有文章，点击「写文章」开始吧！</p></div>';
      return;
    }
    postsList.innerHTML = posts.map(p => `
      <div class="blog-post-card" data-post-id="${p.id}">
        <h2 class="blog-post-title">${escapeHtml(p.title)}</h2>
        <div class="blog-post-meta">${formatDate(p.created_at)}</div>
        <p class="blog-post-excerpt">${escapeHtml(stripMarkdown(p.excerpt || ''))}</p>
        <div class="blog-post-actions" style="display:none">
          <button class="btn-secondary btn-sm edit-post-btn" data-id="${p.id}">编辑</button>
        </div>
      </div>
    `).join('');

    // 点击卡片查看详情
    postsList.querySelectorAll('.blog-post-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const id = parseInt(card.dataset.postId, 10);
        loadPostDetail(id);
      });
    });
  } catch (err) {
    postsList.innerHTML = '<div class="blog-empty" style="color:#DC2626">⚠️ 文章加载失败：' + err.message + '</div>';
  }
}

// ---- 加载单篇文章详情 ----
async function loadPostDetail(id) {
  try {
    const res = await fetch(POSTS_API + '?id=' + id);
    if (!res.ok) throw new Error('文章不存在');
    const data = await res.json();
    const post = data.post;
    const postFull = document.getElementById('postFull');
    postFull.innerHTML = `
      <h1 class="post-full-title">${escapeHtml(post.title)}</h1>
      <div class="post-full-meta">发布于 ${formatDate(post.created_at)}${post.updated_at !== post.created_at ? ' · 更新于 ' + formatDate(post.updated_at) : ''}</div>
      <div class="post-full-content">${renderContent(post.content)}</div>
    `;
    // 如果有密码，显示编辑按钮
    if (authPassword) {
      const btnRow = document.createElement('div');
      btnRow.className = 'blog-post-actions';
      btnRow.style.marginTop = '24px';
      btnRow.innerHTML = '<button class="btn-secondary btn-sm" id="editFromDetailBtn">编辑</button>';
      postFull.appendChild(btnRow);
      document.getElementById('editFromDetailBtn').addEventListener('click', () => openEditor(id));
    }
    showDetail();
  } catch (err) {
    alert('加载文章失败：' + err.message);
  }
}

// ---- 密码弹窗 ----
function showPasswordOverlay(callback) {
  passwordInput.value = '';
  passwordError.style.display = 'none';
  passwordOverlay.style.display = 'flex';
  passwordInput.focus();

  function confirm() {
    const pw = passwordInput.value.trim();
    if (!pw) {
      passwordError.textContent = '请输入密码';
      passwordError.style.display = 'block';
      return;
    }
    authPassword = pw;
    passwordOverlay.style.display = 'none';
    cleanup();
    // 密码正确性通过 API 实际调用验证
    callback(pw);
  }

  function cancel() {
    passwordOverlay.style.display = 'none';
    cleanup();
  }

  function cleanup() {
    document.getElementById('confirmPasswordBtn').removeEventListener('click', confirm);
    document.getElementById('cancelPasswordBtn').removeEventListener('click', cancel);
    passwordInput.removeEventListener('keydown', onKey);
  }

  function onKey(e) { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') cancel(); }
  document.getElementById('confirmPasswordBtn').addEventListener('click', confirm);
  document.getElementById('cancelPasswordBtn').addEventListener('click', cancel);
  passwordInput.addEventListener('keydown', onKey);
}

// ---- 打开编辑器（新建/编辑） ----
function openEditor(postId) {
  editingPostId = postId || null;
  const titleInput = document.getElementById('postTitleInput');
  const contentInput = document.getElementById('postContentInput');
  const editorTitle = document.getElementById('editorTitle');
  const deleteBtn = document.getElementById('deletePostBtn');
  const feedback = document.getElementById('editorFeedback');
  const livePreview = document.getElementById('livePreview');

  titleInput.value = '';
  contentInput.value = '';
  feedback.style.display = 'none';
  livePreview.innerHTML = '<p style="color:#94A3B8">在左侧输入内容，这里实时预览……</p>';

  // 实时预览
  contentInput.oninput = () => {
    const val = contentInput.value.trim();
    if (!val) {
      livePreview.innerHTML = '<p style="color:#94A3B8">在左侧输入内容，这里实时预览……</p>';
    } else {
      livePreview.innerHTML = renderContent(val);
    }
  };

  if (postId) {
    editorTitle.textContent = '编辑文章';
    deleteBtn.style.display = 'inline-block';
    // 加载现有内容
    fetch(POSTS_API + '?id=' + postId)
      .then(r => r.json())
      .then(data => {
        titleInput.value = data.post.title;
        contentInput.value = data.post.content;
      });
  } else {
    editorTitle.textContent = '写新文章';
    deleteBtn.style.display = 'none';
  }
  showEditor();
}

// ---- 保存文章 ----
async function savePost() {
  const title = document.getElementById('postTitleInput').value.trim();
  const content = document.getElementById('postContentInput').value.trim();
  const feedback = document.getElementById('editorFeedback');
  if (!title || !content) {
    feedback.textContent = '请填写标题和内容';
    feedback.className = 'form-feedback error';
    feedback.style.display = 'block';
    return;
  }
  const btn = document.getElementById('savePostBtn');
  btn.disabled = true;
  btn.textContent = '保存中…';
  feedback.style.display = 'none';
  try {
    let res;
    if (editingPostId) {
      res = await fetch(POSTS_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingPostId, title, content, password: authPassword })
      });
    } else {
      res = await fetch(POSTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, password: authPassword })
      });
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '保存失败');
    if (data.error === '密码错误') {
      authPassword = '';
      showPasswordOverlay(pw => { authPassword = pw; savePost(); });
      return;
    }
    showList();
  } catch (err) {
    feedback.textContent = err.message;
    feedback.className = 'form-feedback error';
    feedback.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = '发布文章';
  }
}

// ---- 删除文章 ----
async function deletePost() {
  if (!editingPostId) return;
  if (!confirm('确定要删除这篇文章吗？此操作不可撤销。')) return;
  try {
    const res = await fetch(POSTS_API, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingPostId, password: authPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '删除失败');
    editingPostId = null;
    showList();
  } catch (err) {
    alert('删除失败：' + err.message);
  }
}

// ---- 事件绑定 ----
document.getElementById('showEditorBtn').addEventListener('click', () => {
  if (authPassword) {
    openEditor(null);
    return;
  }
  showPasswordOverlay(pw => {
    authPassword = pw;
    openEditor(null);
  });
});

document.getElementById('savePostBtn').addEventListener('click', savePost);
document.getElementById('deletePostBtn').addEventListener('click', deletePost);
document.getElementById('cancelEditBtn').addEventListener('click', showList);
document.getElementById('backToListFromEditor').addEventListener('click', (e) => { e.preventDefault(); showList(); });
document.getElementById('backToListFromDetail').addEventListener('click', (e) => { e.preventDefault(); showList(); });

// ---- 工具函数 ----
function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const pad = n => n < 10 ? '0' + n : '' + n;
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// ---- 初始化 ----
document.addEventListener('DOMContentLoaded', loadPosts);
