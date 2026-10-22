import {cp,mkdir,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateGoogleServices} from './android-firebase-config.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'www');
let googleConfigured=false;
try{
  const config=JSON.parse(await readFile(path.join(root,'android/app/google-services.json'),'utf8'));
  googleConfigured=validateGoogleServices(config,process.env.ANDROID_SIGNING_SHA1);
}catch(error){if(error.code!=='ENOENT')throw error;}
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const name of await readdir(root)){
  if(/\.html$/.test(name)){
    let html=await readFile(path.join(root,name),'utf8');
    html=html.replace(/<script src="\.\/js\/pwa-bootstrap\.js"><\/script>/g,'<script src="/native/runtime.js"></script>');
    if(!html.includes('/native/runtime.js'))html=html.replace('</head>','<script src="/native/runtime.js"></script></head>');
    await writeFile(path.join(out,name),html);
  }else if(['js','assets','style.css','manifest.webmanifest','hecagus-finance-192.png','hecagus-finance-512.png'].includes(name)){
    await cp(path.join(root,name),path.join(out,name),{recursive:(await stat(path.join(root,name))).isDirectory()});
  }
}
await mkdir(path.join(out,'native'),{recursive:true});
await build({entryPoints:[path.join(root,'native/runtime.js')],outfile:path.join(out,'native/runtime.js'),bundle:true,format:'iife',platform:'browser',target:'chrome89',minify:true,define:{__GOOGLE_CONFIGURED__:String(googleConfigured)}});
console.log(`Recursos Android preparados. Google nativo: ${googleConfigured?'configurado':'pendiente de google-services.json'}.`);
