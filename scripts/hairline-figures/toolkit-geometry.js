// Toolkit figures share the same camera, scale, palette, and clock as the path figures.
const {Cam,fit,proj,facing,rrect,rings,prism,ringAt,run,hull,poly,open,mk,solid,put,
  clamp,lerp,tween,tval,tset,tdone,register,pointer,disposer}=HL;

function toolkitDrawing(svg){
  const C=Cam(45,0.5,1.6);
  fit(C,[[0,0,0],[180,0,0],[0,105,0],[180,105,0],[0,0,62]],200,161);
  const P=proj(C),front=facing(C),root=mk('g',{},svg);
  const path=(g,d,cls='nf')=>mk('path',{d,class:cls},g);
  const line=(g,points,cls='nf')=>path(g,open(points.map(q=>P(...q))),cls);
  const flat=(g,x,y,w,h,z,cls='sil',r=2)=>path(g,poly(ringAt(P,rrect(x,y,x+w,y+h,r,7),z)),cls);
  function box(g,x,y,w,h,z,d,cls='sil'){
    const [outer,inner]=rings(x,y,x+w,y+h,2.4,0.9),el=solid(g);
    put(el,prism(P,front,outer,inner,z,z+d));el.sil.setAttribute('class',cls);
  }
  function panel(g,x,y,z,w,h,cls='sil'){
    const ring=rrect(0,0,w,h,2,8);
    path(g,poly(ring.map(q=>P(x+q.u,y-1,z+q.v))),'lo');
    path(g,poly(ring.map(q=>P(x+q.u,y,z+q.v))),cls);
  }
  function dot(g,x,y,z,r=0.8,cls='dot m'){
    const q=P(x,y,z);mk('circle',{cx:q[0],cy:q[1],r,class:cls},g);
  }
  function server(g,x,y,z,active=false,w=25,h=17){
    box(g,x,y,w,h,z,11,active?'sil hi':'sil');
    line(g,[[x+4,y+h,z+7],[x+w-8,y+h,z+7]],'nf');
    line(g,[[x+4,y+h,z+4],[x+w-11,y+h,z+4]],'nf lo');
    dot(g,x+w-5,y+h,z+5,0.7,active?'dot':'dot m');
  }
  function database(g,x,y,z,r=9,h=18,active=false){
    const ring=rrect(x-r,y-r,x+r,y+r,r,18);
    path(g,poly(hull(ringAt(P,ring,z).concat(ringAt(P,ring,z+h)))),active?'sil hi':'sil');
    path(g,poly(ringAt(P,ring,z+h)),'nf');
    [0.35,0.7].forEach(t=>path(g,open(ringAt(P,run(ring,front),z+h*t)),'nf lo'));
  }
  return {root,P,path,line,flat,box,panel,dot,server,database};
}

function mountToolkit({stage,svg,read},value,kind){
  const bag=disposer(),D=toolkitDrawing(svg),staticG=mk('g',{},D.root),liveG=mk('g',{},D.root);
  const t=tween(0,clamp(900-value*6,480,760));let active=false,last='';
  const {line,flat,box,panel,dot,server,database}=D;
  function base(){box(staticG,7,15,166,77,0,3);flat(staticG,10,18,160,71,3.2,'nf lo',3);}
  function miniature(g,x,y,z,s=1){
    box(g,x,y,15*s,10*s,z,5*s);
    box(g,x+31*s,y+4*s,16*s,10*s,z,5*s);
    line(g,[[x+15*s,y+7*s,z+2*s],[x+31*s,y+9*s,z+2*s]],'nf lo');
    dot(g,x+23*s,y+8*s,z+2*s,0.7);
  }
  if(kind==='library'){
    base();
    [16,66,116].forEach(x=>flat(staticG,x,34,39,35,3.5,'nf lo',2));
    server(staticG,22,43,4,false,25,17);
    box(staticG,124,42,23,24,4,2);
    [0,1,2].forEach(i=>line(staticG,[[128,47+i*6,6.3],[143-i*2,47+i*6,6.3]],'nf lo'));
  }
  if(kind==='annotate'){
    base();
    server(staticG,19,45,4,false,28,19);
    server(staticG,132,53,4,false,25,18);
    line(staticG,[[47,54,4],[73,54,4],[73,61,4],[132,61,4]],'nf lo');
    dot(staticG,73,54,4,1.2,'dot');
  }
  if(kind==='assessment'){
    base();
    miniature(staticG,22,58,4,0.9);
    line(staticG,[[63,66,4],[81,66,4],[81,52,4]],'nf lo');
    dot(staticG,81,52,4,1.2);
  }
  if(kind==='share'){
    base();
    panel(staticG,16,35,7,65,47);
    panel(staticG,106,35,7,57,47);
    line(staticG,[[20,35,45],[77,35,45]],'nf lo');
    line(staticG,[[110,35,45],[159,35,45]],'nf lo');
    miniature(staticG,27,40,8,0.8);
  }
  function render(p){
    const key=p.toFixed(4);if(last===key)return;last=key;liveG.replaceChildren();
    if(kind==='library'){
      const lift=8+15*p;
      line(liveG,[[85,46,4],[85,46,4+lift]],'nf lo dash');
      database(liveG,85+14*p,52-5*p,4+lift,9,19,true);
      flat(liveG,73,41,25,22,4,'nf dash',2);
    }
    if(kind==='annotate'){
      const h=19+22*p;
      line(liveG,[[73,54,4],[81,54,4],[81,54,4+6]],'nf lo');
      panel(liveG,75,54,10,47,h,'sil hi');
      line(liveG,[[82,54,10+h-8],[112,54,10+h-8]],'nf');
      line(liveG,[[82,54,10+h-14],[103,54,10+h-14]],'nf lo');
      dot(liveG,81,54,10+h-6,1,'dot');
    }
    if(kind==='assessment'){
      const h=39+9*p;
      panel(liveG,88,43,7,66,h);
      [0,1,2].forEach(i=>{
        const z=7+h-10-i*11;
        dot(liveG,95,43,z,1,i===1?'dot':'dot m');
        line(liveG,[[101,43,z],[i===1?144:137,43,z]],i===1?'nf hi':'nf lo');
      });
      if(p>0){
        panel(liveG,111,43,19+15*p,39,21,'sil hi');
        line(liveG,[[117,43,29+15*p],[141,43,29+15*p]],'nf');
        line(liveG,[[117,43,23+15*p],[135,43,23+15*p]],'nf lo');
        line(liveG,[[109,43,26],[111,43,19+15*p]],'nf lo');
      }
    }
    if(kind==='share'){
      const x=27+79*p,z=12+15*Math.sin(Math.PI*p);
      flat(liveG,x,50,42,28,z,'sil hi',2);
      miniature(liveG,x+4,55,z+0.2,0.65);
      if(p>0.7){
        line(liveG,[[116,64,8],[151,64,8]],'nf lo');
        dot(liveG,153,64,8,1,'dot');
      }
    }
  }
  const B=register(stage,(_dt,now)=>{render(tval(t,now));return !tdone(t,now);});
  bag.add(B.unregister);
  const names={library:'component selected',annotate:'note expanded',assessment:'finding opened',share:'diagram copied'};
  function activate(next){
    if(active===next)return;active=next;tset(t,next?1:0,performance.now(),0);
    read.textContent=next?names[kind]:'rest';B.wake();
  }
  const move=()=>activate(true),reset=()=>activate(false);
  bag.add(pointer(stage,{move,down:move,leave:reset}));
  bag.add(()=>svg.replaceChildren());read.textContent='rest';render(0);
  return {set(v){t.dur=clamp(900-v*6,480,760);},destroy:bag.dispose,move,reset};
}
