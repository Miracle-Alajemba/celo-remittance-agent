const connectWalletBtn = document.getElementById("connectWalletBtn");
const submitTransferBtn = document.getElementById("submitTransferBtn");
const walletStatus = document.getElementById("walletStatus");
const balancesOutput = document.getElementById("balancesOutput");
const networkBanner = document.getElementById("networkBanner");
const resultCard = document.getElementById("resultCard");
const resultOutput = document.getElementById("resultOutput");
const sessionCard = document.getElementById("sessionCard");
const sessionOutput = document.getElementById("sessionOutput");
const signTransferForm = document.getElementById("signTransferForm");

const recipientInput = document.getElementById("recipientInput");
const amountInput = document.getElementById("amountInput");
const currencySelect = document.getElementById("currencySelect");
const recipientNameInput = document.getElementById("recipientNameInput");
const countryInput = document.getElementById("countryInput");

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

let signerConfig = null;
let browserProvider = null;
let signer = null;
let connectedAddress = null;
let approvalSession = null;

function setStatus(message, kind = "") {
  walletStatus.className = "wallet-status";
  if (kind) {
    walletStatus.classList.add(kind);
  }
  walletStatus.textContent = message;
}

function setResult(html, kind = "") {
  resultCard.hidden = false;
  resultOutput.className = kind;
  resultOutput.innerHTML = html;
}

function setSessionSummary(html) {
  if (!sessionCard || !sessionOutput) return;
  sessionCard.hidden = false;
  sessionOutput.innerHTML = html;
}

function getTelegramReturnLink() {
  return approvalSession?.telegramBotUrl || signerConfig?.telegramBotUrl || null;
}

function getExplorerTxUrl(txHash) {
  if (!signerConfig?.network?.explorerBaseUrl) return null;
  return `${signerConfig.network.explorerBaseUrl}/tx/${txHash}`;
}

function normalizeCurrency(input) {
  const raw = String(input || "").trim();
  if (!raw) return raw;
  const upper = raw.toUpperCase();
  return signerConfig?.currencyAliases?.[upper] || raw;
}

async function fetchSignerConfig() {
  const response = await fetch("/api/wallet-signer/config");
  if (!response.ok) {
    throw new Error("Failed to load signer configuration.");
  }
  signerConfig = await response.json();
  networkBanner.textContent = `Network: ${signerConfig.network.label} · Chain ID: ${signerConfig.network.chainId}`;
}

function applyQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session");
  if (sessionId) {
    return;
  }
  recipientInput.value = params.get("recipient") || "";
  amountInput.value = params.get("amount") || "";
  recipientNameInput.value = params.get("recipientName") || "";
  countryInput.value = params.get("recipientCountry") || "";

  const currency = params.get("currency");
  if (currency) {
    currencySelect.value = normalizeCurrency(currency);
  }
}

function setManualFieldsDisabled(disabled) {
  recipientInput.disabled = disabled;
  amountInput.disabled = disabled;
  currencySelect.disabled = disabled;
  recipientNameInput.disabled = disabled;
  countryInput.disabled = disabled;
}

async function loadApprovalSession() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session");
  if (!sessionId) return;

  const response = await fetch(`/api/wallet-approval/session/${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    throw new Error("Failed to load wallet approval session.");
  }

  approvalSession = await response.json();
  const requested = approvalSession.requestedTransfer;
  const execution = approvalSession.executionPlan;

  recipientInput.value = requested.recipientAddress || "";
  amountInput.value = requested.amount || "";
  currencySelect.value = normalizeCurrency(requested.sourceCurrency);
  recipientNameInput.value = requested.recipientName || "";
  countryInput.value = requested.recipientCountry || "";
  setManualFieldsDisabled(true);
  submitTransferBtn.textContent = "Approve this transfer with connected wallet";

  setSessionSummary(
    [
      `<div><strong>Status:</strong> ${approvalSession.status}</div>`,
      `<div><strong>Requested:</strong> ${requested.amount} ${requested.sourceCurrency}</div>`,
      `<div><strong>Recipient:</strong> ${requested.recipientName} (${requested.recipientCountry})</div>`,
      `<div><strong>Recipient wallet:</strong> <span class="mono">${requested.recipientAddress}</span></div>`,
      `<div><strong>Execution funding:</strong> ${execution.executionSourceAmount} ${execution.executionSourceCurrency}</div>`,
      `<div><strong>Estimated delivery:</strong> ${execution.estimatedReceiveAmount} ${execution.targetCurrency}</div>`,
      execution.routeSummary ? `<div><strong>Route:</strong> ${execution.routeSummary}</div>` : "",
      `<div><strong>Expires:</strong> ${new Date(approvalSession.expiresAt).toLocaleString()}</div>`,
      approvalSession.backendSignerAvailable === false
        ? `<div class="error"><strong>Agent execution unavailable:</strong> the backend signer is not configured yet, so Telegram can preview this transfer but cannot finish it after approval.</div>`
        : "",
    ]
      .filter(Boolean)
      .join(""),
  );
}

async function ensureCeloNetwork() {
  if (!window.ethereum || !signerConfig) return;
  const params = signerConfig.network;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: params.chainIdHex }],
    });
  } catch (error) {
    if (error?.code !== 4902) {
      throw error;
    }

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: params.chainIdHex,
          chainName: params.label,
          nativeCurrency: {
            name: "Celo",
            symbol: "CELO",
            decimals: 18,
          },
          rpcUrls: [params.rpcUrl],
          blockExplorerUrls: [params.explorerBaseUrl],
        },
      ],
    });
  }
}

async function loadBalances() {
  if (!browserProvider || !connectedAddress) return;

  const rows = [];
  const celoBalance = await browserProvider.getBalance(connectedAddress);
  rows.push(`CELO: ${ethers.formatEther(celoBalance)}`);

  const visibleTokens = ["cUSD", "cEUR", "USDm", "EURm", "KESm", "NGNm", "PHPm"];
  for (const symbol of visibleTokens) {
    const tokenAddress = signerConfig?.stablecoinAddresses?.[symbol];
    if (!tokenAddress) continue;

    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, browserProvider);
      const [balance, decimals] = await Promise.all([
        contract.balanceOf(connectedAddress),
        contract.decimals(),
      ]);
      rows.push(`${symbol}: ${ethers.formatUnits(balance, decimals)}`);
    } catch (_error) {
      rows.push(`${symbol}: unavailable`);
    }
  }

  balancesOutput.textContent = rows.join("\n");
}

async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("No injected wallet found. Install MetaMask or another wallet with window.ethereum support.");
  }

  browserProvider = new ethers.BrowserProvider(window.ethereum);
  await browserProvider.send("eth_requestAccounts", []);
  await ensureCeloNetwork();
  browserProvider = new ethers.BrowserProvider(window.ethereum);
  signer = await browserProvider.getSigner();
  connectedAddress = await signer.getAddress();

  setStatus(`Connected wallet: ${connectedAddress}`, "success");
  await loadBalances();
}

async function performTransfer(event) {
  event.preventDefault();

  if (!signer || !browserProvider || !connectedAddress) {
    setResult("Connect a wallet before signing a transfer.", "error");
    return;
  }

  const recipient = recipientInput.value.trim();
  const amount = amountInput.value.trim();
  const requestedCurrency = currencySelect.value;
  const currency = normalizeCurrency(requestedCurrency);

  submitTransferBtn.disabled = true;
  submitTransferBtn.textContent = approvalSession
    ? "Waiting for wallet approval..."
    : "Waiting for wallet signature...";

  try {
    if (approvalSession) {
      if (approvalSession.backendSignerAvailable === false || signerConfig?.backendSignerAvailable === false) {
        throw new Error(
          "Backend execution is not available yet. Restore a valid PRIVATE_KEY before using the Telegram approval flow.",
        );
      }

      const signature = await signer.signMessage(approvalSession.approvalMessage);
      const approveRes = await fetch(
        `/api/wallet-approval/session/${encodeURIComponent(approvalSession.id)}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: connectedAddress,
            signature,
          }),
        },
      );
      const approveData = await approveRes.json();
      if (!approveRes.ok) {
        throw new Error(approveData.error || "Wallet approval failed.");
      }

      const telegramReturnLink = getTelegramReturnLink();

      setResult(
        [
          "<strong>Wallet approval sent successfully.</strong>",
          `<div>Approved wallet: <span class="mono">${connectedAddress}</span></div>`,
          approveData.txHash
            ? `<div>Tx hash: <span class="mono">${approveData.txHash}</span></div>`
            : "",
          approveData.botResponse
            ? `<div>${approveData.botResponse}</div>`
            : "<div>Telegram will receive the receipt and final status.</div>",
          telegramReturnLink
            ? `<div><a href="${telegramReturnLink}" target="_blank" rel="noreferrer">Return to Telegram</a></div>`
            : "",
        ]
          .filter(Boolean)
          .join(""),
        "success",
      );
      return;
    }

    if (!ethers.isAddress(recipient)) {
      setResult("Recipient address is invalid.", "error");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setResult("Enter a valid transfer amount.", "error");
      return;
    }

    let tx;

    if (currency.toUpperCase() === "CELO") {
      tx = await signer.sendTransaction({
        to: recipient,
        value: ethers.parseEther(amount),
      });
    } else {
      const tokenAddress =
        signerConfig?.stablecoinAddresses?.[currency] ||
        signerConfig?.stablecoinAddresses?.[currency.toUpperCase()];

      if (!tokenAddress) {
        throw new Error(`Unsupported token for browser signing: ${currency}`);
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const decimals = await tokenContract.decimals();
      tx = await tokenContract.transfer(recipient, ethers.parseUnits(amount, decimals));
    }

    setResult(
      `Transaction submitted.<br><span class="mono">${tx.hash}</span>`,
      "success",
    );

    const receipt = await tx.wait();
    const explorerUrl = getExplorerTxUrl(tx.hash);
    const explorerLink = explorerUrl
      ? `<a href="${explorerUrl}" target="_blank" rel="noreferrer">View on explorer</a>`
      : "";

    setResult(
      [
        `<strong>Transfer signed successfully.</strong>`,
        `<div>Tx hash: <span class="mono">${tx.hash}</span></div>`,
        receipt?.blockNumber
          ? `<div>Block: ${receipt.blockNumber}</div>`
          : "",
        explorerLink,
      ]
        .filter(Boolean)
        .join(""),
      "success",
    );

    await loadBalances();
  } catch (error) {
    const message = error?.reason || error?.shortMessage || error?.message || "Transfer failed.";
    setResult(message, "error");
  } finally {
    submitTransferBtn.disabled = false;
    submitTransferBtn.textContent = approvalSession
      ? "Approve this transfer with connected wallet"
      : "Sign transfer with connected wallet";
  }
}

connectWalletBtn.addEventListener("click", async () => {
  try {
    await connectWallet();
  } catch (error) {
    const message = error?.message || "Wallet connection failed.";
    setStatus(message, "error");
  }
});

signTransferForm.addEventListener("submit", performTransfer);

(async function init() {
  try {
    await fetchSignerConfig();
    await loadApprovalSession();
    applyQueryParams();
  } catch (error) {
    networkBanner.textContent = error?.message || "Failed to load signer config.";
    networkBanner.classList.add("error");
  }
})();
