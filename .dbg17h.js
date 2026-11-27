const { app, BrowserWindow } = require('electron');
const path=require('path');
const fs=require('fs');
const ud=path.join(require('os').tmpdir(),'pq-dbg17h');
try{fs.rmSync(ud,{recursive:true,force:true})}catch(e){}
fs.mkdirSync(ud,{recursive:true});
app.setPath('userData',ud);
app.whenReady().then(async()=>{
  const w=new BrowserWindow({show:false,webPreferences:{preload:path.join(__dirname,'src','main','preload.js'),contextIsolation:true,sandbox:false}});
  await w.webContents.loadFile(path.join(__dirname,'src','renderer','index.html'));
  await new Promise(r=>setTimeout(r,5000));
  const code=fs.readFileSync(path.join(__dirname,'.dbg17-code.txt'),'utf8');
  let r;
  try{ r=await w.webContents.executeJavaScript('(async function(){'+code+'})()',true); }
  catch(e){ r='OUTER:'+e.message; }
  fs.writeFileSync(path.join(__dirname,'.dbg-dc-out.txt'),String(r),'utf8');
  app.exit(0);
});
