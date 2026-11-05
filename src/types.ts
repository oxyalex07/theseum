export type AgentId = 'orbit' | 'forge' | 'sentinel' | 'scout' | 'quill';
export type Space = 'all' | 'code' | 'research';
export type Page = 'home' | 'session' | 'crew' | 'memory' | 'routines' | 'settings' | 'history' | 'profile' | 'library' | 'browser' | 'terminal';
export type Layout = 'focus' | 'split' | 'grid';
export type Status = 'paused' | 'running' | 'thinking' | 'waiting' | 'question' | 'error' | 'review' | 'done' | 'queued' | 'starting' | 'cancelling' | 'completed' | 'cancelled' | 'failed' | 'interrupted';
export interface Agent { n: string; l: string; c: string; role: string; model: string; p: string }
export interface Project { n: string; sp: Space }
export interface Session {
  id: string; runId?: string; projectName?: string; ag: AgentId; pj: string; t: string; st: Status; time: string;
  demoResume?: { status: 'running' | 'thinking'; prev: [string, string] };
  forkSource?: { sessionId: string; title: string; projectId: string; branch?: string; commit?: string; messageCount: number };
  br?: string; prn?: number; loop?: [number, number]; add?: number; del?: number;
  mem?: number; prev: [string, string]; words?: number; srcN?: number; ci?: string; routine?: number;
}
export interface Tool { tag: string; title: string; meta?: string; out?: string; run?: number }
export interface Message {
  id?: string; r?: 'you' | 'ag'; t?: string; sys?: string; mem?: string[]; tools?: Tool[];
  card?: 'plan' | 'approval' | 'error' | 'review' | 'sources' | 'table' | 'excerpt' | 'options' | 'done';
  items?: ([number, string] | [string, string, string])[];
  commit?: string; cmd?: string; why?: string; aff?: [string, string][]; risk?: string; log?: string; note?: string;
  n?: number; q?: string; opts?: [string, string, number?][]; pick?: number;
  plain?: boolean;
}
export interface MemoryGroup { ic: string; t: string; xs: (string | { t: string; nw: number })[] }
export type Source = [string, string, string, string, number];
export type FileChange = [string, number, number, string?];
export type Routine = [string, string, string, string, AgentId, number];
export type QuickStart = [string, string, string, AgentId[], Space];
export type SettingValue = string | number | boolean;
export type SectionId = 'general' | 'models' | 'safety' | 'spaces' | 'notify' | 'memory' | 'ints' | 'keys' | 'about';
export interface Settings {
  values: Record<string, SettingValue>; allow: string[]; integrations: Record<string, boolean>;
  keys: Record<string, string>;
}
export const NEEDY: Status[] = ['waiting', 'question', 'error', 'review'];
export const statusLabels: Record<Status, string> = { paused: 'Paused', running: 'Working', thinking: 'Thinking', waiting: 'Needs approval', question: 'Needs your pick', error: 'Failed', review: 'Ready for you', done: 'Done', queued: 'Queued', starting: 'Starting', cancelling: 'Cancelling', completed: 'Completed', cancelled: 'Cancelled', failed: 'Failed', interrupted: 'Interrupted' };
export const statusClasses: Record<Status, string> = { paused: 'q', running: 'run', thinking: 'run', waiting: 'wait', question: 'wait', error: 'err', review: 'rev', done: 'done', queued: 'q', starting: 'run', cancelling: 'wait', completed: 'done', cancelled: 'q', failed: 'err', interrupted: 'err' };
export const memoryText = (value: MemoryGroup['xs'][number]) => typeof value === 'string' ? value : value.t;
