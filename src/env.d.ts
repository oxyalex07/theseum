import type { DesktopBridge } from '../shared/bridge';
declare global { interface Window { readonly theseus?: DesktopBridge } }
export {};
