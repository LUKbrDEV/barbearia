// Painel /painel — dono (tudo da barbearia) e barbeiro (só a própria agenda).
{
  const U = window.UI, S = window.Store, A = window.Agenda, P = window.PLATAFORMA;
  const { esc, money, $, ls, fmtData, durTxt, wa, DIAS, cap } = U;
  const app = () => $("#app");
  const ROT = { agendado: "Agendado", concluido: "Concluído", cancelado: "Cancelado", faltou: "Faltou" };
  const STATUS = { teste: "Teste grátis", ativa: "Ativa", bloqueada: "Bloqueada", teste_vencido: "Teste encerrado", vencida: "Vencida" };
  let ctx = null, aba = "agenda", dia = U.hoje(), filtroProf = "", periodo = "30", timer = null, conhecidos = null;
  const dono = () => ctx.papel === "dono" || ctx.papel === "super";
  const cfg = () => ctx.b.config;
  const nomeProf = id => (ctx.profs.find(p => p.id === id) || {}).nome || "—";

  function parar() { clearInterval(timer); timer = null; }

  async function render() {
    parar(); U.manifestPadrao(); document.title = "Painel · " + P.nome;
    U.rodapeHTML(`<span>${esc(P.nome)}</span>`);
    if (!S.logado()) return login();
    U.moldura({ marca: "Painel", marcaHref: "/painel" });
    app().innerHTML = `<p class="vazio band">Carregando…</p>`;
    try {
      // convites e cadastros que ficaram pendentes (confirmação de e-mail)
      const conv = new URLSearchParams(location.search).get("convite") || ls.get("bb_convite_pendente", "");
      if (conv) { try { await S.aceitarConvite(conv); U.toast("Convite aceito!"); } catch (e) { U.toast(e.message); } ls.set("bb_convite_pendente", ""); if (location.search) history.replaceState({}, "", U.url("/painel")); }
      let acessos = await S.acessos();
      const pend = ls.get("bb_cad_pendente", null);
      if (pend && !acessos.length) { await S.criarBarbearia(pend); ls.set("bb_cad_pendente", null); acessos = await S.acessos(); }
      const sup = await S.souSuper();
      if (!acessos.length) return semAcesso(sup);
      let a = acessos.find(x => x.barbearia_id === ls.get("bb_bid", "")) || acessos[0];
      ls.set("bb_bid", a.barbearia_id); ls.set("bb_ultimo_painel", true);
      const [b, profs] = await Promise.all([S.barbearia(a.barbearia_id), S.profs(a.barbearia_id)]);
      if (!ctx || ctx.bid !== a.barbearia_id) { aba = "agenda"; filtroProf = ""; conhecidos = null; }
      ctx = { bid: a.barbearia_id, papel: a.papel, prof_id: a.prof_id, b, profs, acessos, sup };
      desenhar();
    } catch (e) { app().innerHTML = `<div class="form-pag"><p class="erro">${esc(e.message)}</p><button class="btn" id="tentar">Tentar de novo</button></div>`; $("#tentar").onclick = render; }
  }

  function login() {
    U.moldura({ marca: P.nome, marcaHref: "/" });
    const conv = new URLSearchParams(location.search).get("convite") || "";
    const demo = S.modo === "local";
    app().innerHTML = `<form class="form-pag" id="fLogin"><h1>Entrar</h1>
      <p class="l-sub2">Para donos de barbearia e barbeiros.${conv ? " Depois de entrar, o convite <b>" + esc(conv) + "</b> será usado." : ""}</p>
      ${demo ? `<p class="aviso">Demonstração: <b>dono@demo.com</b>, <b>barbeiro@demo.com</b> ou <b>admin@demo.com</b>, senha <b>1234</b>.</p>` : ""}
      <label class="lbl">E-mail<input name="email" type="email" autocomplete="username" required></label>
      <label class="lbl">Senha<input name="senha" type="password" autocomplete="current-password" required></label>
      <p class="erro" id="lErro" role="alert"></p><button class="btn btn-grande" style="width:100%">Entrar</button>
      <p class="centro"><a href="/cadastro" data-link>Criar minha barbearia</a> · <a href="/cadastro?barbeiro=1${conv ? "&convite=" + encodeURIComponent(conv) : ""}" data-link>Recebi um convite</a></p></form>`;
    $("#fLogin").onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      try { await S.entrar(f.email.value.trim(), f.senha.value); ctx = null;
        if (await S.souSuper() && !(await S.acessos()).length && !conv) return U.go("/admin");
        render(); }
      catch (err) { $("#lErro").textContent = err.message; }
    };
  }

  function semAcesso(sup) {
    app().innerHTML = `<div class="form-pag"><h1>Nenhuma barbearia</h1><p>Sua conta (${esc((S.usuario() || {}).email)}) ainda não faz parte de uma barbearia.</p>
      <div class="pilha">${sup ? `<a class="btn" href="/admin" data-link>Abrir administração da plataforma</a>` : ""}
      <a class="btn ${sup ? "btn-sec" : ""}" href="/cadastro" data-link>Criar minha barbearia</a>
      <button class="btn btn-sec" id="usarConv">Tenho um código de convite</button><button class="btn btn-sec" id="sair">Sair</button></div></div>`;
    $("#sair").onclick = sair;
    $("#usarConv").onclick = () => {
      const b = U.modal(`<h2>Código do convite</h2><form id="fc"><input name="c" maxlength="6" style="text-transform:uppercase;letter-spacing:.2em;font-weight:800" required>
        <p class="erro" id="ce"></p><div class="pilha"><button class="btn">Usar convite</button><button type="button" class="btn btn-sec" data-fechar>Cancelar</button></div></form>`);
      b.querySelector("#fc").onsubmit = async e => { e.preventDefault(); try { await S.aceitarConvite(e.target.c.value); U.fecharModal(); render(); } catch (er) { b.querySelector("#ce").textContent = er.message; } };
    };
  }
  function sair() { S.sair(); ls.set("bb_ultimo_painel", false); ls.set("bb_bid", null); ctx = null; U.go("/painel"); }

  // ---------- moldura do painel ----------
  function desenhar() {
    parar();
    const tabs = dono()
      ? [{ id: "agenda", txt: "Agenda" }, { id: "bloq", txt: "Bloqueios" }, { id: "rel", txt: "Relatórios" }, { id: "cli", txt: "Clientes" }, { id: "mais", txt: "Mais" }]
      : [{ id: "agenda", txt: "Agenda" }, { id: "bloq", txt: "Folgas" }, { id: "rel", txt: "Ganhos" }, { id: "cli", txt: "Clientes" }, { id: "mais", txt: "Mais" }];
    const extras = ["equipe", "serv", "hor", "assin", "aj"];
    U.moldura({ marca: ctx.b.nome, marcaHref: "/painel", tabs, ativo: extras.includes(aba) ? "mais" : aba,
      acoes: `<a class="btn btn-mini btn-claro" href="/${esc(ctx.b.slug)}" data-link>Ver página</a>` });
    $("#tabbar").onclick = e => { const t = e.target.closest("[data-tab]"); if (!t) return; e.preventDefault();
      if (t.dataset.tab === "mais") return menuMais(); aba = t.dataset.tab; desenhar(); };
    const se = A.statusEfetivo(ctx.b, U.hoje()), lib = A.liberada(ctx.b, U.hoje());
    let aviso = "";
    if (!lib) aviso = dono() ? `<div class="aviso ruim"><b>${esc(STATUS[se] || se)}.</b> Seus clientes não conseguem agendar online. <button class="lnk" data-ir="assin">Ver assinatura</button></div>`
                             : `<div class="aviso ruim">A agenda online da barbearia está pausada. Fale com o dono.</div>`;
    else if (dono() && ctx.b.status === "teste" && ctx.b.vence_em) {
      const dias = Math.round((A.parseYMD(ctx.b.vence_em) - A.parseYMD(U.hoje())) / 864e5);
      if (dias <= 7) aviso = `<div class="aviso">Teste grátis: ${dias === 0 ? "termina hoje" : dias === 1 ? "falta 1 dia" : `faltam ${dias} dias`}. <button class="lnk" data-ir="assin">Escolher plano</button></div>`;
    }
    const titulos = { agenda: "Agenda", bloq: dono() ? "Bloqueios e folgas" : "Minhas folgas", rel: dono() ? "Relatórios" : "Meus ganhos", cli: "Clientes",
      equipe: "Equipe", serv: "Serviços", hor: "Horários", assin: "Assinatura", aj: "Ajustes" };
    app().innerHTML = `<div class="p-top"><h1>${titulos[aba]}</h1>${!dono() ? `<span class="tag">Barbeiro · ${esc(nomeProf(ctx.prof_id))}</span>` : ""}</div>
      <div class="p-sec">${aviso}<div id="pc"></div></div>`;
    app().querySelectorAll("[data-ir]").forEach(b => b.onclick = () => { aba = b.dataset.ir; desenhar(); });
    const fn = { agenda, bloq, rel, cli, equipe, serv, hor, assin, aj }[aba];
    if ((["equipe", "serv", "hor", "assin", "aj"].includes(aba)) && !dono()) { aba = "agenda"; return desenhar(); }
    fn();
  }
  const box = () => $("#pc");

  function menuMais() {
    const it = dono()
      ? [["equipe", "Equipe e acessos"], ["serv", "Serviços e preços"], ["hor", "Horários de funcionamento"], ["assin", "Assinatura"], ["aj", "Dados, link e QR Code"]]
      : [];
    const b = U.modal(`<h2>${esc(ctx.b.nome)}</h2><p style="color:var(--mut);margin-top:-8px">${esc((S.usuario() || {}).email)} · ${dono() ? "Dono" : "Barbeiro"}</p>
      <div class="menu">${it.map(([k, t]) => `<button data-k="${k}">${t}</button>`).join("")}
      <a href="/${esc(ctx.b.slug)}" data-link>Ver página da barbearia</a>
      ${ctx.acessos.length > 1 ? `<button data-k="trocar">Trocar de barbearia</button>` : ""}
      ${ctx.sup ? `<a href="/admin" data-link>Administração da plataforma</a>` : ""}
      <button data-k="sair" class="perigo">Sair</button></div>`);
    b.querySelector(".menu").onclick = e => {
      const k = e.target.dataset.k; if (!k) return;
      if (k === "sair") { U.fecharModal(); return sair(); }
      if (k === "trocar") {
        const m = U.modal(`<h2>Trocar de barbearia</h2><div class="menu">${ctx.acessos.map(a => `<button data-b="${esc(a.barbearia_id)}">${esc(a.nome)} <small>${a.papel === "dono" ? "dono" : "barbeiro"}</small></button>`).join("")}</div>`);
        m.querySelector(".menu").onclick = ev => { const x = ev.target.closest("[data-b]"); if (!x) return; ls.set("bb_bid", x.dataset.b); U.fecharModal(); ctx = null; render(); };
        return;
      }
      U.fecharModal(); aba = k; desenhar();
    };
  }

  // ---------- AGENDA ----------
  async function agenda() {
    box().innerHTML = `<div class="dia-nav"><button class="btn btn-sec" id="dAnt" aria-label="Dia anterior">‹</button>
      <input type="date" id="dSel" value="${dia}" aria-label="Data"><button class="btn btn-sec" id="dProx" aria-label="Próximo dia">›</button></div>
      <div class="seg"><button class="btn btn-mini btn-sec" id="dHoje">Hoje</button><button class="btn btn-mini" id="dEnc">+ Encaixe</button></div>
      ${dono() && ctx.profs.filter(p => p.ativo).length > 1 ? `<div class="seg chips-filtro" id="fProf">${[{ id: "", nome: "Todos" }].concat(ctx.profs.filter(p => p.ativo)).map(p => `<button class="chip ${filtroProf === p.id ? "on" : ""}" data-p="${esc(p.id)}">${esc(p.nome)}</button>`).join("")}</div>` : ""}
      <div id="aKpis" class="kpis"></div><h2 id="aTit"></h2><div id="aLista"><p class="vazio">Carregando…</p></div>`;
    const ir = d => { dia = d; agenda(); };
    $("#dAnt").onclick = () => ir(A.addDays(dia, -1)); $("#dProx").onclick = () => ir(A.addDays(dia, 1));
    $("#dHoje").onclick = () => ir(U.hoje()); $("#dSel").onchange = e => e.target.value && ir(e.target.value);
    $("#dEnc").onclick = encaixe;
    const fp = $("#fProf"); if (fp) fp.onclick = e => { const b = e.target.closest("[data-p]"); if (b) { filtroProf = b.dataset.p; agenda(); } };
    await listaDia();
    timer = setInterval(() => { if (!document.hidden && aba === "agenda" && U.partes()[0] === "painel") listaDia(true); }, 30000);
  }
  async function listaDia(silencioso) {
    let ags, blq;
    const pf = dono() ? filtroProf : ctx.prof_id;
    try { [ags, blq] = await Promise.all([S.listar(ctx.bid, dia, dia, pf || undefined), S.bloqueios(ctx.bid, dia)]); }
    catch (e) { if (!silencioso && box()) box().querySelector("#aLista").innerHTML = `<p class="erro">${esc(e.message)}</p>`; return; }
    if (!$("#aKpis")) return;
    novosAvisos(ags);
    blq = blq.filter(b => b.data === dia && (!pf || !b.prof_id || b.prof_id === pf));
    const ativos = ags.filter(a => a.status !== "cancelado");
    const fat = ags.filter(a => a.status === "concluido").reduce((s, a) => s + a.preco, 0), prev = ags.filter(a => a.status === "agendado").reduce((s, a) => s + a.preco, 0);
    $("#aKpis").innerHTML = `<div class="kpi"><small>Atendimentos</small><b>${ativos.length}</b></div><div class="kpi"><small>Recebido</small><b>${money(fat)}</b></div><div class="kpi"><small>A receber</small><b>${money(prev)}</b></div>`;
    $("#aTit").textContent = cap(fmtData(dia, true));
    const h = cfg().horarios[A.dow(dia)], mostraProf = dono() && !filtroProf && ctx.profs.length > 1;
    const itens = ags.map(a => ({ t: a.hora, tipo: "ag", a })).concat(blq.map(b => ({ t: b.ini || "00:00", tipo: "blq", b })));
    if (h && h.aberto && h.almocoIni) itens.push({ t: h.almocoIni, tipo: "alm" });
    itens.sort((x, y) => x.t.localeCompare(y.t));
    const lista = $("#aLista");
    if (!itens.length) { lista.innerHTML = `<p class="vazio">${h && h.aberto ? "Nenhum agendamento neste dia." : "Barbearia fechada neste dia."}</p>`; return; }
    lista.innerHTML = itens.map(i => {
      if (i.tipo === "alm") return `<div class="ag-item livre"><div class="h">${esc(h.almocoIni)}<small>até ${esc(h.almocoFim)}</small></div><div class="n">Pausa / almoço</div></div>`;
      if (i.tipo === "blq") return `<div class="ag-item livre"><div class="h">${i.b.ini ? esc(i.b.ini) : "Dia"}<small>${i.b.ini ? "até " + esc(i.b.fim) : "inteiro"}</small></div><div class="n">Bloqueado${i.b.prof_id ? " · " + esc(nomeProf(i.b.prof_id)) : ""}${i.b.motivo ? " · " + esc(i.b.motivo) : ""}</div></div>`;
      const a = i.a;
      return `<div class="ag-item st-${esc(a.status)}" data-id="${esc(a.id)}"><div class="h">${esc(a.hora)}<small>${esc(durTxt(a.dur))}</small></div>
        <div><b>${esc(a.nome)}</b> <span class="tag ${esc(a.status)}">${esc(ROT[a.status] || a.status)}</span><br>
        <span class="sub">${esc(a.servico_nome)} · ${money(a.preco)}${mostraProf ? ` · <b>${esc(nomeProf(a.prof_id))}</b>` : ""}${a.origem === "encaixe" ? " · encaixe" : ""}</span></div>
        <div class="acoes">${a.status === "agendado" ? `<button class="btn btn-mini btn-ok" data-s="concluido">Concluir</button><button class="btn btn-mini btn-sec" data-s="faltou">Faltou</button><button class="btn btn-mini btn-sec" data-s="cancelado">Cancelar</button>`
          : `<button class="btn btn-mini btn-sec" data-s="agendado">Desfazer</button>`}
          ${a.telefone ? `<a class="btn btn-mini btn-sec" target="_blank" rel="noopener" href="${esc(wa(a.telefone, `Olá ${a.nome}! Confirmando seu horário na ${ctx.b.nome}: ${fmtData(a.data)} às ${a.hora}.`))}">WhatsApp</a>` : ""}</div></div>`;
    }).join("");
    lista.onclick = async e => {
      const b = e.target.closest("[data-s]"); if (!b) return;
      try { await S.atualizar(ctx.bid, b.closest("[data-id]").dataset.id, { status: b.dataset.s }); U.toast("Atualizado."); listaDia(); } catch (err) { U.toast(err.message); }
    };
  }
  function novosAvisos(ags) {
    const ids = new Set(ags.map(a => a.id));
    if (conhecidos && conhecidos.dia === dia) {
      const n = ags.find(a => !conhecidos.ids.has(a.id) && a.origem === "online");
      if (n) { const txt = `Novo agendamento: ${n.nome} às ${n.hora}`; U.toast(txt);
        try { if (Notification.permission === "granted") navigator.serviceWorker.ready.then(r => r.showNotification(ctx.b.nome, { body: txt, icon: U.url("/icons/icon-192.png"), tag: n.id })); } catch {} }
    }
    conhecidos = { dia, ids };
  }
  function encaixe() {
    const n = new Date(), hr = A.toHM(Math.min(1425, Math.ceil((n.getHours() * 60 + n.getMinutes()) / 15) * 15));
    const profs = ctx.profs.filter(p => p.ativo);
    const b = U.modal(`<h2>Encaixe</h2><form id="fEnc" class="form-grid">
      <label class="full">Nome do cliente<input name="nome" required maxlength="60"></label>
      <label class="full">Serviço<select name="serv">${cfg().servicos.map(s => `<option value="${esc(s.id)}">${esc(s.nome)} · ${money(s.preco)}</option>`).join("")}</select></label>
      ${dono() && profs.length > 1 ? `<label class="full">Barbeiro<select name="prof">${profs.map(p => `<option value="${esc(p.id)}" ${p.id === (filtroProf || ctx.prof_id) ? "selected" : ""}>${esc(p.nome)}</option>`).join("")}</select></label>` : ""}
      <label>Data<input type="date" name="data" value="${dia}" required></label><label>Hora<input type="time" name="hora" value="${hr}" required></label>
      <label class="full">WhatsApp (opcional)<input name="tel" type="tel" inputmode="tel"></label>
      <p class="erro full" id="encErro"></p><button class="btn full">Salvar encaixe</button><button type="button" class="btn btn-sec full" data-fechar>Cancelar</button></form>`);
    b.querySelector("#fEnc").onsubmit = async e => {
      e.preventDefault(); const f = e.target, s = cfg().servicos.find(x => x.id === f.serv.value);
      if (f.nome.value.trim().length < 2) { b.querySelector("#encErro").textContent = "Digite o nome."; return; }
      try {
        await S.criar(ctx.bid, { prof_id: f.prof ? f.prof.value : (ctx.prof_id || profs[0].id), data: f.data.value, hora: f.hora.value, dur: s.dur, servico_id: s.id, servico_nome: s.nome,
          preco: s.preco, nome: f.nome.value.trim(), telefone: f.tel.value.trim(), status: "agendado", origem: "encaixe" });
        U.fecharModal(); U.toast("Encaixe salvo."); dia = f.data.value; agenda();
      } catch (err) { b.querySelector("#encErro").textContent = err.message; }
    };
  }

  // ---------- BLOQUEIOS / FOLGAS ----------
  async function bloq() {
    const profs = ctx.profs.filter(p => p.ativo);
    box().innerHTML = `<form id="fBlq" class="form-grid">
      ${dono() && profs.length > 1 ? `<label class="full">Para quem<select name="prof"><option value="">Barbearia inteira</option>${profs.map(p => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join("")}</select></label>` : ""}
      <label>Data<input type="date" name="data" value="${U.hoje()}" min="${U.hoje()}" required></label>
      <label class="switch" style="align-self:end;min-height:48px"><input type="checkbox" name="todo" checked> Dia inteiro</label>
      <label>Das<input type="time" name="ini" value="12:00" disabled></label><label>Até<input type="time" name="fim" value="14:00" disabled></label>
      <label class="full">Motivo (opcional)<input name="motivo" maxlength="60" placeholder="Feriado, curso, consulta…"></label>
      <button class="btn full">Bloquear</button></form>
      <p class="aviso" style="margin-top:14px">O horário bloqueado some da agenda do cliente. Quem já tinha marcado continua agendado: avise pelo WhatsApp.</p>
      <h2>Próximos bloqueios</h2><div id="bLista"><p class="vazio">Carregando…</p></div>`;
    const f = $("#fBlq");
    f.todo.onchange = () => { f.ini.disabled = f.fim.disabled = f.todo.checked; };
    f.onsubmit = async e => {
      e.preventDefault();
      if (!f.todo.checked && f.ini.value >= f.fim.value) return U.toast("O horário final deve ser depois do inicial.");
      try { await S.bloquear(ctx.bid, { prof_id: f.prof ? f.prof.value || null : (dono() ? null : ctx.prof_id), data: f.data.value, ini: f.todo.checked ? "" : f.ini.value, fim: f.todo.checked ? "" : f.fim.value, motivo: f.motivo.value.trim() });
        U.toast("Bloqueado."); bloq(); } catch (err) { U.toast(err.message); }
    };
    try {
      const l = await S.bloqueios(ctx.bid, U.hoje()), el = $("#bLista");
      el.innerHTML = l.length ? l.map(b => { const meu = dono() || b.prof_id === ctx.prof_id;
        return `<div class="cli"><div><b>${esc(cap(fmtData(b.data, true)))}</b><small>${b.ini ? esc(b.ini) + " – " + esc(b.fim) : "Dia inteiro"} · ${b.prof_id ? esc(nomeProf(b.prof_id)) : "Barbearia inteira"}${b.motivo ? " · " + esc(b.motivo) : ""}</small></div>
        ${meu ? `<button class="btn btn-mini btn-sec" data-id="${esc(b.id)}">Remover</button>` : ""}</div>`; }).join("") : `<p class="vazio">Nenhum bloqueio.</p>`;
      el.onclick = async e => { const b = e.target.closest("[data-id]"); if (!b) return; try { await S.desbloquear(ctx.bid, b.dataset.id); U.toast("Removido."); bloq(); } catch (er) { U.toast(er.message); } };
    } catch (err) { U.toast(err.message); }
  }

  // ---------- RELATÓRIOS / GANHOS ----------
  async function rel() {
    const PER = { "0": "Hoje", "7": "7 dias", "mes": "Este mês", "30": "30 dias", "90": "90 dias" };
    box().innerHTML = `<div class="seg" id="rPer">${Object.entries(PER).map(([k, t]) => `<button class="btn btn-mini ${periodo === k ? "" : "btn-sec"}" data-p="${k}">${t}</button>`).join("")}</div><div id="rOut"><p class="vazio">Carregando…</p></div>`;
    $("#rPer").onclick = e => { const b = e.target.closest("[data-p]"); if (b) { periodo = b.dataset.p; rel(); } };
    const fim = U.hoje(), ini = periodo === "mes" ? fim.slice(0, 8) + "01" : A.addDays(fim, -(+periodo || 0));
    let ags; try { ags = await S.listar(ctx.bid, ini, A.addDays(fim, 60), dono() ? undefined : ctx.prof_id); } catch (err) { $("#rOut").innerHTML = `<p class="erro">${esc(err.message)}</p>`; return; }
    const noP = ags.filter(a => a.data <= fim || a.status !== "agendado"), fut = ags.filter(a => a.status === "agendado" && a.data >= fim);
    const conc = noP.filter(a => a.status === "concluido"), fat = conc.reduce((s, a) => s + a.preco, 0);
    const faltas = noP.filter(a => a.status === "faltou").length, canc = noP.filter(a => a.status === "cancelado").length, prev = fut.reduce((s, a) => s + a.preco, 0);
    const agrupa = (arr, k) => { const m = {}; arr.forEach(a => { const c = k(a); m[c] = m[c] || { n: 0, v: 0 }; m[c].n++; m[c].v += a.preco; }); return Object.entries(m).sort((x, y) => y[1].v - x[1].v); };
    const barras = (lista, cor, fmt) => { const mx = Math.max(1, ...lista.map(x => x[1].v)); return lista.map(([n, s]) => `<div class="barra"><span>${esc(n)} <small>(${s.n})</small></span><span>${fmt(s)}</span><div class="trilho"><i style="width:${(s.v / mx * 100).toFixed(1)}%;${cor ? "background:" + cor : ""}"></i></div></div>`).join(""); };
    const porDia = [1, 2, 3, 4, 5, 6, 0].map(d => [DIAS[d], { n: conc.filter(a => A.dow(a.data) === d).length, v: conc.filter(a => A.dow(a.data) === d).length }]);
    const pico = agrupa(conc, a => a.hora.slice(0, 2) + "h").sort((x, y) => y[1].n - x[1].n)[0];
    const meu = ctx.profs.find(p => p.id === ctx.prof_id) || {}, com = Number(meu.comissao || 0);
    let html = `<div class="kpis">
      <div class="kpi"><small>${dono() ? "Faturamento" : "Você atendeu"}</small><b>${money(fat)}</b></div>
      ${!dono() && com ? `<div class="kpi destaque"><small>Sua comissão (${com}%)</small><b>${money(fat * com / 100)}</b></div>` : ""}
      <div class="kpi"><small>Atendimentos</small><b>${conc.length}</b></div><div class="kpi"><small>Ticket médio</small><b>${money(conc.length ? fat / conc.length : 0)}</b></div>
      <div class="kpi"><small>Faltas / cancel.</small><b>${faltas} / ${canc}</b></div><div class="kpi"><small>Agendado a receber</small><b>${money(prev)}</b></div>
      <div class="kpi"><small>Horário de pico</small><b>${pico ? pico[0] : "—"}</b></div></div>`;
    if (!conc.length) html += `<p class="vazio">Nenhum atendimento concluído no período. Use “Concluir” na agenda.</p>`;
    else {
      if (dono() && ctx.profs.length > 1) {
        const pp = agrupa(conc, a => a.prof_id);
        html += `<h2>Por barbeiro</h2><div class="scroll"><table class="tab"><thead><tr><th>Barbeiro</th><th class="num">Atend.</th><th class="num">Faturou</th><th class="num">Comissão</th></tr></thead><tbody>${pp.map(([id, s]) => {
          const p = ctx.profs.find(x => x.id === id) || { nome: "—", comissao: 0 };
          return `<tr><td>${esc(p.nome)}</td><td class="num">${s.n}</td><td class="num">${money(s.v)}</td><td class="num">${p.comissao ? money(s.v * p.comissao / 100) + ` <small>(${Number(p.comissao)}%)</small>` : "—"}</td></tr>`; }).join("")}</tbody></table></div>`;
      }
      html += `<h2>Receita por serviço</h2>${barras(agrupa(conc, a => a.servico_nome), "", s => money(s.v))}
        <h2 style="margin-top:24px">Movimento por dia da semana</h2>${barras(porDia, "var(--azul)", s => s.n)}`;
    }
    $("#rOut").innerHTML = html;
  }

  // ---------- CLIENTES ----------
  async function cli() {
    box().innerHTML = `<input class="busca" id="cBusca" type="search" placeholder="Buscar cliente por nome ou telefone"><div id="cLista"><p class="vazio">Carregando…</p></div>`;
    let ags; try { ags = await S.listar(ctx.bid, A.addDays(U.hoje(), -365), A.addDays(U.hoje(), 90), dono() ? undefined : ctx.prof_id); } catch (err) { U.toast(err.message); return; }
    const m = {};
    ags.forEach(a => {
      const k = a.nome.trim().toLowerCase() + "|" + U.soDig(a.telefone);
      const c = m[k] = m[k] || { nome: a.nome.trim(), tel: a.telefone, n: 0, total: 0, ult: "", faltas: 0, prox: "" };
      if (a.status === "concluido") { c.n++; c.total += a.preco; if (a.data > c.ult) c.ult = a.data; }
      if (a.status === "faltou") c.faltas++;
      if (a.status === "agendado" && a.data >= U.hoje() && (!c.prox || a.data < c.prox)) c.prox = a.data;
      if (a.telefone && !c.tel) c.tel = a.telefone;
    });
    const todos = Object.values(m).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome));
    const desenharL = q => {
      const l = todos.filter(c => !q || c.nome.toLowerCase().includes(q) || U.soDig(c.tel).includes(q));
      $("#cLista").innerHTML = l.length ? `<p class="sub" style="margin-top:0">${l.length} cliente(s) nos últimos 12 meses</p>` + l.map(c => `<div class="cli"><div><b>${esc(c.nome)}</b>
        <small>${c.n} visita(s) · ${money(c.total)}${c.ult ? " · última " + esc(fmtData(c.ult)) : ""}${c.prox ? " · próximo " + esc(fmtData(c.prox)) : ""}${c.faltas ? " · " + c.faltas + " falta(s)" : ""}</small></div>
        ${c.tel ? `<a class="btn btn-mini btn-ok" target="_blank" rel="noopener" href="${esc(wa(c.tel, `Olá ${c.nome}! Tudo certo? Bora agendar o próximo corte na ${ctx.b.nome}? ${U.abs("/" + ctx.b.slug)}`))}">WhatsApp</a>` : ""}</div>`).join("")
        : `<p class="vazio">Nenhum cliente encontrado.</p>`;
    };
    $("#cBusca").oninput = e => desenharL(e.target.value.trim().toLowerCase());
    desenharL("");
  }

  // ---------- EQUIPE (dono) ----------
  async function equipe() {
    const plano = P.planos.find(p => p.id === ctx.b.plano), ativos = ctx.profs.filter(p => p.ativo).length;
    box().innerHTML = `<p class="sub" style="margin-top:0">Plano ${esc(plano ? plano.nome : ctx.b.plano)}: ${ativos} de ${plano && plano.maxProf ? plano.maxProf : "∞"} barbeiro(s) ativo(s).</p>
      <div id="eLista">${ctx.profs.map(p => `<div class="prof-card ${p.ativo ? "" : "inativo"}" data-id="${esc(p.id)}">
        <div class="prof-top"><span class="avatar">${esc(U.iniciais(p.nome))}</span><div><b>${esc(p.nome)}</b>
          <small>${p.id === ctx.prof_id ? "Você · dono" : p.tem_acesso ? "Acesso: " + esc(p.email || "ativo") : "Sem acesso ao painel"}${p.comissao ? " · comissão " + Number(p.comissao) + "%" : ""}</small></div></div>
        <div class="dias-mini">${[0, 1, 2, 3, 4, 5, 6].map(d => `<span class="${(p.dias || []).includes(d) ? "on" : ""}">${DIAS[d].slice(0, 3)}</span>`).join("")}</div>
        <div class="acoes"><button class="btn btn-mini btn-sec" data-a="editar">Editar</button>
          ${p.id !== ctx.prof_id ? (p.tem_acesso ? `<button class="btn btn-mini btn-sec" data-a="remover">Remover acesso</button>` : `<button class="btn btn-mini" data-a="convite">Enviar convite</button>`) : ""}</div></div>`).join("")}</div>
      <button class="btn" id="eNovo" style="margin-top:16px;width:100%">+ Adicionar barbeiro</button>`;
    $("#eNovo").onclick = () => editarProf({ nome: "", dias: [1, 2, 3, 4, 5, 6], ativo: true, comissao: 0 });
    $("#eLista").onclick = async e => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      const p = ctx.profs.find(x => x.id === b.closest("[data-id]").dataset.id);
      if (b.dataset.a === "editar") editarProf(p);
      if (b.dataset.a === "convite") convite(p);
      if (b.dataset.a === "remover") {
        const m = U.modal(`<h2>Remover acesso de ${esc(p.nome)}?</h2><p>Ele não entra mais no painel. Os agendamentos dele continuam.</p><div class="pilha"><button class="btn" id="rmSim">Remover acesso</button><button class="btn btn-sec" data-fechar>Cancelar</button></div>`);
        m.querySelector("#rmSim").onclick = async () => { try { await S.removerAcesso(ctx.bid, p.id); U.fecharModal(); await recarregarProfs(); equipe(); } catch (er) { U.toast(er.message); } };
      }
    };
  }
  async function recarregarProfs() { ctx.profs = await S.profs(ctx.bid); }
  function editarProf(p) {
    const novo = !p.id;
    const b = U.modal(`<h2>${novo ? "Novo barbeiro" : "Editar " + esc(p.nome)}</h2><form id="fProf" class="form-grid">
      <label class="full">Nome (aparece para o cliente)<input name="nome" value="${esc(p.nome)}" maxlength="40" required></label>
      <div class="full"><span class="lbl">Dias que atende</span><div class="dias-sel">${[0, 1, 2, 3, 4, 5, 6].map(d => `<label><input type="checkbox" name="d" value="${d}" ${(p.dias || []).includes(d) ? "checked" : ""}><span>${DIAS[d].slice(0, 3)}</span></label>`).join("")}</div></div>
      <label>Comissão (%)<input name="com" type="number" inputmode="decimal" min="0" max="100" step="1" value="${esc(p.comissao || 0)}"></label>
      <label class="switch" style="align-self:end;min-height:48px"><input type="checkbox" name="ativo" ${p.ativo ? "checked" : ""}> Ativo na agenda</label>
      <p class="erro full" id="pErro"></p><button class="btn full">Salvar</button><button type="button" class="btn btn-sec full" data-fechar>Cancelar</button></form>`);
    b.querySelector("#fProf").onsubmit = async e => {
      e.preventDefault(); const f = e.target, dias = [...f.querySelectorAll("[name=d]:checked")].map(x => +x.value);
      if (!f.nome.value.trim()) return b.querySelector("#pErro").textContent = "Digite o nome.";
      if (!dias.length) return b.querySelector("#pErro").textContent = "Marque ao menos um dia.";
      try { await S.salvarProf(ctx.bid, Object.assign({}, p, { nome: f.nome.value.trim(), dias, comissao: Number(f.com.value) || 0, ativo: f.ativo.checked }));
        U.fecharModal(); await recarregarProfs(); U.toast("Salvo."); equipe(); }
      catch (er) { b.querySelector("#pErro").textContent = er.message; }
    };
  }
  async function convite(p) {
    let cod; try { cod = await S.convite(ctx.bid, p.id); } catch (er) { return U.toast(er.message); }
    const link = `${U.abs("/cadastro")}?convite=${cod}`, msg = `Oi ${p.nome}! Criei seu acesso à agenda da ${ctx.b.nome}. Abra o link e crie sua senha: ${link} (código ${cod})`;
    const b = U.modal(`<h2>Convite para ${esc(p.nome)}</h2><p>Envie o link abaixo. Ele cria a senha e já entra vendo só a agenda dele. Vale por 7 dias e só uma vez.</p>
      <p class="codigo">${esc(cod)}</p><input readonly value="${esc(link)}" onclick="this.select()">
      <div class="pilha" style="margin-top:12px"><a class="btn btn-ok" target="_blank" rel="noopener" href="${esc("https://wa.me/?text=" + encodeURIComponent(msg))}">Enviar pelo WhatsApp</a>
      <button class="btn btn-sec" id="cpConv">Copiar link</button><button class="btn btn-sec" data-fechar>Fechar</button></div>`);
    b.querySelector("#cpConv").onclick = () => U.copiar(link);
  }

  // ---------- SERVIÇOS (dono) ----------
  function serv() {
    let lista = JSON.parse(JSON.stringify(cfg().servicos));
    const desenharS = () => {
      box().innerHTML = `<div id="sLista">${lista.map((s, i) => `<div class="serv-ed form-grid" data-i="${i}">
        <label class="full">Nome<input data-k="nome" value="${esc(s.nome)}" maxlength="40"></label>
        <label>Preço (R$)<input data-k="preco" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(s.preco)}"></label>
        <label>Duração (min)<input data-k="dur" type="number" inputmode="numeric" min="5" step="5" value="${esc(s.dur)}"></label>
        <label class="full">Descrição<input data-k="desc" value="${esc(s.desc || "")}" maxlength="90"></label>
        <div class="full seg" style="margin:0"><button class="btn btn-mini btn-sec" data-m="-1" ${i ? "" : "disabled"}>Subir</button><button class="btn btn-mini btn-sec" data-m="1" ${i < lista.length - 1 ? "" : "disabled"}>Descer</button><button class="btn btn-mini btn-sec" data-del>Excluir</button></div></div>`).join("")}</div>
        <div class="seg" style="margin-top:16px"><button class="btn btn-sec" id="sAdd">+ Novo serviço</button><button class="btn" id="sSalvar">Salvar serviços</button></div>`;
      $("#sLista").oninput = e => { const k = e.target.dataset.k; if (!k) return; const i = +e.target.closest("[data-i]").dataset.i; lista[i][k] = k === "preco" || k === "dur" ? Number(e.target.value) : e.target.value; };
      $("#sLista").onclick = e => {
        const it = e.target.closest("[data-i]"); if (!it) return; const i = +it.dataset.i;
        if (e.target.dataset.m) { const j = i + Number(e.target.dataset.m); [lista[i], lista[j]] = [lista[j], lista[i]]; desenharS(); }
        if (e.target.hasAttribute("data-del")) { lista.splice(i, 1); desenharS(); }
      };
      $("#sAdd").onclick = () => { lista.push({ id: "s" + Date.now().toString(36), nome: "Novo serviço", preco: 0, dur: 30, desc: "" }); desenharS(); };
      $("#sSalvar").onclick = () => {
        if (!lista.length) return U.toast("Mantenha ao menos um serviço.");
        if (lista.some(s => !s.nome.trim() || !(s.dur >= 5))) return U.toast("Confira nome e duração (mín. 5 min).");
        salvarCfg({ servicos: lista });
      };
    };
    desenharS();
  }
  async function salvarCfg(patch, nome) {
    try { const c = Object.assign({}, cfg(), patch); await S.salvarBarbearia(ctx.bid, { config: c, nome }); ctx.b.config = c; if (nome) ctx.b.nome = nome; U.toast("Salvo!"); if (nome) desenhar(); }
    catch (err) { U.toast(err.message); }
  }

  // ---------- HORÁRIOS (dono) ----------
  function hor() {
    const c = cfg(), H = JSON.parse(JSON.stringify(c.horarios));
    box().innerHTML = `<div id="hDias">${[1, 2, 3, 4, 5, 6, 0].map(d => { const h = H[d]; return `<div class="linha-dia" data-d="${d}">
      <label class="switch"><input type="checkbox" data-k="aberto" ${h.aberto ? "checked" : ""}>${DIAS[d].slice(0, 3)}</label>
      <input type="time" data-k="abre" value="${esc(h.abre)}" aria-label="Abre"><input type="time" data-k="fecha" value="${esc(h.fecha)}" aria-label="Fecha">
      <div class="alm"><small>Pausa (vazio se não tiver)</small><input type="time" data-k="almocoIni" value="${esc(h.almocoIni)}" aria-label="Início da pausa"><input type="time" data-k="almocoFim" value="${esc(h.almocoFim)}" aria-label="Fim da pausa"></div></div>`; }).join("")}</div>
      <p class="sub">Os dias de cada barbeiro são definidos em Equipe.</p>
      <h2 style="margin-top:24px">Regras do agendamento</h2><div class="form-grid">
      <label>Intervalo entre horários<select id="hInt">${[10, 15, 20, 30, 40, 45, 60].map(v => `<option ${c.intervalo == v ? "selected" : ""} value="${v}">${v} min</option>`).join("")}</select></label>
      <label>Antecedência mínima<select id="hAnt">${[0, 15, 30, 60, 120, 180, 1440].map(v => `<option ${c.antecedenciaMin == v ? "selected" : ""} value="${v}">${v >= 1440 ? "1 dia" : v >= 60 ? v / 60 + " h" : v + " min"}</option>`).join("")}</select></label>
      <label>Agenda aberta por<select id="hDias2">${[7, 14, 21, 30, 45, 60].map(v => `<option ${c.diasAgenda == v ? "selected" : ""} value="${v}">${v} dias</option>`).join("")}</select></label></div>
      <button class="btn" id="hSalvar" style="margin-top:18px;width:100%">Salvar horários</button>`;
    $("#hDias").oninput = e => { const k = e.target.dataset.k; if (!k) return; H[e.target.closest("[data-d]").dataset.d][k] = e.target.type === "checkbox" ? e.target.checked : e.target.value; };
    $("#hSalvar").onclick = () => {
      for (const d in H) { const h = H[d];
        if (h.aberto && (!h.abre || !h.fecha || h.abre >= h.fecha)) return U.toast(`Confira o horário de ${DIAS[d]}.`);
        if ((h.almocoIni && !h.almocoFim) || (!h.almocoIni && h.almocoFim) || (h.almocoIni && h.almocoIni >= h.almocoFim)) return U.toast(`Confira a pausa de ${DIAS[d]}.`); }
      salvarCfg({ horarios: H, intervalo: +$("#hInt").value, antecedenciaMin: +$("#hAnt").value, diasAgenda: +$("#hDias2").value });
    };
  }

  // ---------- ASSINATURA (dono) ----------
  function assin() {
    const b = ctx.b, se = A.statusEfetivo(b, U.hoje()), plano = P.planos.find(p => p.id === b.plano);
    const dias = b.vence_em ? Math.round((A.parseYMD(b.vence_em) - A.parseYMD(U.hoje())) / 864e5) : null;
    box().innerHTML = `<div class="assin-card st-${esc(se)}"><span class="tag ${A.liberada(b, U.hoje()) ? "concluido" : "cancelado"}">${esc(STATUS[se] || se)}</span>
      <p class="quando">${esc(plano ? plano.nome : b.plano)}</p>
      <p>${b.vence_em ? (dias >= 0 ? `${b.status === "teste" ? "Teste até" : "Válida até"} <b>${esc(fmtData(b.vence_em, true))}</b> (${dias === 0 ? "hoje" : dias + " dia(s)"})` : `Venceu em <b>${esc(fmtData(b.vence_em, true))}</b>`) : "Sem data de vencimento"}</p></div>
      <h2>Planos</h2><div class="planos">${P.planos.map(p => `<div class="plano ${p.id === b.plano ? "destaque" : ""}">${p.id === b.plano ? `<span class="tag agendado">Seu plano</span>` : ""}
        <h3>${esc(p.nome)}</h3><p class="preco-plano">${money(p.preco)}<small>/mês</small></p><p>${esc(p.desc)}</p>
        <a class="btn ${p.id === b.plano ? "" : "btn-sec"}" target="_blank" rel="noopener" href="${esc(wa(P.suporteWhatsapp, `Olá! Quero ${p.id === b.plano ? "renovar" : "assinar"} o plano ${p.nome} para a ${b.nome} (${U.abs("/" + b.slug)}).`))}">${p.id === b.plano ? "Renovar" : "Quero este plano"}</a></div>`).join("")}</div>
      <p class="sub">O pagamento online entra em breve. Por enquanto a ativação é feita pelo nosso suporte no WhatsApp.</p>`;
  }

  // ---------- AJUSTES (dono) ----------
  function aj() {
    const c = cfg(), link = U.abs("/" + ctx.b.slug);
    box().innerHTML = `<h2>Seu link</h2>
      <div class="link-box"><input readonly value="${esc(link)}" onclick="this.select()"><button class="btn btn-sec" id="ajCp">Copiar</button></div>
      <div class="seg" style="margin-top:10px"><a class="btn btn-ok btn-mini" target="_blank" rel="noopener" href="${esc("https://wa.me/?text=" + encodeURIComponent("Agende seu horário na " + ctx.b.nome + ": " + link))}">Compartilhar no WhatsApp</a>
        <button class="btn btn-mini btn-sec" id="ajQr">Gerar QR Code</button></div><div id="qr" class="qr"></div>
      <h2 style="margin-top:28px">Dados da barbearia</h2><form id="fAj" class="form-grid">
      <label class="full">Nome<input name="nome" value="${esc(ctx.b.nome)}" maxlength="60" required></label>
      <label class="full">Frase de apresentação<input name="slogan" value="${esc(c.slogan)}" maxlength="80"></label>
      <label>WhatsApp (com DDD)<input name="whatsapp" inputmode="tel" value="${esc(c.whatsapp)}" placeholder="38999990000"></label>
      <label>Instagram<input name="instagram" value="${esc(c.instagram)}" placeholder="seuperfil"></label>
      <label class="full">Endereço<input name="endereco" value="${esc(c.endereco)}"></label>
      <label class="full">Link do Google Maps (opcional)<input name="mapsUrl" type="url" value="${esc(c.mapsUrl)}"></label>
      <label class="switch full"><input type="checkbox" name="pedirTelefone" ${c.pedirTelefone ? "checked" : ""}> Pedir WhatsApp do cliente (opcional para ele)</label>
      <button class="btn full">Salvar dados</button></form>
      <h2 style="margin-top:28px">Avisos de novos agendamentos</h2><p class="sub">Com o painel aberto, chega um aviso a cada novo agendamento.</p>
      <button class="btn btn-sec" id="ajNotif">Ativar notificações</button>
      <h2 style="margin-top:28px">Backup</h2><button class="btn btn-sec" id="ajExp">Baixar agendamentos (CSV)</button>`;
    $("#ajCp").onclick = () => U.copiar(link);
    $("#ajQr").onclick = () => qr(link);
    $("#fAj").onsubmit = e => {
      e.preventDefault(); const f = e.target;
      salvarCfg({ slogan: f.slogan.value.trim(), whatsapp: U.soDig(f.whatsapp.value), instagram: f.instagram.value.trim().replace("@", ""),
        endereco: f.endereco.value.trim(), mapsUrl: f.mapsUrl.value.trim(), pedirTelefone: f.pedirTelefone.checked }, f.nome.value.trim() || ctx.b.nome);
    };
    $("#ajNotif").onclick = async () => { try { const p = await Notification.requestPermission(); U.toast(p === "granted" ? "Notificações ativadas." : "Permissão negada no navegador."); } catch { U.toast("Este navegador não suporta notificações."); } };
    $("#ajExp").onclick = async () => {
      const l = await S.listar(ctx.bid, "2000-01-01", "2100-01-01"), q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
      U.baixar(`agendamentos-${ctx.b.slug}.csv`, "﻿" + ["data;hora;cliente;telefone;servico;barbeiro;preco;status;origem"].concat(l.map(a =>
        [a.data, a.hora, q(a.nome), q(a.telefone), q(a.servico_nome), q(nomeProf(a.prof_id)), String(a.preco).replace(".", ","), a.status, a.origem].join(";"))).join("\n"), "text/csv");
    };
  }
  function qr(link) {
    const el = $("#qr");
    const gerar = () => { el.innerHTML = ""; new window.QRCode(el, { text: link, width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.M });
      el.insertAdjacentHTML("beforeend", `<p class="sub">Imprima e cole no balcão ou no espelho.</p>`); };
    if (window.QRCode) return gerar();
    el.innerHTML = `<p class="vazio">Gerando…</p>`;
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    s.onload = gerar; s.onerror = () => { el.innerHTML = `<p class="erro">Sem conexão para gerar o QR Code.</p>`; }; document.head.appendChild(s);
  }

  window.Painel = { render, parar };
}
