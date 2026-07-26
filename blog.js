const POSTS_API = '/api/posts';
const COMMENTS_API = '/api/blog-comments';
const BLOG_REPLIES_API = '/api/blog-replies';

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(code, { language: lang }).value; } catch(e) {}
    }
    return code;
  }
});

// DOM 元素
const listView = document.getElementById('listView');
const editorView = document.getElementById('editorView');
const detailView = document.getElementById('detailView');
const postsList = document.getElementById('postsList');
const showEditorBtn = document.getElementById('showEditorBtn');

let authPassword = localStorage.getItem('blog_key') || '';
let editingPostId = null; // null = 新建, number = 编辑
let currentPostId = null; // 当前查看的文章 ID

// 如果有 key → 显示管理按钮；没有 → 隐藏
if (authPassword) {
  showEditorBtn.style.display = 'inline-flex';
} else {
  showEditorBtn.style.display = 'none';
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
let allPosts = [];

async function loadPosts() {
  try {
    const res = await fetch(POSTS_API);
    if (!res.ok) throw new Error('加载失败');
    const data = await res.json();
    allPosts = data.posts || [];
    renderTagCloud(allPosts);
    filterAndRender();
  } catch (err) {
    postsList.innerHTML = '<div class="blog-empty" style="color:#DC2626">⚠️ 文章加载失败：' + err.message + '</div>';
  }
}

function filterAndRender() {
  const query = document.getElementById('blogSearch').value.trim().toLowerCase();
  const posts = allPosts.filter(p => {
    if (!query) return true;
    return p.title.toLowerCase().includes(query) || (p.tags || '').toLowerCase().includes(query);
  });
  renderPosts(posts);
}

document.getElementById('blogSearch').addEventListener('input', filterAndRender);

function renderTagCloud(posts) {
  const tagCount = {};
  posts.forEach(p => {
    if (!p.tags) return;
    p.tags.split(',').forEach(t => { const k = t.trim(); if (k) tagCount[k] = (tagCount[k] || 0) + 1; });
  });
  const tags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
  document.getElementById('blogTags').innerHTML = tags.length > 0
    ? '<span style="font-size:0.8rem;color:#94A3B8;margin-right:8px">标签：</span>' + tags.map(([t, c]) => '<span class="blog-tag-pill" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + ' (' + c + ')</span>').join('')
    : '';
  document.querySelectorAll('.blog-tag-pill').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('blogSearch').value = el.dataset.tag;
      filterAndRender();
    });
  });
}

function renderPosts(posts) {
  if (posts.length === 0) {
    postsList.innerHTML = '<div class="blog-empty"><div style="font-size:3rem;margin-bottom:12px">📭</div><p>没有匹配的文章</p></div>';
    return;
  }
    postsList.innerHTML = posts.map(p => `
      <div class="blog-post-card" data-post-id="${p.id}">
        <h2 class="blog-post-title">${escapeHtml(p.title)}</h2>
        <div class="blog-post-meta">${formatDate(p.created_at)}${p.tags ? ' · ' + p.tags.split(',').map(t => '<span class="blog-tag-sm">' + escapeHtml(t.trim()) + '</span>').join(' ') : ''}</div>
        <p class="blog-post-excerpt">${escapeHtml(stripMarkdown(p.excerpt || ''))}</p>
        <div class="blog-post-actions" style="display:none">
          <button class="btn-secondary btn-sm edit-post-btn" data-id="${p.id}">编辑</button>
        </div>
      </div>
    `).join('');

    // 点击卡片查看详情
    postsList.querySelectorAll('.blog-post-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('.blog-tag-sm')) return;
        const id = parseInt(card.dataset.postId, 10);
        loadPostDetail(id);
      });
    });
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
    // 生成目录
    generateTOC(postFull);
    // 加载评论
    currentPostId = id;
    loadComments(id);
    showDetail();
  } catch (err) {
    alert('加载文章失败：' + err.message);
  }
}

// ---- 打开编辑器（新建/编辑） ----
function openEditor(postId) {
  editingPostId = postId || null;
  const titleInput = document.getElementById('postTitleInput');
  const tagsInput = document.getElementById('postTagsInput');
  const contentInput = document.getElementById('postContentInput');
  const editorTitle = document.getElementById('editorTitle');
  const deleteBtn = document.getElementById('deletePostBtn');
  const feedback = document.getElementById('editorFeedback');
  const livePreview = document.getElementById('livePreview');

  titleInput.value = '';
  tagsInput.value = '';
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
        tagsInput.value = data.post.tags || '';
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
  const tags = document.getElementById('postTagsInput').value.trim();
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
        body: JSON.stringify({ id: editingPostId, title, content, tags, password: authPassword })
      });
    } else {
      res = await fetch(POSTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, tags, password: authPassword })
      });
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '保存失败');
    if (data.error === '密码错误') {
      authPassword = '';
      localStorage.removeItem('blog_key');
      showEditorBtn.style.display = 'none';
      feedback.textContent = '密码错误，请通过管理链接重新登录';
      feedback.className = 'form-feedback error';
      feedback.style.display = 'block';
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
  openEditor(null);
});

document.getElementById('savePostBtn').addEventListener('click', savePost);
document.getElementById('deletePostBtn').addEventListener('click', deletePost);
document.getElementById('cancelEditBtn').addEventListener('click', showList);
document.getElementById('backToListFromEditor').addEventListener('click', (e) => { e.preventDefault(); showList(); });
document.getElementById('backToListFromDetail').addEventListener('click', (e) => { e.preventDefault(); showList(); });

// ---- 工具函数 ----
function applyCollapse(container) {
  const MAX = 7.2 * parseFloat(getComputedStyle(document.documentElement).fontSize);
  const items = container.querySelectorAll('.comment-content, .reply-content');
  items.forEach(el => {
    if (el.scrollHeight > MAX + 4) {
      el.classList.add('collapsed');
      const btn = document.createElement('button');
      btn.className = 'expand-btn';
      btn.textContent = '展开 ▼';
      el.insertAdjacentElement('afterend', btn);
    }
  });
}

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

// ====== 博客评论区 ======

// 加载文章评论
async function loadComments(postId) {
  const list = document.getElementById('blogCommentsList');
  list.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>加载评论…</p></div>';
  try {
    const res = await fetch(COMMENTS_API + '?post_id=' + postId);
    const data = await res.json();
    renderComments(data.comments || []);
  } catch (err) {
    list.innerHTML = '<p style="color:#94A3B8;text-align:center;padding:20px">评论加载失败</p>';
  }
}

function renderComments(comments) {
  const list = document.getElementById('blogCommentsList');
  if (comments.length === 0) {
    list.innerHTML = '<p class="no-comments">还没有评论，快来发表第一条吧 ✨</p>';
    return;
  }
  list.innerHTML = comments.map(c => `
    <div class="blog-comment">
      <div class="comment-avatar">${getAvatar(c.name)}</div>
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-name">${escapeHtml(c.name || '匿名')}</span>
          <span class="comment-time">${formatDate(c.created_at)}</span>
        </div>
        <div class="comment-content">${escapeHtml(c.content)}</div>
        <div class="comment-actions">
          <button class="reply-toggle-btn" data-comment-id="${c.id}">💬 回复${c.reply_count > 0 ? ' (' + c.reply_count + ')' : ''}</button>
        </div>
        <div class="replies-section" id="replies-${c.id}" style="display:none"></div>
        <div class="reply-form" id="replyForm-${c.id}" style="display:none">
          <input type="text" class="reply-name-input" id="replyName-${c.id}" placeholder="你的名字（选填）" maxlength="50">
          <textarea class="reply-content-input" id="replyContent-${c.id}" placeholder="写下你的回复…" rows="2" maxlength="300"></textarea>
          <button class="reply-submit-btn" data-comment-id="${c.id}">发送回复</button>
        </div>
      </div>
    </div>
  `).join('');
  applyCollapse(list);

  // 绑定回复按钮
  list.querySelectorAll('.reply-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cid = btn.dataset.commentId;
      const repliesDiv = document.getElementById('replies-' + cid);
      const formDiv = document.getElementById('replyForm-' + cid);
      const isOpen = repliesDiv.style.display !== 'none';
      if (isOpen) {
        repliesDiv.style.display = 'none';
        formDiv.style.display = 'none';
      } else {
        repliesDiv.style.display = 'block';
        formDiv.style.display = 'block';
        loadReplies(cid);
      }
    });
  });

  // 绑定回复提交
  list.querySelectorAll('.reply-submit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cid = btn.dataset.commentId;
      submitReply(cid);
    });
  });

  // 绑定展开按钮
  list.querySelectorAll('.expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const content = btn.previousElementSibling;
      if (content) {
        content.classList.toggle('collapsed');
        btn.textContent = content.classList.contains('collapsed') ? '展开 ▼' : '收起 ▲';
      }
    });
  });
}

// 加载回复
async function loadReplies(commentId) {
  const div = document.getElementById('replies-' + commentId);
  try {
    const res = await fetch(BLOG_REPLIES_API + '?comment_id=' + commentId);
    const data = await res.json();
    const replies = data.replies || [];
    if (replies.length === 0) {
      div.innerHTML = '<p style="color:#94A3B8;font-size:0.85rem;padding:8px 0">暂无回复</p>';
    } else {
      div.innerHTML = replies.map(r => `
        <div class="blog-reply">
          <span class="reply-name">${escapeHtml(r.name || '匿名')}</span>
          <span class="reply-time">${formatDate(r.created_at)}</span>
          <span class="reply-content">${escapeHtml(r.content)}</span>
        </div>
      `).join('');
      applyCollapse(div);
    }
    // 绑定回复中的展开按钮
    div.querySelectorAll('.expand-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const content = btn.previousElementSibling;
        if (content) {
          content.classList.toggle('collapsed');
          btn.textContent = content.classList.contains('collapsed') ? '展开 ▼' : '收起 ▲';
        }
      });
    });
  } catch (err) {
    div.innerHTML = '<p style="color:#DC2626;font-size:0.85rem">加载失败</p>';
  }
}

// 提交评论
async function submitComment() {
  const nameInput = document.getElementById('blogCommentName');
  const contentInput = document.getElementById('blogCommentContent');
  const btn = document.getElementById('blogCommentSubmit');
  const name = nameInput.value.trim() || '匿名';
  const content = contentInput.value.trim();
  if (!content) return;
  if (!currentPostId) return;
  btn.disabled = true;
  btn.textContent = '发送中…';
  try {
    const res = await fetch(COMMENTS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: currentPostId, name, content })
    });
    if (!res.ok) throw new Error('发送失败');
    nameInput.value = '';
    contentInput.value = '';
    loadComments(currentPostId);
  } catch (err) {
    alert('评论发送失败：' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '发表评论';
  }
}

// 提交回复
async function submitReply(commentId) {
  const nameInput = document.getElementById('replyName-' + commentId);
  const contentInput = document.getElementById('replyContent-' + commentId);
  const name = (nameInput.value || '').trim() || '匿名';
  const content = contentInput.value.trim();
  if (!content) return;
  try {
    const res = await fetch(BLOG_REPLIES_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: commentId, name, content })
    });
    if (!res.ok) throw new Error('发送失败');
    nameInput.value = '';
    contentInput.value = '';
    loadReplies(commentId);
    // 刷新评论列表以更新回复计数
    if (currentPostId) loadComments(currentPostId);
  } catch (err) {
    alert('回复发送失败：' + err.message);
  }
}

// 头像生成
function getAvatar(name) {
  const colors = ['#E88D5A','#D4753B','#F4A261','#E76F51','#F5A07A'];
  const idx = (name || '?').charCodeAt(0) % colors.length;
  const letter = (name || '?')[0].toUpperCase();
  return '<span class="avatar-badge" style="background:' + colors[idx] + '">' + letter + '</span>';
}

// ---- 文章目录生成 ----
function generateTOC(container) {
  const tocEl = document.getElementById('postToc');
  const tocNav = document.getElementById('tocNav');
  const headings = container.querySelectorAll('h1, h2, h3');
  if (headings.length < 2) { tocEl.style.display = 'none'; return; }
  let html = '';
  headings.forEach((h, i) => {
    const id = 'heading-' + i;
    h.id = id;
    const level = parseInt(h.tagName[1]);
    html += '<a href="#' + id + '" class="toc-link toc-l' + level + '">' + h.textContent + '</a>';
  });
  tocNav.innerHTML = html;
  tocEl.style.display = 'block';
  document.querySelector('.post-detail-layout').classList.add('has-toc');
}

// 绑定评论提交事件
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('blogCommentSubmit').addEventListener('click', submitComment);
  // Enter 快捷提交（Ctrl+Enter）
  document.getElementById('blogCommentContent').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submitComment();
    }
  });
});
