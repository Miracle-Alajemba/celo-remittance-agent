import { AgentOrchestrator, AgentResponse } from './orchestrator';

export interface OpenClawLikeAgent {
  process(message: string): Promise<AgentResponse>;
}

/**
 * Hackathon adapter so the app can be presented as OpenClaw-ready
 * without pulling in the full SDK. Replace with real OpenClaw client
 * when integrating.
 */
export class OpenClawAdapter implements OpenClawLikeAgent {
  private agent: AgentOrchestrator;

  constructor(agent?: AgentOrchestrator) {
    this.agent = agent || new AgentOrchestrator();
  }

  async process(message: string): Promise<AgentResponse> {
    return this.agent.processMessage(message);
  }
}
