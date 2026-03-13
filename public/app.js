/**
 * CeloRemit — Frontend Application
 */

const API_BASE = '';

// ==================== State ====================
let currentView = 'chat';
let isProcessing = false;

// ==================== DOM Elements ====================
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');
const suggestedActions = document.getElementById('suggestedActions');
const clearChatBtn = document.getElementById('clearChatBtn');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const compareBtn = document.getElementById('compareBtn');
const swapSendBtn = document.getElementById('swapSendBtn');
const swapQuickFillBtn = document.getElementById('swapQuickFillBtn');
const swapRefreshBalancesBtn = document.getElementById('swapRefreshBalancesBtn');

// ==================== Navigation ====================
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    switchView(view);
  });
});

function switchView(viewName) {
  currentView = viewName;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

  // Update views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${viewName}`)?.classList.add('active');

  // Load data for non-chat views
  if (viewName === 'dashboard') loadDashboard();
  if (viewName === 'history') loadHistory();
  if (viewName === 'swap') loadSwapBalances();

  // Close mobile sidebar
  sidebar.classList.remove('mobile-open');
}

// ==================== Sidebar ====================
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

mobileMenuBtn.addEventListener('click', () => {
  sidebar.classList.toggle('mobile-open');
});

// Close mobile sidebar on overlay click
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768 && sidebar.classList.contains('mobile-open')) {
    if (!sidebar.contains(e.target) && e.target !== mobileMenuBtn) {
      sidebar.classList.remove('mobile-open');
    }
  }
});

// ==================== Chat ====================
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message || isProcessing) return;
  await sendMessage(message);
});

// Quick actions from welcome message
document.querySelectorAll('.quick-action').forEach(btn => {
  btn.addEventListener('click', async () => {
    const message = btn.dataset.message;
    if (message) await sendMessage(message);
  });
});

clearChatBtn.addEventListener('click', async () => {
  try {
    await fetch(`${API_BASE}/api/agent/reset`, { method: 'POST' });
  } catch (e) { /* ignore */ }

  chatMessages.innerHTML = '';
  addWelcomeMessage();
  hideSuggestions();
});

async function sendMessage(text) {
  // Add user message
  addMessage('user', text);
  chatInput.value = '';
  chatInput.focus();
  isProcessing = true;
  sendBtn.disabled = true;
  hideSuggestions();

  // Show typing indicator
  const typingEl = addTypingIndicator();

  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });

    const data = await response.json();

    // Remove typing indicator
    typingEl.remove();

    // Add agent response
    addAgentMessage(data);

    // Show suggested actions
    if (data.suggestedActions && data.suggestedActions.length > 0) {
      showSuggestions(data.suggestedActions);
    }

  } catch (error) {
    typingEl.remove();
    addMessage('agent', '❌ Connection error. Please make sure the server is running on port 3001.', 'error');
  } finally {
    isProcessing = false;
    sendBtn.disabled = false;
  }
}

function addMessage(role, content, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}-message`;

  const avatarDiv = document.createElement('div');
  avatarDiv.className = 'message-avatar';

  if (role === 'agent') {
    avatarDiv.innerHTML = `
      <div class="agent-avatar">
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" stroke="#35D07F" stroke-width="2" fill="none"/>
          <path d="M9 14l3 3 7-7" stroke="#35D07F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`;
  } else {
    avatarDiv.innerHTML = '<div class="user-avatar">You</div>';
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = formatMessageContent(content);

  contentDiv.appendChild(bubble);
  messageDiv.appendChild(avatarDiv);
  messageDiv.appendChild(contentDiv);
  chatMessages.appendChild(messageDiv);

  scrollToBottom();
}

function addAgentMessage(data) {
  const { message, type, data: responseData } = data;

  if (type === 'fee_comparison' && responseData) {
    addFeeComparisonMessage(responseData);
    return;
  }

  addMessage('agent', message, type);
}

function addFeeComparisonMessage(comparison) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message agent-message';

  const avatarDiv = document.createElement('div');
  avatarDiv.className = 'message-avatar';
  avatarDiv.innerHTML = `
    <div class="agent-avatar">
      <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="12" stroke="#35D07F" stroke-width="2" fill="none"/>
        <path d="M9 14l3 3 7-7" stroke="#35D07F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.style.maxWidth = '600px';

  let html = `<h3 style="margin-bottom: 12px; font-size: 1.1rem;">💰 Fee Comparison — ${comparison.sendAmount} ${comparison.sendCurrency} → ${comparison.receiveCurrency}</h3>`;

  // Celo card
  const celo = comparison.celoFees;
  html += `
    <div class="fee-card recommended">
      <div class="fee-card-header">
        <span class="fee-provider">🟢 ${celo.provider}</span>
        <span class="fee-badge best">Recommended</span>
      </div>
      <div class="fee-details">
        <div class="fee-detail">
          <span class="fee-detail-label">They Receive</span>
          <span class="fee-detail-value highlight">${Number(celo.receiveAmount).toLocaleString()} ${comparison.receiveCurrency}</span>
        </div>
        <div class="fee-detail">
          <span class="fee-detail-label">Fee</span>
          <span class="fee-detail-value highlight">$${celo.transferFee.toFixed(2)}</span>
        </div>
        <div class="fee-detail">
          <span class="fee-detail-label">Rate</span>
          <span class="fee-detail-value">${celo.exchangeRate.toFixed(4)}</span>
        </div>
        <div class="fee-detail">
          <span class="fee-detail-label">Delivery</span>
          <span class="fee-detail-value highlight">${celo.estimatedDelivery}</span>
        </div>
      </div>
    </div>`;

  // Traditional providers
  for (const provider of comparison.traditionalProviders) {
    html += `
      <div class="fee-card">
        <div class="fee-card-header">
          <span class="fee-provider">🔴 ${provider.provider}</span>
          ${provider.savings > 0 ? `<span class="fee-badge savings">Save ${Number(provider.savings).toLocaleString()} ${comparison.receiveCurrency}</span>` : ''}
        </div>
        <div class="fee-details">
          <div class="fee-detail">
            <span class="fee-detail-label">They Receive</span>
            <span class="fee-detail-value">${Number(provider.receiveAmount).toLocaleString()} ${comparison.receiveCurrency}</span>
          </div>
          <div class="fee-detail">
            <span class="fee-detail-label">Fee</span>
            <span class="fee-detail-value">$${provider.transferFee.toFixed(2)}</span>
          </div>
          <div class="fee-detail">
            <span class="fee-detail-label">Rate</span>
            <span class="fee-detail-value">${provider.exchangeRate.toFixed(4)}</span>
          </div>
          <div class="fee-detail">
            <span class="fee-detail-label">Delivery</span>
            <span class="fee-detail-value">${provider.estimatedDelivery}</span>
          </div>
        </div>
      </div>`;
  }

  // Summary
  html += `<div style="margin-top: 14px; padding: 12px; background: rgba(53,208,127,0.08); border-radius: 8px; border: 1px solid rgba(53,208,127,0.15);">
    <strong style="color: #35D07F;">💡 With Celo, you save up to ${comparison.bestSavingsPercent}%</strong> compared to traditional providers.
  </div>`;

  bubble.innerHTML = html;
  contentDiv.appendChild(bubble);
  messageDiv.appendChild(avatarDiv);
  messageDiv.appendChild(contentDiv);
  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

function addTypingIndicator() {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message agent-message';
  messageDiv.id = 'typingIndicator';

  messageDiv.innerHTML = `
    <div class="message-avatar">
      <div class="agent-avatar">
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" stroke="#35D07F" stroke-width="2" fill="none"/>
          <path d="M9 14l3 3 7-7" stroke="#35D07F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
    <div class="message-content">
      <div class="message-bubble typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;

  chatMessages.appendChild(messageDiv);
  scrollToBottom();
  return messageDiv;
}

function addWelcomeMessage() {
  const welcome = document.createElement('div');
  welcome.className = 'message agent-message welcome-message';
  welcome.innerHTML = `
    <div class="message-avatar">
      <div class="agent-avatar">
        <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" stroke="#35D07F" stroke-width="2" fill="none"/>
          <path d="M9 14l3 3 7-7" stroke="#35D07F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
    <div class="message-content">
      <div class="message-bubble">
        <div class="welcome-hero">
          <h2>👋 Welcome to CeloRemit</h2>
          <p>I'm your AI-powered remittance agent. Send money globally using Celo stablecoins — faster, cheaper, and more transparent than traditional services.</p>
        </div>
        <div class="quick-actions">
          <button class="quick-action" data-message="Send $50 to my mom in the Philippines" onclick="sendMessage(this.dataset.message)">
            <span class="qa-icon">🇵🇭</span><span class="qa-text">Send to Philippines</span>
          </button>
          <button class="quick-action" data-message="Transfer 100 euros to Nigeria every month" onclick="sendMessage(this.dataset.message)">
            <span class="qa-icon">🇳🇬</span><span class="qa-text">Monthly to Nigeria</span>
          </button>
          <button class="quick-action" data-message="Compare fees for sending $200 to Kenya" onclick="sendMessage(this.dataset.message)">
            <span class="qa-icon">📊</span><span class="qa-text">Compare Fees</span>
          </button>
          <button class="quick-action" data-message="Check my balance" onclick="sendMessage(this.dataset.message)">
            <span class="qa-icon">💰</span><span class="qa-text">Check Balance</span>
          </button>
        </div>
        <div class="supported-langs">
          <span class="lang-badge">🇬🇧 English</span>
          <span class="lang-badge">🇪🇸 Español</span>
          <span class="lang-badge">🇧🇷 Português</span>
          <span class="lang-badge">🇫🇷 Français</span>
        </div>
      </div>
    </div>`;
  chatMessages.appendChild(welcome);
}

// ==================== Suggestions ====================
function showSuggestions(actions) {
  suggestedActions.innerHTML = '';
  suggestedActions.style.display = 'flex';

  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = 'suggested-btn';
    btn.textContent = action;
    btn.addEventListener('click', () => sendMessage(action));
    suggestedActions.appendChild(btn);
  });
}

function hideSuggestions() {
  suggestedActions.style.display = 'none';
  suggestedActions.innerHTML = '';
}

// ==================== Dashboard ====================
async function loadDashboard() {
  try {
    const [txRes, schedRes] = await Promise.all([
      fetch(`${API_BASE}/api/transactions`),
      fetch(`${API_BASE}/api/schedules`),
    ]);

    const txData = await txRes.json();
    const schedData = await schedRes.json();

    // Update stats
    const summary = txData.summary || {};
    updateStat('stat-total-sent', `$${(summary.totalSent || 0).toLocaleString()}`);
    updateStat('stat-total-tx', summary.totalTransactions || 0);
    updateStat('stat-recipients', summary.uniqueRecipients || 0);
    updateStat('stat-saved', `$${(summary.totalFeesPaid || 0).toFixed(2)}`);

    // Scheduled transfers
    const schedList = document.getElementById('scheduledList');
    if (schedData.schedules && schedData.schedules.length > 0) {
      schedList.innerHTML = schedData.schedules.map(s => `
        <div class="history-item">
          <div class="history-status">📅</div>
          <div class="history-info">
            <div class="history-corridor">${s.recipientName} (${s.recipientCountry})</div>
            <div class="history-meta">${s.frequency} · Next: ${new Date(s.nextExecutionDate).toLocaleDateString()}</div>
          </div>
          <div class="history-amount">
            <div class="history-sent">${s.amount} ${s.sourceCurrency}</div>
            <div class="history-received">${s.status}</div>
          </div>
        </div>
      `).join('');
    } else {
      schedList.innerHTML = '<p class="empty-state">No scheduled transfers yet</p>';
    }

    // Recent transactions
    const recentList = document.getElementById('recentTxList');
    if (txData.history && txData.history.length > 0) {
      recentList.innerHTML = txData.history.slice(0, 5).map(tx => `
        <div class="history-item">
          <div class="history-status">${tx.status === 'confirmed' ? '✅' : tx.status === 'pending' ? '⏳' : '❌'}</div>
          <div class="history-info">
            <div class="history-corridor">${tx.sendCurrency} → ${tx.receiveCurrency}</div>
            <div class="history-meta">${new Date(tx.timestamp).toLocaleString()}</div>
          </div>
          <div class="history-amount">
            <div class="history-sent">${tx.sendAmount} ${tx.sendCurrency}</div>
            <div class="history-received">→ ${Number(tx.receiveAmount).toLocaleString()} ${tx.receiveCurrency}</div>
          </div>
        </div>
      `).join('');
    } else {
      recentList.innerHTML = '<p class="empty-state">No transactions yet</p>';
    }
  } catch (error) {
    console.error('Dashboard load error:', error);
  }
}

function updateStat(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.querySelector('.stat-value').textContent = value;
  }
}

// ==================== Fee Comparison Page ====================
compareBtn.addEventListener('click', async () => {
  const amount = document.getElementById('compareAmount').value;
  const currency = document.getElementById('compareCurrency').value;
  const country = document.getElementById('compareCountry').value;

  if (!amount || parseFloat(amount) <= 0) return;

  compareBtn.textContent = 'Comparing...';
  compareBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/fees/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, sendCurrency: currency, receiveCountry: country }),
    });
    const data = await res.json();
    renderFeeComparison(data);
  } catch (error) {
    document.getElementById('compareResults').innerHTML =
      '<p class="empty-state">❌ Error loading comparison. Make sure the server is running.</p>';
  } finally {
    compareBtn.textContent = 'Compare';
    compareBtn.disabled = false;
  }
});

function renderFeeComparison(comparison) {
  const container = document.getElementById('compareResults');
  const celo = comparison.celoFees;

  let html = '';

  // Celo card
  html += `
    <div class="fee-card recommended">
      <div class="fee-card-header">
        <span class="fee-provider">🟢 ${celo.provider}</span>
        <span class="fee-badge best">Best Option</span>
      </div>
      <div class="fee-details">
        <div class="fee-detail">
          <span class="fee-detail-label">They Receive</span>
          <span class="fee-detail-value highlight">${Number(celo.receiveAmount).toLocaleString()} ${comparison.receiveCurrency}</span>
        </div>
        <div class="fee-detail">
          <span class="fee-detail-label">Transfer Fee</span>
          <span class="fee-detail-value highlight">$${celo.transferFee.toFixed(2)}</span>
        </div>
        <div class="fee-detail">
          <span class="fee-detail-label">Exchange Rate</span>
          <span class="fee-detail-value">1 ${comparison.sendCurrency} = ${celo.exchangeRate.toFixed(4)} ${comparison.receiveCurrency}</span>
        </div>
        <div class="fee-detail">
          <span class="fee-detail-label">Delivery Time</span>
          <span class="fee-detail-value highlight">${celo.estimatedDelivery}</span>
        </div>
      </div>
    </div>`;

  // Traditional
  for (const provider of comparison.traditionalProviders) {
    html += `
      <div class="fee-card">
        <div class="fee-card-header">
          <span class="fee-provider">🔴 ${provider.provider}</span>
          ${provider.savings > 0 ? `<span class="fee-badge savings">Save ${Number(provider.savings).toLocaleString()} ${comparison.receiveCurrency}</span>` : ''}
        </div>
        <div class="fee-details">
          <div class="fee-detail">
            <span class="fee-detail-label">They Receive</span>
            <span class="fee-detail-value">${Number(provider.receiveAmount).toLocaleString()} ${comparison.receiveCurrency}</span>
          </div>
          <div class="fee-detail">
            <span class="fee-detail-label">Transfer Fee</span>
            <span class="fee-detail-value">$${provider.transferFee.toFixed(2)}</span>
          </div>
          <div class="fee-detail">
            <span class="fee-detail-label">Exchange Rate</span>
            <span class="fee-detail-value">1 ${comparison.sendCurrency} = ${provider.exchangeRate.toFixed(4)} ${comparison.receiveCurrency}</span>
          </div>
          <div class="fee-detail">
            <span class="fee-detail-label">Delivery Time</span>
            <span class="fee-detail-value">${provider.estimatedDelivery}</span>
          </div>
        </div>
      </div>`;
  }

  // Savings summary
  html += `
    <div style="margin-top: 20px; padding: 20px; background: rgba(53,208,127,0.08); border-radius: 12px; border: 1px solid rgba(53,208,127,0.15); text-align: center;">
      <div style="font-size: 2rem; font-weight: 900; color: #35D07F; margin-bottom: 4px;">
        Save up to ${comparison.bestSavingsPercent}%
      </div>
      <div style="color: #9CA3AF; font-size: 0.9rem;">
        That's <strong style="color: #FCFF52;">${Number(comparison.bestSavings).toLocaleString()} ${comparison.receiveCurrency}</strong> more in your recipient's pocket
      </div>
    </div>`;

  container.innerHTML = html;
}

// ==================== Swap & Send Page ====================
if (swapSendBtn) {
  swapSendBtn.addEventListener('click', async () => {
    const recipient = document.getElementById('swapRecipient').value.trim();
    const inputAmount = document.getElementById('swapInputAmount').value;
    const inputCurrency = document.getElementById('swapInputCurrency').value;
    const outputCurrency = document.getElementById('swapOutputCurrency').value;
    const maxSlippage = document.getElementById('swapSlippage').value;

    if (!recipient || !inputAmount || parseFloat(inputAmount) <= 0) return;

    swapSendBtn.textContent = 'Processing...';
    swapSendBtn.disabled = true;
    renderSwapResult({ status: 'pending', message: 'Submitting swap and transfer...' });

    try {
      const res = await fetch(`${API_BASE}/api/swap/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient,
          inputCurrency,
          outputCurrency,
          inputAmount,
          maxSlippage: maxSlippage ? Number(maxSlippage) : undefined,
        }),
      });
      const data = await res.json();
      const baseDetails = {
        recipient,
        inputCurrency,
        outputCurrency,
        inputAmount,
        outputAmount: data?.swap?.outputAmount || '',
      };

      if (!res.ok || !data.success) {
        renderSwapResult({
          status: 'error',
          message: data.error || 'Swap and send failed',
          details: { ...baseDetails, ...(data.result || {}) },
        });
      } else {
        renderSwapResult({
          status: 'success',
          message: 'Swap and send completed',
          details: { ...baseDetails, ...data },
        });
        localStorage.setItem('swapLastRecipient', recipient);
        localStorage.setItem('swapLastInput', inputCurrency);
        localStorage.setItem('swapLastOutput', outputCurrency);
        localStorage.setItem('swapLastAmount', inputAmount);
        loadSwapBalances();
      }
    } catch (error) {
      renderSwapResult({
        status: 'error',
        message: 'Error calling API. Make sure the server is running.',
      });
    } finally {
      swapSendBtn.textContent = 'Swap & Send';
      swapSendBtn.disabled = false;
    }
  });
}

if (swapQuickFillBtn) {
  swapQuickFillBtn.addEventListener('click', () => {
    const recipientEl = document.getElementById('swapRecipient');
    const amountEl = document.getElementById('swapInputAmount');
    const inputEl = document.getElementById('swapInputCurrency');
    const outputEl = document.getElementById('swapOutputCurrency');

    const lastRecipient = localStorage.getItem('swapLastRecipient');
    if (recipientEl && !recipientEl.value && lastRecipient) recipientEl.value = lastRecipient;

    if (amountEl) amountEl.value = localStorage.getItem('swapLastAmount') || '5';
    if (inputEl) inputEl.value = localStorage.getItem('swapLastInput') || 'cUSD';
    if (outputEl) outputEl.value = localStorage.getItem('swapLastOutput') || 'cEUR';
  });
}

if (swapRefreshBalancesBtn) {
  swapRefreshBalancesBtn.addEventListener('click', () => {
    loadSwapBalances();
  });
}

async function loadSwapBalances() {
  const container = document.getElementById('swapBalances');
  if (!container) return;

  container.innerHTML = '<p class="empty-state">Loading balances...</p>';

  try {
    const res = await fetch(`${API_BASE}/api/blockchain/balance`);
    const data = await res.json();
    const balances = data.balances || {};
    const entries = Object.entries(balances);

    if (entries.length === 0) {
      container.innerHTML = '<p class="empty-state">No balances available</p>';
      return;
    }

    let html = '<div class="balance-grid">';
    for (const [symbol, value] of entries) {
      html += `
        <div class="balance-card">
          <div class="balance-label">${symbol}</div>
          <div class="balance-value">${Number(value).toLocaleString()}</div>
        </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = '<p class="empty-state">❌ Failed to load balances</p>';
  }
}

function renderSwapResult(payload) {
  const container = document.getElementById('swapResults');
  if (!container) return;

  if (!payload) {
    container.innerHTML = '<p class="empty-state">No result yet</p>';
    return;
  }

  const status = payload.status || 'info';
  const message = payload.message || 'Swap result';
  const details = payload.details || {};
  const swap = details.swap || null;
  const transfer = details.transfer || null;

  const statusLabel = status === 'success' ? '✅ Success' : status === 'error' ? '❌ Error' : '⏳ Pending';

  let html = `
    <div class="swap-card ${status}">
      <div class="swap-card-header">
        <span class="swap-status">${statusLabel}</span>
        <span class="swap-title">${message}</span>
      </div>
      <div class="swap-card-body">
        <div class="swap-row"><span>Recipient</span><span>${details.recipient || '—'}</span></div>
        <div class="swap-row"><span>Input</span><span>${details.inputCurrency || '—'} ${details.inputAmount || ''}</span></div>
        <div class="swap-row"><span>Output</span><span>${details.outputCurrency || '—'} ${details.outputAmount || ''}</span></div>
      </div>
    </div>`;

  if (swap) {
    html += `
      <div class="swap-card">
        <div class="swap-card-header">
          <span class="swap-status">🔁 Swap</span>
          <span class="swap-title">${swap.txHash ? 'On-chain swap submitted' : 'Swap details'}</span>
        </div>
        <div class="swap-card-body">
          <div class="swap-row"><span>Tx Hash</span><span class="mono">${swap.txHash || '—'}</span></div>
          <div class="swap-row"><span>Block</span><span>${swap.blockNumber || '—'}</span></div>
        </div>
      </div>`;
  }

  if (transfer) {
    html += `
      <div class="swap-card">
        <div class="swap-card-header">
          <span class="swap-status">🚀 Transfer</span>
          <span class="swap-title">${transfer.txHash ? 'Transfer submitted' : 'Transfer details'}</span>
        </div>
        <div class="swap-card-body">
          <div class="swap-row"><span>Tx Hash</span><span class="mono">${transfer.txHash || '—'}</span></div>
          <div class="swap-row"><span>Block</span><span>${transfer.blockNumber || '—'}</span></div>
          <div class="swap-row"><span>Gas Used</span><span>${transfer.gasUsed || '—'}</span></div>
        </div>
      </div>`;
  }

  container.innerHTML = html;
}

// ==================== History Page ====================
async function loadHistory() {
  try {
    const res = await fetch(`${API_BASE}/api/transactions?limit=50`);
    const data = await res.json();
    const container = document.getElementById('historyList');

    if (data.history && data.history.length > 0) {
      container.innerHTML = data.history.map(tx => `
        <div class="history-item">
          <div class="history-status">${tx.status === 'confirmed' ? '✅' : tx.status === 'pending' ? '⏳' : '❌'}</div>
          <div class="history-info">
            <div class="history-corridor">${tx.recipient?.name || 'Unknown'} · ${tx.sendCurrency} → ${tx.receiveCurrency}</div>
            <div class="history-meta">${new Date(tx.timestamp).toLocaleString()} · ${tx.blockchain?.network || 'Celo'}</div>
          </div>
          <div class="history-amount">
            <div class="history-sent">${tx.sendAmount} ${tx.sendCurrency}</div>
            <div class="history-received">→ ${Number(tx.receiveAmount).toLocaleString()} ${tx.receiveCurrency}</div>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p class="empty-state">No transactions yet. Start by sending your first remittance!</p>';
    }
  } catch (error) {
    document.getElementById('historyList').innerHTML =
      '<p class="empty-state">❌ Error loading history. Make sure the server is running.</p>';
  }
}

// ==================== Helpers ====================
function formatMessageContent(content) {
  if (!content) return '';
  // Convert markdown-like formatting
  let html = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
    .replace(/═/g, '═')
    .replace(/───/g, '───');
  return html;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

// ==================== Init ====================
// Focus input on load
chatInput.focus();

// Health check
(async () => {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (res.ok) {
      console.log('✅ CeloRemit Agent connected');
    }
  } catch (e) {
    console.warn('⚠️ Server not available yet');
  }
})();
