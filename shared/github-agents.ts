export interface GitHubAgentSource {
  repository:string;
  path:string;
  commit:string;
}
export interface GitHubAgentCatalog {
  id:string;
  repository:string;
  ref:string;
  commit:string;
  files:{path:string;size:number}[];
  omitted:number;
}
export interface GitHubAgentPreview {
  name:string;
  description:string;
  instructions:string;
  source:GitHubAgentSource;
  hadFrontmatter:boolean;
}
