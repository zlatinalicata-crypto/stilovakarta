const fs=require('fs'); const keys=require('./keys0.json').all; const d={};
for(const f of fs.readdirSync('tr').filter(x=>/^\d+\.js$/.test(x))){ const [start,arr]=require('./tr/'+f); arr.forEach((v,i)=>{ d[keys[start+i]]=v; }); }
Object.assign(d, require('./tr/extra.js'), require('./tr/landing.js'));
fs.writeFileSync('src/en.js','/* English texts, keyed by the Bulgarian source text. Generated from the translation batches. */\nvar EN_DICT = '+JSON.stringify(d,null,0).replace(/","/g,'",\n"')+';\nif (typeof module !== "undefined") module.exports = EN_DICT;\n');
console.log('entries',Object.keys(d).length);
