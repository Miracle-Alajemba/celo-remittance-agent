/**
 * Celo Agent Skills Framework
 * Implements modular capabilities for AI agents on Celo
 * Reference: https://docs.celo.org/build-on-celo/build-with-ai/agent-skills
 */

import { RemittanceIntent } from './intent-parser';
import { AgentResponse } from './orchestrator';

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: 'transfer' | 'query' | 'analysis' | 'execution' | 'utility';
  version: string;
  author: string;
  enabled: boolean;
  dependencies?: string[];
  requiredCapabilities?: string[];
  metadata?: Record<string, any>;
}

export interface SkillExecutionContext {
  agentId: string;
  userId: string;
  intent: RemittanceIntent;
  timestamp: Date;
  conversationHistory?: string[];
}

export interface SkillResult {
  success: boolean;
  skillId: string;
  result?: any;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

export interface SkillChain {
  id: string;
  name: string;
  description: string;
  skills: string[]; // Skill IDs in execution order
  conditional?: boolean;
  metadata?: Record<string, any>;
}

// Base abstract skill class
export abstract class BaseSkill {
  definition: SkillDefinition;

  constructor(definition: SkillDefinition) {
    this.definition = definition;
  }

  abstract execute(
    context: SkillExecutionContext,
    ...args: any[]
  ): Promise<SkillResult>;

  /**
   * Validate if skill can be executed with given context
   */
  canExecute(context: SkillExecutionContext): boolean {
    return this.definition.enabled;
  }

  /**
   * Get skill info
   */
  getInfo(): SkillDefinition {
    return this.definition;
  }
}

// Concrete Skill Implementations
export class TransferSkill extends BaseSkill {
  async execute(
    context: SkillExecutionContext,
    amount: string,
    recipient: string,
    currency: string
  ): Promise<SkillResult> {
    const startTime = Date.now();
    try {
      // Implementation for transfer logic
      return {
        success: true,
        skillId: this.definition.id,
        result: {
          transactionId: `tx_${Date.now()}`,
          amount,
          recipient,
          currency,
          status: 'pending',
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        skillId: this.definition.id,
        error: error.message,
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }
}

export class BalanceQuerySkill extends BaseSkill {
  async execute(
    context: SkillExecutionContext
  ): Promise<SkillResult> {
    const startTime = Date.now();
    try {
      // Mock balance query
      return {
        success: true,
        skillId: this.definition.id,
        result: {
          balances: {
            CELO: '10.5',
            cUSD: '500.75',
            cEUR: '250.25',
          },
          total_usd: '750.75',
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        skillId: this.definition.id,
        error: error.message,
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }
}

export class FeeAnalysisSkill extends BaseSkill {
  async execute(
    context: SkillExecutionContext,
    amount: string,
    sourceCurrency: string,
    targetCurrency: string
  ): Promise<SkillResult> {
    const startTime = Date.now();
    try {
      return {
        success: true,
        skillId: this.definition.id,
        result: {
          providers: [
            {
              name: 'Celo (Mento)',
              fee: '0.5%',
              total: (parseFloat(amount) * 0.005).toFixed(2),
              time: '< 5 seconds',
            },
            {
              name: 'Western Union',
              fee: '3.0%',
              total: (parseFloat(amount) * 0.03).toFixed(2),
              time: '1-2 hours',
            },
            {
              name: 'Wise',
              fee: '1.5%',
              total: (parseFloat(amount) * 0.015).toFixed(2),
              time: '1-2 days',
            },
          ],
          recommendation: 'Celo (Mento)',
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        skillId: this.definition.id,
        error: error.message,
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }
}

export class ScheduleTransferSkill extends BaseSkill {
  async execute(
    context: SkillExecutionContext,
    amount: string,
    recipient: string,
    currency: string,
    frequency: string
  ): Promise<SkillResult> {
    const startTime = Date.now();
    try {
      return {
        success: true,
        skillId: this.definition.id,
        result: {
          scheduleId: `schedule_${Date.now()}`,
          amount,
          recipient,
          currency,
          frequency,
          nextExecution: new Date(Date.now() + 86400000).toISOString(),
          status: 'active',
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        skillId: this.definition.id,
        error: error.message,
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }
}

export class SwapSkill extends BaseSkill {
  async execute(
    context: SkillExecutionContext,
    fromCurrency: string,
    toCurrency: string,
    amount: string
  ): Promise<SkillResult> {
    const startTime = Date.now();
    try {
      const rate = 1.0; // Mock rate
      return {
        success: true,
        skillId: this.definition.id,
        result: {
          swapId: `swap_${Date.now()}`,
          from: fromCurrency,
          to: toCurrency,
          inputAmount: amount,
          outputAmount: (parseFloat(amount) * rate).toFixed(2),
          rate,
          status: 'pending',
          estimatedTime: '< 5 seconds',
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        skillId: this.definition.id,
        error: error.message,
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }
}

// Skill Registry and Manager
export class CeloSkillsFramework {
  private skills: Map<string, BaseSkill> = new Map();
  private skillChains: Map<string, SkillChain> = new Map();
  private executionHistory: SkillResult[] = [];

  constructor() {
    this.registerDefaultSkills();
  }

  /**
   * Register default skills
   */
  private registerDefaultSkills() {
    this.register(
      new TransferSkill({
        id: 'transfer',
        name: 'Send Transfer',
        description: 'Send money transfers via Celo',
        category: 'transfer',
        version: '1.0.0',
        author: 'Celo',
        enabled: true,
        requiredCapabilities: ['send_transfer'],
      })
    );

    this.register(
      new BalanceQuerySkill({
        id: 'balance',
        name: 'Check Balance',
        description: 'Query wallet balances',
        category: 'query',
        version: '1.0.0',
        author: 'Celo',
        enabled: true,
        requiredCapabilities: ['check_balance'],
      })
    );

    this.register(
      new FeeAnalysisSkill({
        id: 'fee_analysis',
        name: 'Fee Analysis',
        description: 'Compare transfer fees across providers',
        category: 'analysis',
        version: '1.0.0',
        author: 'Celo',
        enabled: true,
        requiredCapabilities: ['fee_comparison'],
      })
    );

    this.register(
      new ScheduleTransferSkill({
        id: 'schedule',
        name: 'Schedule Transfer',
        description: 'Schedule recurring transfers',
        category: 'execution',
        version: '1.0.0',
        author: 'Celo',
        enabled: true,
        requiredCapabilities: ['schedule_transfer'],
      })
    );

    this.register(
      new SwapSkill({
        id: 'swap',
        name: 'Currency Swap',
        description: 'Swap currencies via Mento',
        category: 'execution',
        version: '1.0.0',
        author: 'Celo',
        enabled: true,
        requiredCapabilities: ['execute_swap'],
      })
    );
  }

  /**
   * Register a new skill
   */
  register(skill: BaseSkill): void {
    this.skills.set(skill.definition.id, skill);
  }

  /**
   * Get skill by ID
   */
  getSkill(skillId: string): BaseSkill | null {
    return this.skills.get(skillId) || null;
  }

  /**
   * Get all available skills
   */
  getAllSkills(): SkillDefinition[] {
    return Array.from(this.skills.values())
      .filter(s => s.definition.enabled)
      .map(s => s.definition);
  }

  /**
   * Execute a skill
   */
  async executeSkill(
    skillId: string,
    context: SkillExecutionContext,
    ...args: any[]
  ): Promise<SkillResult> {
    const skill = this.getSkill(skillId);
    if (!skill) {
      return {
        success: false,
        skillId,
        error: `Skill ${skillId} not found`,
        executionTime: 0,
        timestamp: new Date(),
      };
    }

    if (!skill.canExecute(context)) {
      return {
        success: false,
        skillId,
        error: `Skill ${skillId} cannot be executed in current context`,
        executionTime: 0,
        timestamp: new Date(),
      };
    }

    const result = await skill.execute(context, ...args);
    this.executionHistory.push(result);
    return result;
  }

  /**
   * Create a skill chain
   */
  createChain(chain: SkillChain): void {
    this.skillChains.set(chain.id, chain);
  }

  /**
   * Execute a skill chain
   */
  async executeChain(
    chainId: string,
    context: SkillExecutionContext
  ): Promise<SkillResult[]> {
    const chain = this.skillChains.get(chainId);
    if (!chain) {
      return [];
    }

    const results: SkillResult[] = [];
    for (const skillId of chain.skills) {
      const result = await this.executeSkill(skillId, context);
      results.push(result);

      if (!result.success && !chain.conditional) {
        break;
      }
    }

    return results;
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 50): SkillResult[] {
    return this.executionHistory.slice(-limit).reverse();
  }

  /**
   * Get skill execution stats
   */
  getSkillStats(skillId: string) {
    const relevant = this.executionHistory.filter(r => r.skillId === skillId);
    return {
      totalExecutions: relevant.length,
      successful: relevant.filter(r => r.success).length,
      failed: relevant.filter(r => !r.success).length,
      averageExecutionTime:
        relevant.length > 0
          ? relevant.reduce((sum, r) => sum + r.executionTime, 0) /
            relevant.length
          : 0,
    };
  }
}

// Singleton instance
let skillsFramework: CeloSkillsFramework | null = null;

export function getSkillsFramework(): CeloSkillsFramework {
  if (!skillsFramework) {
    skillsFramework = new CeloSkillsFramework();
  }
  return skillsFramework;
}
