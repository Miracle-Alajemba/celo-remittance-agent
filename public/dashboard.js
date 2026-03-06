/**
 * Dashboard Analytics - Real-time Agent Performance Monitoring
 * Fetches data from AgentScan APIs and displays comprehensive metrics
 */

// Chart instances
let trustScoreChart = null;
let successRateChart = null;
let activityChart = null;
let transactionTypeChart = null;

// Mock data for demonstration (replace with real API calls)
const mockAgents = [
  {
    address: '0xAgent001...',
    stats: { trustScore: 95, totalTransactions: 1250, successfulTransactions: 1200, failed: 50, totalVolume: '45000', status: 'healthy' },
  },
  {
    address: '0xAgent002...',
    stats: { trustScore: 87, totalTransactions: 820, successfulTransactions: 780, failed: 40, totalVolume: '32000', status: 'healthy' },
  },
  {
    address: '0xAgent003...',
    stats: { trustScore: 72, totalTransactions: 450, successfulTransactions: 400, failed: 50, totalVolume: '18000', status: 'warning' },
  },
  {
    address: '0xAgent004...',
    stats: { trustScore: 91, totalTransactions: 980, successfulTransactions: 950, failed: 30, totalVolume: '38000', status: 'healthy' },
  },
  {
    address: '0xAgent005...',
    stats: { trustScore: 85, totalTransactions: 650, successfulTransactions: 610, failed: 40, totalVolume: '25000', status: 'healthy' },
  },
];

/**
 * Initialize dashboard on page load
 */
document.addEventListener('DOMContentLoaded', async () => {
  await refreshDashboard();
  // Auto-refresh every 30 seconds
  setInterval(refreshDashboard, 30000);
});

/**
 * Refresh all dashboard data
 */
async function refreshDashboard() {
  try {
    clearError();
    await loadMetrics();
    await loadCharts();
    await loadAgentsTable();
  } catch (error) {
    showError(`Failed to load dashboard: ${error.message}`);
    console.error('Dashboard error:', error);
  }
}

/**
 * Load key metrics
 */
async function loadMetrics() {
  try {
    // Calculate metrics from mock agents
    const totalAgents = mockAgents.length;
    const avgTrustScore = Math.round(
      mockAgents.reduce((sum, a) => sum + a.stats.trustScore, 0) / totalAgents
    );
    const totalVolume = mockAgents
      .reduce((sum, a) => sum + parseFloat(a.stats.totalVolume || 0), 0)
      .toFixed(2);
    const totalTransactions = mockAgents.reduce((sum, a) => sum + a.stats.totalTransactions, 0);
    const successfulTransactions = mockAgents.reduce((sum, a) => sum + a.stats.successfulTransactions, 0);
    const successRate = Math.round((successfulTransactions / totalTransactions) * 100);

    // Update UI
    document.getElementById('totalAgents').textContent = totalAgents;
    document.getElementById('avgTrustScore').textContent = `${avgTrustScore}/100`;
    document.getElementById('totalVolume').textContent = `$${parseFloat(totalVolume).toLocaleString()}`;
    document.getElementById('successRate').textContent = `${successRate}%`;

    // Update changes
    document.getElementById('agentsChange').textContent = '↑ 2 this week';
    document.getElementById('trustScoreChange').textContent = '↑ 3 points';
    document.getElementById('volumeChange').textContent = '↑ $12,000';
    document.getElementById('successChange').textContent = '↑ 2%';
  } catch (error) {
    console.error('Error loading metrics:', error);
  }
}

/**
 * Load and render charts
 */
async function loadCharts() {
  try {
    // Prepare data
    const trustScores = mockAgents.map(a => a.stats.trustScore);
    const agentLabels = mockAgents.map((a, i) => `Agent ${i + 1}`);
    const transactionData = mockAgents.map(a => a.stats.totalTransactions);
    const successData = mockAgents.map(a => a.stats.successfulTransactions);
    const failureData = mockAgents.map(a => a.stats.failed);

    // Trust Score Distribution
    renderTrustScoreChart(agentLabels, trustScores);

    // Success Rate
    renderSuccessRateChart(successData, failureData);

    // Activity Timeline
    renderActivityChart(agentLabels, transactionData);

    // Transaction Type Distribution
    renderTransactionTypeChart();
  } catch (error) {
    console.error('Error loading charts:', error);
  }
}

/**
 * Render Trust Score Distribution Chart
 */
function renderTrustScoreChart(labels, data) {
  const ctx = document.getElementById('trustScoreChart').getContext('2d');

  if (trustScoreChart) trustScoreChart.destroy();

  trustScoreChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Trust Score',
          data,
          backgroundColor: [
            'rgba(53, 208, 127, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(99, 102, 241, 0.8)',
            'rgba(53, 208, 127, 0.8)',
            'rgba(59, 130, 246, 0.8)',
          ],
          borderColor: [
            'rgba(53, 208, 127, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(99, 102, 241, 1)',
            'rgba(53, 208, 127, 1)',
            'rgba(59, 130, 246, 1)',
          ],
          borderWidth: 1,
          borderRadius: 6,
          barThickness: 40,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'rgba(255, 255, 255, 0.5)' },
        },
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(255, 255, 255, 0.5)' },
        },
      },
    },
  });
}

/**
 * Render Success Rate Chart
 */
function renderSuccessRateChart(successData, failureData) {
  const ctx = document.getElementById('successRateChart').getContext('2d');

  if (successRateChart) successRateChart.destroy();

  successRateChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Successful', 'Failed'],
      datasets: [
        {
          data: [
            successData.reduce((a, b) => a + b, 0),
            failureData.reduce((a, b) => a + b, 0),
          ],
          backgroundColor: ['rgba(53, 208, 127, 0.8)', 'rgba(239, 68, 68, 0.8)'],
          borderColor: ['rgba(53, 208, 127, 1)', 'rgba(239, 68, 68, 1)'],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: 'rgba(255, 255, 255, 0.8)', padding: 20 },
        },
      },
    },
  });
}

/**
 * Render Activity Timeline Chart
 */
function renderActivityChart(labels, data) {
  const ctx = document.getElementById('activityChart').getContext('2d');

  if (activityChart) activityChart.destroy();

  activityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Transactions',
          data,
          borderColor: 'rgba(53, 208, 127, 1)',
          backgroundColor: 'rgba(53, 208, 127, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgba(53, 208, 127, 1)',
          pointBorderColor: '#0B0F19',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: 'rgba(255, 255, 255, 0.8)' } },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'rgba(255, 255, 255, 0.5)' },
        },
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(255, 255, 255, 0.5)' },
        },
      },
    },
  });
}

/**
 * Render Transaction Type Distribution Chart
 */
function renderTransactionTypeChart() {
  const ctx = document.getElementById('transactionTypeChart').getContext('2d');

  if (transactionTypeChart) transactionTypeChart.destroy();

  transactionTypeChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Transfer', 'Swap', 'Schedule', 'Fee Check', 'Balance'],
      datasets: [
        {
          label: 'Activity Count',
          data: [320, 180, 150, 420, 290],
          borderColor: 'rgba(53, 208, 127, 1)',
          backgroundColor: 'rgba(53, 208, 127, 0.2)',
          pointBackgroundColor: 'rgba(53, 208, 127, 1)',
          pointBorderColor: '#0B0F19',
          pointBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: 'rgba(255, 255, 255, 0.8)' } },
      },
      scales: {
        r: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: 'rgba(255, 255, 255, 0.5)' },
        },
      },
    },
  });
}

/**
 * Load and render agents table
 */
async function loadAgentsTable() {
  try {
    const tbody = document.getElementById('agentsTableBody');
    tbody.innerHTML = '';

    mockAgents.forEach(agent => {
      const stats = agent.stats;
      const successRate = Math.round((stats.successfulTransactions / stats.totalTransactions) * 100);
      const statusBadgeClass = stats.status === 'healthy' ? 'status-healthy' : 'status-warning';
      const statusText = stats.status === 'healthy' ? '✓ Healthy' : '⚠ Warning';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">${agent.address}</td>
        <td>
          <span class="trust-score">
            <span>⭐</span>
            <span>${stats.trustScore}</span>
          </span>
        </td>
        <td>${stats.totalTransactions.toLocaleString()}</td>
        <td>${successRate}%</td>
        <td>$${parseFloat(stats.totalVolume).toLocaleString()}</td>
        <td>
          <span class="status-badge ${statusBadgeClass}">${statusText}</span>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading agents table:', error);
  }
}

/**
 * Show error message
 */
function showError(message) {
  const errorEl = document.getElementById('errorMessage');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

/**
 * Clear error message
 */
function clearError() {
  const errorEl = document.getElementById('errorMessage');
  errorEl.style.display = 'none';
}

/**
 * Format large numbers
 */
function formatNumber(num) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(num);
}
