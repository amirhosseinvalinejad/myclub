require("./_pack_eu1");
require("./_pack_world");
require("./_pack_more");
const { packs } = require("./_pack_core");
const needed = "aa,af,am,ar,ay,az,be,bg,bi,bm,bn,bs,ca,crs,cs,cy,da,de,dv,dz,el,en,es,et,eu,fa,fi,fil,fj,fr,ga,gd,gil,gl,gn,gu,ha,he,hi,hif,ho,hr,ht,hu,hy,id,ig,is,it,ja,ka,kg,kk,km,kn,ko,ku,ky,la,lb,ln,lo,lt,lua,lv,mg,mh,mi,mk,ml,mn,mr,ms,mt,my,na,nd,ne,nl,no,nr,nso,ny,om,or,pa,pau,pl,ps,pt,qu,rm,rn,ro,ru,rw,sg,si,sk,sl,sm,sn,so,sq,sr,ss,st,sv,sw,swb,ta,te,tet,tg,th,ti,tk,tn,to,tpi,tr,ts,tvl,uk,ur,uz,ve,vi,wo,xh,yo,zgh,zh,zu".split(",");
const missing = needed.filter((c) => !packs[c]);
console.log("have", Object.keys(packs).length);
console.log("missing", missing.length);
console.log(missing.join(","));
