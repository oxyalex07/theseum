export const researchKinds = ['outline','draft','comparison'] as const;
export type ResearchKind = typeof researchKinds[number];
export interface ResearchEvidence {
  origin:'output-link'|'selected-page'|'browser-activity';
  sequence?:number;
  pageId?:string;
  capturedAt:string;
  sha256:string;
  excerpt:string;
}
export interface ResearchSource { id:string; url:string; title:string; evidence:ResearchEvidence[] }
export interface ResearchArtifact {
  kind:ResearchKind;
  content:string;
  updatedAt:string;
  resultHashes:string[];
}
export interface ResearchDocument {
  version:1;
  runId:string;
  projectPath:string;
  runRevision:number;
  revision:number;
  collectedAt:string;
  truncated:boolean;
  sources:ResearchSource[];
  artifacts:Partial<Record<ResearchKind,ResearchArtifact>>;
}
export interface ResearchState { document:ResearchDocument|null; warning?:string }
export interface ResearchArtifactSummary { runId:string; kind:ResearchKind; task:string; projectName:string; updatedAt:string; characters:number; citations:number; preview:string }
export interface ResearchArtifactList { artifacts:ResearchArtifactSummary[]; warning?:string }
export interface ResearchTarget { runId:string }
export interface ResearchEdit extends ResearchTarget { revision:number; kind:ResearchKind }
export interface ResearchDestination { token:string; path:string; expiresAt:string }
export function researchTarget(input:unknown):ResearchTarget {
  if(!input||typeof input!=='object'||Array.isArray(input)||typeof (input as ResearchTarget).runId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test((input as ResearchTarget).runId))throw new Error('Invalid research run.');
  return {runId:(input as ResearchTarget).runId};
}
export function researchEdit(input:unknown):ResearchEdit {
  const target=researchTarget(input),r=input as ResearchEdit;
  if(!researchKinds.includes(r.kind)||!Number.isSafeInteger(r.revision)||r.revision<1)throw new Error('Invalid research artifact or revision.');
  return {...target,revision:r.revision,kind:r.kind};
}
export function citationIds(content:string):string[]{return [...new Set([...content.matchAll(/\[S(\d+)\]/g)].map(match=>`S${match[1]}`))];}
export function validateResearchContent(input:unknown,sources:ResearchSource[]):string {
  if(typeof input!=='string'||!input.trim()||input.length>200_000||input.includes('\0'))throw new Error('Artifact must contain 1–200,000 characters without null bytes.');
  const ids=new Set(sources.map(source=>source.id));
  if(citationIds(input).some(id=>!ids.has(id)))throw new Error('Unknown citation. Use a collected source ID such as [S1].');
  return input;
}
