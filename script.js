/* EcoRoute RAEE FIEI | Simulador académico local
   Fuente: Informe_EcoRoute_Web.pdf (2026).
   IMPORTANTE: datos y rutas del escenario didáctico, no mediciones en la FIEI.
   No hay backend, recolección de información ni conexiones externas.
*/
'use strict';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const STORAGE_KEY = 'ecoroute-raee-demo-v1';
const CATEGORIES = ['Componentes informáticos', 'Cableado y accesorios', 'Baterías: evaluación especializada', 'Evaluación pendiente'];
const STATES = ['Registrado', 'Clasificado', 'Almacenado', 'Recolectado', 'Entregado'];
const NODE_ORDER = ['H', 'A', 'B', 'C'];
const POINTS = {H:{x:105,y:210}, A:{x:300,y:85}, B:{x:300,y:320}, C:{x:600,y:210}};
const GRAPH = {H:{A:20,B:35}, A:{H:20,B:10,C:40}, B:{H:35,A:10,C:15}, C:{A:40,B:15}};
const VIEW_NAMES = {inicio:'Resumen',inventario:'Inventario',rutas:'Rutas y Dijkstra',trazabilidad:'Trazabilidad',alertas:'Lógica de alertas',exposicion:'Modo exposición'};
const STAGE_ACTIONS = ['Registrar elemento', 'Asignar categoría', 'Confirmar ubicación autorizada', 'Confirmar retiro', 'Validar recepción con constancia'];
const DEFAULT_RECORDS = [
  {id:'P1',description:'Placa electrónica',category:CATEGORIES[0],point:'A',risk:false},
  {id:'P2',description:'Memoria RAM',category:CATEGORIES[0],point:'A',risk:false},
  {id:'C1',description:'Cable',category:CATEGORIES[1],point:'B',risk:false},
  {id:'B1',description:'Batería',category:CATEGORIES[2],point:'C',risk:true}
];

function nowText(){return new Date().toLocaleString('es-PE',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function createDefaults(){return DEFAULT_RECORDS.map(r=>({...r,state:0,receipt:'',history:[{action:'Registro del escenario',state:0,details:'Dato ilustrativo del informe',at:nowText(),actor:'Simulador'}]}));}
function validRecord(r){return r && typeof r.id==='string' && typeof r.description==='string' && CATEGORIES.includes(r.category) && ['A','B','C'].includes(r.point) && Number.isInteger(r.state) && r.state>=0 && r.state<=4 && Array.isArray(r.history);}
function loadRecords(){try{const stored=JSON.parse(localStorage.getItem(STORAGE_KEY));if(Array.isArray(stored)&&stored.length<=200&&stored.every(validRecord))return stored;}catch(_error){}return createDefaults();}
let records=loadRecords();
let selectedTraceId='P1';
let toastTimer;
function persistRecords(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(records));}catch(_error){/* Si está deshabilitado el almacenamiento, la sesión sigue funcionando. */}}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3600);}

/* ------ NAVEGACIÓN / MODO EXPOSICIÓN ------ */
function showView(view, updateHash=true){
  if(!VIEW_NAMES[view])view='inicio';
  $$('.view').forEach(el=>{const active=el.id===`view-${view}`;el.hidden=!active;el.classList.toggle('active-view',active);});
  $$('[data-view-link]').forEach(el=>{const active=el.dataset.viewLink===view;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  $('#currentViewName').textContent=VIEW_NAMES[view];
  $('#sidebar').classList.remove('mobile-open');
  if(updateHash && location.hash!==`#${view}`)history.replaceState(null,'',`#${view}`);
  window.scrollTo({top:0,behavior:'instant'});
  if(view==='rutas')renderRoute();
  if(view==='inventario')renderInventory();
  if(view==='trazabilidad')renderTrace();
  if(view==='alertas')renderAlerts();
  if(view==='exposicion')renderSlide();
}
$$('[data-view-link]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();showView(el.dataset.viewLink);}));
// Se usa delegación porque los botones de exposición se crean dinámicamente.
$('#mainContent').addEventListener('click',e=>{const btn=e.target.closest('[data-jump]');if(btn){e.preventDefault();showView(btn.dataset.jump);}});
window.addEventListener('hashchange',()=>showView(location.hash.slice(1),false));
$('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('mobile-open'));
document.addEventListener('click',e=>{if(innerWidth<761&&!e.target.closest('#sidebar')&&!e.target.closest('#mobileMenu'))$('#sidebar').classList.remove('mobile-open');});
$('#closeNotice').addEventListener('click',()=>{$('.notice-bar').hidden=true;});

/* ------ INVENTARIO Y CLASES DE EQUIVALENCIA ------ */
function categoryBadge(category){if(category===CATEGORIES[0])return 'blue';if(category===CATEGORIES[1])return 'green';if(category===CATEGORIES[2])return 'yellow';return 'gray';}
function stateBadge(index){return index===4?'green':index===3?'blue':index===0?'gray':'yellow';}
function renderInventory(){
  $('#metricRecords').textContent=records.length;
  $('#inventoryCountText').textContent=`${records.length} registros en la simulación`;
  const query=$('#inventorySearch').value.trim().toLocaleLowerCase('es');
  const filter=$('#inventoryFilter').value;
  const items=records.filter(r=>(filter==='all'||r.category===filter)&&(r.id.toLocaleLowerCase('es').includes(query)||r.description.toLocaleLowerCase('es').includes(query)));
  $('#inventoryBody').innerHTML=items.length?items.map(r=>`<tr><td class="cell-strong">${escapeHTML(r.id)}</td><td>${escapeHTML(r.description)}</td><td><span class="badge ${categoryBadge(r.category)}">${escapeHTML(r.category)}</span></td><td>${escapeHTML(r.point)}</td><td><span class="badge ${stateBadge(r.state)}">${STATES[r.state]}</span></td><td>${r.risk?'<span class="badge yellow">Revisar</span>':'<span class="muted-cell">No reportada</span>'}</td></tr>`).join(''):'<tr><td colspan="6" class="muted-cell">No hay registros que coincidan con el filtro.</td></tr>';
  $('#categoryGroups').innerHTML=CATEGORIES.map(category=>{const matching=records.filter(r=>r.category===category);return `<div class="group-card ${category===CATEGORIES[3]?'pending':''}"><strong>${escapeHTML(category)}</strong><div class="group-ids">{${matching.map(r=>escapeHTML(r.id)).join(', ')||'∅'}}</div><span class="group-num">${matching.length} elemento(s)</span></div>`;}).join('');
}
function updateAllRecordViews(){renderInventory();renderTraceSelect();renderTrace();}
$('#inventorySearch').addEventListener('input',renderInventory);
$('#inventoryFilter').addEventListener('change',renderInventory);
$('#inventoryForm').addEventListener('submit',e=>{
  e.preventDefault();
  const id=$('#newId').value.trim().toUpperCase();
  const description=$('#newDescription').value.trim();
  const category=$('#newCategory').value;const point=$('#newLocation').value;
  if(!/^[A-Z0-9-]{1,18}$/.test(id)||!description||!CATEGORIES.includes(category)){toast('Revisa el ID, la descripción y la categoría.');return;}
  if(records.some(r=>r.id.toUpperCase()===id)){toast(`El identificador ${id} ya está registrado.`);return;}
  const item={id,description,category,point,risk:$('#newRisk').checked,state:0,receipt:'',history:[{action:'Registrar elemento',state:0,details:`Punto ${point} · categoría: ${category}`,at:nowText(),actor:'Equipo expositor (demo)'}]};
  records.push(item);persistRecords();e.target.reset();selectedTraceId=id;updateAllRecordViews();toast(`Registro ${id} añadido a la simulación.`);
});
$('#resetInventory').addEventListener('click',()=>{
  if(!window.confirm('¿Restablecer el inventario y el historial a los datos ficticios iniciales?'))return;
  records=createDefaults();selectedTraceId='P1';persistRecords();updateAllRecordViews();toast('Se restauraron P1, P2, C1 y B1.');
});
$('#exportData').addEventListener('click',()=>{
  const payload={proyecto:'EcoRoute RAEE FIEI',tipo:'Simulación didáctica — no es inventario institucional',fecha:nowText(),registros:records};
  const data=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download='ecoroute-inventario-demo.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Se exportó el inventario de demostración.');
});

/* ------ GRAFOS, DIJKSTRA Y RUTAS ------ */
function shortestPaths(start){
  const dist=Object.fromEntries(NODE_ORDER.map(v=>[v,Infinity]));
  const prev=Object.fromEntries(NODE_ORDER.map(v=>[v,null]));
  const visited=new Set();dist[start]=0;
  const snapshots=[{step:'Inicio',dist:{...dist},visited:[]}];
  for(let count=0;count<NODE_ORDER.length;count++){
    const u=NODE_ORDER.filter(v=>!visited.has(v)).sort((a,b)=>dist[a]-dist[b])[0];
    if(!u||dist[u]===Infinity)break;
    visited.add(u);
    for(const [v,w] of Object.entries(GRAPH[u])){if(!visited.has(v)&&dist[u]+w<dist[v]){dist[v]=dist[u]+w;prev[v]=u;}}
    snapshots.push({step:u,dist:{...dist},visited:[...visited]});
  }
  return {dist,prev,snapshots};
}
function shortestRoute(from,to){
  const {dist,prev}=shortestPaths(from);
  if(!Number.isFinite(dist[to]))return {nodes:[],cost:Infinity};
  const path=[to];let current=to;
  while(current!==from){current=prev[current];if(!current)break;path.unshift(current);}
  return {nodes:path,cost:dist[to]};
}
function getTourData(order){
  const visits=['H',...order.split('-'),'H'];
  const physical=[];let cost=0;
  for(let i=0;i<visits.length-1;i++){
    const stage=shortestRoute(visits[i],visits[i+1]);cost+=stage.cost;
    if(i===0)physical.push(...stage.nodes);else physical.push(...stage.nodes.slice(1));
  }
  return {visits,physical,cost};
}
function graphEdgeKey(a,b){return [a,b].sort().join('-');}
function setHighlightedGraph(path=[],activePair=null){
  const edges=new Set();for(let i=0;i<path.length-1;i++)edges.add(graphEdgeKey(path[i],path[i+1]));
  $$('#graphEdges line').forEach(el=>{const key=graphEdgeKey(...el.dataset.edge.split('-'));el.classList.toggle('highlight',edges.has(key));el.classList.toggle('active-segment',activePair?graphEdgeKey(...activePair)===key:false);});
  const used=new Set(path);$$('.graph-nodes > g').forEach(el=>el.classList.toggle('passed',used.has(el.dataset.node)));
}
let routeToken=0;let isRunning=false;
function selectedTour(){return getTourData($('#routeOrder').value);}
function renderRoute(){
  const tour=selectedTour();
  $('#routeCost').innerHTML=`${tour.cost} <small>m</small>`;
  $('#activeRouteMeters').textContent=`${tour.cost} m`;
  const optimal=tour.cost===90;
  $('#routeQuality').textContent=optimal?'✓ Una de las cuatro rutas de menor costo':'○ Recorrido alternativo, no mínimo';
  $('#routeQuality').classList.toggle('nonoptimal',!optimal);
  $('#routePhysical').textContent=tour.physical.join(' – ');
  const delta=110-tour.cost;
  $('#routeDifference').textContent=delta>0?`${delta} m menos · ${(delta/110*100).toFixed(2).replace('.',',')} % de diferencia`:'Igual distancia que la referencia (110 m)';
  $('#graphNarration').textContent=`Orden de atención: ${tour.visits.join(' → ')}. Trayectoria real por aristas: ${tour.physical.join(' → ')}.`;
  setHighlightedGraph(tour.physical);
  const chosen=$('#routeOrder').value;
  $('#routeOptionsBody').innerHTML=['A-B-C','A-C-B','B-A-C','B-C-A','C-A-B','C-B-A'].map(order=>{const data=getTourData(order);return `<tr class="${chosen===order?'selected-row':''}"><td class="cell-strong">H–${order.split('-').join('–')}–H</td><td>${data.cost} m</td><td>${data.cost===90?'<span class="badge green">Mínima</span>':'<span class="badge yellow">Mayor costo</span>'}</td></tr>`;}).join('');
}
function stopRoute(message='Simulación detenida.'){routeToken++;isRunning=false;$('#runRoute').disabled=false;$('#routeOrder').disabled=false;const marker=$('#vehicleMarker');marker.setAttribute('visibility','hidden');$('#routeStatus').textContent=message;renderRoute();}
$('#routeOrder').addEventListener('change',()=>{stopRoute('Ruta actualizada. Puedes iniciar la simulación.');});
$('#stopRoute').addEventListener('click',()=>stopRoute('Simulación reiniciada.'));
function animateSegment(from,to,token){return new Promise(resolve=>{
  const start=performance.now();const marker=$('#vehicleMarker');const p1=POINTS[from],p2=POINTS[to];
  function frame(timestamp){if(token!==routeToken){resolve(false);return;}const t=Math.min((timestamp-start)/620,1);const smooth=t*t*(3-2*t);marker.setAttribute('cx',String(p1.x+(p2.x-p1.x)*smooth));marker.setAttribute('cy',String(p1.y+(p2.y-p1.y)*smooth));if(t>=1)resolve(true);else requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
});}
$('#runRoute').addEventListener('click',async()=>{
  if(isRunning)return;
  routeToken++;const token=routeToken;const tour=selectedTour();isRunning=true;$('#runRoute').disabled=true;$('#routeOrder').disabled=true;
  $('#vehicleMarker').setAttribute('visibility','visible');
  let cumulative=0;
  for(let i=1;i<tour.physical.length;i++){
    if(token!==routeToken)return;
    const from=tour.physical[i-1],to=tour.physical[i];
    $('#routeStatus').textContent=`Tramo ${i}/${tour.physical.length-1}: ${from} → ${to} · ${cumulative} m recorridos`;
    setHighlightedGraph(tour.physical,[from,to]);
    const completed=await animateSegment(from,to,token);if(!completed)return;
    cumulative+=GRAPH[from][to];
  }
  if(token!==routeToken)return;
  setHighlightedGraph(tour.physical);isRunning=false;$('#runRoute').disabled=false;$('#routeOrder').disabled=false;
  $('#routeStatus').textContent=`✓ Recojo simulado completo: ${cumulative} m. Regreso a base H.`;
  toast(`Simulación terminada: ${cumulative} m, escenario ficticio.`);
});
// Dijkstra paso a paso, conservando exactamente las etiquetas provisionales del informe.
const DIJKSTRA=shortestPaths('H');let dijkstraStep=0;
function renderDijkstra(){
  const target=$('#dijkstraTarget').value;
  const targetPath=shortestRoute('H',target);
  $('#dijkstraSummary').textContent=`${targetPath.nodes.join(' → ')} = ${targetPath.cost} m`;
  const snap=DIJKSTRA.snapshots[dijkstraStep];
  $('#dijkstraStepText').textContent=dijkstraStep===0?'Inicio: d(H)=0; las otras distancias son infinitas.':dijkstraStep===4?'Terminó Dijkstra: todos los vértices tienen distancia definitiva.':`Paso ${dijkstraStep}: procesar ${snap.step}, relajar sus conexiones y actualizar las distancias.`;
  $('#dijkstraBody').innerHTML=DIJKSTRA.snapshots.slice(0,dijkstraStep+1).map((row,index)=>`<tr class="${index===dijkstraStep?'latest':''}"><td class="cell-strong">${row.step}</td>${NODE_ORDER.map(v=>`<td>${Number.isFinite(row.dist[v])?row.dist[v]:'∞'}</td>`).join('')}</tr>`).join('');
  $('#nextDijkstra').disabled=dijkstraStep===4;
  if(dijkstraStep===4){setHighlightedGraph(targetPath.nodes);$('#graphNarration').textContent=`Dijkstra desde H hasta ${target}: ${targetPath.nodes.join(' → ')} con costo mínimo ${targetPath.cost} m.`;}
}
$('#nextDijkstra').addEventListener('click',()=>{dijkstraStep=Math.min(4,dijkstraStep+1);renderDijkstra();});
$('#resetDijkstra').addEventListener('click',()=>{dijkstraStep=0;renderDijkstra();renderRoute();});
$('#dijkstraTarget').addEventListener('change',()=>{dijkstraStep=0;renderDijkstra();renderRoute();});

/* ------ AUTÓMATA DE SEGUIMIENTO / AUDITORÍA ------ */
function currentTrace(){return records.find(r=>r.id===selectedTraceId)||records[0];}
function renderTraceSelect(){
  const select=$('#traceItem');if(!records.some(r=>r.id===selectedTraceId))selectedTraceId=records[0]?.id||'';
  select.innerHTML=records.map(r=>`<option value="${escapeHTML(r.id)}">${escapeHTML(r.id)} · ${escapeHTML(r.description)}</option>`).join('');
  select.value=selectedTraceId;
}
function renderTrace(){
  renderTraceSelect();const r=currentTrace();if(!r)return;
  $('#traceItemName').textContent=`${r.id} · ${r.description}`;
  $('#traceCurrentState').textContent=`Estado actual: ${STATES[r.state].toLowerCase()} · punto ${r.point}`;
  $('#tracePill').textContent=STATES[r.state];
  $('#stateFlow').innerHTML=STATES.map((name,i)=>`<div class="state-step ${i<r.state?'done':i===r.state?'current':''}"><div class="state-circle">${i<r.state?'✓':i+1}</div><span>${name}</span></div>`).join('');
  $('#advanceState').disabled=r.state===4;
  $('#advanceState').textContent=r.state===4?'✓ Entrega registrada':`${STAGE_ACTIONS[r.state+1]} →`;
  $('#historyList').innerHTML=[...r.history].reverse().map(h=>`<div class="history-item"><span class="history-circle">✓</span><div class="history-content"><strong>${escapeHTML(h.action)}</strong><p>${escapeHTML(h.details)} · ${escapeHTML(h.actor)}</p><time>${escapeHTML(h.at)}</time></div></div>`).join('');
}
$('#traceItem').addEventListener('change',e=>{selectedTraceId=e.target.value;$('#traceFeedback').textContent='Selecciona una acción para continuar.';renderTrace();});
function traceFeedback(message,error=false){const el=$('#traceFeedback');el.textContent=message;el.className=`inline-feedback ${error?'error':'success'}`;toast(message);}
$('#advanceState').addEventListener('click',()=>{
  const r=currentTrace();if(!r||r.state>=4)return;
  if(r.state===0&&r.category===CATEGORIES[3]){traceFeedback('Transición rechazada: la categoría está pendiente de evaluación.',true);return;}
  if(r.state===3&&!$('#receiptNumber').value.trim()){traceFeedback('Transición rechazada: falta constancia de recepción. El estado no cambia.',true);return;}
  const next=r.state+1;
  const details=next===1?`Categoría: ${r.category}`:next===2?`Ubicación verificada: punto ${r.point}`:next===3?'Retiro simulado autorizado':`Constancia de demostración: ${$('#receiptNumber').value.trim()}`;
  if(next===4)r.receipt=$('#receiptNumber').value.trim();
  r.state=next;r.history.push({action:STAGE_ACTIONS[next],state:next,details,at:nowText(),actor:'Equipo expositor (demo)'});
  persistRecords();renderTrace();renderInventory();traceFeedback(`✓ Cambio registrado: ${STATES[next]}.`);
});
$('#skipState').addEventListener('click',()=>{
  const r=currentTrace();if(r.state<3){traceFeedback('Evento rechazado: no puedes confirmar una entrega saltando las etapas del autómata.',true);}
  else if(r.state===3&&!$('#receiptNumber').value.trim()){traceFeedback('Evento rechazado: aunque esté recolectado, falta una constancia.',true);}
  else if(r.state===3){traceFeedback('Este caso puede validarse con el botón «Validar recepción con constancia».',true);}
  else{traceFeedback('Este elemento ya está en el estado final Entregado.',false);}
});
$('#fillReceipt').addEventListener('click',()=>{$('#receiptNumber').value='CONSTANCIA-DEMO-001';toast('Constancia ficticia insertada en el formulario.');});

/* ------ ÁLGEBRA BOOLEANA ------ */
function getLogic(){const occupancy=Number($('#occupancy').value);return {occupancy,p:Number(occupancy>=80),q:Number($('#riskToggle').checked),r:Number($('#trafficToggle').checked)};}
function renderAlerts(){
  const {occupancy,p,q,r}=getLogic();const f=Number(Boolean(q||(p&&r)));
  $('#occupancyOutput').textContent=`${occupancy} %`;
  $('#logicP').textContent=p;$('#logicQ').textContent=q;$('#logicR').textContent=r;
  $('#logicBubble').textContent=f;$('#logicResult').classList.toggle('priority',Boolean(f));
  $('#logicTitle').textContent=f?'Atención prioritaria':'Atención ordinaria';
  $('#logicExplanation').textContent=q?'Se ha reportado una señal de riesgo que requiere evaluación, independientemente de la ocupación.':(p&&r)?'Se alcanza el umbral de ocupación y existe alta afluencia en el punto.':'No se cumplen las condiciones modeladas para activar la prioridad. El procedimiento ordinario continúa.';
  $('#logicCalculation').textContent=`f = ${q} ∨ (${p} ∧ ${r}) = ${f}`;
  const rows=[];
  for(let pp=0;pp<=1;pp++)for(let qq=0;qq<=1;qq++)for(let rr=0;rr<=1;rr++){
    const out=Number(Boolean(qq||(pp&&rr)));const active=pp===p&&qq===q&&rr===r;
    rows.push(`<tr class="${active?'current-logic':''}"><td>${pp}</td><td>${qq}</td><td>${rr}</td><td class="${out?'truth-one':'truth-zero'}">${out}</td><td><span class="badge ${out?'green':'gray'}">${out?'Prioritaria':'Ordinaria'}</span>${active?' <span class="badge blue">Actual</span>':''}</td></tr>`);
  }
  $('#truthBody').innerHTML=rows.join('');
}
['#occupancy','#riskToggle','#trafficToggle'].forEach(sel=>$(sel).addEventListener('input',renderAlerts));
$$('[data-preset]').forEach(btn=>btn.addEventListener('click',()=>{
  const preset=btn.dataset.preset;
  $('#occupancy').value=preset==='full'?'85':preset==='ordinary'?'90':'35';
  $('#riskToggle').checked=preset==='risk';$('#trafficToggle').checked=preset==='full';
  renderAlerts();toast('Caso de prueba aplicado.');
}));

/* ------ GUION PARA LA EXPOSICIÓN ------ */
const SLIDES=[
  {tag:'01 · INTRODUCCIÓN',title:'¿Qué es <em>EcoRoute?</em>',description:'Propuesta de plataforma web para el registro, clasificación, seguimiento y planificación del recojo interno de RAEE en puntos seleccionados de la FIEI.',bullets:['Proyecto de Matemática Discreta — UNFV, 2026.','Integra grafos, funciones, autómatas y lógica booleana.','Es un diseño y simulación académica, no una implementación institucional.'],jump:'inicio',button:'Explorar el resumen'},
  {tag:'02 · PROBLEMA',title:'De registros aislados a <em>decisiones verificables.</em>',description:'El informe plantea como hipótesis la posible dispersión de equipos en desuso y de sus registros, que deberá comprobarse mediante diagnóstico de campo.',bullets:['¿Qué residuos tenemos y dónde se encuentran?','¿Qué etapa de gestión lleva cada elemento?','¿Cómo planificamos un recojo interno con información confiable?'],jump:'inventario',button:'Ver inventario'},
  {tag:'03 · CONJUNTOS',title:'Clasificar sin <em>duplicar.</em>',description:'Una función c: A → C asigna una única categoría principal. Elementos con la misma categoría forman una clase de equivalencia.',bullets:['P1 (placa) y P2 (RAM): componentes informáticos.','C1 (cable): cableado y accesorios.','B1 (batería): evaluación especializada; riesgo es señal independiente.'],jump:'inventario',button:'Simular clasificación'},
  {tag:'04 · GRAFOS Y DIJKSTRA',title:'La ruta más corta <em>se calcula.</em>',description:'Grafo didáctico con base H y puntos A, B y C. Dijkstra obtiene H → A → B → C = 45 m, y la planificación del recorrido completo llega a 90 m.',bullets:['Aristas: HA=20, HB=35, AB=10, AC=40, BC=15 metros.','Referencia de ejemplo: 110 m; alternativa óptima: 90 m.','La diferencia del 18,18 % NO es una medición de la FIEI.'],jump:'rutas',button:'Simular recorrido'},
  {tag:'05 · AUTÓMATAS',title:'Cada cambio deja <em>evidencia.</em>',description:'Un autómata de cinco estados impide confirmar etapas fuera de secuencia.',bullets:['Registrado → Clasificado → Almacenado.','Almacenado → Recolectado → Entregado.','Sin constancia documental, la entrega se rechaza.'],jump:'trazabilidad',button:'Probar estados'},
  {tag:'06 · LÓGICA BOOLEANA',title:'Priorizar con una <em>regla clara.</em>',description:'La función f = q ∨ (p ∧ r) activa una alerta si hay riesgo reportado o si coinciden ocupación alta y afluencia.',bullets:['p: ocupación ≥ 80 % (umbral de ejemplo).','q: señal de riesgo que requiere evaluación.','r: punto de alta afluencia. La alerta no sustituye protocolos físicos.'],jump:'alertas',button:'Probar alertas'},
  {tag:'07 · CONCLUSIÓN',title:'La matemática discreta <em>organiza decisiones.</em>',description:'EcoRoute demuestra cómo traducir conceptos matemáticos en reglas verificables de software.',bullets:['La clasificación evita categorías principales superpuestas.','Los grafos comparan recorridos, y los autómatas ordenan eventos.','La viabilidad real exige catálogos autorizados, medición de campo y un piloto institucional.'],jump:'rutas',button:'Volver a la simulación'}
];
let slideIndex=0;
function renderSlide(){
  const slide=SLIDES[slideIndex];$('#slideNumber').textContent=`${String(slideIndex+1).padStart(2,'0')} / ${String(SLIDES.length).padStart(2,'0')}`;
  $('#slideBody').innerHTML=`<div class="slide-overline">${slide.tag}</div><h2>${slide.title}</h2><p>${slide.description}</p><ul>${slide.bullets.map(b=>`<li>${b}</li>`).join('')}</ul><div class="presentation-actions"><button class="btn btn-mint" data-jump="${slide.jump}">▶ ${slide.button}</button></div>`;
  $('#slideDots').innerHTML=SLIDES.map((_,i)=>`<button type="button" class="${i===slideIndex?'active':''}" aria-label="Ir a diapositiva ${i+1}" data-slide="${i}"></button>`).join('');
  $('#prevSlide').disabled=slideIndex===0;$('#nextSlide').disabled=slideIndex===SLIDES.length-1;
}
$('#prevSlide').addEventListener('click',()=>{slideIndex=Math.max(0,slideIndex-1);renderSlide();});
$('#nextSlide').addEventListener('click',()=>{slideIndex=Math.min(SLIDES.length-1,slideIndex+1);renderSlide();});
$('#slideDots').addEventListener('click',e=>{const btn=e.target.closest('[data-slide]');if(btn){slideIndex=Number(btn.dataset.slide);renderSlide();}});
document.addEventListener('keydown',e=>{
  if($('#view-exposicion').hidden||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName))return;
  if(e.key==='ArrowRight'&&slideIndex<SLIDES.length-1){slideIndex++;renderSlide();}
  if(e.key==='ArrowLeft'&&slideIndex>0){slideIndex--;renderSlide();}
});

/* ------ ARRANQUE ------ */
renderInventory();renderRoute();renderDijkstra();renderTrace();renderAlerts();renderSlide();showView(location.hash.replace('#','')||'inicio',false);
