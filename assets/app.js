
// FacilityFuz multipage demo app (localStorage-powered)
const brand = { primary: "#0E2A47", accent:"#23C15C" };
const CATEGORIES = ["HVAC","Electrical","Janitorial","IT","Other"];
const PRIORITIES = ["Low","Normal","High","Emergency"];
const RESOURCES = [
  { id: "res_roof", name: "Rooftop", type: "Space" },
  { id: "res_freight", name: "Freight Elevator", type: "Equipment" },
  { id: "res_dock", name: "Loading Dock", type: "Space" },
  { id: "res_confA", name: "Conference A", type: "Room" },
];

function uid(prefix="id"){ return `${prefix}_${Math.random().toString(36).slice(2,9)}`; }
function overlaps(aStart, aEnd, bStart, bEnd) { return aStart < bEnd && bStart < aEnd; }

function storeGet(){
  try { return JSON.parse(localStorage.getItem("ff_store")||"{}"); } catch { return {}; }
}
function storeSet(obj){
  localStorage.setItem("ff_store", JSON.stringify(obj));
}
function getUser(){ const s = storeGet(); return s.user || null; }
function setUser(user){ const s = storeGet(); s.user = user; storeSet(s); }
function signOut(){ const s = storeGet(); delete s.user; storeSet(s); }

function ensureData(){
  const s = storeGet();
  if(!s.workOrders) s.workOrders = [];
  if(!s.reservations) s.reservations = [];
  if(!s.expectedVisitors) s.expectedVisitors = [];
  if(!s.checkedIn) s.checkedIn = [];
  if(!s.resources) s.resources = RESOURCES;
  storeSet(s);
  return s;
}

// Navbar helpers
function attachNavbar(){
  const burger = document.querySelector(".burger");
  burger && burger.addEventListener("click", ()=>{
    const m = document.querySelector(".mobile-menu"); m && m.classList.toggle("open");
  });
  const signOutBtn = document.getElementById("signOutBtn");
  if(signOutBtn){
    signOutBtn.addEventListener("click", ()=>{ signOut(); window.location.href = "index.html"; });
  }
  const sessionSpan = document.getElementById("sessionInfo");
  const user = getUser();
  if(user && sessionSpan){
    const role = ({tenant:"Tenant", lobby:"Lobby / Reception", engineer:"Engineer", pm:"Property Manager"})[user.role] || user.role;
    sessionSpan.textContent = `${user.firstName} • ${role}`;
  }
  const authCtas = document.getElementById("authCtas");
  if(authCtas){
    if(getUser()){ authCtas.classList.add("hidden"); }
    else { authCtas.classList.remove("hidden"); }
  }
}

// Guards and redirects
function requireRole(role, redirect="signin.html"){
  const u = getUser();
  if(!u || u.role !== role){
    window.location.href = redirect;
    return null;
  }
  return u;
}

// Page initializers
window.FF = {
  initHome(){
    attachNavbar();
    // no-op
  },
  initAbout(){ attachNavbar(); },
  initServices(){ attachNavbar(); },
  initContact(){ attachNavbar(); },
  initRegister(){
    attachNavbar();
    const form = document.getElementById("registerForm");
    const acctType = document.getElementById("accountType");
    const companyWrap = document.getElementById("companyWrap");
    acctType.addEventListener("change", ()=>{
      if(acctType.value === "company"){ companyWrap.classList.remove("hidden"); }
      else { companyWrap.classList.add("hidden"); }
    });
    form.addEventListener("submit", (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const user = { id: uid("USR"), accountType: data.accountType, company: data.company||"", firstName: data.firstName, lastName: data.lastName, email: data.email, role: data.role };
      setUser(user);
      const target = ({tenant:"tenant.html", lobby:"lobby.html", engineer:"engineer.html", pm:"pm.html"})[user.role] || "index.html";
      window.location.href = target;
    });
  },
  initSignin(){
    attachNavbar();
    const form = document.getElementById("signinForm");
    form.addEventListener("submit", (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const user = { id: uid("USR"), firstName: (data.email||'').split("@")[0] || "User", lastName:"", email: data.email, role: data.role };
      setUser(user);
      const target = ({tenant:"tenant.html", lobby:"lobby.html", engineer:"engineer.html", pm:"pm.html"})[user.role] || "index.html";
      window.location.href = target;
    });
  },
  initTenant(){
    attachNavbar(); ensureData();
    const u = requireRole("tenant"); if(!u) return;
    const s = storeGet();
    // Work order submit
    const woForm = document.getElementById("woForm");
    const catSel = document.getElementById("woCategory");
    CATEGORIES.forEach(c=>{ const o = document.createElement("option"); o.value=c; o.textContent=c; catSel.appendChild(o); });
    const priSel = document.getElementById("woPriority");
    PRIORITIES.forEach(p=>{ const o = document.createElement("option"); o.value=p; o.textContent=p; priSel.appendChild(o); });
    woForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const d = Object.fromEntries(new FormData(woForm));
      const wo = { id: uid("WO"), createdAt: new Date().toISOString(), category: d.category, priority: d.priority, location: d.location, description: d.description, status: "New" };
      s.workOrders.unshift(wo); storeSet(s); renderWO();
      woForm.reset();
    });
    function renderWO(){
      const tbody = document.getElementById("woRows"); tbody.innerHTML = "";
      if(s.workOrders.length===0){ const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan=5; td.className="empty"; td.textContent = "No work orders yet."; tr.appendChild(td); tbody.appendChild(tr); return; }
      s.workOrders.forEach(w=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `<td class="mono">${w.id}</td><td>${w.category}</td><td><span class="badge">${w.priority}</span></td><td>${w.status}</td><td>${new Date(w.createdAt).toLocaleString()}</td>`;
        tbody.appendChild(tr);
      });
    }
    renderWO();

    // Reservation submit
    const resForm = document.getElementById("resForm");
    const resSel = document.getElementById("resResource");
    s.resources.forEach(r=>{ const o = document.createElement("option"); o.value=r.id; o.textContent=r.name; resSel.appendChild(o); });
    const resErr = document.getElementById("resError");
    resForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const d = Object.fromEntries(new FormData(resForm));
      const startAt = new Date(`${d.date}T${d.start}:00`);
      const endAt = new Date(`${d.date}T${d.end}:00`);
      if(!d.resource || isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || endAt<=startAt){
        resErr.textContent = "Please select a resource and a valid time range."; return;
      }
      const conflict = s.reservations.find(r=> r.resourceId===d.resource && overlaps(startAt,endAt,new Date(r.startAt),new Date(r.endAt)));
      if(conflict){ resErr.textContent = "That slot conflicts with an existing reservation."; return; }
      const autoApprove = !["res_roof","res_freight","res_dock"].includes(String(d.resource));
      s.reservations.unshift({ id: uid("RES"), resourceId: d.resource, resourceName: (s.resources.find(x=>x.id===d.resource)||{}).name || "", startAt: startAt.toISOString(), endAt: endAt.toISOString(), status: autoApprove? "Approved" : "Pending Approval" });
      storeSet(s); resErr.textContent=""; resForm.reset(); renderUpcoming();
    });
    function renderUpcoming(){
      const ul = document.getElementById("resList"); ul.innerHTML="";
      if(s.reservations.length===0){ const li=document.createElement("li"); li.className="muted"; li.textContent="No reservations yet."; ul.appendChild(li); return; }
      s.reservations.slice(0,6).forEach(r=>{
        const li = document.createElement("li"); li.className="item"; li.innerHTML = `<div class="strong">${r.resourceName}</div><div class="muted">${new Date(r.startAt).toLocaleString()} – ${new Date(r.endAt).toLocaleTimeString()}</div><div style="margin-top:4px"><span class="badge">${r.status}</span></div>`; ul.appendChild(li);
      });
    }
    renderUpcoming();

    // Visitor register
    const visForm = document.getElementById("visForm");
    function renderVisitors(){
      const tbody = document.getElementById("visRows"); tbody.innerHTML = "";
      if(s.expectedVisitors.length===0){ const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan=4; td.className="empty"; td.textContent="No visitors yet."; tr.appendChild(td); tbody.appendChild(tr); return; }
      s.expectedVisitors.forEach(v=>{
        const tr = document.createElement("tr"); tr.innerHTML = `<td>${v.firstName} ${v.lastName}</td><td>${v.date} ${v.time}</td><td>${v.hostSuite}</td><td class="mono">${v.code}</td>`; tbody.appendChild(tr);
      });
    }
    visForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const d = Object.fromEntries(new FormData(visForm));
      s.expectedVisitors.unshift({ id: uid("VIS"), firstName:d.firstName, lastName:d.lastName, phone:d.phone, email:d.email, date:d.vdate, time:d.vtime, hostSuite:d.suite, code: Math.random().toString(36).slice(2,8).toUpperCase() });
      storeSet(s); visForm.reset(); renderVisitors();
    });
    renderVisitors();
  },
  initLobby(){
    attachNavbar(); ensureData(); const u = requireRole("lobby"); if(!u) return;
    const s = storeGet();
    // Check-in
    const codeInput = document.getElementById("codeInput");
    const checkBtn = document.getElementById("checkBtn");
    const feedback = document.getElementById("feedback");
    checkBtn.addEventListener("click", ()=>{
      const code = (codeInput.value||"").trim().toUpperCase(); if(!code) return;
      const idx = s.expectedVisitors.findIndex(v=> v.code===code);
      if(idx===-1){ feedback.textContent="Code not found"; return; }
      const visit = s.expectedVisitors.splice(idx,1)[0];
      s.checkedIn.unshift({ ...visit, checkedInAt: new Date().toISOString(), badgeId: uid("BADGE") });
      storeSet(s); codeInput.value=""; feedback.textContent="Checked in ✓ Badge printed"; renderTables();
      setTimeout(()=> feedback.textContent="", 1600);
    });
    function renderTables(){
      // expected
      const tbody1 = document.getElementById("expRows"); tbody1.innerHTML="";
      if(s.expectedVisitors.length===0){ tbody1.innerHTML = `<tr><td class="empty" colspan="3">No expected visitors.</td></tr>`; }
      else {
        s.expectedVisitors.forEach(v=>{ const tr=document.createElement("tr"); tr.innerHTML = `<td>${v.firstName} ${v.lastName}</td><td>${v.hostSuite}</td><td class="mono">${v.code}</td>`; tbody1.appendChild(tr); });
      }
      // checked-in
      const tbody2 = document.getElementById("inRows"); tbody2.innerHTML="";
      if(s.checkedIn.length===0){ tbody2.innerHTML = `<tr><td class="empty" colspan="3">None.</td></tr>`; }
      else {
        s.checkedIn.forEach(v=>{ const tr=document.createElement("tr"); tr.innerHTML = `<td>${v.firstName} ${v.lastName}</td><td class="mono">${v.badgeId}</td><td style="text-align:right"><button class="btn btn-sm btn-outline" data-id="${v.id}">Check‑Out</button></td>`; tbody2.appendChild(tr); });
      }
      // bind checkout
      tbody2.querySelectorAll("button[data-id]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = btn.getAttribute("data-id"); s.checkedIn = s.checkedIn.filter(v=> v.id!==id); storeSet(s); renderTables();
        });
      });
      // today's reservations
      const list = document.getElementById("todayList"); list.innerHTML="";
      const now = new Date(); const start = new Date(now); start.setHours(0,0,0,0); const end = new Date(now); end.setHours(23,59,59,999);
      const todays = s.reservations.filter(r => new Date(r.startAt) >= start && new Date(r.startAt) <= end);
      if(todays.length===0){ const li=document.createElement("li"); li.className="muted"; li.textContent="No bookings today."; list.appendChild(li); }
      else todays.forEach(b=>{ const li=document.createElement("li"); li.className="item"; li.innerHTML = `<div class="strong">${b.resourceName}</div><div class="muted">${new Date(b.startAt).toLocaleTimeString()} – ${new Date(b.endAt).toLocaleTimeString()}</div><div style="margin-top:4px"><span class="badge">${b.status}</span></div>`; list.appendChild(li); });
    }
    renderTables();
  },
  initEngineer(){
    attachNavbar(); ensureData(); const u = requireRole("engineer"); if(!u) return;
    const s = storeGet();
    function renderWO(){
      const tbody = document.getElementById("woRows"); tbody.innerHTML="";
      if(s.workOrders.length===0){ tbody.innerHTML = `<tr><td class="empty" colspan="5">No assigned work orders.</td></tr>`; return; }
      s.workOrders.forEach(w=>{
        const tr=document.createElement("tr");
        tr.innerHTML = `<td class="mono">${w.id}</td><td>${w.category}</td><td><span class="badge">${w.priority}</span></td><td>${w.status}</td><td style="text-align:right"><button class="btn btn-sm btn-outline" data-id="${w.id}">Advance</button></td>`;
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll("button[data-id]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = btn.getAttribute("data-id");
          const flow = ["New","Acknowledged","In Progress","On Hold","Completed","Closed"];
          const idx = s.workOrders.findIndex(x=>x.id===id);
          if(idx>-1){
            const w = s.workOrders[idx];
            const next = flow[(flow.indexOf(w.status)+1)%flow.length];
            s.workOrders[idx] = {...w, status: next}; storeSet(s); renderWO();
          }
        });
      });
    }
    renderWO();
  },
  initPM(){
    attachNavbar(); ensureData(); const u = requireRole("pm"); if(!u) return;
    const s = storeGet();
    function renderApprovals(){
      const tbody = document.getElementById("apRows"); tbody.innerHTML="";
      const pending = s.reservations.filter(r=> r.status!=="Approved");
      if(pending.length===0){ tbody.innerHTML = `<tr><td class="empty" colspan="5">No pending requests.</td></tr>`; return; }
      pending.forEach(r=>{
        const tr=document.createElement("tr");
        tr.innerHTML = `<td>${r.resourceName}</td><td>${new Date(r.startAt).toLocaleString()}</td><td>${new Date(r.endAt).toLocaleString()}</td><td><span class="badge">${r.status}</span></td><td style="text-align:right"><button class="btn btn-sm" data-act="approve" data-id="${r.id}">Approve</button> <button class="btn btn-sm btn-outline" data-act="reject" data-id="${r.id}">Reject</button></td>`;
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll("button[data-id]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = btn.getAttribute("data-id"); const act = btn.getAttribute("data-act");
          if(act==="approve"){ s.reservations = s.reservations.map(x=> x.id===id? {...x, status:"Approved"} : x); }
          else { s.reservations = s.reservations.filter(x=> x.id!==id); }
          storeSet(s); renderApprovals();
        });
      });
    }
    function renderWO(){
      const tbody = document.getElementById("woRows"); tbody.innerHTML="";
      if(s.workOrders.length===0){ tbody.innerHTML = `<tr><td class="empty" colspan="5">No work orders yet.</td></tr>`; return; }
      s.workOrders.forEach(w=>{
        const tr=document.createElement("tr");
        tr.innerHTML = `<td class="mono">${w.id}</td><td>${w.category}</td><td><span class="badge">${w.priority}</span></td><td>${w.status}</td><td style="text-align:right"><button class="btn btn-sm btn-outline" data-id="${w.id}">Advance</button></td>`;
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll("button[data-id]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const id = btn.getAttribute("data-id");
          const flow = ["New","Acknowledged","In Progress","On Hold","Completed","Closed"];
          const idx = s.workOrders.findIndex(x=>x.id===id);
          if(idx>-1){
            const w = s.workOrders[idx];
            const next = flow[(flow.indexOf(w.status)+1)%flow.length];
            s.workOrders[idx] = {...w, status: next}; storeSet(s); renderWO();
          }
        });
      });
    }
    renderApprovals(); renderWO();
  }
};
