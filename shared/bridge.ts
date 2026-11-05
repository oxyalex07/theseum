import type { BrowserBounds, BrowserCommand, BrowsingState, PageExtract } from './browsing';
import type { TerminalCommand, TerminalRequest, TerminalState } from './terminal';
import type { MemoryWorkflowRequest, MemoryWorkflowResult } from './memory-workflows';
import type { MemoryPolicy, MemoryReference, MemoryState, SaveMemoryRequest } from './memory';
import type { LibraryBridge } from './library';
// The only renderer-visible desktop API. No generic IPC, filesystem, shell, or Node objects.
export interface AppInfo { name: string; version: string; platform: string; electron: string; node: string; mode: 'desktop' }
export interface WorkspaceSummary { id: string; name: string; path: string; entries: { name: string; kind: 'directory'|'file' }[]; truncated: boolean }
export type MemoryExport = Record<string, string[]>;
export type WindowAction = 'minimize'|'maximize'|'close';
export interface DesktopBridge extends LibraryBridge {
  getRoutines():Promise<import('./routines').RoutineState>;
  saveRoutine(request:import('./routines').SaveRoutineRequest):Promise<import('./routines').RoutineState>;
  enableRoutine(request:import('./routines').RoutineReference,enabled:boolean,executionConsent:boolean):Promise<import('./routines').RoutineState>;
  deleteRoutine(request:import('./routines').RoutineReference):Promise<import('./routines').RoutineState>;
  runRoutineNow(request:import('./routines').RoutineReference):Promise<import('./routines').RoutineState>;
  resumeRoutines():Promise<import('./routines').RoutineState>;
  onRoutines(listener:(state:import('./routines').RoutineState)=>void):()=>void;
  getResearch(target:import('./research').ResearchTarget):Promise<import('./research').ResearchState>;
  listResearchArtifacts():Promise<import('./research').ResearchArtifactList>;
  generateResearch(request:import('./research').ResearchEdit):Promise<import('./research').ResearchState>;
  saveResearch(request:import('./research').ResearchEdit&{content:string;baseContent?:string;projectPath?:string}):Promise<import('./research').ResearchState>;
  chooseResearchDestination(request:import('./research').ResearchEdit):Promise<import('./research').ResearchDestination|null>;
  publishResearch(request:import('./research').ResearchEdit&{token:string;intent:'export-markdown'}):Promise<{state:'cancelled'|'exported';path?:string}>;
  reviewTaskFile(request:{workspaceId:string;fileId:string}):Promise<import('./task-context').TaskFileReview>;
  getProjectShell(target:import('./project-tools').ProjectTarget):Promise<import('./project-tools').ProjectShell|null>;
  openProjectShell(request:{target:import('./project-tools').ProjectTarget;size:import('./project-tools').TerminalSize}):Promise<import('./project-tools').ProjectShell>;
  writeProjectShell(request:{id:string;data:string}):Promise<void>;
  resizeProjectShell(request:{id:string;size:import('./project-tools').TerminalSize}):Promise<void>;
  closeProjectShell(id:string):Promise<void>;
  onProjectShell(listener:(state:import('./project-tools').ProjectShell)=>void):()=>void;
  getPreviewCandidates(target:import('./project-tools').ProjectTarget):Promise<string[]>;
  getProjectPreview():Promise<import('./project-tools').ProjectPreview>;
  openProjectPreview(request:{target:import('./project-tools').ProjectTarget;url:string}):Promise<import('./project-tools').ProjectPreview>;
  setProjectPreviewBounds(request:{target:import('./project-tools').ProjectTarget;bounds:BrowserBounds}|null):Promise<void>;
  closeProjectPreview():Promise<void>;
  onProjectPreview(listener:(state:import('./project-tools').ProjectPreview)=>void):()=>void;
  discoverGitHubAgents(request:{repository:string;ref?:string}):Promise<import('./github-agents').GitHubAgentCatalog>;
  previewGitHubAgent(request:{catalogId:string;path:string}):Promise<import('./github-agents').GitHubAgentPreview>;
  getDesktopState():Promise<import('./desktop').DesktopState>;
  saveDesktopPreferences(patch:Partial<import('./desktop').DesktopPreferences>):Promise<import('./desktop').DesktopState>;
  onDesktopState(listener:(state:import('./desktop').DesktopState)=>void):()=>void;
  checkUpdates():Promise<import('./desktop').UpdateResult>;
  openUpdateRelease():Promise<void>;
  getGitSnapshot(target:import('./git').GitTarget):Promise<import('./git').GitSnapshot>;
  startGitWork(request:{runId:string;kind:'review'|'fix';findingIndex?:number;reviewRunId?:string}):Promise<AgentRun>;
  openGitPullRequest(target:import('./git').GitTarget):Promise<void>;
  mergeGitPullRequest(request:{runId:string;url:string;head:string}):Promise<{state:'cancelled'|'merged'|'pending';message:string}>;
  onWorktreeState(listener:(state:import('./worktrees').WorktreeState)=>void):()=>void;
  getWorktreeState():Promise<import('./worktrees').WorktreeState>;
  recoverWorktree(id:string,action:'recover'|'forget'):Promise<import('./worktrees').WorktreeState>;
  saveWorktreePreferences(preferences:import('./worktrees').WorktreePreferences):Promise<import('./worktrees').WorktreeState>;
  cleanupWorktrees():Promise<import('./worktrees').WorktreeCleanup>;
  selectManagedWorktree(id:string):Promise<WorkspaceSummary>;
  getAgentLaunchers():Promise<import('./agent-launchers').LauncherState>;
  saveAgentLauncher(request:import('./agent-launchers').SaveLauncherRequest):Promise<import('./agent-launchers').LauncherState>;
  removeAgentLauncher(id:string,updatedAt:string):Promise<import('./agent-launchers').LauncherState>;
  launchAgentLauncher(id:string,updatedAt:string):Promise<import('./agent-launchers').LauncherState>;
  getSafetyState():Promise<import('./safety').SafetyState>;
  saveSafetyPolicy(policy:import('./safety').SafetyPolicy):Promise<import('./safety').SafetyState>;
  stopAllExecution():Promise<void>;
  getProviderState():Promise<import('./integrations').ProviderState>;
  accountAction(action:import('./integrations').AccountAction):Promise<void>;
  getIntegrations():Promise<import('./integrations').IntegrationState>;
  saveMcpServer(server:import('./integrations').McpConfiguration):Promise<import('./integrations').IntegrationState>;
  mcpServerAction(name:string,action:'test'|'login'|'remove'|'logout'):Promise<import('./integrations').IntegrationState>;
  getTerminalState():Promise<TerminalState>;
  startTerminalCommand(request:TerminalRequest):Promise<TerminalCommand>;
  cancelTerminalCommand(id:string):Promise<TerminalCommand>;
  onTerminalCommand(listener:(command:TerminalCommand)=>void):()=>void;
  openBrowserUrl(url:string):Promise<void>;
  getBrowsingState():Promise<BrowsingState>;
  browserCommand(command:BrowserCommand):Promise<BrowsingState>;
  setBrowserBounds(bounds:BrowserBounds|null):Promise<void>;
  onBrowsingState(listener:(state:BrowsingState)=>void):()=>void;
  memoryWorkflow(request:MemoryWorkflowRequest):Promise<MemoryWorkflowResult>;
  getMemoryGraph():Promise<MemoryState>;
  saveMemory(request:SaveMemoryRequest):Promise<MemoryState>;
  deleteMemory(id:string):Promise<MemoryState>;
  moveMemoryNode(id:string,position:{x:number;y:number}):Promise<MemoryState>;
  listAgentProfiles():Promise<{profiles:AgentProfile[];warning?:string}>;
  saveAgentProfile(request:SaveAgentRequest):Promise<AgentProfile>;
  changeAgentProfile(request:AgentProfileLifecycleRequest):Promise<{profiles:AgentProfile[];warning?:string}>;
  checkAgentRuntime():Promise<RuntimeCheck>;
  selectAgentFolder():Promise<WorkspaceSummary|null>;
  useAgentProfile(id:string):Promise<{profile:AgentProfile;workspace:WorkspaceSummary|null;warning?:string}>;
  getAppInfo(): Promise<AppInfo>;
  getExecutionState(): Promise<ExecutionState>;
  getRunHistory():Promise<RunHistoryState>;
  deleteRunHistory(request:DeleteHistoryRequest):Promise<RunHistoryState>;
  setRunRetention(retention:RunRetention):Promise<RunHistoryState>;
  prepareRunRerun(id:string):Promise<{run:AgentRun;workspace:WorkspaceSummary}>;
  onRunHistory(listener:(state:RunHistoryState)=>void):()=>void;
  startAgentRun(request: StartRunRequest): Promise<AgentRun>;
  continueAgentRun(request: ContinueRunRequest): Promise<AgentRun>;
  cancelAgentRun(id: string): Promise<AgentRun>;
  onAgentRun(listener: (run: AgentRun) => void): () => void;
  selectWorkspace(): Promise<WorkspaceSummary|null>;
  exportMemory(memory: MemoryExport): Promise<{saved:boolean}>;
  windowControl(action: WindowAction): Promise<void>;
}

export type RunStatus = 'queued' | 'starting' | 'running' | 'cancelling' | 'completed' | 'cancelled' | 'failed' | 'interrupted';
export interface AgentAvailability { installed: boolean; authenticated: boolean; version?: string; message: string }
export interface RunOutput { sequence: number; kind: 'user' | 'system' | 'message' | 'command' | 'output' | 'file' | 'error'; text: string }
export interface AgentRun {
  taskContextSelection?:import('./task-context').TaskContextSelection;
  crew?:import('./crew').CrewExecution;
  threadId?:string;
  gitWorkflow?:import('./git').GitWorkflow;
  executionPath?:string; worktreeId?:string;
  id: string; revision: number; workspaceId: string; projectName: string; projectPath: string;
  pageSelection?:Pick<PageExtract,'id'|'url'|'title'|'capturedAt'>[]; memorySelection?:MemoryReference[]; agentConfiguration?:AgentSnapshot; task: string; status: RunStatus; startedAt: string; endedAt?: string;
  exitCode?: number; signal?: string; error?: string; persistenceError?: string; output: RunOutput[]; truncated: boolean;
}
export interface ContinueRunRequest { runId:string; task:string; expectedRevision:number }
export interface StartRunRequest { taskContext?:import('./task-context').TaskContextRequest; crew?:import('./crew').CrewRequest; useWorktree?:boolean; workspaceId: string; task: string; profileId?:string; profileUpdatedAt?:string; memoryIds?:string[]; memoryRevision?:number; pageIds?:string[] }
export interface ExecutionState { availability: AgentAvailability; workspace: WorkspaceSummary | null; runs: AgentRun[]; executionLimitSeconds?:number; historyWarning?: string }
export const isActiveRun = (status: RunStatus) => status === 'queued' || status === 'starting' || status === 'running' || status === 'cancelling';

export type AgentIcon='code'|'spark'|'shield'|'bug'|'book';
export type AgentColor='violet'|'green'|'blue'|'amber'|'pink';
export interface AgentConfiguration {
  name:string; icon:AgentIcon; color:AgentColor; description:string; runtime:'codex';
  model:string|null; reasoningEffort:string|null; instructions:string; memory:MemoryPolicy;
  sandbox:'read-only'|'workspace-write'; timeoutSeconds:number;
  githubSource?:import('./github-agents').GitHubAgentSource;
}
export interface AgentProfile extends AgentConfiguration {
  id:string; configurationVersion:1; createdAt:string; updatedAt:string; defaultProjectPath:string|null; archivedAt?:string;
}
export interface AgentProfileLifecycleRequest { id:string; expectedUpdatedAt:string; action:'archive'|'restore'|'delete' }
export interface SaveAgentRequest extends AgentConfiguration {
  id?:string; expectedUpdatedAt?:string;
  // null clears, a picker-issued workspace ID selects, saved:<profile ID> retains an approved folder.
  folderChoice:string|null;
}
export interface RuntimeModel { id:string; label:string; efforts:{value:string;description:string}[] }
export interface RuntimeCheck {
  state:'verified'|'unavailable'|'unknown'; authentication:'verified'|'unknown';
  version?:string; checkedAt:string; message:string; models:RuntimeModel[]; catalogState:'verified'|'unknown';
}
export interface AgentSnapshot { profile?:AgentProfile; runtimeDefaults?:true; approvalPolicy:'never'; timeoutSeconds:number; runtimeVersion?:string; safetyPolicy?:import('./safety').SafetyPolicy }

export type RunRetention='30'|'90'|'365'|'all';
export type DeleteHistoryRequest={ids:string[]}|{all:true};
export interface RunHistoryState {runs:AgentRun[];retention:RunRetention;deletedIds:string[];warning?:string}
