import {readFile,writeFile} from 'node:fs/promises';
// No cargar el plugin nativo de Firebase si aún no existe su aplicación Android.
const file='android/app/src/main/assets/capacitor.plugins.json';
let configured=true;
try{await readFile('android/app/google-services.json');}catch(error){if(error.code==='ENOENT')configured=false;else throw error;}
if(!configured){
  const plugins=JSON.parse(await readFile(file,'utf8'));
  await writeFile(file,JSON.stringify(plugins.filter(p=>p.pkg!=='@capacitor-firebase/authentication'),null,2));
}
