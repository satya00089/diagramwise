// Original Diagramwise geometry. The fixed Hairline kernel owns the camera math and clock.
const { Cam, fit, proj, facing, rrect, rings, prism, ringAt, run, hull, poly, open,
  seg, mk, solid, put, clamp, lerp, tween, tval, tset, tdone, spring, stepS,
  register, pointer, disposer } = HL;

function drawing(svg) {
  const C = Cam(45, 0.5, 1.6);
  fit(C, [[0,0,0],[180,0,0],[0,105,0],[180,105,0],[0,0,62]], 200, 161);
  const P = proj(C), front = facing(C), root = mk('g', {}, svg);
  const path = (g, d, cls='nf') => mk('path', {d, class:cls}, g);
  const line = (g, pts, cls='nf') => path(g, open(pts.map(p=>P(...p))), cls);
  const flat = (g,x,y,w,h,z,cls='sil',r=2) => path(g, poly(ringAt(P,rrect(x,y,x+w,y+h,r,7),z)),cls);
  function box(g,x,y,w,h,z,d,cls='sil') {
    const [outer,inner]=rings(x,y,x+w,y+h,2.4,0.9), el=solid(g);
    put(el,prism(P,front,outer,inner,z,z+d)); el.sil.setAttribute('class',cls); return el;
  }
  function dot(g,x,y,z,r=0.65,cls='dot off') { const p=P(x,y,z); return mk('circle',{cx:p[0],cy:p[1],r,class:cls},g); }
  function panel(g,x,y,z,w,h,cls='sil') {
    const ring=rrect(0,0,w,h,2,8);
    path(g,poly(ring.map(q=>P(x+q.u,y-1,z+q.v))),'lo');
    path(g,poly(ring.map(q=>P(x+q.u,y,z+q.v))),cls);
  }
  function grid(g,x0=9,y0=12,x1=171,y1=97) {
    for(let x=x0;x<=x1;x+=12) for(let y=y0;y<=y1;y+=12) dot(g,x,y,3.8,0.42);
  }
  function board(g,editor=false) {
    box(g,0,0,180,105,0,3.5); flat(g,3,3,174,99,3.55,'nf lo',4);
    grid(g,editor?39:9,editor?24:12);
    if(editor) {
      line(g,[[3,16,3.8],[177,16,3.8]],'nf lo');
      line(g,[[31,16,3.8],[31,101,3.8]],'nf lo');
      [9,17,25].forEach(x=>dot(g,x,9,3.8,1,'dot m'));
      box(g,9,27,15,11,4,3); database(g,16.5,52,4,5,9);
      line(g,[[10,77,4],[15,77,4],[15,86,4],[24,86,4]],'nf');
      dot(g,10,77,4,1,'dot m');dot(g,24,86,4,1,'dot m');
    }
  }
  function server(g,x,y,z,active=false,w=25,h=16) {
    box(g,x,y,w,h,z,12,active?'sil hi':'sil');
    line(g,[[x+4,y+h,z+7],[x+w-9,y+h,z+7]],'nf');
    line(g,[[x+4,y+h,z+4],[x+w-13,y+h,z+4]],'nf lo');
    dot(g,x+w-5,y+h,z+5,0.7,active?'dot':'dot m');
  }
  function database(g,x,y,z,r=10,h=24) {
    const circle=rrect(x-r,y-r,x+r,y+r,r,18);
    path(g,poly(hull(ringAt(P,circle,z).concat(ringAt(P,circle,z+h)))),'sil');
    path(g,poly(ringAt(P,circle,z+h)),'nf');
    [0.34,0.67].forEach(t=>path(g,open(ringAt(P,run(circle,front),z+h*t)),'nf lo'));
  }
  function monitor(g,x,y,z) {
    box(g,x+5,y-3,14,10,z,1.5);
    line(g,[[x+12,y+2,z+2],[x+12,y+2,z+10]],'nf');
    panel(g,x,y+2,z+9,25,22);panel(g,x+2,y+2.05,z+11,21,18,'nf lo');
  }
  function brief(g,x,y,z,review=false) {
    panel(g,x,y,z,40,43);
    if(!review) panel(g,x+14,y+0.5,z+39,12,7,'sil');
    for(let i=0;i<3;i++) {
      const v=z+32-i*10; dot(g,x+6,y+0.2,v,0.9,'dot m');
      line(g,[[x+12,y+0.2,v],[x+(i===1?29:34),y+0.2,v]],i===0&&review?'nf hi':'nf');
      if(!review)line(g,[[x+12,y+0.2,v-3],[x+25,y+0.2,v-3]],'nf lo');
    }
  }
  function cursor(g,x,y,z) {
    const p=P(x,y,z);
    path(g,poly([[p[0],p[1]],[p[0]+1,p[1]+15],[p[0]+5,p[1]+11],[p[0]+9,p[1]+17],[p[0]+12,p[1]+15],[p[0]+8,p[1]+9],[p[0]+14,p[1]+9]]),'sil hi');
  }
  function check(g,x,y,z) { line(g,[[x,y,z],[x+2.7,y+3,z],[x+8,y-5,z]],'nf'); }
  return {C,P,root,path,line,flat,box,dot,panel,grid,board,server,database,monitor,brief,cursor,check};
}

function mountScene({stage,svg,read},value,kind) {
  const bag=disposer(), D=drawing(svg);
  const staticG=mk('g',{},D.root), liveG=mk('g',{},D.root);
  const progress=tween(0), choice=[0,0,0.55,0].map(v=>tween(v));
  const tracking=spring(0); let amount=value, active=false, selected=2, last='', demo=false, demoTime=0;
  const {P,line,flat,box,dot,board,server,database,monitor,brief,cursor,check,path,panel}=D;
  const setup={
    practice(){board(staticG);brief(staticG,7,15,5);},
    learn(){},
    review(){board(staticG);brief(staticG,125,10,8,true);},
    canvas(){board(staticG,true);flat(staticG,91,56,25,16,4,'nf dash',2);}
  }; setup[kind]();

  function circuit(g,p=0,review=false){
    line(g,[[32,73,4],[157,73,4]],'nf lo');
    if(!review) {
      flat(g,65,64,25,16,4,'nf dash');
      line(g,[[65,64,4],[65,64,4+18*(1-p)],[90,64,4+18*(1-p)]],'nf lo dash');
    }
    monitor(g,13,72,4);
    server(g,65,64,4+(review?0:18*(1-p)),!review);
    server(g,109,64,4);
    database(g,158,73,4,10,24);
    if(!review){
      line(g,[[90,73,4],[109,73,4]],p>0.7?'nf hi':'nf lo');
      cursor(g,92,78,16+18*(1-p));
    }
  }
  function book(g,i,opening){
    const x=5+i*44,y=38,z=4;
    box(g,x,y,34,49,z,2);
    flat(g,x+1.5,y+1.5,31,46,z+2.1,'sil');
    line(g,[[x+5,y+36,z+2.2],[x+28,y+36,z+2.2]],'nf');
    line(g,[[x+5,y+40,z+2.2],[x+23,y+40,z+2.2]],'nf lo');
    if(i%2===0){
      [[7,12],[22,20],[7,27]].forEach(([u,v])=>flat(g,x+u,y+v,7,5,z+2.2,'nf',0.8));
      line(g,[[x+14,y+14,z+2.2],[x+25,y+14,z+2.2],[x+25,y+20,z+2.2]],'nf lo');
    }else{database(g,x+16,y+18,z+2.2,5,8);}
    const angle=opening*1.82;
    const Q=(u,v)=>P(x+u*Math.cos(angle),y+v,z+3+u*Math.sin(angle));
    const cover=rrect(0,0,34,49,2,7);
    path(g,poly(cover.map(q=>Q(q.u,q.v))),i===selected?'sil hi':'sil');
    path(g,open([Q(5,35),Q(28,35)]),'nf');
    path(g,open([Q(5,40),Q(22,40)]),'nf lo');
    const detail=rrect(8,9,26,24,2,7);
    path(g,poly(detail.map(q=>Q(q.u,q.v))),'nf lo');
    path(g,open([Q(3,2),Q(3,47)]),'nf lo');
    if(i<2)check(g,x+23,y+8,z+3.2);
  }
  function render(p,opens,track){
    const key=[p,...opens,track].map(v=>v.toFixed(4)).join(',');if(key===last)return;last=key;
    liveG.replaceChildren();
    if(kind==='practice')circuit(liveG,p);
    if(kind==='learn'){
      line(liveG,[[22,62,4],[154,62,4]],'nf lo');
      for(let i=0;i<4;i++)book(liveG,i,opens[i]);
    }
    if(kind==='review'){
      circuit(liveG,0,true);
      const cx=99+track*20,cy=78,cz=29;
      const Q=(u,v)=>P(cx+u*0.707,cy-u*0.707,cz+v);
      const centre=P(cx,cy,cz), ring=rrect(-17,-17,17,17,17,18);
      // A raised inspection lens: attached handle, open glass, and a magnified junction.
      path(liveG,poly([Q(-12,-12),Q(-26,-31),Q(-30,-27),Q(-16,-8)]),'sil');
      path(liveG,poly(ring.map(q=>Q(q.u,q.v))),'sil hi');
      const inset=rrect(-14,-14,14,14,14,18);
      path(liveG,poly(inset.map(q=>Q(q.u,q.v))),'nf');
      path(liveG,open([Q(-12,4),Q(0,0),Q(12,-4)]),'nf hi');
      path(liveG,open([Q(0,0),Q(0,-11)]),'nf lo');
      mk('circle',{cx:centre[0],cy:centre[1],r:2.2,class:'dot'},liveG);
      line(liveG,[[cx,cy,cz+17],[cx,cy-17,cz+22],[125,10,28]],'nf lo');
    }
    if(kind==='canvas'){
      const x=lerp(14,91,p),y=lerp(32,56,p),z=lerp(22,4,p);
      server(liveG,x,y,z,true);cursor(liveG,x+28,y+14,z+11);
    }
  }
  const B=register(stage,(dt,now)=>{
    if(demo){
      demoTime+=dt;
      const t=clamp(demoTime/1.5,0,1), e=HL.EASE_LIFT(t);
      const p=demoTime<2.5?e:1-HL.EASE_LIFT(clamp((demoTime-2.5)/1.5,0,1));
      const op=choice.map((_,i)=>i===2?lerp(0.55,1,p):p*(i===1?0.16:0.07));
      render(p,op,p);
      if(demoTime>=4.1){demo=false;active=false;read.textContent='rest';render(0,[0,0,0.55,0],0);}
      return demo;
    }
    const trackMoving=stepS(tracking,dt);
    render(tval(progress,now),choice.map(t=>tval(t,now)),tracking.x);
    return trackMoving||!tdone(progress,now)||choice.some(t=>!tdone(t,now));
  });bag.add(B.unregister);
  function activate(next=true,index=2,location=0.8){
    demo=false;active=next;selected=next?index:2;const now=performance.now();
    tset(progress,next?1:0,now,0);
    choice.forEach((t,i)=>tset(t,next?(i===index?1:0.12/Math.max(1,Math.abs(i-index))):(i===2?0.55:0),now,Math.abs(i-index)*amount));
    tracking.t=next?clamp(location,-1,1):0;
    read.textContent=next?({practice:'component placed',learn:`lesson ${index+1}`,review:'connection inspected',canvas:'first node'})[kind]:'rest';
    last='';B.wake();
  }
  function move(x){
      const centres=[0,1,2,3].map(i=>P(22+i*44,62,4)[0]);
      const idx=centres.reduce((a,v,i)=>Math.abs(v-x)<Math.abs(centres[a]-x)?i:a,0);
      if(!active||kind==='learn'&&idx!==selected)activate(true,idx,(x-200)/90);
      if(kind==='review'){tracking.t=clamp((x-200)/90,-1,1);B.wake();}
  }
  bag.add(pointer(stage,{
    move:([x])=>move(x),down:([x])=>{
      const centres=[0,1,2,3].map(i=>P(22+i*44,62,4)[0]);
      const idx=centres.reduce((a,v,i)=>Math.abs(v-x)<Math.abs(centres[a]-x)?i:a,0);
      activate(true,kind==='learn'?idx:2,(x-200)/90);
    },leave:()=>activate(false)
  }));
  bag.add(()=>svg.replaceChildren());read.textContent='rest';render(0,[0,0,0.55,0],0);
  return {set(v){amount=v;},destroy:bag.dispose,activate,move,
    play(){if(HL.reducedMotion()){activate(true);return;}selected=2;demo=true;demoTime=0;read.textContent='preview';B.wake();},
    reset(){activate(false);},pose(p){demo=false;selected=2;render(clamp(p,0,1),[0.08*p,0.16*p,lerp(0.55,1,p),0.08*p],p);}
  };
}
