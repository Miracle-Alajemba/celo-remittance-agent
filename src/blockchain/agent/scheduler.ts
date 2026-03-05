/**
 * Recurring Transfer Scheduler
 * Manages scheduled/recurring remittance transfers
 */

export interface ScheduledTransfer {
  id: string;
  userId: string;
  recipientAddress: string;
  recipientName: string;
  recipientCountry: string;
  amount: string;
  sourceCurrency: string;
  targetCurrency: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextExecutionDate: Date;
  lastExecutionDate?: Date;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  executionCount: number;
  maxExecutions?: number;
  notifyRecipient: boolean;
  notifyPhone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulerStats {
  totalScheduled: number;
  activeScheduled: number;
  totalExecuted: number;
  nextExecution?: Date;
}

// In-memory store (in production, use a database)
const scheduledTransfers: Map<string, ScheduledTransfer> = new Map();

export function createScheduledTransfer(params: {
  recipientAddress: string;
  recipientName: string;
  recipientCountry: string;
  amount: string;
  sourceCurrency: string;
  targetCurrency: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  notifyRecipient?: boolean;
  notifyPhone?: string;
  maxExecutions?: number;
}): ScheduledTransfer {
  const id = `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  const nextDate = calculateNextExecution(now, params.frequency);

  const transfer: ScheduledTransfer = {
    id,
    userId: 'default_user',
    recipientAddress: params.recipientAddress,
    recipientName: params.recipientName,
    recipientCountry: params.recipientCountry,
    amount: params.amount,
    sourceCurrency: params.sourceCurrency,
    targetCurrency: params.targetCurrency || 'USD',
    frequency: params.frequency,
    nextExecutionDate: nextDate,
    status: 'active',
    executionCount: 0,
    maxExecutions: params.maxExecutions,
    notifyRecipient: params.notifyRecipient || false,
    notifyPhone: params.notifyPhone,
    createdAt: now,
    updatedAt: now,
  };

  scheduledTransfers.set(id, transfer);
  return transfer;
}

export function getScheduledTransfers(status?: string): ScheduledTransfer[] {
  const transfers = Array.from(scheduledTransfers.values());
  if (status) {
    return transfers.filter((t) => t.status === status);
  }
  return transfers;
}

export function getScheduledTransferById(id: string): ScheduledTransfer | undefined {
  return scheduledTransfers.get(id);
}

export function cancelScheduledTransfer(id: string): boolean {
  const transfer = scheduledTransfers.get(id);
  if (transfer) {
    transfer.status = 'cancelled';
    transfer.updatedAt = new Date();
    return true;
  }
  return false;
}

export function pauseScheduledTransfer(id: string): boolean {
  const transfer = scheduledTransfers.get(id);
  if (transfer && transfer.status === 'active') {
    transfer.status = 'paused';
    transfer.updatedAt = new Date();
    return true;
  }
  return false;
}

export function resumeScheduledTransfer(id: string): boolean {
  const transfer = scheduledTransfers.get(id);
  if (transfer && transfer.status === 'paused') {
    transfer.status = 'active';
    transfer.nextExecutionDate = calculateNextExecution(new Date(), transfer.frequency);
    transfer.updatedAt = new Date();
    return true;
  }
  return false;
}

export function markTransferExecuted(id: string): ScheduledTransfer | null {
  const transfer = scheduledTransfers.get(id);
  if (!transfer) return null;

  transfer.executionCount += 1;
  transfer.lastExecutionDate = new Date();

  if (transfer.maxExecutions && transfer.executionCount >= transfer.maxExecutions) {
    transfer.status = 'completed';
  } else {
    transfer.nextExecutionDate = calculateNextExecution(new Date(), transfer.frequency);
  }

  transfer.updatedAt = new Date();
  return transfer;
}

export function getDueTransfers(): ScheduledTransfer[] {
  const now = new Date();
  return Array.from(scheduledTransfers.values()).filter(
    (t) => t.status === 'active' && t.nextExecutionDate <= now
  );
}

export function getSchedulerStats(): SchedulerStats {
  const transfers = Array.from(scheduledTransfers.values());
  const active = transfers.filter((t) => t.status === 'active');
  const nextExecution = active.length > 0
    ? new Date(Math.min(...active.map((t) => t.nextExecutionDate.getTime())))
    : undefined;

  return {
    totalScheduled: transfers.length,
    activeScheduled: active.length,
    totalExecuted: transfers.reduce((sum, t) => sum + t.executionCount, 0),
    nextExecution,
  };
}

function calculateNextExecution(from: Date, frequency: string): Date {
  const next = new Date(from);
  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export function formatScheduledTransfer(transfer: ScheduledTransfer, lang: string = 'en'): string {
  const labels: { [lang: string]: { [key: string]: string } } = {
    en: { id: 'ID', to: 'To', amount: 'Amount', freq: 'Frequency', next: 'Next', status: 'Status', count: 'Executed' },
    es: { id: 'ID', to: 'Para', amount: 'Monto', freq: 'Frecuencia', next: 'Próximo', status: 'Estado', count: 'Ejecutados' },
    pt: { id: 'ID', to: 'Para', amount: 'Valor', freq: 'Frequência', next: 'Próximo', status: 'Status', count: 'Executados' },
    fr: { id: 'ID', to: 'À', amount: 'Montant', freq: 'Fréquence', next: 'Prochain', status: 'Statut', count: 'Exécutés' },
  };

  const l = labels[lang] || labels['en'];
  return [
    `📅 ${l.id}: ${transfer.id.substring(0, 12)}...`,
    `   ${l.to}: ${transfer.recipientName} (${transfer.recipientCountry})`,
    `   ${l.amount}: ${transfer.amount} ${transfer.sourceCurrency}`,
    `   ${l.freq}: ${transfer.frequency}`,
    `   ${l.next}: ${transfer.nextExecutionDate.toLocaleDateString()}`,
    `   ${l.status}: ${transfer.status}`,
    `   ${l.count}: ${transfer.executionCount}x`,
  ].join('\n');
}
