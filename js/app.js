// Presidente · Lumanoids — app principal (dados no Supabase, placar ao vivo via Realtime)
const $=s=>$d.querySelector(s),$d=document;
const CG={pres:'presidente',vice:'vice',sup:'suplente',lixinho:'lixinho',lixao:'lixao'};
let DB={jogadores:[],campeonatos:[],cj:[],rodadas:[],part:[],res:[]},S={view:'login'},GAL=[],AC,TM;
let snd=localStorage.getItem('pres_snd')!='0';
const P=id=>DB.jogadores.find(p=>p.id==id),CH=id=>DB.campeonatos.find(c=>c.id==id),nm=id=>P(id)?P(id).nome:'?';
const rds=cid=>DB.rodadas.filter(r=>r.campeonato_id==cid).sort((a,b)=>a.numero-b.numero);
const curR=cid=>rds(cid).find(r=>r.status=='em_andamento'),lastF=cid=>rds(cid).filter(r=>r.status=='finalizada').pop();
const resR=rid=>DB.res.filter(x=>x.rodada_id==rid).sort((a,b)=>a.posicao-b.posicao);
const partR=rid=>DB.part.filter(x=>x.rodada_id==rid).sort((a,b)=>a.ordem_inicial-b.ordem_inicial);
const dur=s=>{s=Math.max(0,s|0);return[s/3600|0,(s%3600)/60|0,s%60].map(x=>String(x).padStart(2,'0')).join(':')};
const el=r=>r.status=='finalizada'?(r.duracao_seg||0):(Date.now()-new Date(r.iniciada_em))/1000;
const pimg=(id,z)=>{const p=P(id);return p&&p.imagem?`<img class=av src="assets/jogadores/${encodeURI(p.imagem)}" width=${z} height=${z} style="object-fit:cover" onerror="this.outerHTML=avt('${id}',${z})">`:avt(id,z)};
const BF='<div class=bf><div class=bfd></div><b>BOLSA FAMÍLIA</b><small>Rodada em modo especial</small></div>';

/* ---------- dados ---------- */
async function fetchAll(t,cols){let out=[],f=0;for(;;){let q=SB.from(t).select('*');cols.forEach(c=>q=q.order(c));const{data,error}=await q.range(f,f+999);if(error)throw error;out=out.concat(data);if(data.length<1000)return out;f+=1000}}
async function loadAll(){const[a,b,c,d,e,f]=await Promise.all([fetchAll('jogadores',['nome','id']),fetchAll('campeonatos',['iniciado_em','id']),fetchAll('campeonato_jogadores',['campeonato_id','jogador_id']),fetchAll('rodadas',['iniciada_em','id']),fetchAll('rodada_participantes',['rodada_id','jogador_id']),fetchAll('rodada_resultados',['rodada_id','posicao'])]);DB={jogadores:a,campeonatos:b,cj:c,rodadas:d,part:e,res:f}}

function sub(){SB.channel('presidente-live').on('postgres_changes',{event:'*',schema:'public'},()=>{clearTimeout(TM);TM=setTimeout(refresh,250)}).subscribe()}
async function loadGal(){try{GAL=await (await fetch('assets/jogadores/manifest.json',{cache:'no-cache'})).json()}catch(e){GAL=[]}}
const who=()=>localStorage.getItem('pres_nome')||'';
function log(cid,rid,tipo,desc){SB.from('historico_alteracoes').insert({campeonato_id:cid,rodada_id:rid||null,tipo,descricao:desc,autor:who()}).then(()=>{})}
async function db_(p){const{data,error}=await p;if(error){toast('Erro: '+error.message);throw error}return data}

/* ---------- regras de pontuação ---------- */
function standing(cid,skip){const m={},g=id=>m[id]||(m[id]={id,total:0,pres:0,vice:0,lixinho:0,lixao:0,r:0});
 DB.cj.filter(x=>x.campeonato_id==cid).forEach(x=>{const o=g(x.jogador_id);o.total+=x.pontos_entrada;o.ativo=x.status=='ativo'});
 const rs=new Set(DB.rodadas.filter(r=>r.campeonato_id==cid&&r.id!=skip).map(r=>r.id));
 DB.res.filter(x=>rs.has(x.rodada_id)).forEach(x=>{const o=g(x.jogador_id);o.total+=x.pontos;o.r++;const k={presidente:'pres',vice:'vice',lixinho:'lixinho',lixao:'lixao'}[x.cargo];if(k)o[k]++});
 return Object.values(m).sort((a,b)=>b.total-a.total||b.pres-a.pres||a.lixao-b.lixao||nm(a.id).localeCompare(nm(b.id)))}
function bolsa(cid){const rs=rds(cid).filter(r=>r.status=='finalizada');let n=0,w=null;
 for(let i=rs.length-1;i>=0;i--){const p=DB.res.find(x=>x.rodada_id==rs[i].id&&x.posicao==1);if(!p)break;if(w==null)w=p.jogador_id;if(p.jogador_id!=w)break;n++}
 return n>0&&n%5==0}
function gRank(y){const m={};DB.campeonatos.filter(c=>c.status=='finalizado'&&(y=='all'||new Date(c.iniciado_em).getFullYear()==y)).forEach(c=>standing(c.id).forEach(s=>{const o=m[s.id]||(m[s.id]={id:s.id,pts:0,n:0,r:0,pres:0});o.pts+=s.total;o.n++;o.r+=s.r;o.pres+=s.pres}));return Object.values(m).sort((a,b)=>b.pts-a.pts||b.pres-a.pres)}
function sortName(){const used=DB.campeonatos.map(c=>c.nome),f=NAMES.filter(n=>!used.includes('Campeonato '+n));return'Campeonato '+(f.length?f[Math.random()*f.length|0]:NAMES[Math.random()*NAMES.length|0]+' '+(DB.campeonatos.length+1))}

/* ---------- sons (arquivos em assets/sons/) ---------- */
const SND={};
function play(n){if(!snd)return;try{const a=SND[n]||(SND[n]=new Audio('assets/sons/'+n+'.wav'));a.currentTime=0;const p=a.play();if(p)p.catch(()=>{})}catch(e){}}
function playPos(pos,n){const k=role(pos,n)[0];play({pres:'presidente',vice:'vice',sup:'suplente',lixinho:'lixinho',lixao:'lixao'}[k]||'posicao-'+Math.min(pos,8))}
let seenR=null,DEF=null;
const standalone=()=>(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone;
async function refresh(){try{await loadAll()}catch(e){return toast('Falha ao carregar: '+e.message)}
 const now=new Set(DB.res.map(x=>x.rodada_id+'|'+x.jogador_id));
 if(seenR&&S.cid&&S.mode=='live'){const cr=curR(S.cid);if(cr){const nw=resR(cr.id).filter(x=>!seenR.has(x.rodada_id+'|'+x.jogador_id));if(nw.length)playPos(nw[nw.length-1].posicao,partR(cr.id).length)}}
 seenR=now;if(!S.sheet)render()}

/* ---------- telas ---------- */
const rankRow=(s,i)=>`<div class="row rc ${i==0?'sel':''}"><span class="pos${pc(i+1)}">${i+1}º</span>${pimg(s.id,30)}<div class=nm>${esc(nm(s.id))}<small>${s.n} camp. · ${s.r} rodadas · ${s.pres}× presidente</small></div><span class=pts>${s.pts} pts</span></div>`;
const stRows=st=>st.map((s,i)=>`<div class="row rc ${i==0?'sel':''}"><span class="pos${pc(i+1)}">${i+1}º</span>${pimg(s.id,30)}<div class=nm>${esc(nm(s.id))}<small>${s.r} rodadas · ${s.pres}× presidente${s.ativo===false?' · fora':''}</small></div><span class=pts>${s.total} pts</span></div>`).join('');
function clsRows(r){const n=partR(r.id).length;return resR(r.id).map(x=>{const q=role(x.posicao,n);return`<div class="row rc ${q[0]=='lixao'||q[0]=='lixinho'?'low':''}"><span class="pos${pc(x.posicao)}">${x.posicao}º</span>${q[2]?ic(q[2],20):'<span style="width:20px;flex:none"></span>'}${pimg(x.jogador_id,30)}<div class=nm>${esc(nm(x.jogador_id))}</div><span class=rl style="font-size:12px;white-space:nowrap">${q[1]}</span><span class=pts>${x.pontos} pts</span></div>`}).join('')||'<div class="card mu">Ninguém classificado ainda.</div>'}
const FLAG='<svg class=flag width=96 height=64 viewBox="0 0 90 60"><rect width=90 height=60 fill="#fff"/><circle cx=45 cy=30 r=18 fill="#BC002D"/></svg>';
function vLogin(){return`<div class=lgbg><div class=lg>${FLAG}${ic('crown',54)}<h1>PRESIDENTE</h1><p class=mu>Acesso do grupo</p><input type=text id=lu placeholder="Usuário" autocapitalize=none autocomplete=username><input type=password id=lp placeholder="Senha" autocomplete=current-password style="width:100%;padding:14px;border-radius:14px;border:2px solid #e3e3e3;font:16px Inter,system-ui,sans-serif;margin-bottom:10px"><button class="btn p" data-a=login>${ic('lock')} Entrar</button><p class=foot>Criado por <b>Lumanoids</b></p></div></div>`}
function vHome(){const em=DB.campeonatos.find(c=>c.status=='em_andamento'),pr={};DB.res.filter(x=>x.cargo=='presidente').forEach(x=>pr[x.jogador_id]=(pr[x.jogador_id]||0)+1);const top=Object.entries(pr).sort((a,b)=>b[1]-a[1])[0],cr=em&&curR(em.id);
 return(em?`<button class="live blink" data-a=live data-id="${em.id}"><span class=dot></span><div style="flex:1"><b>Campeonato em andamento</b><small>${esc(em.nome)}${cr?' · Rodada '+cr.numero+' · Juiz '+esc(cr.juiz):''}<br>Toque para acompanhar ao vivo</small></div>${ic('radio',26)}</button>`:`<div class="live off">${ic('radio',26)}<div><b>Sem campeonato no momento</b></div></div>`)+
 `<div class=stats><div><b>${DB.campeonatos.length}</b>campeonatos</div><div><b>${DB.rodadas.length}</b>rodadas</div><div><b>${top?esc(nm(top[0])):'–'}</b>maior presidente${top?' ('+top[1]+'×)':''}</div></div>
 <button class="btn p" data-a=newc>${ic('plus')} Novo Campeonato</button>
 <div class=g2><button class=btn data-a=rank>${ic('chart')} Ranking</button><button class=btn data-a=hist>${ic('trophy')} Histórico</button><button class=btn data-a=pl>${ic('users')} Jogadores</button><button class=btn data-a=regras>${ic('book')} Regras</button></div>
 ${standalone()?'':`<button class=btn style="margin-top:10px" data-a=install>${ic('phone')} Instalar no celular</button>`}`}
function addForm(){return`<div class=card><input type=text id=pn placeholder="Nome do novo jogador" maxlength=30 value="${esc(S.pn||'')}"><div class=g2><button class=btn data-a=gal data-id=new>${S.newImg?'Imagem: '+esc(S.newImg):'Escolher imagem'}</button><button class="btn p" data-a=addp>${ic('plus')} Adicionar</button></div></div>`}
function vNewc(){const ps=DB.jogadores.filter(p=>p.ativo);return`<h2 style="margin-top:0">Quem vai jogar hoje?</h2>${addForm()}<div class=g2 style="margin-bottom:12px"><button class="btn s" data-a=selall>Selecionar todos</button><button class="btn s" data-a=selnone>Limpar seleção</button></div>
 ${ps.map(p=>`<div class="row t ${S.sel.includes(p.id)?'sel':''}" data-a=tsel data-id="${p.id}"><span class=ck>${S.sel.includes(p.id)?ic('check',16):''}</span>${pimg(p.id,30)}<div class=nm>${esc(p.nome)}</div></div>`).join('')}
 <button class="btn p" style="margin-top:12px" data-a=start>${ic('play')} Iniciar Campeonato (${S.sel.length})</button>`}
function vPl(){return`<h2 style="margin-top:0">Jogadores</h2>${addForm()}${DB.jogadores.map(p=>`<div class=row style="${p.ativo?'':'opacity:.55'}">${pimg(p.id,38)}<div class=nm>${esc(p.nome)}<small>${p.ativo?'Ativo':'Inativo'}</small></div><button class="btn s" data-a=ren data-id="${p.id}">Nome</button><button class="btn s" data-a=gal data-id="${p.id}">Imagem</button><button class="btn s" data-a=tact data-id="${p.id}">${p.ativo?'Desativar':'Ativar'}</button></div>`).join('')}`}
function vChamp(){const c=CH(S.cid);if(!c)return vHome();if(c.status=='finalizado')return vDet(c);
 const cr=curR(c.id),jm=S.mode=='judge',st=standing(c.id),b=standing(c.id,cr&&cr.id),pos={},pt={};b.forEach((s,i)=>{pos[s.id]=i+1;pt[s.id]=s.total});
 let ids,can=false;if(cr){const pl=resR(cr.id).map(x=>x.jogador_id);ids=partR(cr.id).map(x=>x.jogador_id).filter(i=>!pl.includes(i));can=jm}else ids=b.filter(s=>s.ativo!==false).map(s=>s.id);
 const placed=cr?resR(cr.id).length:0,n=cr?partR(cr.id).length:0,done=cr&&!ids.length&&n>=2,ub=`<button class=btn data-a=undo ${placed?'':'disabled'}>${ic('undo')} Desfazer último</button>`;
 let h=`<div class=camp>${ic('trophy',38)}<div><small>${jm?'Você é o juiz':'Ao vivo'}</small><b>${esc(c.nome.replace('Campeonato ',''))}</b></div><div>${cr?`Rodada ${cr.numero}<small>${ic('clock',13)} <span data-t="${cr.id}">${dur(el(cr))}</span></small>`:`<small>${fd(c.iniciado_em)}</small>${rds(c.id).length} rodadas`}</div></div>
 ${cr?`<div class="card mu" style="padding:10px">${ic('user',16)} Juiz: <b style="color:var(--tx)">${esc(cr.juiz)}</b> · Rodada <b style="color:var(--tx)">${cr.tipo}</b></div>`:''}${cr&&cr.bolsa_familia?BF:''}
 ${cr?`<p style="font-weight:600;margin:4px 0 10px;font-size:15px">${can?'Toque no jogador conforme a ordem que terminar':'Jogadores ainda na rodada'}</p>`:''}
 ${ids.length?`<div class=tls>${ids.map(id=>`<div class="tl ${can?'tap':''}" ${can?`data-a=pick data-id="${id}"`:''}>${pimg(id,34)}<b>${esc(nm(id))}</b><small>${pos[id]}º · ${pt[id]} pts</small></div>`).join('')}</div>`:''}
 ${cr?`<h2 style="margin-top:6px">Classificação da rodada <span class=mu style="font-weight:400;float:right;margin-top:3px">${placed} de ${n}</span></h2>${clsRows(cr)}`:(jm?'':'<div class="card mu">Aguardando a próxima rodada…</div>')}
 ${jm&&cr?`<div style="margin:12px 0">${done?`<div class=g2>${ub}<button class="btn p" data-a=endr>${ic('check')} Finalizar</button></div>`:ub}</div>`:''}
 ${jm&&!cr?`<button class="btn p" data-a=nround>${ic('play')} Nova rodada</button><button class=btn data-a=parts>${ic('users')} Editar participantes</button>${rds(c.id).length?`<button class=btn data-a=endc>${ic('flag')} Finalizar campeonato</button>`:''}`:''}
 <h2>Ranking do campeonato</h2>${stRows(st)}
 <button class=btn style="margin-top:10px" data-a=share>${ic('share')} Compartilhar campeonato ao vivo</button>${jm?'':`<button class=btn data-a=judge>${ic('edit')} Sou o juiz: anotar rodada</button>`}`;
 return h}
function vDet(c){const st=standing(c.id),top=k=>{const m=Math.max(...st.map(s=>s[k]));return m>0?[st.filter(s=>s[k]==m).map(s=>nm(s.id)).join(' e '),m]:['–',0]},mp=top('pres'),ml=top('lixao'),rs=rds(c.id);
 return`<div class=camp>${ic('trophy',38)}<div><small>Finalizado em ${fd(c.encerrado_em)}</small><b>${esc(c.nome.replace('Campeonato ',''))}</b></div><div><small>${fd(c.iniciado_em)}</small>${rs.length} rodadas</div></div>
 <p class=mu style="margin-bottom:12px">Este campeonato teve <b>${rs.length} rodadas</b>.</p>
 <div class=g2 style="margin-bottom:14px"><div class=stc>${ic('crown',28)}<small>Maior presidente</small><b>${esc(mp[0])}</b><span>${mp[1]}×</span></div><div class=stc>${ic('trash',28)}<small>Maior lixão</small><b>${esc(ml[0])}</b><span>${ml[1]}×</span></div></div>
 <h2 style="margin-top:0">Classificação final</h2>${stRows(st)}
 <h2>Rodadas</h2>${rs.map(r=>{const n=partR(r.id).length;return`<div class=card><b>Rodada ${r.numero}</b> <span class=mu>· ${esc(r.juiz)} · ${r.tipo} · ${dur(r.duracao_seg||0)}${r.bolsa_familia?' · Bolsa Família':''}</span><div style="margin-top:6px">${resR(r.id).map(x=>`<span class="pc ${cls(x.posicao,n)}">${x.posicao}º ${esc(nm(x.jogador_id))}</span>`).join('')}</div></div>`}).join('')}
 <button class="btn p" data-a=shareimg>${ic('share')} Compartilhar imagem no WhatsApp</button><button class=btn data-a=reopen>${ic('undo')} Reabrir campeonato</button>`}
function vHist(){
 if(S.sub=='c'){const f=DB.campeonatos.filter(c=>c.status=='finalizado').sort((a,b)=>(b.encerrado_em||'').localeCompare(a.encerrado_em||''));
  return f.length?f.map(c=>`<button class=btn data-a=det data-id="${c.id}" style="justify-content:space-between;text-align:left"><span>${esc(c.nome)}<br><small style="font-weight:400;color:var(--mu)">${fd(c.iniciado_em)} · ${rds(c.id).length} rodadas</small></span><span>${esc(nm(standing(c.id)[0].id))}</span></button>`).join(''):'<div class="card mu">Nenhum campeonato finalizado.</div>'}
 if(S.sub=='j')return DB.jogadores.map(p=>`<div class="row t" data-a=pj data-id="${p.id}">${pimg(p.id,36)}<div class=nm>${esc(p.nome)}</div></div>`).join('')||'<div class="card mu">Nenhum jogador.</div>';
 return`<button class="btn p" data-a=hsub data-v=c>${ic('trophy')} Histórico de campeonatos</button><button class=btn data-a=hsub data-v=j>${ic('users')} Histórico de jogadores</button>`}
function vPj(){const id=S.pid,rs=DB.res.filter(x=>x.jogador_id==id).map(x=>({x,r:DB.rodadas.find(r=>r.id==x.rodada_id)})).filter(o=>o.r).sort((a,b)=>new Date(b.r.iniciada_em)-new Date(a.r.iniciada_em)),cnt=k=>rs.filter(o=>o.x.cargo==k).length,ps=rs.map(o=>o.x.posicao),
 camps=new Set(DB.cj.filter(x=>x.jogador_id==id).map(x=>x.campeonato_id)),tit=DB.campeonatos.filter(c=>c.status=='finalizado'&&standing(c.id)[0]&&standing(c.id)[0].id==id).length;
 return`<div class=card style="display:flex;gap:12px;align-items:center">${pimg(id,56)}<div><b style="font-size:19px">${esc(nm(id))}</b><br><span class=mu>${camps.size} campeonatos · ${tit} título${tit==1?'':'s'}</span></div></div>
 <div class=stats><div><b>${rs.length}</b>rodadas</div><div><b>${ps.length?Math.min(...ps)+'º':'–'}</b>melhor</div><div><b>${ps.length?Math.max(...ps)+'º':'–'}</b>pior</div></div>
 <div class=card>${[['crown','Presidente','presidente'],['medal','Vice','vice'],['down','Lixinho','lixinho'],['trash','Lixão','lixao']].map(a=>`<span style="display:inline-flex;gap:4px;align-items:center;margin-right:14px">${ic(a[0],16)}${a[1]} <b>${cnt(a[2])}×</b></span>`).join('')}</div>
 <h2>O que aconteceu</h2>${rs.slice(0,40).map(o=>{const c=CH(o.r.campeonato_id),q=role(o.x.posicao,partR(o.r.id).length);return`<div class="row rc"><span class="pos${pc(o.x.posicao)}">${o.x.posicao}º</span><div class=nm>${esc(c?c.nome:'')} · Rodada ${o.r.numero}<small>${q[1]} · ${fd(o.r.iniciada_em)}</small></div><span class=pts>${o.x.pontos} pts</span></div>`}).join('')||'<div class="card mu">Ainda sem rodadas.</div>'}`}
function vRank(){const ys=[...new Set(DB.campeonatos.filter(c=>c.status=='finalizado').map(c=>new Date(c.iniciado_em).getFullYear()))].sort().reverse(),L=gRank(S.year);
 return`<select data-a=year style="width:100%;padding:13px;border-radius:14px;border:2px solid #e3e3e3;font:16px Inter,system-ui,sans-serif;margin-bottom:10px;background:#fff"><option value=all>Todos os anos</option>${ys.map(y=>`<option ${S.year==y?'selected':''}>${y}</option>`).join('')}</select>${L.length?L.map(rankRow).join(''):'<div class="card mu">Sem campeonatos finalizados.</div>'}`}
const vInfo=()=>`<div class=card style="text-align:center;padding:22px 14px"><p>Sabe quanto custa criar um aplicativo como este?</p><div class=pr style="margin:12px 0">Apenas<b>R$ 800,00</b></div><a class="btn p" href="https://applumanoids.github.io/sitelumanoids.com/" target=_blank rel=noopener>Conheça o site da Lumanoids</a></div>`;
const vRegras=()=>`<div class=card><b style="color:var(--r)">Regra número 1</b><p style="margin-top:4px">Luma é linda</p></div><div class=card><b style="color:var(--r)">Regra número 2</b><p style="margin-top:4px">Luma é honesta</p></div>`;
const vConfig=()=>`<div class=card style="display:flex;align-items:center;gap:10px">${ic(snd?'vol':'mute')}<b style="flex:1">Sons do jogo</b><button class="btn s" data-a=tsnd>${snd?'Desligar':'Ligar'}</button></div>
 <button class=btn data-a=install>${ic('phone')} Instalar no celular</button><button class=btn data-a=exp>${ic('dl')} Exportar backup (.json)</button>
 <h2>Apagar campeonato</h2>${DB.campeonatos.map(c=>`<div class=row><div class=nm>${esc(c.nome)}<small>${fd(c.iniciado_em)} · ${c.status=='finalizado'?'finalizado':'em andamento'}</small></div><button class="btn s" data-a=delc data-id="${c.id}">${ic('trash',16)} Apagar</button></div>`).join('')||'<div class="card mu">Nenhum campeonato.</div>'}
 <button class=btn style="margin-top:14px" data-a=logout>${ic('out')} Sair</button>`;
function sheet(){
 if(S.sheet=='round')return`<div class=ov><div class=sh><h3>Quem vai anotar esta rodada?</h3><div class=jw>${DB.jogadores.filter(p=>p.ativo).map(p=>`<button class="jc ${S.judge==p.nome?'on':''}" data-a=jpick data-v="${esc(p.nome)}">${esc(p.nome)}</button>`).join('')}</div><input type=text id=jn placeholder="Ou digite outro nome" value="${esc(S.judge||'')}"><h3>Tipo da rodada</h3><div class=g2 style="margin-bottom:12px"><button class="btn ${S.tipo=='aberta'?'p':''}" data-a=tipo data-v=aberta>Aberta</button><button class="btn ${S.tipo=='fechada'?'p':''}" data-a=tipo data-v=fechada>Fechada</button></div><button class="btn p" data-a=startr>${ic('play')} Iniciar rodada</button><button class=btn data-a=close>Cancelar</button></div></div>`;
 if(S.sheet=='parts')return`<div class=ov><div class=sh><h3>Editar participantes</h3><p class=mu style="margin-bottom:10px">Vale a partir da próxima rodada. Quem entra começa com os pontos do último colocado.</p>${DB.jogadores.filter(p=>p.ativo||S.part.includes(p.id)).map(p=>`<div class="row t ${S.part.includes(p.id)?'sel':''}" data-a=tpart data-id="${p.id}"><span class=ck>${S.part.includes(p.id)?ic('check',16):''}</span>${pimg(p.id,30)}<div class=nm>${esc(p.nome)}</div></div>`).join('')}<button class="btn p" data-a=okparts>Aplicar</button><button class=btn data-a=close>Cancelar</button></div></div>`;
 if(S.sheet=='gal')return`<div class=ov><div class=sh><h3>Escolha a imagem</h3><div class=gal><button data-a=setimg data-v="">${avt('x',60)}<br>Padrão</button>${GAL.map(f=>`<button data-a=setimg data-v="${esc(f)}"><img src="assets/jogadores/${encodeURI(f)}"></button>`).join('')}</div>${GAL.length?'':'<p class=mu>Nenhuma imagem no manifest.json ainda.</p>'}<button class=btn data-a=close>Cancelar</button></div></div>`;
 return''}
const TITLES={home:'PRESIDENTE',newc:'Novo campeonato',champ:'Campeonato',hist:'Histórico',rank:'Ranking',pl:'Jogadores',info:'Sobre',regras:'Regras do Jogo',config:'Configurações',pj:'Jogador'};
function render(){const v=S.view;if(v=='login'){$('#app').innerHTML=vLogin();return}
 const V={home:vHome,newc:vNewc,champ:vChamp,hist:vHist,rank:vRank,pl:vPl,info:vInfo,regras:vRegras,config:vConfig,pj:vPj}[v]||vHome,t=v=='hist'&&S.sub?(S.sub=='c'?'Campeonatos':'Jogadores'):TITLES[v];
 $('#app').innerHTML=`<div class=hdr>${v!='home'?`<button class="hb hm" data-a=home>${ic('home',20)}<span>Menu</span></button>`:ic('crown',28)}<h1>${t||''}</h1><button class=hb data-a=config>${ic('cog',24)}</button><button class=hb data-a=info>${ic('info',24)}</button></div><main>${V()}<p class=foot>Criado por <b>Lumanoids</b></p></main>${sheet()}`}
function go(v,x){S=Object.assign({view:v},x||{});render();scrollTo(0,0)}
setInterval(()=>$d.querySelectorAll('[data-t]').forEach(e=>{const r=DB.rodadas.find(x=>x.id==e.dataset.t);if(r)e.textContent=dur(el(r))}),1000);

/* ---------- ações ---------- */
async function addPlayer(){const n=($('#pn').value||'').trim();if(!n)return toast('Digite o nome.');if(DB.jogadores.some(p=>p.nome.toLowerCase()==n.toLowerCase()))return toast('Esse jogador já existe.');
 const p=await db_(SB.from('jogadores').insert({nome:n,imagem:S.newImg||null}).select().single());DB.jogadores.push(p);if(S.sel)S.sel.push(p.id);S.pn='';S.newImg='';render();toast('Jogador adicionado.')}
async function applyParts(sel){const cid=S.cid,cps=DB.cj.filter(x=>x.campeonato_id==cid),act=cps.filter(x=>x.status=='ativo').map(x=>x.jogador_id),st=standing(cid).filter(s=>act.includes(s.id)),minP=rds(cid).length&&st.length?Math.min(...st.map(s=>s.total)):0;
 for(const id of sel){const ex=cps.find(x=>x.jogador_id==id);
  if(!ex){await db_(SB.from('campeonato_jogadores').insert({campeonato_id:cid,jogador_id:id,pontos_entrada:minP}));log(cid,null,'entrada',nm(id)+' entrou com '+minP+' pts')}
  else if(ex.status=='saiu'){await db_(SB.from('campeonato_jogadores').update({status:'ativo',saiu_em:null}).match({campeonato_id:cid,jogador_id:id}));log(cid,null,'retorno',nm(id)+' voltou')}}
 for(const x of cps)if(x.status=='ativo'&&!sel.includes(x.jogador_id)){await db_(SB.from('campeonato_jogadores').update({status:'saiu',saiu_em:new Date().toISOString()}).match({campeonato_id:cid,jogador_id:x.jogador_id}));log(cid,null,'saida',nm(x.jogador_id)+' saiu')}}
function shareImg(c){const st=standing(c.id),mx=Math.max(...st.map(s=>s.pres)),cv=document.createElement('canvas'),H=Math.max(1200,420+st.length*100+120),f='Inter,system-ui,sans-serif';cv.width=1080;cv.height=H;const g=cv.getContext('2d');
 const crown=(x,y,z)=>{g.save();g.translate(x,y);g.scale(z/24,z/24);g.strokeStyle='#D32F2F';g.lineWidth=2;g.lineCap='round';g.lineJoin='round';g.stroke(new Path2D('M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z'));g.stroke(new Path2D('M5 21h14'));g.restore()};
 g.fillStyle='#fff';g.fillRect(0,0,1080,H);g.fillStyle='#D32F2F';g.fillRect(0,0,1080,210);g.fillStyle='#fff';g.textAlign='center';g.font='bold 38px '+f;g.fillText('PRESIDENTE',540,75);g.font='bold 70px '+f;g.fillText(c.nome,540,160);
 g.fillStyle='#777';g.font='32px '+f;g.fillText(fd(c.iniciado_em)+' · '+rds(c.id).length+' rodadas',540,270);
 st.forEach((s,i)=>{const y=310+i*100;g.fillStyle=i==0?'#FDECEC':i%2?'#fff':'#F5F5F5';g.fillRect(50,y,980,88);g.textAlign='left';g.fillStyle=i==0?'#D32F2F':'#333';g.font='bold 44px '+f;g.fillText((i+1)+'º',80,y+60);g.fillText(nm(s.id),190,y+60);
  if(mx>0&&s.pres==mx)crown(190+g.measureText(nm(s.id)).width+18,y+22,44);g.textAlign='right';g.fillText(s.total+' pts',1000,y+60)});
 const y=310+st.length*100+40,big=st.filter(s=>s.pres==mx&&mx>0).map(s=>nm(s.id)).join(', ');
 if(big){crown(60,y-30,44);g.textAlign='left';g.fillStyle='#333';g.font='30px '+f;g.fillText('Maior presidente: '+big+' ('+mx+'×)',120,y+4)}
 const txt=c.nome+' – campeão: '+nm(st[0].id)+' ('+st[0].total+' pts)';
 cv.toBlob(async b=>{const file=new File([b],'presidente-pontuacao.png',{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],text:txt})}catch(e){}}
  else{dl(b,file.name);toast('Imagem baixada. Abrindo o WhatsApp…');setTimeout(()=>window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank'),900)}},'image/png')}
const A={
 async login(){const{error}=await Auth.login($('#lu').value,$('#lp').value);if(error)return toast('Usuário ou senha inválidos.');await start()},
 async logout(){await Auth.logout()},home:()=>go('home'),info:()=>go('info'),regras:()=>go('regras'),config:()=>go('config'),hist:()=>go('hist'),rank:()=>go('rank',{year:'all'}),pl:()=>go('pl'),
 hsub:e=>go('hist',{sub:e.dataset.v}),det:e=>go('champ',{cid:e.dataset.id}),pj:e=>go('pj',{pid:e.dataset.id}),
 tsnd:()=>{snd=!snd;localStorage.setItem('pres_snd',snd?'1':'0');render();if(snd)play('inicio')},
 async install(){if(DEF){DEF.prompt();await DEF.userChoice;DEF=null;render()}else alert('Para instalar:\n\nAndroid (Chrome): menu ⋮ → "Instalar aplicativo".\niPhone (Safari): botão Compartilhar → "Adicionar à Tela de Início".')},
 newc(){if(DB.campeonatos.some(c=>c.status=='em_andamento'))return toast('Já existe um campeonato em andamento.');go('newc',{sel:DB.jogadores.filter(p=>p.ativo).map(p=>p.id)})},
 live:e=>go('champ',{cid:e.dataset.id,mode:'live'}),judge:()=>{S.mode='judge';render()},
 selall:()=>{S.sel=DB.jogadores.filter(p=>p.ativo).map(p=>p.id);render()},selnone:()=>{S.sel=[];render()},
 tsel:e=>{const i=S.sel.indexOf(e.dataset.id);i<0?S.sel.push(e.dataset.id):S.sel.splice(i,1);render()},
 addp:addPlayer,close:()=>{S.sheet=null;render()},
 gal:e=>{S.gal=e.dataset.id;S.sheet='gal';render()},
 async setimg(e){const f=e.dataset.v||null;if(S.gal=='new'){S.newImg=f||''}else{await db_(SB.from('jogadores').update({imagem:f}).eq('id',S.gal));P(S.gal).imagem=f}S.sheet=null;render()},
 async ren(e){const p=P(e.dataset.id),n=(prompt('Novo nome:',p.nome)||'').trim();if(!n)return;await db_(SB.from('jogadores').update({nome:n}).eq('id',p.id));p.nome=n;render()},
 async tact(e){const p=P(e.dataset.id);await db_(SB.from('jogadores').update({ativo:!p.ativo}).eq('id',p.id));p.ativo=!p.ativo;render()},
 async start(){if(S.sel.length<2)return toast('Selecione ao menos 2 jogadores.');const c=await db_(SB.from('campeonatos').insert({nome:sortName()}).select().single());
  await db_(SB.from('campeonato_jogadores').insert(S.sel.map(id=>({campeonato_id:c.id,jogador_id:id}))));log(c.id,null,'campeonato','Campeonato criado');play('inicio');await loadAll();go('champ',{cid:c.id,mode:'judge'})},
 nround:()=>{S.sheet='round';S.judge=who();S.tipo='aberta';render()},jpick:e=>{S.judge=e.dataset.v;render()},tipo:e=>{S.tipo=e.dataset.v;render()},
 async startr(){const j=(S.judge||'').trim();if(!j)return toast('Informe quem vai anotar.');localStorage.setItem('pres_nome',j);const cid=S.cid;
  const act=DB.cj.filter(x=>x.campeonato_id==cid&&x.status=='ativo').map(x=>x.jogador_id);if(act.length<2)return toast('Precisa de ao menos 2 jogadores ativos.');
  const lf=lastF(cid),pos={};if(lf)resR(lf.id).forEach(x=>pos[x.jogador_id]=x.posicao);const ord=act.sort((a,b)=>(pos[a]||99)-(pos[b]||99)||nm(a).localeCompare(nm(b)));
  const num=Math.max(0,...rds(cid).map(r=>r.numero))+1,bf=bolsa(cid);
  const r=await db_(SB.from('rodadas').insert({campeonato_id:cid,numero:num,tipo:S.tipo,juiz:j,bolsa_familia:bf}).select().single());
  await db_(SB.from('rodada_participantes').insert(ord.map((id,i)=>({rodada_id:r.id,jogador_id:id,ordem_inicial:i+1}))));
  log(cid,r.id,'rodada','Rodada '+num+' iniciada por '+j+' ('+S.tipo+')'+(bf?' · BOLSA FAMÍLIA':''));S.sheet=null;S.mode='judge';await loadAll();render()},
 parts:()=>{S.part=DB.cj.filter(x=>x.campeonato_id==S.cid&&x.status=='ativo').map(x=>x.jogador_id);S.sheet='parts';render()},
 tpart:e=>{const i=S.part.indexOf(e.dataset.id);i<0?S.part.push(e.dataset.id):S.part.splice(i,1);render()},
 async okparts(){if(S.part.length<2)return toast('Selecione ao menos 2 jogadores.');await applyParts(S.part);S.sheet=null;await loadAll();render();toast('Participantes atualizados.')},
 async pick(e){const cr=curR(S.cid),id=e.dataset.id;if(!cr||e.classList.contains('gone'))return;e.classList.add('gone');
  const n=partR(cr.id).length,pos=resR(cr.id).length+1,k=role(pos,n)[0],row={rodada_id:cr.id,jogador_id:id,posicao:pos,pontos:n-pos+1,cargo:CG[k]||null};
  DB.res.push(row);playPos(pos,n);setTimeout(render,180);const{error}=await SB.from('rodada_resultados').insert(row);if(error){toast('Erro ao salvar: '+error.message);await refresh()}},
 async undo(){const cr=curR(S.cid),l=resR(cr.id).pop();if(!l)return;DB.res=DB.res.filter(x=>x!==l);render();const{error}=await SB.from('rodada_resultados').delete().match({rodada_id:l.rodada_id,jogador_id:l.jogador_id});if(error){toast('Erro: '+error.message);await refresh()}else log(S.cid,cr.id,'desfazer','Desfeito: '+nm(l.jogador_id))},
 async endr(){const cr=curR(S.cid),d=Math.round((Date.now()-new Date(cr.iniciada_em))/1000);await db_(SB.from('rodadas').update({status:'finalizada',finalizada_em:new Date().toISOString(),duracao_seg:d}).eq('id',cr.id));log(S.cid,cr.id,'rodada','Rodada '+cr.numero+' finalizada ('+dur(d)+')');await refresh();toast('Rodada finalizada.')},
 async endc(){if(!confirm('Finalizar o campeonato?'))return;await db_(SB.from('campeonatos').update({status:'finalizado',encerrado_em:new Date().toISOString()}).eq('id',S.cid));log(S.cid,null,'campeonato','Finalizado');await loadAll();go('champ',{cid:S.cid});toast('Campeonato finalizado. Compartilhe o resultado!')},
 async reopen(){if(!confirm('Reabrir este campeonato? Rodadas e pontos são mantidos.'))return;await db_(SB.from('campeonatos').update({status:'em_andamento',encerrado_em:null,reaberto_em:new Date().toISOString()}).eq('id',S.cid));log(S.cid,null,'campeonato','Reaberto');await loadAll();go('champ',{cid:S.cid,mode:'judge'})},
 async delc(e){const c=CH(e.dataset.id);if(!confirm('Apagar "'+c.nome+'" com todas as rodadas e resultados? Não dá para desfazer.'))return;await db_(SB.from('campeonatos').delete().eq('id',c.id));await loadAll();render();toast('Campeonato apagado.')},
 share(){const c=CH(S.cid),u=location.origin+location.pathname+'#/c/'+c.id;window.open('https://wa.me/?text='+encodeURIComponent('Acompanhe o '+c.nome+' ao vivo: '+u),'_blank')},
 shareimg:()=>shareImg(CH(S.cid)),year:()=>{},
 async exp(){await loadAll();const d=new Date().toISOString();dl(new Blob([JSON.stringify({app:'presidente-lumanoids',versao:4,exportado_em:d,dados:DB},null,1)],{type:'application/json'}),'presidente-backup-'+d.slice(0,10)+'.json')}};
$d.addEventListener('click',e=>{const t=e.target.closest('[data-a]');if(t&&t.tagName!='SELECT'&&A[t.dataset.a])A[t.dataset.a](t)});
$d.addEventListener('change',e=>{if(e.target.dataset.a=='year'){S.year=e.target.value;render()}});
$d.addEventListener('input',e=>{if(e.target.id=='jn')S.judge=e.target.value;if(e.target.id=='pn')S.pn=e.target.value});
$d.addEventListener('keydown',e=>{if(e.key=='Enter'&&e.target.id=='lp')A.login()});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();DEF=e});

/* ---------- início ---------- */
async function start(){await Promise.all([loadAll(),loadGal()]);seenR=new Set(DB.res.map(x=>x.rodada_id+'|'+x.jogador_id));
 const m=location.hash.match(/#\/c\/([0-9a-f-]{36})/);S=m&&CH(m[1])?{view:'champ',cid:m[1],mode:'live'}:{view:'home'};sub();render()}
SB.auth.onAuthStateChange(ev=>{if(ev=='SIGNED_OUT'){S={view:'login'};render()}});
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
(async()=>{try{(await Auth.session())?await start():render()}catch(e){render();toast('Sem conexão com o Supabase.')}})();
