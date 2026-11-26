"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const STORAGE = "hempstead-encounter-v1";
  const LEGACY = "dnd-homepage-initiative-v1";
  const DATA_URL = "https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/en/5e-SRD-Monsters.json";
  const API_BASE = "https://www.dnd5eapi.co/api/2014/monsters";
  const monsterMap = new Map();
  const playerMap = new Map();
  let participants = [], encounterName = "", browserMode = "monsters", dragging = null;
  let catalog = [], fetching = false, pendingDetail = new Map();
  const id = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() :
    Date.now().toString(36) + Math.random().toString(36).slice(2);
  const safeNum = (x, fallback = 0) => Number.isFinite(Number(x)) ? Number(x) : fallback;
  const text = x => typeof x === "string" ? x : String(x ?? "");
  const slug = x => text(x).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const ac = m => Array.isArray(m.armor_class) ? safeNum(m.armor_class[0]?.value) : safeNum(m.armor_class);
  const crText = cr => ({0.125:"1/8",0.25:"1/4",0.5:"1/2"})[Number(cr)] ?? String(cr ?? "—");
  const catalogStatus = msg => { $("encounter-catalog-status").textContent = msg; };
  const message = msg => { $("encounter-message").textContent = msg; };
  const elem = (tag, cls, value) => {const node=document.createElement(tag); if(cls)node.className=cls; if(value!==undefined)node.textContent=text(value); return node;};
  const button = (label, cls, callback) => { const n=elem("button",cls,label);n.type="button";n.addEventListener("click",callback);return n; };
  const listText = data => Array.isArray(data) ? data.map(x => x?.name || x?.index || x).join(", ") : text(data);
  function normalizeMonster(m, source = "srd") {
    if (!m || typeof m.name !== "string") return null;
    const rawIndex = m.index || m.id || slug(m.name);
    return { ...m, index: String(rawIndex), source: m.source || source,
      challenge_rating: safeNum(m.challenge_rating), xp: safeNum(m.xp),
      type: m.type || "unknown" };
  }
  function normalizePlayer(p) {
    if (!p || !p.name) return null;
    return { id: String(p.id || slug(p.name)), name: String(p.name), hp: safeNum(p.hp, 10),
      ac: safeNum(p.ac), initiative: p.initiative == null ? "" : String(p.initiative),
      notes: text(p.notes || "") };
  }
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
      if (saved && Array.isArray(saved.participants)) {
        encounterName = text(saved.name || "");
        participants = saved.participants.filter(p => p && typeof p.name === "string").map(p => ({
          uid: String(p.uid || id()), name: String(p.name), kind: p.kind || "manual",
          sourceId: text(p.sourceId || ""), hp: safeNum(p.hp),
          initiative: text(p.initiative || ""), ac: safeNum(p.ac),
          notes: text(p.notes || "")
        }));
        return;
      }
      const old = JSON.parse(localStorage.getItem(LEGACY) || "null");
      if (Array.isArray(old)) participants = old.filter(x => x?.name).map(x => ({
        uid: String(x.id || id()), name: String(x.name), kind:"manual", sourceId:"",
        hp: safeNum(x.hp), initiative:"", ac:0, notes:""
      }));
    } catch { message("Lokale encounter kon niet worden gelezen."); }
  }
  function save() {
    try { localStorage.setItem(STORAGE,JSON.stringify({name:encounterName,participants})); }
    catch {message("Browseropslag is niet beschikbaar. Exporteer je encounter als back-up.");}
  }
  function displayName(p) {
    if (p.kind !== "monster") return p.name;
    const count = participants.filter(x => x.kind==="monster" && x.sourceId === p.sourceId);
    const number = count.findIndex(x => x.uid === p.uid) + 1;
    return count.length>1 ? p.name + " #" + number : p.name;
  }
  function addEntry(entry) { participants.push({...entry,uid:id()}); save(); renderTracker(); renderBlocks(); }
  function addMonster(m) {
    addEntry({name:m.name,kind:"monster",sourceId:m.index,hp:safeNum(m.hit_points,1),
      initiative:"",ac:ac(m),notes:""});
  }
  function addPlayer(p) { addEntry({name:p.name,kind:"player",sourceId:p.id,hp:p.hp,ac:p.ac,
    initiative:p.initiative,notes:p.notes}); }
  function shift(fromId,toId) {
    const from=participants.findIndex(x=>x.uid===fromId),to=participants.findIndex(x=>x.uid===toId);
    if(from<0||to<0||from===to)return;
    const [picked]=participants.splice(from,1); participants.splice(to,0,picked);
    save();renderTracker();
  }
  function move(from,direction) {
    const target=from+direction;
    if(target<0||target>=participants.length)return;
    [participants[from],participants[target]]=[participants[target],participants[from]];
    save();renderTracker();
  }
  function numberField(p,key,label) {
    const labelNode=elem("label","encounter-inline-field",label);
    const inp=document.createElement("input");
    inp.type="number";inp.step="1";inp.className="encounter-number";
    inp.setAttribute("aria-label",label+" "+p.name);
    inp.value=key==="initiative" ? p.initiative : String(p[key]);
    inp.addEventListener("input",()=> {
      if (key==="initiative") p.initiative=inp.value;
      else if (inp.value!=="") p[key]=safeNum(inp.value);
      inp.classList.toggle("encounter-zero",key==="hp" && safeNum(inp.value)<=0);
      save();
    });
    inp.addEventListener("blur",()=> {if(key!=="initiative"&&inp.value==="")inp.value=String(p[key]);});
    if(key==="hp")inp.classList.toggle("encounter-zero",p.hp<=0);
    labelNode.append(inp);return labelNode;
  }
  function renderTracker() {
    $("encounter-name").value=encounterName;
    const fragment=document.createDocumentFragment();
    participants.forEach((p,index)=>{
      const row=elem("li","encounter-turn-item"); row.dataset.id=p.uid;
      const grip=button("⠿","encounter-grip",()=>{});
      grip.title="Versleep om de volgorde te veranderen";grip.draggable=true;
      grip.setAttribute("aria-label","Versleep "+displayName(p));
      grip.addEventListener("dragstart",e=> {
        dragging=p.uid;e.dataTransfer.effectAllowed="move";
        e.dataTransfer.setData("text/plain",p.uid);row.classList.add("is-dragging");
      });
      grip.addEventListener("dragend",()=> {dragging=null;document.querySelectorAll(".encounter-turn-item").forEach(n=>n.classList.remove("is-dragging","drag-over"));});
      row.addEventListener("dragover",e=> {if(!dragging)return;e.preventDefault();row.classList.add("drag-over");});
      row.addEventListener("dragleave",()=>row.classList.remove("drag-over"));
      row.addEventListener("drop",e=> {e.preventDefault();const origin=dragging;dragging=null;if(origin)shift(origin,p.uid);});
      const rank=elem("span","encounter-rank",index+1);
      const names=elem("span","encounter-combatant",displayName(p));
      const species=elem("small","encounter-kind",p.kind==="monster"?"Monster":p.kind==="player"?"Speler":"Handmatig");
      names.append(species);
      const arrows=elem("span","encounter-arrows");
      const up=button("↑","encounter-arrow",()=>move(index,-1)); up.disabled=index===0;
      const down=button("↓","encounter-arrow",()=>move(index,1));down.disabled=index===participants.length-1;
      arrows.append(up,down);
      const remove=button("×","encounter-delete",()=>{participants=participants.filter(x=>x.uid!==p.uid);save();renderTracker();renderBlocks();});
      remove.setAttribute("aria-label","Verwijder "+displayName(p));
      row.append(grip,rank,names,numberField(p,"initiative","Init"),numberField(p,"hp","HP"),numberField(p,"ac","AC"),arrows,remove);
      fragment.append(row);
    });
    $("encounter-turn-list").replaceChildren(fragment);
    $("encounter-empty").hidden=participants.length>0;
    const monsters=participants.filter(x=>x.kind==="monster");
    const xp=monsters.reduce((sum,p)=>sum+safeNum(monsterMap.get(p.sourceId)?.xp),0);
    $("encounter-summary").textContent=participants.length+" deelnemers · "+monsters.length+" monsters · "+xp+" XP (basis)";
  }
  function abilityBonus(score){const n=Math.floor((safeNum(score,10)-10)/2);return n>=0?"+"+n:String(n);}
  function section(parent,title,entries){
    if(!Array.isArray(entries)||!entries.length)return;
    parent.append(elem("h4","encounter-block-section",title));
    entries.forEach(e=>{
      const p=elem("p","encounter-block-action");
      const strong=elem("strong","",e.name?e.name+". ":"");
      p.append(strong,document.createTextNode(text(e.desc || e.description || "")));
      parent.append(p);
    });
  }
  function renderBlocks() {
    const ids=[...new Set(participants.filter(p=>p.kind==="monster").map(p=>p.sourceId))];
    $("encounter-statblocks-count").textContent=ids.length+" unieke monsters";
    const wrap=$("encounter-statblocks-grid"); const fragment=document.createDocumentFragment();
    if(!ids.length){wrap.replaceChildren(elem("p","encounter-hint","Voeg monsters toe om hier hun volledige statblocks te zien."));return;}
    ids.forEach(key=>{
      const monster=monsterMap.get(key);
      const details=document.createElement("details");details.className="encounter-statblock";details.open=true;
      const summary=document.createElement("summary");
      summary.append(elem("strong","",monster?.name||key),elem("span","",monster?"CR "+crText(monster.challenge_rating)+" · AC "+ac(monster)+" · HP "+monster.hit_points:"Statblock wordt geladen..."));
      details.append(summary);
      if(!monster){fragment.append(details);return;}
      const body=elem("div","encounter-statblock-body");
      body.append(elem("p","encounter-monster-subtitle",[monster.size,monster.type,monster.subtype,monster.alignment].filter(Boolean).join(" · ")));
      if(monster.faction || monster.city_book_note) {
        const details=[monster.faction ? "Factie: "+monster.faction : "",monster.city_book_note || ""].filter(Boolean);
        body.append(elem("p","encounter-block-meta",details.join(" · ")));
      }
      const stats=elem("div","encounter-core-stats");
      stats.append(elem("div","","AC "+ac(monster)),elem("div","","HP "+monster.hit_points+" ("+(monster.hit_dice||"—")+")"),elem("div","","Speed "+Object.entries(monster.speed||{}).map(([k,v])=>k+" "+v).join(", ")),
        elem("div","","CR "+crText(monster.challenge_rating)+" · "+monster.xp+" XP"));
      body.append(stats);
      const attributes=elem("div","encounter-abilities");
      for(const [label,key2] of [["STR","strength"],["DEX","dexterity"],["CON","constitution"],["INT","intelligence"],["WIS","wisdom"],["CHA","charisma"]]){
        attributes.append(elem("span","",label+"\n"+monster[key2]+" ("+abilityBonus(monster[key2])+")"));
      }
      body.append(attributes);
      const attributes2=[
        ["Saving Throws",monster.proficiencies?.filter(p=>p.proficiency?.index?.startsWith("saving-throw")).map(p=>p.proficiency.name.replace("Saving Throw: ","")+" +"+p.value).join(", ")],
        ["Skills",monster.proficiencies?.filter(p=>p.proficiency?.index?.startsWith("skill-")).map(p=>p.proficiency.name.replace("Skill: ","")+" +"+p.value).join(", ")],
        ["Damage Vulnerabilities",listText(monster.damage_vulnerabilities)],
        ["Damage Resistances",listText(monster.damage_resistances)],
        ["Damage Immunities",listText(monster.damage_immunities)],
        ["Condition Immunities",listText(monster.condition_immunities)],
        ["Senses",Object.entries(monster.senses||{}).map(([k,v])=>k.replace(/_/g," ")+" "+v).join(", ")],
        ["Languages",monster.languages],["Proficiency Bonus",monster.proficiency_bonus !=null?"+"+monster.proficiency_bonus:""]
      ];
      attributes2.forEach(([heading,v])=>{if(v)body.append(elem("p","encounter-block-meta",heading+": "+v));});
      section(body,"Traits / Special Abilities",monster.special_abilities);
      section(body,"Actions",monster.actions);
      section(body,"Bonus Actions",monster.bonus_actions);
      section(body,"Reactions",monster.reactions);
      section(body,"Legendary Actions",monster.legendary_actions);
      const count=participants.filter(p=>p.kind==="monster"&&p.sourceId===key).length;
      body.append(elem("p","encounter-block-foot",count+"× in de tracker · "+(monster.source==="homebrew"?"Homebrew":"D&D 5e SRD 5.1")));
      details.append(body);fragment.append(details);
    });
    wrap.replaceChildren(fragment);
  }
  function renderFilters(){
    const cr=$("encounter-cr"), type=$("encounter-type");
    const oldCr=cr.value,oldType=type.value;
    const uniqueCR=[...new Set(catalog.map(x=>x.challenge_rating))].sort((a,b)=>a-b);
    cr.replaceChildren(new Option("Alle CR",""));
    uniqueCR.forEach(x=>cr.add(new Option(crText(x),String(x))));
    cr.value=oldCr;
    type.replaceChildren(new Option("Alle types",""));
    [...new Set(catalog.map(x=>x.type))].sort().forEach(x=>type.add(new Option(x,x)));
    type.value=oldType;
  }
  function renderCatalog(){
    const isMonster=browserMode==="monsters";
    $("encounter-monster-controls").hidden=!isMonster;
    $("encounter-player-controls").hidden=isMonster;
    $("encounter-show-monsters").classList.toggle("is-active",isMonster);
    $("encounter-show-players").classList.toggle("is-active",!isMonster);
    const query=$("encounter-search").value.trim().toLowerCase();
    const maxCr=$("encounter-cr").value, maxXp=$("encounter-xp").value, type=$("encounter-type").value, source=$("encounter-source").value;
    let items=isMonster?catalog:[...playerMap.values()];
    if(isMonster)items=items.filter(m=>(!query||m.name.toLowerCase().includes(query))&&
      (!maxCr||m.challenge_rating<=Number(maxCr))&&
      (!maxXp||m.xp<=Number(maxXp))&&(!type||m.type===type)&&(!source||m.source===source));
    const shown=items.slice(0,150);
    const frag=document.createDocumentFragment();
    shown.forEach(m=>{
      const row=elem("div","encounter-catalog-item");
      const name=elem("span","encounter-catalog-name",m.name);
      if(isMonster)name.append(elem("small","","CR "+crText(m.challenge_rating)+" · "+m.xp+" XP · "+m.type));
      else name.append(elem("small","","HP "+m.hp+" · AC "+(m.ac||"—")));
      const add=button("+ Add","encounter-catalog-add",()=>isMonster?addMonster(m):addPlayer(m));
      add.setAttribute("aria-label","Voeg "+m.name+" toe");row.append(name,add);frag.append(row);
    });
    if(!shown.length)frag.append(elem("p","encounter-hint",isMonster && !catalog.length?"Monstercatalogus wordt geladen...":"Geen resultaten."));
    $("encounter-results").replaceChildren(frag);
    catalogStatus(isMonster?catalog.length+" monsters · "+items.length+" resultaten"+(items.length>150?" (eerste 150 getoond)":""):playerMap.size+" spelers");
  }
  async function getJSON(url){const response=await fetch(url);if(!response.ok)throw new Error(response.status+" "+url);return response.json();}
  async function apiDetail(index){
    if(pendingDetail.has(index))return pendingDetail.get(index);
    const promise=getJSON(API_BASE+"/"+encodeURIComponent(index)).then(m=>{
      const valid=normalizeMonster(m);if(valid){monsterMap.set(valid.index,valid);renderTracker();renderBlocks();}
      return valid;
    }).catch(()=>null).finally(()=>pendingDetail.delete(index));
    pendingDetail.set(index,promise);return promise;
  }
  async function loadMonsters(){
    catalogStatus("SRD-monsters laden...");
    try {
      const raw=await getJSON(DATA_URL);
      if(!Array.isArray(raw))throw new Error("Unexpected catalog format");
      raw.forEach(x=>{const m=normalizeMonster(x);if(m)monsterMap.set(m.index,m);});
      catalog=[...monsterMap.values()].sort((a,b)=>a.name.localeCompare(b.name));
      renderFilters();renderCatalog();renderTracker();renderBlocks();
    } catch(error) {
      catalogStatus("Fallback API laden...");
      try {
        const index=await getJSON(API_BASE);
        const results=Array.isArray(index.results)?index.results:[];
        // The API index only contains names. Load details in small batches
        // so CR, XP and type filters become available once all metadata arrives.
        let next=0,done=0;
        const workers=Array.from({length:8},async()=>{
          while(next<results.length){
            const i=next++; const m=await apiDetail(results[i].index);
            if(m)catalog.push(m);done++;
            if(done%20===0){catalog.sort((a,b)=>a.name.localeCompare(b.name));renderFilters();renderCatalog();}
          }
        });
        await Promise.all(workers);catalog.sort((a,b)=>a.name.localeCompare(b.name));
        renderFilters();renderCatalog();renderTracker();renderBlocks();
      } catch(err) {
        catalogStatus("Monstercatalogus offline");
        message("SRD-catalogus niet bereikbaar. Je kunt spelers, handmatige deelnemers en eigen monsters blijven gebruiken.");
      }
    }
    for(const p of participants.filter(x=>x.kind==="monster"&&!monsterMap.has(x.sourceId)))await apiDetail(p.sourceId);
  }
  async function loadCustom(){
    try {
      const raw=await getJSON("data/encounters/monsters.json");
      const items=Array.isArray(raw.monsters)?raw.monsters:[];
      const bases=[...new Set(items.map(x=>x?.base_monster).filter(Boolean))];
      await Promise.all(bases.filter(x=>!monsterMap.has(x)).map(x=>apiDetail(x)));
      for(const item of items){
        if(!item || typeof item.name!=="string")continue;
        const base=item.base_monster ? monsterMap.get(item.base_monster) : null;
        // Never fabricate missing stats. Incomplete template entries are skipped until SRD data is available.
        if(item.base_monster && !base && (item.hit_points==null || item.armor_class==null))continue;
        const m=normalizeMonster({...base,...item,source:"homebrew"},"homebrew");
        if(m){
          m.index="custom-"+(item.index || slug(item.name));
          monsterMap.set(m.index,m);
        }
      }
      catalog=[...monsterMap.values()].sort((a,b)=>a.name.localeCompare(b.name));
      renderFilters();renderCatalog();renderTracker();renderBlocks();
    } catch { /* Custom monsters are optional. */ }
  }
  async function loadPlayers(){
    try{
      const raw=await getJSON("data/encounters/players.json");
      for(const x of Array.isArray(raw.players)?raw.players:[]){const p=normalizePlayer(x);if(p)playerMap.set(p.id,p);}
    } catch {message("Spelerslijst niet bereikbaar; voeg spelers toe via data/encounters/players.json.");}
    renderCatalog();
  }
  $("encounter-name").addEventListener("input",e=>{encounterName=e.target.value;save();});
  $("encounter-search").addEventListener("input",renderCatalog);
  ["encounter-cr","encounter-xp","encounter-type","encounter-source"].forEach(id=>$(id).addEventListener("change",renderCatalog));
  $("encounter-show-monsters").addEventListener("click",()=>{browserMode="monsters";renderCatalog();});
  $("encounter-show-players").addEventListener("click",()=>{browserMode="players";renderCatalog();});
  $("encounter-manual-form").addEventListener("submit",e=>{
    e.preventDefault();const name=$("encounter-manual-name").value.trim(),hp=safeNum($("encounter-manual-hp").value,10);
    if(!name)return;
    addEntry({name,kind:"manual",sourceId:"",hp,initiative:"",ac:0,notes:""});
    $("encounter-manual-name").value="";$("encounter-manual-name").focus();
  });
  $("encounter-clear").addEventListener("click",()=>{
    if(!confirm("De volledige huidige encounter leegmaken? Exporteer eerst als je hem wilt bewaren."))return;
    participants=[];encounterName="";save();renderTracker();renderBlocks();
  });
  $("encounter-export").addEventListener("click",()=>{
    const data={name:encounterName,participants};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="encounter-"+(slug(encounterName)||"hempstead")+".json";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $("encounter-import").addEventListener("change",async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(!Array.isArray(data.participants))throw Error("Geen participants gevonden");
      if(!confirm("Huidige encounter vervangen door deze import?"))return;
      const sanitized=data.participants.filter(p=>p&&typeof p.name==="string").map(p=>({
        uid:id(),name:p.name,kind:["monster","player","manual"].includes(p.kind)?p.kind:"manual",
        sourceId:text(p.sourceId),hp:safeNum(p.hp),initiative:text(p.initiative),ac:safeNum(p.ac),notes:text(p.notes)
      }));
      participants=sanitized;encounterName=text(data.name||"");save();renderTracker();renderBlocks();
      await Promise.all([...new Set(participants.filter(p=>p.kind==="monster").map(p=>p.sourceId))]
        .filter(key=>!monsterMap.has(key)&&!key.startsWith("custom-")).map(apiDetail));
      renderBlocks();
    }catch(err){message("Import mislukt: "+err.message);}
    finally{e.target.value="";}
  });
  loadState();renderTracker();renderBlocks();
  loadPlayers();
  loadMonsters().then(loadCustom);
})();
