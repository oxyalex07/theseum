import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electron from 'electron';
await import('./build-electron.mjs');
const server=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true}});
await server.listen();server.printUrls();
const env={...process.env,THESEUS_DEV_URL:'http://127.0.0.1:5173'};
delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(electron,['.'],{stdio:'inherit',env});
let closing=false;
async function close(code=0){if(closing)return;closing=true;child.kill();await server.close();process.exit(code);}
child.on('exit',code=>void close(code??0));
child.on('error',error=>{console.error(error);void close(1);});
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
