const fs = require('fs');
const c = fs.readFileSync('core/fixtures/hero-data.ts','utf8');
const m = c.match(/export default\s+([\s\S]*\])/);
const arr = JSON.parse(m[1]);
const flat = arr.filter(h => h.show === 1).map(h => ({ no: h.no, name: h.name, nickname: h.nickname || '' }));

function normalize(str){
  if(!str) return '';
  let s = String(str).toLowerCase().replace(/\s+/g,'');
  s = s.replace(/[！-～]/g, function(ch){ return String.fromCharCode(ch.charCodeAt(0)-0xFEE0); });
  return s;
}
function isSubsequence(sub, str){
  if(!sub||!str) return false;
  let i=0;
  for(let j=0;j<str.length && i<sub.length;j++){ if(sub[i]===str[j]) i++; }
  return i===sub.length;
}
function matchHero(query){
  const q = normalize(query);
  if(!q) return null;
  let fallback = null;
  for(const hero of flat){
    const nameN = normalize(hero.name);
    const nickN = normalize(hero.nickname);
    if(q===nameN || (nickN && q===nickN)) return hero.no;
    if(q.length>=2){
      if(isSubsequence(q, nameN)){ if(!fallback) fallback = hero.no; }
      else if(nickN && isSubsequence(q, nickN)){ if(!fallback) fallback = hero.no; }
    }
  }
  return fallback;
}
function splitNames(text){
  if(!text) return [];
  return text.split(/[\s,，、/\\|;；\n\r\t]+/).map(function(s){return s.trim();}).filter(function(s){return s.length>0;});
}

const sample = '京太郎，文堂，津山，小学生怜，柿子，野上叶子，石户明星，水村史织';
const tokens = splitNames(sample);
console.log('tokens:', tokens.join(' | '));
tokens.forEach(function(t,i){
  const no = matchHero(t);
  const h = flat.find(function(x){return x.no===no;});
  console.log('['+i+'] "'+t+'" => no='+no+' name='+((h&&h.name)||'-')+' nick='+((h&&h.nickname)||'-'));
});
console.log('--- 缩略/昵称测试 ---');
['京狗','京太郎','文堂','津山','柿子','水村'].forEach(function(t){
  const no = matchHero(t); const h = flat.find(function(x){return x.no===no;});
  console.log('"'+t+'" => '+((h&&h.name)||'未匹配')+' (no='+no+')');
});
