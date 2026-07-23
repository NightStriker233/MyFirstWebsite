const API_BASE = '/api/messages';

const form = document.getElementById('messageForm');
const nameInput = document.getElementById('nameInput');
const contentInput = document.getElementById('contentInput');
const submitBtn = document.getElementById('submitBtn');
const messagesList = document.getElementById('messagesList');
const formFeedback = document.getElementById('formFeedback');
const charCount = document.getElementById('charCount');
const totalMessagesEl = document.getElementById('totalMessages');

contentInput.addEventListener('input', () => {
  charCount.textContent = contentInput.value.length;
});

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

function renderMessages(messages) {
  if (!messages || messages.length === 0) {
    messagesList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💭</div><p>还没有留言，快来写下第一条吧！</p></div>';
    return;
  }
  messagesList.innerHTML = messages.map(msg => {
    const time = formatTime(msg.created_at);
    return '<div class="message-card"><div class="message-header"><span class="message-name">' + escapeHtml(msg.name) + '</span><span class="message-time">' + time + '</span></div><div class="message-content">' + escapeHtml(msg.content) + '</div></div>';
  }).join('');
}

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