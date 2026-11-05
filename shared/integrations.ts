export interface McpConfiguration {
  name:string; enabled:boolean;
  transport: {type:'http';url:string;bearerTokenEnvVar?:string}|{type:'stdio';command:string;args:string[];envVars:string[]};
}
export interface McpConnection {name:string;state:'configured'|'connected'|'disabled'|'error';message:string;checkedAt?:string}
export interface UsageWindow {label:string;usedPercent:number;windowMinutes:number|null;resetsAt:string|null}
export interface ProviderState {
  checkedAt:string;state:'connected'|'disconnected'|'unavailable';message:string;email?:string;plan?:string;
  usage:UsageWindow[];usageMessage?:string;loginPending:boolean;
}
export interface IntegrationState {servers:McpConfiguration[];connections:McpConnection[];warning?:string}
export type AccountAction='login'|'cancel'|'logout'|'manage';
