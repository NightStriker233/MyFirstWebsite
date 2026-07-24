const API_BASE = '/api/messages';
const REPLIES_API = '/api/replies';
const LIKES_API = '/api/likes';

const form = document.getElementById('messageForm');
const nameInput = document.getElementById('nameInput');
const contentInput = document.getElementById('contentInput');
const submitBtn = document.getElementById('submitBtn');
const messagesList = document.getElementById('messagesList');
const formFeedback = document.getElementById('formFeedback');
const charCount = document.getElementById('charCount');
const totalMessagesEl = document.getElementById('totalMessages');

// ---- 点赞状态本地缓存 ----
function getLikedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem('likedMsgIds') || '[]'));
  } catch { return new Set(); }
}
function saveLikedSet(set) {
  localStorage.setItem('likedMsgIds', JSON.stringify([...set]));
}

// ---- 字符计数 ----
contentInput.addEventListener('input', () => {
  charCount.textContent = contentInput.value.length;
});

// ---- 加载留言列表 ----
async function loadMessages() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || '请求失败 (' + res.status + ')');
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.messages)) {
      throw new Error('数据格式错误');
    }
    renderMessages(data.messages);
    updateTotalCount(data.messages.length);
  } catch (err) {
    console.error('留言加载失败:', err);
    messagesList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>留言加载失败，请刷新页面重试</p><p style="font-size:0.8rem;color:#94A3B8;margin-top:8px">' + err.message + '</p></div>';
  }
}

// ---- 渲染留言列表（含回复区 + 点赞按钮） ----
function renderMessages(messages) {
  if (!messages || messages.length === 0) {
    messagesList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💭</div><p>还没有留言，快来写下第一条吧！</p></div>';
    return;
  }
  const likedSet = getLikedSet();
  messagesList.innerHTML = messages.map(msg => {
    const time = formatTime(msg.created_at);
    const replyCount = msg.reply_count || 0;
    const likeCount = msg.like_count || 0;
    return `
      <div class="message-card" data-msg-id="${msg.id}">
        <div class="message-header">
          <span class="message-name">${escapeHtml(msg.name)}</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${escapeHtml(msg.content)}</div>
        <div class="message-actions">
          <button class="like-btn${likedSet.has(msg.id) ? ' liked' : ''}" data-action="like" data-msg-id="${msg.id}">
            <span class="like-icon">${likedSet.has(msg.id) ? '❤️' : '🤍'}</span>
            <span class="like-count">${likeCount}</span>
          </button>
          <button class="reply-toggle-btn" data-action="toggle-replies" data-msg-id="${msg.id}">
            💬 回复 <span class="reply-count-badge">${replyCount}</span>
          </button>
        </div>
        <div class="replies-section" id="replies-${msg.id}" style="display:none">
          <div class="replies-list" id="replies-list-${msg.id}">
            <div class="loading-replies" style="display:none">
              <div class="loading-spinner"></div>
            </div>
          </div>
          <form class="reply-form" data-action="submit-reply" data-msg-id="${msg.id}">
            <div class="reply-form-row">
              <input type="text" class="reply-name-input" placeholder="你的名字" maxlength="50" required>
              <button type="submit" class="reply-submit-btn">回复</button>
            </div>
            <textarea class="reply-content-input" placeholder="写下回复……" maxlength="300" required rows="2"></textarea>
          </form>
        </div>
      </div>`;
  }).join('');
}

// ---- 事件委托：点赞 / 展开回复 / 提交回复 ----
messagesList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  const msgId = parseInt(btn.dataset.msgId, 10);
  if (!msgId) return;

  // 点赞/取消
  if (action === 'like') {
    e.preventDefault();
    btn.disabled = true;
    try {
      const res = await fetch(LIKES_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: msgId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      // 更新按钮状态
      const likedSet = getLikedSet();
      if (data.liked) {
        likedSet.add(msgId);
        btn.classList.add('liked');
        btn.querySelector('.like-icon').textContent = '❤️';
      } else {
        likedSet.delete(msgId);
        btn.classList.remove('liked');
        btn.querySelector('.like-icon').textContent = '🤍';
      }
      saveLikedSet(likedSet);
      if (data.like_count !== null && data.like_count !== undefined) {
        btn.querySelector('.like-count').textContent = data.like_count;
      }
    } catch (err) {
      console.error('点赞失败:', err);
    } finally {
      btn.disabled = false;
    }
    return;
  }

  // 展开/收起回复
  if (action === 'toggle-replies') {
    const section = document.getElementById('replies-' + msgId);
    if (!section) return;
    if (section.style.display === 'none') {
      section.style.display = 'block';
      btn.textContent = '🔽 收起回复';
      loadReplies(msgId);
    } else {
      section.style.display = 'none';
      const replyCountBadge = section.parentElement.querySelector('.reply-count-badge');
      btn.innerHTML = '💬 回复 <span class="reply-count-badge">' + (replyCountBadge?.textContent || '0') + '</span>';
    }
    return;
  }
});

// 提交回复（用 submit 事件委托，因为回复表单是 form）
messagesList.addEventListener('submit', async (e) => {
  const formEl = e.target.closest('form');
  if (!formEl || formEl.dataset.action !== 'submit-reply') return;
  e.preventDefault();
  const msgId = parseInt(formEl.dataset.msgId, 10);
  if (!msgId) return;

  const nameInput = formEl.querySelector('.reply-name-input');
  const contentInput = formEl.querySelector('.reply-content-input');
  const submitBtn = formEl.querySelector('.reply-submit-btn');
  const name = nameInput.value.trim();
  const content = contentInput.value.trim();
  if (!name || !content) return;

  submitBtn.disabled = true;
  submitBtn.textContent = '提交中…';
  try {
    const res = await fetch(REPLIES_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: msgId, name, content })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '提交失败');
    nameInput.value = '';
    contentInput.value = '';
    // 重新加载该留言的回复
    await loadReplies(msgId, true);
    // 更新回复计数
    await refreshReplyCount(msgId);
  } catch (err) {
    alert('回复失败：' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '回复';
  }
});

// ---- 加载某条留言的回复 ----
async function loadReplies(msgId, forceReload) {
  const listEl = document.getElementById('replies-list-' + msgId);
  const loadingEl = listEl?.querySelector('.loading-replies');
  if (!listEl) return;
  if (!forceReload && listEl.dataset.loaded === 'true') return;

  if (loadingEl) loadingEl.style.display = 'block';
  try {
    const res = await fetch(REPLIES_API + '?message_id=' + msgId);
    if (!res.ok) throw new Error('加载失败');
    const data = await res.json();
    const replies = data.replies || [];
    if (replies.length === 0) {
      listEl.innerHTML = '<p class="no-replies">暂无回复</p>';
    } else {
      listEl.innerHTML = replies.map(r => `
        <div class="reply-item">
          <span class="reply-name">${escapeHtml(r.name)}</span>
          <span class="reply-time">${formatTime(r.created_at)}</span>
          <p class="reply-content">${escapeHtml(r.content)}</p>
        </div>
      `).join('');
    }
    listEl.dataset.loaded = 'true';
  } catch (err) {
    listEl.innerHTML = '<p class="no-replies" style="color:#DC2626">回复加载失败</p>';
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

// ---- 刷新单条留言的回复计数 ----
async function refreshReplyCount(msgId) {
  const card = document.querySelector('.message-card[data-msg-id="' + msgId + '"]');
  if (!card) return;
  try {
    const res = await fetch(REPLIES_API + '?message_id=' + msgId);
    if (!res.ok) return;
    const data = await res.json();
    const count = (data.replies || []).length;
    const badge = card.querySelector('.reply-count-badge');
    if (badge) badge.textContent = count;
    // 同时更新 toggle 按钮文案
    const toggleBtn = card.querySelector('.reply-toggle-btn');
    if (toggleBtn && document.getElementById('replies-' + msgId)?.style.display !== 'none') {
      toggleBtn.textContent = '🔽 收起回复';
    }
  } catch { /* ignore */ }
}

// ---- 提交主留言 ----
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const content = contentInput.value.trim();
  if (!name || !content) {
    showFeedback('请填写名字和留言内容', 'error');
    return;
  }
  setSubmitLoading(true);
  hideFeedback();
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '提交失败');
    showFeedback('留言提交成功！🎉', 'success');
    form.reset();
    charCount.textContent = '0';
    await loadMessages();
  } catch (err) {
    showFeedback(err.message || '提交失败，请稍后再试', 'error');
  } finally {
    setSubmitLoading(false);
  }
});

// ---- 工具函数 ----
function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (d.toDateString() === now.toDateString()) return '今天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (d.getFullYear() === now.getFullYear()) return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showFeedback(msg, type) {
  formFeedback.textContent = msg;
  formFeedback.className = 'form-feedback ' + type;
  formFeedback.style.display = 'block';
}

function hideFeedback() {
  formFeedback.style.display = 'none';
}

function setSubmitLoading(loading) {
  submitBtn.disabled = loading;
  var btnText = submitBtn.querySelector('.btn-text');
  var btnLoading = submitBtn.querySelector('.btn-loading');
  if (loading) {
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
  } else {
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
  }
}

function updateTotalCount(count) {
  if (totalMessagesEl) totalMessagesEl.textContent = count;
}

document.addEventListener('DOMContentLoaded', loadMessages);
