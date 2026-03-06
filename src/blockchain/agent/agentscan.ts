/**
 * AgentScan Integration
 * On-chain scanner for agent activity tracking and monitoring
 * Reference: https://agentscan.info/
 */

import { ethers } from 'ethers';

export interface AgentActivity {
  id: string;
  agentAddress: string;
  activityType: 'transfer' | 'swap' | 'approval' | 'execution' | 'schedule';
  transactionHash?: string;
  blockNumber?: number;
  timestamp: Date;
  value?: string;
  recipient?: string;
  metadata: Record<string, any>;
  status: 'pending' | 'completed' | 'failed';
}

export interface AgentAnalytics {
  agentAddress: string;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalVolume: string; // in USD
  averageTransactionSize: string;
  lastActivity: Date;
  activeDays: number;
  trustScore: number; // 0-100
}

export interface TransactionTrace {
  from: string;
  to: string;
  value: string;
  data?: string;
  gasUsed?: string;
  status: 'success' | 'failed';
  timestamp: Date;
}

export interface AgentMetrics {
  successRate: number;
  gasEfficiency: number;
  responseTime: number; // milliseconds
  volumeGrowth: number; // percentage
  userSatisfaction?: number;
}

// AgentScan Implementation
export class AgentScanner {
  private activities: Map<string, AgentActivity[]> = new Map();
  private analytics: Map<string, AgentAnalytics> = new Map();
  private transactions: Map<string, TransactionTrace[]> = new Map();

  /**
   * Record agent activity
   */
  recordActivity(activity: AgentActivity): void {
    const key = activity.agentAddress;
    if (!this.activities.has(key)) {
      this.activities.set(key, []);
    }
    this.activities.get(key)!.push(activity);

    // Update analytics
    this.updateAnalytics(activity.agentAddress);
  }

  /**
   * Record transaction trace
   */
  recordTransactionTrace(
    agentAddress: string,
    trace: TransactionTrace
  ): void {
    const key = agentAddress;
    if (!this.transactions.has(key)) {
      this.transactions.set(key, []);
    }
    this.transactions.get(key)!.push(trace);
  }

  /**
   * Get agent activity log
   */
  getActivityLog(agentAddress: string, limit: number = 100): AgentActivity[] {
    const activities = this.activities.get(agentAddress) || [];
    return activities.slice(-limit).reverse();
  }

  /**
   * Get activity by type
   */
  getActivityByType(
    agentAddress: string,
    type: AgentActivity['activityType']
  ): AgentActivity[] {
    const activities = this.activities.get(agentAddress) || [];
    return activities.filter(a => a.activityType === type);
  }

  /**
   * Get agent analytics
   */
  getAnalytics(agentAddress: string): AgentAnalytics | null {
    return this.analytics.get(agentAddress) || null;
  }

  /**
   * Update agent analytics
   */
  private updateAnalytics(agentAddress: string): void {
    const activities = this.activities.get(agentAddress) || [];
    if (activities.length === 0) return;

    const successful = activities.filter(a => a.status === 'completed').length;
    const failed = activities.filter(a => a.status === 'failed').length;

    // Calculate total volume
    const totalVolume = activities
      .filter(a => a.value)
      .reduce((sum, a) => sum + parseFloat(a.value || '0'), 0)
      .toFixed(2);

    // Calculate average transaction size
    const avgSize =
      activities.length > 0
        ? (
            activities
              .filter(a => a.value)
              .reduce((sum, a) => sum + parseFloat(a.value || '0'), 0) /
            activities.length
          ).toFixed(2)
        : '0';

    // Calculate active days
    const uniqueDays = new Set(
      activities.map(a => a.timestamp.toISOString().split('T')[0])
    ).size;

    // Calculate trust score (0-100)
    const trustScore = Math.min(
      100,
      Math.floor(
        (successful / activities.length) * 100 - (failed / activities.length) * 10
      )
    );

    const analytics: AgentAnalytics = {
      agentAddress,
      totalTransactions: activities.length,
      successfulTransactions: successful,
      failedTransactions: failed,
      totalVolume,
      averageTransactionSize: avgSize,
      lastActivity: activities[activities.length - 1].timestamp,
      activeDays: uniqueDays,
      trustScore,
    };

    this.analytics.set(agentAddress, analytics);
  }

  /**
   * Get transaction traces for agent
   */
  getTransactionTraces(agentAddress: string): TransactionTrace[] {
    return this.transactions.get(agentAddress) || [];
  }

  /**
   * Get agent metrics
   */
  getMetrics(agentAddress: string): AgentMetrics {
    const analytics = this.getAnalytics(agentAddress);
    const activities = this.activities.get(agentAddress) || [];

    if (!analytics || activities.length === 0) {
      return {
        successRate: 0,
        gasEfficiency: 0,
        responseTime: 0,
        volumeGrowth: 0,
      };
    }

    const successRate =
      (analytics.successfulTransactions / analytics.totalTransactions) * 100;

    // Calculate gas efficiency (mock calculation)
    const totalGasUsed = this.getTransactionTraces(agentAddress).reduce(
      (sum, t) => sum + (parseInt(t.gasUsed || '0') || 0),
      0
    );
    const gasEfficiency =
      activities.length > 0 ? 100 - (totalGasUsed / (activities.length * 21000)) * 100 : 0;

    // Calculate average response time (mock)
    const responseTime = Math.random() * 5000;

    // Calculate volume growth (mock)
    const volumeGrowth = (Math.random() - 0.3) * 100;

    return {
      successRate,
      gasEfficiency: Math.max(0, gasEfficiency),
      responseTime,
      volumeGrowth,
    };
  }

  /**
   * Get real-time agent status
   */
  getAgentStatus(agentAddress: string) {
    const analytics = this.getAnalytics(agentAddress);
    const metrics = this.getMetrics(agentAddress);
    const recentActivities = this.getActivityLog(agentAddress, 10);

    return {
      address: agentAddress,
      status:
        analytics && analytics.trustScore > 70 ? 'healthy' : 'warning',
      analytics,
      metrics,
      recentActivities,
      lastCheckTime: new Date(),
    };
  }

  /**
   * Monitor agent activity (real-time updates)
   */
  async monitorAgentActivity(
    agentAddress: string,
    onActivity: (activity: AgentActivity) => void
  ) {
    // Simulate real-time monitoring
    const checkInterval = setInterval(() => {
      const activities = this.activities.get(agentAddress) || [];
      if (activities.length > 0) {
        const lastActivity = activities[activities.length - 1];
        onActivity(lastActivity);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkInterval);
  }

  /**
   * Get top performing agents
   */
  getTopAgents(limit: number = 10): AgentAnalytics[] {
    return Array.from(this.analytics.values())
      .sort((a, b) => b.trustScore - a.trustScore)
      .slice(0, limit);
  }

  /**
   * Get agents by trust score range
   */
  getAgentsByTrustScore(min: number, max: number): AgentAnalytics[] {
    return Array.from(this.analytics.values()).filter(
      a => a.trustScore >= min && a.trustScore <= max
    );
  }

  /**
   * Generate agent report
   */
  generateReport(agentAddress: string) {
    const analytics = this.getAnalytics(agentAddress);
    const metrics = this.getMetrics(agentAddress);
    const activities = this.getActivityLog(agentAddress);

    return {
      generatedAt: new Date(),
      agent: agentAddress,
      summary: {
        analytics,
        metrics,
        status: analytics && analytics.trustScore > 70 ? 'Healthy' : 'Warning',
      },
      activitySummary: {
        totalActivities: activities.length,
        byType: {
          transfer: activities.filter(a => a.activityType === 'transfer').length,
          swap: activities.filter(a => a.activityType === 'swap').length,
          approval: activities.filter(a => a.activityType === 'approval').length,
          execution: activities.filter(a => a.activityType === 'execution').length,
          schedule: activities.filter(a => a.activityType === 'schedule').length,
        },
        byStatus: {
          pending: activities.filter(a => a.status === 'pending').length,
          completed: activities.filter(a => a.status === 'completed').length,
          failed: activities.filter(a => a.status === 'failed').length,
        },
      },
      recommendations: this.generateRecommendations(analytics, metrics),
    };
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(
    analytics: AgentAnalytics | null,
    metrics: AgentMetrics
  ): string[] {
    const recommendations: string[] = [];

    if (!analytics) return ['Insufficient data for recommendations'];

    if (metrics.successRate < 80) {
      recommendations.push(
        'Success rate is below 80%. Review failed transactions and improve error handling.'
      );
    }

    if (metrics.gasEfficiency < 50) {
      recommendations.push('Gas efficiency is low. Optimize contract interactions.');
    }

    if (analytics.trustScore < 50) {
      recommendations.push(
        'Trust score is low. Ensure compliance and successful transaction completion.'
      );
    }

    if (metrics.responseTime > 10000) {
      recommendations.push(
        'Response time is high. Consider optimizing blockchain interactions.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Agent performance is optimal. No improvements needed.');
    }

    return recommendations;
  }

  /**
   * Export activity data
   */
  exportActivityData(agentAddress: string, format: 'json' | 'csv' = 'json') {
    const activities = this.getActivityLog(agentAddress, 1000);

    if (format === 'json') {
      return JSON.stringify(activities, null, 2);
    }

    // CSV format
    const headers = ['id', 'type', 'status', 'timestamp', 'value', 'recipient'];
    const rows = activities.map(a => [
      a.id,
      a.activityType,
      a.status,
      a.timestamp.toISOString(),
      a.value || '',
      a.recipient || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n');

    return csv;
  }
}

// Singleton instance
let agentScanner: AgentScanner | null = null;

export function getAgentScanner(): AgentScanner {
  if (!agentScanner) {
    agentScanner = new AgentScanner();
  }
  return agentScanner;
}
