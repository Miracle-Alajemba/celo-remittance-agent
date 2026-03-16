/**
 * Dashboard Analytics - Real-time Agent Performance Monitoring
 * Fetches data from Backend APIs and displays comprehensive metrics
 */

// Chart instances
let transactionChart = null;
let currencyChart = null;
let corridorChart = null;
let languageChart = null;

// API Base URL
const API_BASE = "http://localhost:3001/api/dashboard";

// Mock data for demonstration (replace with real API calls)
const mockAgents = [
  {
    address: "0xAgent001...",
    stats: {
      trustScore: 95,
      totalTransactions: 1250,
      successfulTransactions: 1200,
      failed: 50,
      totalVolume: "45000",
      status: "healthy",
    },
  },
  {
    address: "0xAgent002...",
    stats: {
      trustScore: 87,
      totalTransactions: 820,
      successfulTransactions: 780,
      failed: 40,
      totalVolume: "32000",
      status: "healthy",
    },
  },
  {
    address: "0xAgent003...",
    stats: {
      trustScore: 72,
      totalTransactions: 450,
      successfulTransactions: 400,
      failed: 50,
      totalVolume: "18000",
      status: "warning",
    },
  },
  {
    address: "0xAgent004...",
    stats: {
      trustScore: 91,
      totalTransactions: 980,
      successfulTransactions: 950,
      failed: 30,
      totalVolume: "38000",
      status: "healthy",
    },
  },
  {
    address: "0xAgent005...",
    stats: {
      trustScore: 85,
      totalTransactions: 650,
      successfulTransactions: 610,
      failed: 40,
      totalVolume: "25000",
      status: "healthy",
    },
  },
];

/**
 * Initialize dashboard on page load
 */
document.addEventListener("DOMContentLoaded", async () => {
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

    // Fetch all dashboard data in parallel
    const [stats, transactions, users, performance] = await Promise.all([
      fetch(`${API_BASE}/stats`).then((r) => r.json()),
      fetch(`${API_BASE}/transactions`).then((r) => r.json()),
      fetch(`${API_BASE}/users`).then((r) => r.json()),
      fetch(`${API_BASE}/performance`).then((r) => r.json()),
    ]);

    // Update all sections
    updateOverviewStats(stats.overview);
    updateTransactionCharts(transactions);
    updateUserStats(users);
    updatePerformanceMetrics(performance);

    console.log("✅ Dashboard updated at", new Date().toLocaleTimeString());
  } catch (error) {
    showError("Failed to fetch dashboard data: " + error.message);
    console.error("Dashboard error:", error);
  }
}

/**
 * Update overview statistics cards
 */
function updateOverviewStats(overview) {
  if (!overview) return;

  document.getElementById("metric-transactions").textContent =
    overview.totalTransactions.toLocaleString();
  document.getElementById("metric-volume").textContent =
    `$${overview.totalVolume.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  document.getElementById("metric-success").textContent =
    overview.successRate + "%";
  document.getElementById("metric-users").textContent =
    overview.activeUsers.toLocaleString();
  document.getElementById("metric-fee").textContent =
    `$${parseFloat(overview.averageFee).toFixed(2)}`;
  document.getElementById("metric-savings").textContent =
    `$${parseFloat(overview.totalFeesSaved).toFixed(2)}`;

  // Update status indicator
  const statusEl = document.getElementById("system-status");
  if (statusEl) {
    statusEl.innerHTML = "🟢 Healthy";
  }
}

/**
 * Update transaction charts
 */
function updateTransactionCharts(data) {
  if (!data || !data.daily) return;

  // Transaction Timeline Chart
  updateTimelineChart(data.daily);

  // Currency Distribution Pie Chart
  updateCurrencyChart(data.byCurrency);

  // Top Corridors Bar Chart
  updateCorridorChart(data.topCorridors);
}

/**
 * Update timeline chart
 */
function updateTimelineChart(daily) {
  const ctx = document.getElementById("chart-transactions");
  if (!ctx) return;

  const dates = daily.map((d) => d.date);
  const transactions = daily.map((d) => d.transactions);
  const volumes = daily.map((d) => d.volume);

  if (transactionChart) {
    transactionChart.destroy();
  }

  transactionChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Transactions",
          data: transactions,
          borderColor: "#35D07F",
          backgroundColor: "rgba(53, 208, 127, 0.1)",
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          yAxisID: "y",
        },
        {
          label: "Volume (USD)",
          data: volumes,
          borderColor: "#FCFF52",
          backgroundColor: "rgba(252, 255, 82, 0.1)",
          borderWidth: 2,
          tension: 0.4,
          fill: false,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        y: {
          type: "linear",
          display: true,
          position: "left",
          title: {
            display: true,
            text: "Transactions",
            color: "#35D07F",
          },
          ticks: {
            color: "#9CA3AF",
          },
          grid: {
            color: "rgba(255, 255, 255, 0.05)",
          },
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          title: {
            display: true,
            text: "Volume (USD)",
            color: "#FCFF52",
          },
          ticks: {
            color: "#9CA3AF",
          },
          grid: {
            drawOnChartArea: false,
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "#F9FAFB",
          },
        },
      },
    },
  });
}

/**
 * Update currency distribution pie chart
 */
function updateCurrencyChart(currencies) {
  const ctx = document.getElementById("chart-currencies");
  if (!ctx) return;

  const labels = currencies.map((c) => c.name);
  const data = currencies.map((c) => c.value);
  const colors = ["#35D07F", "#FCFF52", "#3B82F6", "#6366F1", "#F59E0B"];

  if (currencyChart) {
    currencyChart.destroy();
  }

  currencyChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: "#111827",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#F9FAFB",
            padding: 20,
          },
        },
      },
    },
  });
}

/**
 * Update corridors bar chart
 */
function updateCorridorChart(corridors) {
  const ctx = document.getElementById("chart-corridors");
  if (!ctx) return;

  const labels = corridors.map((c) => c.name);
  const data = corridors.map((c) => c.value);

  if (corridorChart) {
    corridorChart.destroy();
  }

  corridorChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Transfers",
          data,
          backgroundColor: "#3B82F6",
          borderColor: "#1E40AF",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: "#9CA3AF",
          },
          grid: {
            color: "rgba(255, 255, 255, 0.05)",
          },
        },
        x: {
          ticks: {
            color: "#9CA3AF",
          },
          grid: {
            color: "rgba(255, 255, 255, 0.05)",
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "#F9FAFB",
          },
        },
      },
    },
  });
}

/**
 * Update user statistics
 */
function updateUserStats(users) {
  if (!users) return;

  // Update user count cards
  const totalEl = document.getElementById("user-total");
  const activeEl = document.getElementById("user-active");
  const newEl = document.getElementById("user-new");

  if (totalEl) totalEl.textContent = users.totalUsers.toLocaleString();
  if (activeEl) activeEl.textContent = users.activeUsers.toLocaleString();
  if (newEl) newEl.textContent = users.newUsers.toLocaleString();

  // Update language distribution
  updateLanguageChart(users.byLanguage);
}

/**
 * Update language distribution chart
 */
function updateLanguageChart(byLanguage) {
  const ctx = document.getElementById("chart-languages");
  if (!ctx) return;

  const labels = ["English", "Spanish", "Portuguese", "French"];
  const langCodes = ["en", "es", "pt", "fr"];
  const data = langCodes.map((code) => byLanguage[code] || 0);
  const colors = ["#3B82F6", "#F59E0B", "#10B981", "#8B5CF6"];

  if (languageChart) {
    languageChart.destroy();
  }

  languageChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Users by Language",
          data,
          backgroundColor: colors,
          borderColor: colors.map((c) => c),
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            color: "#9CA3AF",
          },
          grid: {
            color: "rgba(255, 255, 255, 0.05)",
          },
        },
        y: {
          ticks: {
            color: "#9CA3AF",
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "#F9FAFB",
          },
        },
      },
    },
  });
}

/**
 * Update performance metrics
 */
function updatePerformanceMetrics(perf) {
  if (!perf) return;

  // Update uptime
  const uptimeEl = document.getElementById("perf-uptime");
  if (uptimeEl) {
    uptimeEl.textContent = perf.uptime.formatted;
  }

  // Update memory usage
  const memEl = document.getElementById("perf-memory");
  if (memEl) {
    memEl.textContent = perf.memory.heapUsed + " / " + perf.memory.heapTotal;
  }

  // Update database status
  const dbEl = document.getElementById("perf-database");
  if (dbEl) {
    const status = perf.database.connected ? "🟢 Connected" : "🔴 Disconnected";
    dbEl.textContent = status;
  }
}

/**
 * Show error message
 */
function showError(message) {
  const errorEl = document.getElementById("errorMessage");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = "block";
  }
}

/**
 * Clear error message
 */
function clearError() {
  const errorEl = document.getElementById("errorMessage");
  if (errorEl) {
    errorEl.style.display = "none";
  }
}

/**
 * Manual refresh button
 */
function manualRefresh() {
  document.getElementById("refresh-btn").textContent = "⟳ Refreshing...";
  refreshDashboard().then(() => {
    document.getElementById("refresh-btn").textContent = "⟳ Refresh";
  });
}

// Expose functions for HTML onclick
window.manualRefresh = manualRefresh;

/**
 * Load key metrics
 */
async function loadMetrics() {
  try {
    // Calculate metrics from mock agents
    const totalAgents = mockAgents.length;
    const avgTrustScore = Math.round(
      mockAgents.reduce((sum, a) => sum + a.stats.trustScore, 0) / totalAgents,
    );
    const totalVolume = mockAgents
      .reduce((sum, a) => sum + parseFloat(a.stats.totalVolume || 0), 0)
      .toFixed(2);
    const totalTransactions = mockAgents.reduce(
      (sum, a) => sum + a.stats.totalTransactions,
      0,
    );
    const successfulTransactions = mockAgents.reduce(
      (sum, a) => sum + a.stats.successfulTransactions,
      0,
    );
    const successRate = Math.round(
      (successfulTransactions / totalTransactions) * 100,
    );

    // Update UI
    document.getElementById("totalAgents").textContent = totalAgents;
    document.getElementById("avgTrustScore").textContent =
      `${avgTrustScore}/100`;
    document.getElementById("totalVolume").textContent =
      `$${parseFloat(totalVolume).toLocaleString()}`;
    document.getElementById("successRate").textContent = `${successRate}%`;

    // Update changes
    document.getElementById("agentsChange").textContent = "↑ 2 this week";
    document.getElementById("trustScoreChange").textContent = "↑ 3 points";
    document.getElementById("volumeChange").textContent = "↑ $12,000";
    document.getElementById("successChange").textContent = "↑ 2%";
  } catch (error) {
    console.error("Error loading metrics:", error);
  }
}

/**
 * Load and render charts
 */
async function loadCharts() {
  try {
    // Prepare data
    const trustScores = mockAgents.map((a) => a.stats.trustScore);
    const agentLabels = mockAgents.map((a, i) => `Agent ${i + 1}`);
    const transactionData = mockAgents.map((a) => a.stats.totalTransactions);
    const successData = mockAgents.map((a) => a.stats.successfulTransactions);
    const failureData = mockAgents.map((a) => a.stats.failed);

    // Trust Score Distribution
    renderTrustScoreChart(agentLabels, trustScores);

    // Success Rate
    renderSuccessRateChart(successData, failureData);

    // Activity Timeline
    renderActivityChart(agentLabels, transactionData);

    // Transaction Type Distribution
    renderTransactionTypeChart();
  } catch (error) {
    console.error("Error loading charts:", error);
  }
}

/**
 * Render Trust Score Distribution Chart
 */
function renderTrustScoreChart(labels, data) {
  const ctx = document.getElementById("trustScoreChart").getContext("2d");

  if (trustScoreChart) trustScoreChart.destroy();

  trustScoreChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Trust Score",
          data,
          backgroundColor: [
            "rgba(53, 208, 127, 0.8)",
            "rgba(59, 130, 246, 0.8)",
            "rgba(99, 102, 241, 0.8)",
            "rgba(53, 208, 127, 0.8)",
            "rgba(59, 130, 246, 0.8)",
          ],
          borderColor: [
            "rgba(53, 208, 127, 1)",
            "rgba(59, 130, 246, 1)",
            "rgba(99, 102, 241, 1)",
            "rgba(53, 208, 127, 1)",
            "rgba(59, 130, 246, 1)",
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
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "rgba(255, 255, 255, 0.5)" },
        },
        x: {
          grid: { display: false },
          ticks: { color: "rgba(255, 255, 255, 0.5)" },
        },
      },
    },
  });
}

/**
 * Render Success Rate Chart
 */
function renderSuccessRateChart(successData, failureData) {
  const ctx = document.getElementById("successRateChart").getContext("2d");

  if (successRateChart) successRateChart.destroy();

  successRateChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Successful", "Failed"],
      datasets: [
        {
          data: [
            successData.reduce((a, b) => a + b, 0),
            failureData.reduce((a, b) => a + b, 0),
          ],
          backgroundColor: [
            "rgba(53, 208, 127, 0.8)",
            "rgba(239, 68, 68, 0.8)",
          ],
          borderColor: ["rgba(53, 208, 127, 1)", "rgba(239, 68, 68, 1)"],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "rgba(255, 255, 255, 0.8)", padding: 20 },
        },
      },
    },
  });
}

/**
 * Render Activity Timeline Chart
 */
function renderActivityChart(labels, data) {
  const ctx = document.getElementById("activityChart").getContext("2d");

  if (activityChart) activityChart.destroy();

  activityChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Transactions",
          data,
          borderColor: "rgba(53, 208, 127, 1)",
          backgroundColor: "rgba(53, 208, 127, 0.1)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "rgba(53, 208, 127, 1)",
          pointBorderColor: "#0B0F19",
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
        legend: {
          display: true,
          labels: { color: "rgba(255, 255, 255, 0.8)" },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "rgba(255, 255, 255, 0.5)" },
        },
        x: {
          grid: { display: false },
          ticks: { color: "rgba(255, 255, 255, 0.5)" },
        },
      },
    },
  });
}

/**
 * Render Transaction Type Distribution Chart
 */
function renderTransactionTypeChart() {
  const ctx = document.getElementById("transactionTypeChart").getContext("2d");

  if (transactionTypeChart) transactionTypeChart.destroy();

  transactionTypeChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["Transfer", "Swap", "Schedule", "Fee Check", "Balance"],
      datasets: [
        {
          label: "Activity Count",
          data: [320, 180, 150, 420, 290],
          borderColor: "rgba(53, 208, 127, 1)",
          backgroundColor: "rgba(53, 208, 127, 0.2)",
          pointBackgroundColor: "rgba(53, 208, 127, 1)",
          pointBorderColor: "#0B0F19",
          pointBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "rgba(255, 255, 255, 0.8)" } },
      },
      scales: {
        r: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "rgba(255, 255, 255, 0.5)" },
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
    const tbody = document.getElementById("agentsTableBody");
    tbody.innerHTML = "";

    mockAgents.forEach((agent) => {
      const stats = agent.stats;
      const successRate = Math.round(
        (stats.successfulTransactions / stats.totalTransactions) * 100,
      );
      const statusBadgeClass =
        stats.status === "healthy" ? "status-healthy" : "status-warning";
      const statusText = stats.status === "healthy" ? "✓ Healthy" : "⚠ Warning";

      const row = document.createElement("tr");
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
    console.error("Error loading agents table:", error);
  }
}

/**
 * Show error message
 */
function showError(message) {
  const errorEl = document.getElementById("errorMessage");
  errorEl.textContent = message;
  errorEl.style.display = "block";
}

/**
 * Clear error message
 */
function clearError() {
  const errorEl = document.getElementById("errorMessage");
  errorEl.style.display = "none";
}

/**
 * Format large numbers
 */
function formatNumber(num) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
  }).format(num);
}
