const fs=require('fs');
const CYR=/[А-Яа-яЁё]/;
function lits(file, skipVars){
  const out=[]; const lines=fs.readFileSync(file,'utf8').split('\n'); let skip=false;
  for(const l of lines){
    const m=l.match(/^  var ([A-Za-z_]+) = /);
    if(m && skipVars.includes(m[1])) skip=true;
    if(!skip){
      const re=/'(?:[^'\\\n]|\\.)*'/g; let x;
      while((x=re.exec(l))){ if(!CYR.test(x[0])) continue;
        const a=l.slice(0,x.index).trimEnd(), b=l.slice(x.index+x[0].length).trimStart();
        if(b.startsWith(':') && (a.endsWith('{')||a.endsWith(',')||a==='')) continue;
        out.push(eval(x[0])); }
    }
    if(skip && l.trimEnd().endsWith(';')) skip=false;
  }
  return out;
}
function leaves(o, acc, key){
  if(typeof o==='string'){ if(CYR.test(o)) acc.push(o); return; }
  if(o && typeof o==='object') for(const k of Object.keys(o)){ if(['fam','CITIES','TZS'].includes(k)) continue; leaves(o[k],acc,k); }
}
const D=require('./src/data.js');
const data=[]; leaves(D,data);
const cities=D.CITIES.filter(c=>!c[4]).map(c=>c[0]).concat(['България']);
const pub=JSON.parse(fs.readFileSync('/tmp/pubdata.json','utf8')); const pubLeaves=[]; leaves(pub,pubLeaves);
const app=lits('src/app.js',['PROMPT']);
const priv=[].concat(lits('src/report.js',['LOOKS','LOOK_TWEAK','NO_LOOK','PAT']),lits('src/palette.js',[]),lits('src/engine.js',[]),lits('site-src/lib/server.js',[]),data);
const uniq=a=>[...new Set(a)];
const P=uniq(app.concat(pubLeaves,cities)), ALL=uniq(P.concat(priv));
fs.writeFileSync('keys.json',JSON.stringify({public:P,all:ALL},null,0));
console.log('public',P.length,'all',ALL.length,'chars',ALL.join('').length);
