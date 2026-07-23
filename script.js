const API_BASE = '/api/messages';

const form = document.getElementById('messageForm');
const nameInput = document.getElementById('nameInput');
const contentInput = document.getElementById('contentInput');
const submitBtn = document.getElementById('submitBtn');
const messagesList = document.getElementById('messagesList');
const formFeedback = document.getElementById('formFeedback');
const charCount = document.getElementById('charCount');
const totalMessagesEl = document.getElementById('totalMessages');

// 实时字数统计
contentInput.addEventListener('input', () => {
  charCount.textContent = contentInput.value.length;
});

// 加载留言
async function loadMessages() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error('加载失败');

    const data = await res.json();
    renderMessages(data.messages);
    updateTotalCount(data.messages.length);
  } catch (err) {
    messagesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <p>留言加载失败，请刷新页面重试</p>
      </div>
    `;
  }
}

// 渲染留言列表
function renderMessages(messages) {
  if (!messages || messages.length === 0) {
    messagesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💭</div>
        <p>还没有留言，快来写下第一条吧！</p>
      </div>
    `;
    return;
  }

  messagesList.innerHTML = messages.map(msg => {
    const time = formatTime(msg.created_at);
    return `
      <div class="message-card">
        <div class="message-header">
          <span class="message-name">${escapeHtml(msg.name)}</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-content">${escapeHtml(msg.content)}</div>
      </div>
    `;
  }).join('');
}

// 提交留言
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = nameInput.value.trim();
  const content = contentInput.value.trim();

  if (!name || !content) {
    showFeedback('请填写名字和留言内容', 'error');
    return;
  }

  // 禁用按钮，显示加载状态
  setSubmitLoading(true);
  hideFeedback();

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '提交失败');
    }

    // 成功
    showFeedback('留言提交成功！🎉', 'success');
    form.reset();
    charCount.textContent = '0';

    // 重新加载留言列表
    await loadMessages();
  } catch (err) {
    showFeedback(err.message || '提交失败，请稍后再试', 'error');
  } finally {
    setSubmitLoading(false);
  }
});

// ===== 工具函数 =====

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;

  // 1 分钟内显示"刚刚"
  if (diff < 60000) return '刚刚';

  // 1 小时内显示"x 分钟前"
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;

  // 今天内显示"今天 HH:mm"
  if (d.toDateString() === now.toDateString()) {
    return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // 昨天
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // 今年内显示 "MM-DD HH:mm"
  if (d.getFullYear() === now.getFullYear()) {
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // 更早显示完整日期
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showFeedback(msg, type) {
  formFeedback.textContent = msg;
  formFeedback.className = `form-feedback ${type}`;
  formFeedback.style.display = 'block';
}

function hideFeedback() {
  formFeedback.style.display = 'none';
}

function setSubmitLoading(loading) {
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');
  submitBtn.disabled = loading;

  if (loading) {
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
  } else {
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
  }
}

function updateTotalCount(count) {
  totalMessagesEl.textContent = count;
}

// 页面加载时获取留言
document.addEventListener('DOMContentLoaded', loadMessages);
