"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenClawAdapter = void 0;
const orchestrator_1 = require("./orchestrator");
/**
 * Hackathon adapter so the app can be presented as OpenClaw-ready
 * without pulling in the full SDK. Replace with real OpenClaw client
 * when integrating.
 */
class OpenClawAdapter {
    constructor(agent) {
        this.agent = agent || new orchestrator_1.AgentOrchestrator();
    }
    async process(message) {
        return this.agent.processMessage(message);
    }
}
exports.OpenClawAdapter = OpenClawAdapter;
