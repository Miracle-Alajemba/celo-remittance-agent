const { ethers } = window;

const connectWalletBtn = document.getElementById("connectWalletBtn");
const walletStatus = document.getElementById("walletStatus");
const networkBanner = document.getElementById("networkBanner");
const resultCard = document.getElementById("resultCard");
const resultOutput = document.getElementById("resultOutput");
const sessionCard = document.getElementById("sessionCard");
const sessionOutput = document.getElementById("sessionOutput");
const pageEyebrow = document.getElementById("pageEyebrow");
const pageTitle = document.getElementById("pageTitle");
const pageLead = document.getElementById("pageLead");

let signerConfig = null;
let browserProvider = null;
let signer = null;
let connectedAddress = null;
let approvalSession = null;
let authSession = null;
let appKit = null;
let appKitReadyPromise = null;
let sessionActionInFlight = false;

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

const BROKER_SWAP_ABI = [
  "function swapIn(address exchangeProvider, bytes32 exchangeId, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOutMin) returns (uint256 amountOut)",
];

const ROUTER_SWAP_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut)[] path) returns (uint256[] amounts)",
];

function isSessionMode() {
  return Boolean(authSession || approvalSession);
}

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
  sessionCard.hidden = false;
  sessionOutput.innerHTML = html;
}

function setExpiredState(message) {
  pageEyebrow.textContent = "Telegram sign-in";
  pageTitle.textContent = "Session expired";
  pageLead.textContent = "Go back to Telegram and request a fresh secure link.";
  networkBanner.textContent = message;
  networkBanner.classList.add("error");
  connectWalletBtn.hidden = true;
  setStatus(message, "error");
}

function applyBaseUi() {
  pageEyebrow.textContent = "Telegram sign-in";
  pageTitle.textContent = "Continue With Your Wallet";
  pageLead.textContent =
    "Opened from Telegram. Connect once and continue.";
}

function applyAuthModeUi() {
  document.body.classList.add("auth-mode");
  pageEyebrow.textContent = "Telegram sign-in";
  pageTitle.textContent = "Connect To Continue";
  pageLead.textContent =
    "Connect your wallet and sign once. Telegram will continue automatically.";
}

function applyApprovalModeUi() {
  document.body.classList.add("approval-mode");
  pageEyebrow.textContent = "Transfer approval";
  pageTitle.textContent = "Send This Transfer";
  pageLead.textContent =
    "Review the summary, connect your wallet, and send it securely. Telegram will send the final update.";
}

function updatePrimaryActionButton() {
  if (authSession) {
    connectWalletBtn.textContent = connectedAddress
      ? "Signing in..."
      : "Connect wallet";
    return;
  }

  if (approvalSession) {
    connectWalletBtn.textContent = connectedAddress
      ? "Sending transfer..."
      : "Connect wallet";
    return;
  }

  connectWalletBtn.textContent = connectedAddress ? "Wallet connected" : "Connect wallet";
}

function getReturnLink() {
  return (
    approvalSession?.returnUrl ||
    authSession?.returnUrl ||
    approvalSession?.telegramBotUrl ||
    authSession?.telegramBotUrl ||
    signerConfig?.telegramBotUrl ||
    null
  );
}

function getReturnLabel() {
  return (
    approvalSession?.returnLabel ||
    authSession?.returnLabel ||
    "Return to Telegram"
  );
}

function normalizeCurrencySymbol(symbol) {
  if (!symbol) return symbol;
  const aliases = signerConfig?.currencyAliases || {};
  return aliases[symbol] || aliases[symbol?.toUpperCase?.()] || symbol;
}

function formatExplorerLink(txHash) {
  if (!signerConfig?.network?.explorerBaseUrl || !txHash) return txHash;
  const href = `${signerConfig.network.explorerBaseUrl}/tx/${txHash}`;
  return `<a href="${href}" target="_blank" rel="noreferrer" class="mono">${txHash}</a>`;
}

async function fetchJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  headers.set("ngrok-skip-browser-warning", "true");

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const responseText = await response.text();
  let data = null;

  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch (_error) {
    if (responseText.trim().startsWith("<!DOCTYPE")) {
      throw new Error(
        "The public tunnel returned an HTML page instead of the API response. Refresh the link and try again.",
      );
    }
    throw new Error(responseText || "Unexpected response from the server.");
  }

  return { response, data };
}

async function assertConnectedWalletNetwork() {
  if (!browserProvider || !signerConfig?.network?.chainId) return;
  const network = await browserProvider.getNetwork();
  const connectedChainId = Number(network.chainId);
  if (connectedChainId !== signerConfig.network.chainId) {
    throw new Error(`Switch your wallet to ${signerConfig.network.label} and try again.`);
  }
}

function getStablecoinAddress(symbol, stablecoinAddresses = signerConfig?.stablecoinAddresses || {}) {
  const normalized = normalizeCurrencySymbol(symbol);
  return (
    stablecoinAddresses[normalized] ||
    stablecoinAddresses[normalized?.toUpperCase?.()] ||
    null
  );
}

async function getAssetBalance(symbol, address, stablecoinAddresses) {
  const normalized = normalizeCurrencySymbol(symbol);
  if (normalized?.toUpperCase?.() === "CELO") {
    return browserProvider.getBalance(address);
  }

  const tokenAddress = getStablecoinAddress(normalized, stablecoinAddresses);
  if (!tokenAddress) {
    throw new Error(`Unsupported token for browser execution: ${normalized}`);
  }

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  return token.balanceOf(address);
}

async function ensureTokenAllowance(tokenAddress, spender, amount) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const owner = await signer.getAddress();
  const currentAllowance = await token.allowance(owner, spender);

  if (currentAllowance >= amount) {
    return;
  }

  setStatus("Approving token access...");
  const approvalTx = await token.approve(spender, amount);
  await approvalTx.wait();
}

async function waitForConfirmedTransaction(txPromise, statusMessage) {
  if (statusMessage) {
    setStatus(statusMessage);
  }
  const tx = await txPromise;
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("The transaction failed on-chain.");
  }
  return { tx, receipt };
}

async function executeBrowserSwapAndTransfer(executionPayload) {
  await assertConnectedWalletNetwork();

  const stablecoinAddresses =
    executionPayload.stablecoinAddresses || signerConfig?.stablecoinAddresses || {};
  const senderAddress = await signer.getAddress();
  const recipientAddress = executionPayload.recipientAddress;

  if (!ethers.isAddress(recipientAddress)) {
    throw new Error("Recipient address is invalid.");
  }

  const sourceCurrency = normalizeCurrencySymbol(executionPayload.executionSourceCurrency);
  const targetCurrency = normalizeCurrencySymbol(executionPayload.targetCurrency);

  if (!executionPayload.requiresSwap) {
    const transferTx = await executeDirectTransfer({
      currency: sourceCurrency,
      amount: executionPayload.executionSourceAmount,
      recipientAddress,
      stablecoinAddresses,
    });

    return {
      txHash: transferTx.tx.hash,
      blockNumber: transferTx.receipt.blockNumber,
      gasUsed: transferTx.receipt.gasUsed?.toString(),
      receiveAmount: executionPayload.executionSourceAmount,
      receiveCurrency: sourceCurrency,
    };
  }

  const swapPlan = executionPayload.swapPlan;
  if (!swapPlan) {
    throw new Error("Swap plan is missing from the Telegram session.");
  }

  const tokenOutBefore = await getAssetBalance(
    swapPlan.tokenOut.symbol,
    senderAddress,
    stablecoinAddresses,
  );

  await ensureTokenAllowance(
    swapPlan.tokenIn.address,
    swapPlan.spender,
    BigInt(swapPlan.amountIn),
  );

  if (swapPlan.mode === "direct") {
    const broker = new ethers.Contract(swapPlan.spender, BROKER_SWAP_ABI, signer);
    await waitForConfirmedTransaction(
      broker.swapIn(
        swapPlan.directHop.exchangeProvider,
        swapPlan.directHop.exchangeId,
        swapPlan.tokenIn.address,
        swapPlan.tokenOut.address,
        BigInt(swapPlan.amountIn),
        BigInt(swapPlan.minAmountOut),
      ),
      "Executing swap...",
    );
  } else {
    const router = new ethers.Contract(swapPlan.spender, ROUTER_SWAP_ABI, signer);
    await waitForConfirmedTransaction(
      router.swapExactTokensForTokens(
        BigInt(swapPlan.amountIn),
        BigInt(swapPlan.minAmountOut),
        swapPlan.steps,
      ),
      "Executing swap...",
    );
  }

  const tokenOutAfter = await getAssetBalance(
    swapPlan.tokenOut.symbol,
    senderAddress,
    stablecoinAddresses,
  );
  const receivedAmountRaw = tokenOutAfter - tokenOutBefore;

  if (receivedAmountRaw <= 0n) {
    throw new Error("Swap completed, but no destination balance was detected for transfer.");
  }

  const transferTx = await executeDirectTransfer({
    currency: swapPlan.tokenOut.symbol,
    amountRaw: receivedAmountRaw,
    recipientAddress,
    stablecoinAddresses,
  });

  return {
    txHash: transferTx.tx.hash,
    blockNumber: transferTx.receipt.blockNumber,
    gasUsed: transferTx.receipt.gasUsed?.toString(),
    receiveAmount: ethers.formatUnits(receivedAmountRaw, swapPlan.tokenOut.decimals),
    receiveCurrency: targetCurrency || swapPlan.tokenOut.symbol,
  };
}

async function executeDirectTransfer(params) {
  const normalizedCurrency = normalizeCurrencySymbol(params.currency);
  const recipientAddress = params.recipientAddress;

  if (normalizedCurrency?.toUpperCase?.() === "CELO") {
    const txRequest = {
      to: recipientAddress,
      value:
        params.amountRaw ??
        ethers.parseEther(String(params.amount)),
    };

    return waitForConfirmedTransaction(
      signer.sendTransaction(txRequest),
      "Sending transfer...",
    );
  }

  const tokenAddress = getStablecoinAddress(normalizedCurrency, params.stablecoinAddresses);
  if (!tokenAddress) {
    throw new Error(`Unsupported transfer currency: ${normalizedCurrency}`);
  }

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const decimals = await token.decimals();
  const amountRaw =
    params.amountRaw ?? ethers.parseUnits(String(params.amount), decimals);

  return waitForConfirmedTransaction(
    token.transfer(recipientAddress, amountRaw),
    "Sending transfer...",
  );
}

async function loadApprovalExecutionPlan() {
  const { response, data } = await fetchJson(
    `/api/wallet-approval/session/${encodeURIComponent(approvalSession.id)}/execution`,
  );
  if (!response.ok) {
    throw new Error(data.error || "Failed to load the transfer execution plan.");
  }
  return data;
}

async function completeApprovalSession(payload) {
  const { response, data } = await fetchJson(
    `/api/wallet-approval/session/${encodeURIComponent(approvalSession.id)}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(data.error || "Telegram could not confirm the transfer result.");
  }
  return data;
}

function getCeloAppKitNetwork() {
  if (!signerConfig?.network) return null;

  return {
    id: signerConfig.network.chainId,
    caipNetworkId: `eip155:${signerConfig.network.chainId}`,
    chainNamespace: "eip155",
    name: signerConfig.network.label,
    nativeCurrency: {
      name: "Celo",
      symbol: "CELO",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [signerConfig.network.rpcUrl],
      },
    },
    blockExplorers: {
      default: {
        name: "Blockscout",
        url: signerConfig.network.explorerBaseUrl,
      },
    },
  };
}

async function syncConnectedWalletFromProvider(providerLike, preferredAddress = null) {
  browserProvider = new ethers.BrowserProvider(providerLike);
  signer = await browserProvider.getSigner();
  connectedAddress = preferredAddress
    ? ethers.getAddress(preferredAddress)
    : await signer.getAddress();

  setStatus(
    authSession || approvalSession
      ? `Connected wallet: ${connectedAddress}`
      : `Wallet connected: ${connectedAddress}`,
    "success",
  );

  updatePrimaryActionButton();

  if (isSessionMode() && !sessionActionInFlight) {
    setTimeout(() => {
      void performSessionAction();
    }, 120);
  }
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

async function ensureAppKit() {
  if (!signerConfig?.reownProjectId) return null;
  if (appKit) return appKit;
  if (appKitReadyPromise) return appKitReadyPromise;

  appKitReadyPromise = (async () => {
    const [{ createAppKit }, { EthersAdapter }] = await Promise.all([
      import("https://esm.sh/@reown/appkit@1.8.19"),
      import("https://esm.sh/@reown/appkit-adapter-ethers@1.8.19"),
    ]);

    const celoNetwork = getCeloAppKitNetwork();
    if (!celoNetwork) {
      throw new Error("Celo network config is unavailable.");
    }

    appKit = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [celoNetwork],
      defaultNetwork: celoNetwork,
      metadata: {
        name: "CeloRemit",
        description: "Telegram-first AI remittance flow with wallet approval on Celo.",
        url: window.location.origin,
        icons: [`${window.location.origin}/favicon.ico`],
      },
      projectId: signerConfig.reownProjectId,
    });

    appKit.subscribeAccount(async (accountState) => {
      try {
        if (!accountState?.isConnected || !accountState.address) {
          setStatus("No wallet connected yet.");
          return;
        }

        const providerLike = appKit.getProvider("eip155");
        if (!providerLike) {
          throw new Error("Connected wallet provider is unavailable.");
        }

        await syncConnectedWalletFromProvider(providerLike, accountState.address);
      } catch (error) {
        const message = error?.message || "Wallet connection failed.";
        setStatus(message, "error");
      }
    });

    return appKit;
  })().catch((error) => {
    appKitReadyPromise = null;
    throw error;
  });

  return appKitReadyPromise;
}

async function fetchSignerConfig() {
  const { response, data } = await fetchJson("/api/wallet-signer/config");
  if (!response.ok) {
    throw new Error("Failed to load signer configuration.");
  }

  signerConfig = data;
  networkBanner.textContent = signerConfig.network.label;
}

async function loadApprovalSession() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session");
  if (!sessionId) return;

  const { response, data } = await fetchJson(
    `/api/wallet-approval/session/${encodeURIComponent(sessionId)}`,
  );
  if (!response.ok) {
    throw new Error("This Telegram approval link has expired. Go back to Telegram and request a new one.");
  }

  approvalSession = data;
  applyApprovalModeUi();

  const requested = approvalSession.requestedTransfer;
  const execution = approvalSession.executionPlan || {};

  setSessionSummary(
    [
      `<div class="session-stack">`,
      `<div class="session-pill">${approvalSession.status}</div>`,
      `<div class="session-grid">`,
      `<div class="session-item"><span class="session-label">You send</span><div class="session-value">${requested.amount} ${requested.sourceCurrency}</div></div>`,
      `<div class="session-item"><span class="session-label">They receive</span><div class="session-value">${execution.estimatedReceiveAmount || "-"} ${execution.targetCurrency || ""}</div></div>`,
      `<div class="session-item"><span class="session-label">Recipient</span><div class="session-value">${requested.recipientName}</div></div>`,
      `<div class="session-item"><span class="session-label">Country</span><div class="session-value">${requested.recipientCountry}</div></div>`,
      `</div>`,
      execution.routeSummary
        ? `<div class="session-note">Route: ${execution.routeSummary}</div>`
        : `<div class="session-note">Ready to send securely from your wallet.</div>`,
      `</div>`,
    ]
      .filter(Boolean)
      .join(""),
  );

  updatePrimaryActionButton();
}

async function loadAuthSession() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("authSession");
  if (!sessionId) return;

  const { response, data } = await fetchJson(
    `/api/wallet-auth/session/${encodeURIComponent(sessionId)}`,
  );
  if (!response.ok) {
    throw new Error("This Telegram sign-in link has expired. Go back to Telegram and request a new one.");
  }

  authSession = data;
  applyAuthModeUi();

  setSessionSummary(
    [
      `<div class="session-stack">`,
      `<div class="session-pill">${authSession.status}</div>`,
      `<div class="session-item"><span class="session-label">Purpose</span><div class="session-value">Securely link your wallet to Telegram</div></div>`,
      `<div class="session-note">Sign once to continue.</div>`,
      `</div>`,
    ].join(""),
  );

  updatePrimaryActionButton();
}

async function connectWallet() {
  if (signerConfig?.reownProjectId) {
    const walletKit = await ensureAppKit();
    if (!walletKit) {
      throw new Error("WalletConnect is not configured.");
    }

    setStatus("Waiting for wallet approval...");
    await walletKit.open({ view: "Connect" });
    return;
  }

  if (!window.ethereum) {
    throw new Error("No wallet found. Install MetaMask or configure WalletConnect first.");
  }

  browserProvider = new ethers.BrowserProvider(window.ethereum);
  await browserProvider.send("eth_requestAccounts", []);
  await ensureCeloNetwork();
  await syncConnectedWalletFromProvider(window.ethereum);
}

async function performSessionAction() {
  if (sessionActionInFlight || !signer || !connectedAddress) {
    return;
  }

  sessionActionInFlight = true;
  connectWalletBtn.disabled = true;

  try {
    if (authSession) {
      const signature = await signer.signMessage(authSession.approvalMessage);
      const { response: authRes, data: authData } = await fetchJson(
        `/api/wallet-auth/session/${encodeURIComponent(authSession.id)}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: connectedAddress,
            signature,
          }),
        },
      );
      if (!authRes.ok) {
        throw new Error(authData.error || "Wallet sign-in failed.");
      }

      const returnLink = getReturnLink();
      const returnLabel = getReturnLabel();
      setResult(
        [
          "<strong>Wallet connected.</strong>",
          authData.botResponse
            ? `<div>${authData.botResponse}</div>`
            : "<div>Telegram will continue now.</div>",
          returnLink
            ? `<div><a href="${returnLink}" target="_blank" rel="noreferrer">${returnLabel}</a></div>`
            : "",
        ]
          .filter(Boolean)
          .join(""),
        "success",
      );

      if (returnLink) {
        setTimeout(() => {
          window.location.href = returnLink;
        }, 1600);
      }
      return;
    }

    if (approvalSession) {
      const executionPayload = await loadApprovalExecutionPlan();
      const executionResult = await executeBrowserSwapAndTransfer(executionPayload);
      const completionData = await completeApprovalSession({
        walletAddress: connectedAddress,
        txHash: executionResult.txHash,
        receiveAmount: executionResult.receiveAmount,
        receiveCurrency: executionResult.receiveCurrency,
      });

      const returnLink = getReturnLink();
      const returnLabel = getReturnLabel();
      setResult(
        [
          "<strong>Transfer sent.</strong>",
          executionResult.txHash
            ? `<div>Tx hash: ${formatExplorerLink(executionResult.txHash)}</div>`
            : "",
          completionData.botResponse
            ? `<div>${completionData.botResponse}</div>`
            : "<div>Telegram will receive the final update.</div>",
          returnLink
            ? `<div><a href="${returnLink}" target="_blank" rel="noreferrer">${returnLabel}</a></div>`
            : "",
        ]
          .filter(Boolean)
          .join(""),
        "success",
      );

      if (returnLink) {
        setTimeout(() => {
          window.location.href = returnLink;
        }, 1800);
      }
    }
  } catch (error) {
    const message = error?.reason || error?.shortMessage || error?.message || "Action failed.";
    setResult(message, "error");
    setStatus(message, "error");
  } finally {
    sessionActionInFlight = false;
    connectWalletBtn.disabled = false;
    updatePrimaryActionButton();
  }
}

connectWalletBtn.addEventListener("click", async () => {
  try {
    if (isSessionMode() && connectedAddress) {
      await performSessionAction();
      return;
    }

    await connectWallet();
  } catch (error) {
    const message = error?.message || "Wallet connection failed.";
    setStatus(message, "error");
  }
});

(async function init() {
  applyBaseUi();

  try {
    await fetchSignerConfig();
    await loadAuthSession();
    await loadApprovalSession();
    updatePrimaryActionButton();
  } catch (error) {
    setExpiredState(error?.message || "Failed to load Telegram wallet session.");
  }
})();
