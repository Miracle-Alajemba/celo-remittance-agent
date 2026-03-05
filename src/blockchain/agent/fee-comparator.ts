/**
 * Fee Comparison Engine
 * Compares Celo remittance costs vs traditional providers (Western Union, Wise, etc.)
 */

export interface ProviderFees {
  provider: string;
  sendAmount: number;
  sendCurrency: string;
  receiveAmount: number;
  receiveCurrency: string;
  exchangeRate: number;
  transferFee: number;
  totalCost: number;
  estimatedDelivery: string;
  savings?: number;
  savingsPercent?: number;
}

export interface FeeComparison {
  corridor: string;
  sendAmount: number;
  sendCurrency: string;
  receiveCurrency: string;
  celoFees: ProviderFees;
  traditionalProviders: ProviderFees[];
  bestSavings: number;
  bestSavingsPercent: number;
  avgSavings: number;
}

// Traditional provider fee structures (realistic approximations)
const PROVIDER_FEES: {
  [provider: string]: {
    fixedFee: { [corridor: string]: number };
    feePercent: number;
    rateMarkup: number; // percentage markup on mid-market rate
    deliveryTime: string;
  };
} = {
  'Western Union': {
    fixedFee: {
      'US-PH': 5.0,
      'US-NG': 7.0,
      'US-KE': 5.0,
      'US-BR': 6.0,
      'US-CO': 5.0,
      'US-GH': 7.0,
      'US-IN': 5.0,
      'US-MX': 4.99,
      'EU-PH': 6.0,
      'EU-NG': 8.0,
      'EU-KE': 6.0,
      'GB-PH': 5.0,
      'GB-NG': 5.0,
      'GB-KE': 5.0,
      default: 7.99,
    },
    feePercent: 0,
    rateMarkup: 3.5, // 3.5% worse than mid-market
    deliveryTime: '1-3 business days',
  },
  'Wise (TransferWise)': {
    fixedFee: {
      'US-PH': 1.50,
      'US-NG': 2.00,
      'US-KE': 1.50,
      'US-BR': 2.50,
      'US-CO': 2.00,
      'US-GH': 2.50,
      'US-IN': 1.50,
      'US-MX': 1.50,
      'EU-PH': 1.30,
      'EU-NG': 1.80,
      'EU-KE': 1.30,
      'GB-PH': 1.20,
      'GB-NG': 1.50,
      'GB-KE': 1.00,
      default: 2.50,
    },
    feePercent: 0.65,
    rateMarkup: 0.5, // Wise uses near mid-market rates
    deliveryTime: '1-2 business days',
  },
  'MoneyGram': {
    fixedFee: {
      'US-PH': 4.99,
      'US-NG': 6.99,
      'US-KE': 4.99,
      'US-BR': 5.99,
      'US-CO': 4.99,
      'US-GH': 6.99,
      'US-IN': 4.99,
      'US-MX': 3.99,
      default: 6.99,
    },
    feePercent: 0,
    rateMarkup: 3.0,
    deliveryTime: '1-3 business days',
  },
  'Remitly': {
    fixedFee: {
      'US-PH': 1.99,
      'US-NG': 3.99,
      'US-KE': 1.99,
      'US-IN': 1.99,
      'US-MX': 1.99,
      default: 3.99,
    },
    feePercent: 0,
    rateMarkup: 1.5,
    deliveryTime: '1-2 business days',
  },
};

// Mid-market exchange rates (reference rates)
const MID_MARKET_RATES: { [pair: string]: number } = {
  'USD-PHP': 56.5,
  'USD-NGN': 1580,
  'USD-KES': 131,
  'USD-BRL': 5.10,
  'USD-COP': 4150,
  'USD-GHS': 15.5,
  'USD-INR': 83.5,
  'USD-MXN': 17.2,
  'USD-XOF': 615,
  'EUR-PHP': 61.2,
  'EUR-NGN': 1720,
  'EUR-KES': 142,
  'EUR-XOF': 655.957,
  'GBP-PHP': 71.5,
  'GBP-NGN': 2000,
  'GBP-KES': 166,
};

function getCorridorCode(sendCurrency: string, receiveCountry: string): string {
  const currencyToCountry: { [c: string]: string } = {
    USD: 'US',
    EUR: 'EU',
    GBP: 'GB',
    BRL: 'BR',
  };
  const countryMap: { [c: string]: string } = {
    PH: 'PH', NG: 'NG', KE: 'KE', BR: 'BR', CO: 'CO',
    GH: 'GH', IN: 'IN', MX: 'MX', SN: 'SN', CI: 'CI',
  };

  const from = currencyToCountry[sendCurrency] || 'US';
  const to = countryMap[receiveCountry] || receiveCountry;
  return `${from}-${to}`;
}

function getReceiveCurrency(country: string): string {
  const map: { [c: string]: string } = {
    PH: 'PHP', NG: 'NGN', KE: 'KES', BR: 'BRL', CO: 'COP',
    GH: 'GHS', IN: 'INR', MX: 'MXN', SN: 'XOF', CI: 'XOF',
  };
  return map[country] || 'USD';
}

export function compareFees(
  amount: number,
  sendCurrency: string,
  receiveCountry: string
): FeeComparison {
  const receiveCurrency = getReceiveCurrency(receiveCountry);
  const ratePair = `${sendCurrency}-${receiveCurrency}`;
  const midMarketRate = MID_MARKET_RATES[ratePair] || 1;
  const corridor = getCorridorCode(sendCurrency, receiveCountry);

  // Celo fees (using Mento)
  const celoFeePercent = 0.30; // 0.3% Mento swap fee
  const celoFixedFee = 0; // No fixed fee
  const celoRate = midMarketRate * (1 - 0.002); // 0.2% rate markup (very close to mid-market)
  const celoTransferFee = amount * (celoFeePercent / 100);
  const celoReceiveAmount = (amount - celoTransferFee) * celoRate;
  const celoTotalCost = celoTransferFee;

  const celoFees: ProviderFees = {
    provider: 'Celo (Mento)',
    sendAmount: amount,
    sendCurrency,
    receiveAmount: Math.round(celoReceiveAmount * 100) / 100,
    receiveCurrency,
    exchangeRate: celoRate,
    transferFee: celoTransferFee,
    totalCost: celoTotalCost,
    estimatedDelivery: '< 5 seconds',
  };

  // Traditional provider fees
  const traditionalProviders: ProviderFees[] = [];

  for (const [providerName, config] of Object.entries(PROVIDER_FEES)) {
    const fixedFee = config.fixedFee[corridor] ?? config.fixedFee['default'];
    const percentFee = amount * (config.feePercent / 100);
    const totalFee = fixedFee + percentFee;
    const providerRate = midMarketRate * (1 - config.rateMarkup / 100);
    const receiveAmount = (amount - totalFee) * providerRate;
    const totalCost = totalFee + (amount * config.rateMarkup / 100);

    const savings = receiveAmount > 0 ? celoReceiveAmount - receiveAmount : 0;
    const savingsPercent = receiveAmount > 0 ? (savings / receiveAmount) * 100 : 0;

    traditionalProviders.push({
      provider: providerName,
      sendAmount: amount,
      sendCurrency,
      receiveAmount: Math.round(receiveAmount * 100) / 100,
      receiveCurrency,
      exchangeRate: providerRate,
      transferFee: totalFee,
      totalCost: Math.round(totalCost * 100) / 100,
      estimatedDelivery: config.deliveryTime,
      savings: Math.round(savings * 100) / 100,
      savingsPercent: Math.round(savingsPercent * 100) / 100,
    });
  }

  // Sort by most expensive first (to show biggest savings first)
  traditionalProviders.sort((a, b) => (a.receiveAmount) - (b.receiveAmount));

  const bestSavings = Math.max(...traditionalProviders.map((p) => p.savings || 0));
  const bestSavingsPercent = Math.max(...traditionalProviders.map((p) => p.savingsPercent || 0));
  const avgSavings = traditionalProviders.reduce((sum, p) => sum + (p.savings || 0), 0) / traditionalProviders.length;

  return {
    corridor,
    sendAmount: amount,
    sendCurrency,
    receiveCurrency,
    celoFees,
    traditionalProviders,
    bestSavings: Math.round(bestSavings * 100) / 100,
    bestSavingsPercent: Math.round(bestSavingsPercent * 100) / 100,
    avgSavings: Math.round(avgSavings * 100) / 100,
  };
}

export function formatFeeComparison(comparison: FeeComparison, lang: string = 'en'): string {
  const { celoFees, traditionalProviders, sendAmount, sendCurrency, receiveCurrency } = comparison;

  const headers: { [lang: string]: { title: string; you_send: string; they_receive: string; fee: string; rate: string; delivery: string; savings: string } } = {
    en: { title: '💰 Fee Comparison', you_send: 'You send', they_receive: 'They receive', fee: 'Fee', rate: 'Rate', delivery: 'Delivery', savings: 'You save' },
    es: { title: '💰 Comparación de Tarifas', you_send: 'Envías', they_receive: 'Reciben', fee: 'Tarifa', rate: 'Tasa', delivery: 'Entrega', savings: 'Ahorras' },
    pt: { title: '💰 Comparação de Taxas', you_send: 'Você envia', they_receive: 'Eles recebem', fee: 'Taxa', rate: 'Câmbio', delivery: 'Entrega', savings: 'Você economiza' },
    fr: { title: '💰 Comparaison des Frais', you_send: 'Vous envoyez', they_receive: 'Ils reçoivent', fee: 'Frais', rate: 'Taux', delivery: 'Livraison', savings: 'Vous économisez' },
  };

  const h = headers[lang] || headers['en'];
  let output = `${h.title}\n`;
  output += `${h.you_send}: ${sendAmount} ${sendCurrency}\n\n`;

  // Celo row
  output += `🟢 **${celoFees.provider}** (Recommended)\n`;
  output += `   ${h.they_receive}: ${celoFees.receiveAmount.toLocaleString()} ${receiveCurrency}\n`;
  output += `   ${h.fee}: $${celoFees.transferFee.toFixed(2)} (${(celoFees.transferFee / sendAmount * 100).toFixed(2)}%)\n`;
  output += `   ${h.rate}: 1 ${sendCurrency} = ${celoFees.exchangeRate.toFixed(4)} ${receiveCurrency}\n`;
  output += `   ${h.delivery}: ${celoFees.estimatedDelivery}\n\n`;

  // Traditional providers
  for (const provider of traditionalProviders) {
    output += `🔴 **${provider.provider}**\n`;
    output += `   ${h.they_receive}: ${provider.receiveAmount.toLocaleString()} ${receiveCurrency}\n`;
    output += `   ${h.fee}: $${provider.transferFee.toFixed(2)}\n`;
    output += `   ${h.rate}: 1 ${sendCurrency} = ${provider.exchangeRate.toFixed(4)} ${receiveCurrency}\n`;
    output += `   ${h.delivery}: ${provider.estimatedDelivery}\n`;
    if (provider.savings && provider.savings > 0) {
      output += `   ${h.savings}: ${provider.savings.toLocaleString()} ${receiveCurrency} (${provider.savingsPercent}%)\n`;
    }
    output += '\n';
  }

  return output;
}
