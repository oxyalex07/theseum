import { build } from 'esbuild';
import './prepare-pty.mjs';
await build({entryPoints:['electron/main.ts','electron/preload.ts'],outdir:'dist-electron',bundle:true,platform:'node',format:'cjs',outExtension:{'.js':'.cjs'},external:['electron','node-pty'],sourcemap:true,target:'node22'});
