// Capabilities of the exec adapter, not a claim about every Codex transport.
export const executionCapabilities = Object.freeze({
  adapter: 'codex-exec', pendingApprovals: false, commandAllowlist: false,
  askFirst: false, networkModes: ['off'] as const, stepTimeout: false,
  runTimeout: true, stopAll: true,
});
export interface SafetyPolicy {
  approval: 'deny-escalation'; network: 'off'; commandAllowlist: string[];
  askFirst: false; timeoutSeconds: number;
}
export interface SafetyState { capabilities: typeof executionCapabilities; policy: SafetyPolicy; error?: string }
export function validateSafetyPolicy(input: unknown): SafetyPolicy {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid safety policy.');
  const p = input as SafetyPolicy;
  const keys = ['approval','network','commandAllowlist','askFirst','timeoutSeconds'];
  if (Object.keys(p).some(key => !keys.includes(key))) throw new Error('Unsupported safety policy field.');
  if (p.approval !== 'deny-escalation' || p.askFirst !== false) throw new Error('This execution adapter cannot ask for approval. Operations requiring escalation are denied.');
  if (p.network !== 'off') throw new Error('This execution adapter only supports blocked sandbox network access.');
  if (!Array.isArray(p.commandAllowlist) || p.commandAllowlist.length) throw new Error('Command allowlists are not supported by this execution adapter.');
  if (!Number.isInteger(p.timeoutSeconds) || p.timeoutSeconds < 5 || p.timeoutSeconds > 1800) throw new Error('Run time limit must be between 5 and 1,800 seconds.');
  return {approval:'deny-escalation',network:'off',commandAllowlist:[],askFirst:false,timeoutSeconds:p.timeoutSeconds};
}
export const defaultSafetyPolicy = (): SafetyPolicy => ({approval:'deny-escalation',network:'off',commandAllowlist:[],askFirst:false,timeoutSeconds:1800});
