// Painel /painel — dono (tudo da barbearia) e barbeiro (só a própria agenda).
{
  const U = window.UI, S = window.Store, A = window.Agenda, P = window.PLATAFORMA;
  const { esc, money, $, ls, fmtData, durTxt, wa, DIAS, cap } = U;
  const app = () => $("#app");
  const ROT = { agendado: "Agendado", concluido: "Concluído", cancelado: "Cancelado", faltou: "Faltou" };
  const STATUS = { teste: "Teste grátis", ativa: "Ativa", carencia: "Pagamento pendente", bloqueada: "Bloqueada", teste_vencido: "Teste encerrado", vencida: "Vencida" };
  let ctx = null, aba = "agenda", dia = U.hoje(), filtroProf = "", periodo = "30", timer = null, conhecidos = null;
  const dono = () => ctx.papel === "dono" || ctx.papel === "super";
  const cfg = () => ctx.b.config;
  const nomeProf = id => (ctx.profs.find(p => p.id === id) || {}).nome || "—";

  function parar() { clearInterval(timer); timer = null; }

  let avisoCad = "";
  async function render() {
    parar(); U.manifestPadrao(); document.title = "Painel · " + P.nome;
    U.rodapeHTML(`<span>${esc(P.nome)}</span>`);
    if (location.hash.length > 20) { // voltou de um link de e-mail (confirmação ou nova senha)
      try { const tipo = await S.capturarRetornoAuth(); if (tipo === "recovery") return novaSenha(); if (tipo) U.toast("E-mail confirmado!"); }
      catch (e) { U.toast(e.message); }
    }
    if (!S.logado()) return login();
    U.moldura({ marca: "Painel", marcaHref: "/painel" });
    app().innerHTML = `<p class="vazio band">Carregando…</p>`;
    try {
      // convites e cadastros que ficaram pendentes (confirmação de e-mail)
      const conv = new URLSearchParams(location.search).get("convite") || ls.get("bb_convite_pendente", "");
      if (conv) { try { await S.aceitarConvite(conv); U.toast("Convite aceito!"); } catch (e) { U.toast(e.message); } ls.set("bb_convite_pendente", ""); if (location.search) history.replaceState({}, "", U.url("/painel")); }
      let acessos = await S.acessos();
      avisoCad = "";
      if (!acessos.length) { // barbearia informada no cadastro (vale em qualquer navegador/aparelho)
        let criou = null;
        try { criou = await S.criarPendente(); }
        catch (e) { avisoCad = /slug|uso/i.test(e.message) ? "O endereço escolhido no cadastro foi usado por outra barbearia. Crie a sua com outro endereço." : e.message; }
        const pend = ls.get("bb_cad_pendente", null); // cadastros antigos, feitos antes desta versão
        if (!criou && !avisoCad && pend) { try { await S.criarBarbearia(pend); criou = true; } catch (e) { avisoCad = e.message; } }
        ls.set("bb_cad_pendente", null);
        if (criou) { acessos = await S.acessos(); U.toast("Barbearia criada! Configure seus serviços e horários."); }
      }
      const sup = await S.souSuper();
      if (!acessos.length) return semAcesso(sup);
      let a = acessos.find(x => x.barbearia_id === ls.get("bb_bid", "")) || acessos[0];
      ls.set("bb_bid", a.barbearia_id); ls.set("bb_ultimo_painel", true);
      const [b, profs, produtos] = await Promise.all([S.barbearia(a.barbearia_id), S.profs(a.barbearia_id), S.produtos(a.barbearia_id).catch(() => [])]);
      if (!ctx || ctx.bid !== a.barbearia_id) { aba = "agenda"; filtroProf = ""; conhecidos = null; }
      ctx = { bid: a.barbearia_id, papel: a.papel, prof_id: a.prof_id, b, profs, produtos, acessos, sup };
      desenhar();
    } catch (e) { app().innerHTML = `<div class="form-pag"><p class="erro">${esc(e.message)}</p><button class="btn" id="tentar">Tentar de novo</button></div>`; $("#tentar").onclick = render; }
  }

  function login() {
    U.moldura({ marca: P.nome, marcaHref: "/" });
    const conv = new URLSearchParams(location.search).get("convite") || "";
    app().innerHTML = `<form class="form-pag" id="fLogin"><h1>Entrar</h1>
      <p class="l-sub2">Para donos de barbearia e barbeiros.${conv ? " Depois de entrar, o convite <b>" + esc(conv) + "</b> será usado." : ""}</p>
      <label class="lbl">E-mail<input name="email" type="email" autocomplete="username" required></label>
      <label class="lbl">Senha<input name="senha" type="password" autocomplete="current-password" required></label>
      <p class="erro" id="lErro" role="alert"></p><button class="btn btn-grande" style="width:100%">Entrar</button>
      <p class="centro"><button type="button" class="lnk" id="esqueci">Esqueci minha senha</button></p>
      <p class="centro"><a href="/cadastro" data-link>Criar minha barbearia</a> · <a href="/cadastro?barbeiro=1${conv ? "&convite=" + encodeURIComponent(conv) : ""}" data-link>Recebi um convite</a></p></form>`;
    $("#fLogin").onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      try { await S.entrar(f.email.value.trim(), f.senha.value); ctx = null;
        if (await S.souSuper() && !(await S.acessos()).length && !conv) return U.go("/admin");
        render(); }
      catch (err) { $("#lErro").textContent = err.message; }
    };
    $("#esqueci").onclick = () => {
      const m = U.modal(`<h2>Recuperar senha</h2><p>Enviamos um link para você criar uma senha nova.</p><form id="fRec"><label class="lbl">E-mail<input name="email" type="email" autocomplete="email" required value="${esc($("#fLogin").email.value)}"></label>
        <p class="erro" id="rErro"></p><div class="pilha"><button class="btn">Enviar link</button><button type="button" class="btn btn-sec" data-fechar>Cancelar</button></div></form>`);
      m.querySelector("#fRec").onsubmit = async e => { e.preventDefault();
        try { await S.recuperarSenha(e.target.email.value.trim()); U.modal(`<h2>Confira seu e-mail</h2><p>Se existir uma conta com esse e-mail, o link chega em instantes. Veja também o spam.</p><button class="btn" data-fechar style="width:100%">Ok</button>`); }
        catch (er) { m.querySelector("#rErro").textContent = er.message; } };
    };
  }
  function novaSenha() {
    U.moldura({ marca: P.nome, marcaHref: "/" });
    app().innerHTML = `<form class="form-pag" id="fNova"><h1>Nova senha</h1><p class="l-sub2">${esc((S.usuario() || {}).email || "")}</p>
      <label class="lbl">Nova senha<input name="s" type="password" minlength="6" autocomplete="new-password" required></label>
      <p class="erro" id="nErro"></p><button class="btn btn-grande" style="width:100%">Salvar e entrar</button></form>`;
    $("#fNova").onsubmit = async e => { e.preventDefault();
      try { await S.trocarSenha(e.target.s.value); U.toast("Senha alterada!"); render(); } catch (er) { $("#nErro").textContent = er.message; } };
  }

  function semAcesso(sup) {
    app().innerHTML = `<div class="form-pag"><h1>Nenhuma barbearia</h1>${avisoCad ? `<p class="aviso ruim">${esc(avisoCad)}</p>` : ""}<p>Sua conta (${esc((S.usuario() || {}).email)}) ainda não faz parte de uma barbearia. Crie a sua agora, leva 1 minuto.</p>
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
    const extras = ["equipe", "serv", "prod", "hor", "assin", "aj"];
    const ic = U.iconesDe(ctx.bid, cfg().logo);
    U.moldura({ marca: ctx.b.nome, marcaHref: "/painel", tabs, ativo: extras.includes(aba) ? "mais" : aba, logo: ic && ic.i192,
      acoes: `<a class="btn btn-mini btn-claro" href="/${esc(ctx.b.slug)}" data-link>Ver página</a>` });
    $("#tabbar").onclick = e => { const t = e.target.closest("[data-tab]"); if (!t) return; e.preventDefault();
      if (t.dataset.tab === "mais") return menuMais(); aba = t.dataset.tab; desenhar(); };
    const se = A.statusEfetivo(ctx.b, U.hoje()), lib = A.liberada(ctx.b, U.hoje());
    let aviso = "";
    if (!lib) aviso = dono() ? `<div class="aviso ruim"><b>${esc(STATUS[se] || se)}.</b> Seus clientes não conseguem agendar online. <button class="lnk" data-ir="assin">Ver assinatura</button></div>`
                             : `<div class="aviso ruim">A agenda online da barbearia está pausada. Fale com o dono.</div>`;
    else if (dono() && se === "carencia") aviso = `<div class="aviso ruim"><b>Pagamento pendente.</b> A agenda continua aberta por poucos dias. <button class="lnk" data-ir="assin">Pagar fatura</button></div>`;
    else if (dono() && ctx.b.status === "teste" && ctx.b.vence_em && !ctx.b.asaas_subscription_id) {
      const dias = Math.round((A.parseYMD(ctx.b.vence_em) - A.parseYMD(U.hoje())) / 864e5);
      if (dias <= 7) aviso = `<div class="aviso">Teste grátis: ${dias === 0 ? "termina hoje" : dias === 1 ? "falta 1 dia" : `faltam ${dias} dias`}. <button class="lnk" data-ir="assin">Assinar agora</button></div>`;
    }
    const titulos = { agenda: "Agenda", bloq: dono() ? "Bloqueios e folgas" : "Minhas folgas", rel: dono() ? "Relatórios" : "Meus ganhos", cli: "Clientes", prod: "Produtos à venda",
      equipe: "Equipe", serv: "Serviços", hor: "Horários", assin: "Assinatura", aj: "Ajustes" };
    app().innerHTML = `<div class="p-top"><h1>${titulos[aba]}</h1>${!dono() ? `<span class="tag">Barbeiro · ${esc(nomeProf(ctx.prof_id))}</span>` : ""}</div>
      <div class="p-sec">${aviso}<div id="pc"></div></div>`;
    app().querySelectorAll("[data-ir]").forEach(b => b.onclick = () => { aba = b.dataset.ir; desenhar(); });
    const fn = { agenda, bloq, rel, cli, equipe, serv, prod, hor, assin, aj }[aba];
    if ((["equipe", "serv", "prod", "hor", "assin", "aj"].includes(aba)) && !dono()) { aba = "agenda"; return desenhar(); }
    fn();
  }
  const box = () => $("#pc");

  function menuMais() {
    const it = dono()
      ? [["equipe", "Equipe e acessos"], ["serv", "Serviços, preços e fotos"], ["prod", "Produtos à venda"], ["hor", "Horários de funcionamento"], ["assin", "Assinatura"], ["aj", "Capa, ícone, dados, link e QR Code"]]
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
      <div class="seg"><button class="btn btn-mini btn-sec" id="dHoje">Hoje</button><button class="btn btn-mini" id="dEnc">+ Encaixe</button>${temProdutos() ? `<button class="btn btn-mini btn-sec" id="dVenda">+ Venda avulsa</button>` : ""}</div>
      ${dono() && ctx.profs.filter(p => p.ativo).length > 1 ? `<div class="seg chips-filtro" id="fProf">${[{ id: "", nome: "Todos" }].concat(ctx.profs.filter(p => p.ativo)).map(p => `<button class="chip ${filtroProf === p.id ? "on" : ""}" data-p="${esc(p.id)}">${esc(p.nome)}</button>`).join("")}</div>` : ""}
      <div id="aKpis" class="kpis"></div><h2 id="aTit"></h2><div id="aLista"><p class="vazio">Carregando…</p></div>`;
    const ir = d => { dia = d; agenda(); };
    $("#dAnt").onclick = () => ir(A.addDays(dia, -1)); $("#dProx").onclick = () => ir(A.addDays(dia, 1));
    $("#dHoje").onclick = () => ir(U.hoje()); $("#dSel").onchange = e => e.target.value && ir(e.target.value);
    $("#dEnc").onclick = encaixe;
    const dv = $("#dVenda"); if (dv) dv.onclick = () => vender(null);
    const fp = $("#fProf"); if (fp) fp.onclick = e => { const b = e.target.closest("[data-p]"); if (b) { filtroProf = b.dataset.p; agenda(); } };
    await listaDia();
    timer = setInterval(() => { if (!document.hidden && aba === "agenda" && U.partes()[0] === "painel") listaDia(true); }, 30000);
  }
  async function listaDia(silencioso) {
    let ags, blq, vendas;
    const pf = dono() ? filtroProf : ctx.prof_id;
    try { [ags, blq, vendas] = await Promise.all([S.listar(ctx.bid, dia, dia, pf || undefined), S.bloqueios(ctx.bid, dia), S.vendas(ctx.bid, dia, dia, pf || undefined).catch(() => [])]); }
    catch (e) { if (!silencioso && box()) box().querySelector("#aLista").innerHTML = `<p class="erro">${esc(e.message)}</p>`; return; }
    if (!$("#aKpis")) return;
    novosAvisos(ags);
    blq = blq.filter(b => b.data === dia && (!pf || !b.prof_id || b.prof_id === pf));
    const ativos = ags.filter(a => a.status !== "cancelado");
    const fat = ags.filter(a => a.status === "concluido").reduce((s, a) => s + a.preco, 0), prev = ags.filter(a => a.status === "agendado").reduce((s, a) => s + a.preco, 0);
    const totProd = vendas.reduce((t, v) => t + v.preco * v.qtd, 0);
    $("#aKpis").innerHTML = `<div class="kpi"><small>Atendimentos</small><b>${ativos.length}</b></div><div class="kpi"><small>Serviços recebidos</small><b>${money(fat)}</b></div>
      <div class="kpi"><small>A receber</small><b>${money(prev)}</b></div>${totProd ? `<div class="kpi"><small>Produtos vendidos</small><b>${money(totProd)}</b></div>` : ""}`;
    const linhaVendas = vs => vs.length ? `<div class="vendas-ag">${vs.map(v => `<span>${esc(v.produto_nome)}${v.qtd > 1 ? " ×" + v.qtd : ""} · ${money(v.preco * v.qtd)} <button class="lnk sutil" data-desfazer="${esc(v.id)}" aria-label="Desfazer venda de ${esc(v.produto_nome)}">desfazer</button></span>`).join("")}</div>` : "";
    const avulsas = vendas.filter(v => !v.agendamento_id);
    $("#aTit").textContent = cap(fmtData(dia, true));
    const h = cfg().horarios[A.dow(dia)], mostraProf = dono() && !filtroProf && ctx.profs.length > 1;
    const itens = ags.map(a => ({ t: a.hora, tipo: "ag", a })).concat(blq.map(b => ({ t: b.ini || "00:00", tipo: "blq", b })));
    if (h && h.aberto && h.almocoIni) itens.push({ t: h.almocoIni, tipo: "alm" });
    itens.sort((x, y) => x.t.localeCompare(y.t));
    const lista = $("#aLista");
    if (!itens.length && !avulsas.length) { lista.innerHTML = `<p class="vazio">${h && h.aberto ? "Nenhum agendamento neste dia." : "Barbearia fechada neste dia."}</p>`; return; }
    lista.innerHTML = itens.map(i => {
      if (i.tipo === "alm") return `<div class="ag-item livre"><div class="h">${esc(h.almocoIni)}<small>até ${esc(h.almocoFim)}</small></div><div class="n">Pausa / almoço</div></div>`;
      if (i.tipo === "blq") return `<div class="ag-item livre"><div class="h">${i.b.ini ? esc(i.b.ini) : "Dia"}<small>${i.b.ini ? "até " + esc(i.b.fim) : "inteiro"}</small></div><div class="n">Bloqueado${i.b.prof_id ? " · " + esc(nomeProf(i.b.prof_id)) : ""}${i.b.motivo ? " · " + esc(i.b.motivo) : ""}</div></div>`;
      const a = i.a;
      return `<div class="ag-item st-${esc(a.status)}" data-id="${esc(a.id)}"><div class="h">${esc(a.hora)}<small>${esc(durTxt(a.dur))}</small></div>
        <div><b>${esc(a.nome)}</b> <span class="tag ${esc(a.status)}">${esc(ROT[a.status] || a.status)}</span><br>
        <span class="sub">${esc(a.servico_nome)} · ${money(a.preco)}${mostraProf ? ` · <b>${esc(nomeProf(a.prof_id))}</b>` : ""}${a.origem === "encaixe" ? " · encaixe" : ""}</span>${linhaVendas(vendas.filter(v => v.agendamento_id === a.id))}</div>
        <div class="acoes">${a.status === "agendado" ? `<button class="btn btn-mini btn-ok" data-s="concluido">Concluir</button><button class="btn btn-mini btn-sec" data-s="faltou">Faltou</button><button class="btn btn-mini btn-sec" data-s="cancelado">Cancelar</button>`
          : `<button class="btn btn-mini btn-sec" data-s="agendado">Desfazer</button>`}
          ${temProdutos() && !["cancelado", "faltou"].includes(a.status) ? `<button class="btn btn-mini btn-sec" data-venda="${esc(a.id)}">+ Produto</button>` : ""}
          ${a.telefone ? `<a class="btn btn-mini btn-sec" target="_blank" rel="noopener" href="${esc(wa(a.telefone, `Olá ${a.nome}! Confirmando seu horário na ${ctx.b.nome}: ${fmtData(a.data)} às ${a.hora}.`))}">WhatsApp</a>` : ""}</div></div>`;
    }).join("") + (avulsas.length ? `<h3 class="tit-avulsas">Vendas avulsas</h3>${avulsas.map(v => `<div class="cli"><div><b>${esc(v.produto_nome)}${v.qtd > 1 ? " ×" + v.qtd : ""}</b><small>${money(v.preco * v.qtd)}${ctx.profs.length > 1 ? " · " + esc(nomeProf(v.prof_id)) : ""}</small></div><button class="btn btn-mini btn-sec" data-desfazer="${esc(v.id)}">Desfazer</button></div>`).join("")}` : "");
    lista.onclick = async e => {
      const bv = e.target.closest("[data-venda]"); if (bv) return vender(bv.dataset.venda);
      const bd = e.target.closest("[data-desfazer]");
      if (bd) { try { await S.desfazerVenda(bd.dataset.desfazer); ctx.produtos = await S.produtos(ctx.bid).catch(() => ctx.produtos); U.toast("Venda desfeita."); listaDia(); } catch (err) { U.toast(err.message); } return; }
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
    let ags, vendas; try { [ags, vendas] = await Promise.all([S.listar(ctx.bid, ini, A.addDays(fim, 60), dono() ? undefined : ctx.prof_id), S.vendas(ctx.bid, ini, fim, dono() ? undefined : ctx.prof_id).catch(() => [])]); }
    catch (err) { $("#rOut").innerHTML = `<p class="erro">${esc(err.message)}</p>`; return; }
    const totProd = vendas.reduce((t, v) => t + v.preco * v.qtd, 0), qtdProd = vendas.reduce((t, v) => t + v.qtd, 0);
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
      <div class="kpi"><small>Horário de pico</small><b>${pico ? pico[0] : "—"}</b></div>
      ${totProd ? `<div class="kpi"><small>Produtos (${qtdProd} un.)</small><b>${money(totProd)}</b></div>` : ""}</div>`;
    if (vendas.length) {
      const pv = {}; vendas.forEach(v => { pv[v.produto_nome] = pv[v.produto_nome] || { n: 0, v: 0 }; pv[v.produto_nome].n += v.qtd; pv[v.produto_nome].v += v.preco * v.qtd; });
      html += `<h2>Produtos mais vendidos</h2>${barras(Object.entries(pv).sort((x, y) => y[1].v - x[1].v), "#c98a12", s => money(s.v))}`;
    }
    if (!conc.length) html += `<p class="vazio">Nenhum atendimento concluído no período. Use “Concluir” na agenda.</p>`;
    else {
      if (dono() && ctx.profs.length > 1) {
        const pp = agrupa(conc, a => a.prof_id);
        html += `<h2>Por barbeiro</h2><div class="scroll"><table class="tab"><thead><tr><th>Barbeiro</th><th class="num">Atend.</th><th class="num">Faturou</th><th class="num">Produtos</th><th class="num">Comissão</th></tr></thead><tbody>${pp.map(([id, s]) => {
          const p = ctx.profs.find(x => x.id === id) || { nome: "—", comissao: 0 }, prodP = vendas.filter(v => v.prof_id === id).reduce((t, v) => t + v.preco * v.qtd, 0);
          return `<tr><td>${esc(p.nome)}</td><td class="num">${s.n}</td><td class="num">${money(s.v)}</td><td class="num">${prodP ? money(prodP) : "—"}</td><td class="num">${p.comissao ? money(s.v * p.comissao / 100) + ` <small>(${Number(p.comissao)}%)</small>` : "—"}</td></tr>`; }).join("")}</tbody></table></div>`;
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
    const plano = (await U.planos().catch(() => [])).find(p => p.id === ctx.b.plano), ativos = ctx.profs.filter(p => p.ativo).length;
    box().innerHTML = `<p class="sub" style="margin-top:0">Plano ${esc(plano ? plano.nome : ctx.b.plano)}: ${ativos} de ${plano && plano.max_prof ? plano.max_prof : "∞"} barbeiro(s) ativo(s).</p>
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
      box().innerHTML = `<p class="sub" style="margin-top:0">A foto aparece pequena ao lado do serviço; o cliente toca para ver grande.</p><div id="sLista">${lista.map((s, i) => `<div class="serv-ed form-grid" data-i="${i}">
        <div class="full foto-linha"><div class="miniatura">${s.foto && s.foto.v ? `<img src="${esc(S.fotoURL(ctx.bid, "serv-" + s.id + ".webp", s.foto.v))}" alt="" width="64" height="64">` : `<span aria-hidden="true">sem foto</span>`}</div>
          <div class="seg" style="margin:0"><button class="btn btn-mini btn-sec" data-foto>${s.foto && s.foto.v ? "Trocar foto" : "Adicionar foto"}</button>${s.foto && s.foto.v ? `<button class="btn btn-mini btn-sec" data-semfoto>Tirar foto</button>` : ""}</div></div>
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
        if (e.target.hasAttribute("data-semfoto")) { lista[i].foto = null; fotoNoSalvo(lista[i].id, null); desenharS(); }
        if (e.target.hasAttribute("data-foto")) escolherArquivo(async arq => {
          const btn = e.target; btn.disabled = true; btn.textContent = "Enviando…";
          try { const blob = await fotoQuadrada(arq, 480); await S.enviarLogo(ctx.bid, [{ nome: "serv-" + lista[i].id + ".webp", blob }]);
            lista[i].foto = { v: Date.now() }; await fotoNoSalvo(lista[i].id, lista[i].foto); desenharS(); }
          catch (er) { U.toast(er.message); btn.disabled = false; btn.textContent = "Adicionar foto"; }
        });
      };
      // a foto já vale para o serviço salvo (sem precisar tocar em Salvar); serviço novo ainda não salvo espera o Salvar
      async function fotoNoSalvo(id, foto) {
        const salvos = cfg().servicos; if (!salvos.some(x => x.id === id)) return U.toast("Foto pronta. Toque em Salvar serviços.");
        await salvarCfg({ servicos: salvos.map(x => x.id === id ? Object.assign({}, x, { foto }) : x) });
      }
      $("#sAdd").onclick = () => { lista.push({ id: "s" + Date.now().toString(36), nome: "Novo serviço", preco: 0, dur: 30, desc: "" }); desenharS(); };
      $("#sSalvar").onclick = () => {
        if (!lista.length) return U.toast("Mantenha ao menos um serviço.");
        if (lista.some(s => !s.nome.trim() || !(s.dur >= 5))) return U.toast("Confira nome e duração (mín. 5 min).");
        salvarCfg({ servicos: lista });
      };
    };
    desenharS();
  }
  // ---------- FOTOS (serviços e produtos) ----------
  function escolherArquivo(cb) {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp";
    inp.onchange = () => { const f = inp.files[0]; if (!f) return; if (f.size > 12 * 1024 * 1024) return U.toast("Imagem muito grande (máximo 12 MB)."); cb(f); };
    inp.click();
  }
  // recorta o centro em quadrado e comprime (WebP ~30–60 KB); o celular não sobe a foto original pesada
  async function fotoQuadrada(arq, tam) {
    const img = await carregarImagem(arq), lado = Math.min(img.width, img.height);
    const c = document.createElement("canvas"); c.width = c.height = tam; const g = c.getContext("2d"); g.imageSmoothingQuality = "high";
    g.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, tam, tam);
    let b = await new Promise(ok => c.toBlob(ok, "image/webp", 0.8));
    if (!b || b.type !== "image/webp") b = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.82));
    return new Blob([b], { type: "image/webp" === b.type ? "image/webp" : "image/jpeg" });
  }

  // capa: lado maior até 1600px, mantém o formato da foto, WebP ~150–300 KB (limite do armazenamento: 1 MB)
  async function fotoCapa(arq) {
    const img = await carregarImagem(arq), k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.78, 0.65, 0.5]) {
      let b = await new Promise(ok => c.toBlob(ok, "image/webp", q));
      if (!b || b.type !== "image/webp") b = await new Promise(ok => c.toBlob(ok, "image/jpeg", q));
      if (b && b.size < 950 * 1024) return b;
    }
    throw new Error("A foto ficou grande demais. Tente outra imagem.");
  }

  // ---------- PRODUTOS (dono) ----------
  const temProdutos = () => (ctx.produtos || []).some(p => p.ativo);
  const fotoProd = p => p.foto_v ? S.fotoURL(ctx.bid, "prod-" + p.id + ".webp", p.foto_v) : null;
  async function prod() {
    try { ctx.produtos = await S.produtos(ctx.bid); } catch (e) { box().innerHTML = `<p class="erro">${esc(e.message)}</p>`; return; }
    const l = ctx.produtos;
    box().innerHTML = `<p class="sub" style="margin-top:0">Os produtos ativos aparecem na sua página, numa vitrine compacta. O barbeiro registra a venda na agenda (“+ Produto”).</p>
      <div id="pLista">${l.length ? l.map(p => `<div class="prod-card ${p.ativo ? "" : "inativo"}" data-id="${esc(p.id)}">
        <div class="miniatura">${fotoProd(p) ? `<img src="${esc(fotoProd(p))}" alt="" width="56" height="56">` : `<span aria-hidden="true">sem foto</span>`}</div>
        <div><b>${esc(p.nome)}</b><small>${money(p.preco)} · ${p.estoque == null ? "sem controle de estoque" : p.estoque === 0 ? "esgotado" : p.estoque + " em estoque"}${p.ativo ? "" : " · oculto"}</small></div>
        <button class="btn btn-mini btn-sec" data-ed>Editar</button></div>`).join("") : `<p class="vazio">Nenhum produto ainda. Cadastre pomadas, óleos, bebidas…</p>`}</div>
      <button class="btn" id="pNovo" style="margin-top:16px;width:100%">+ Novo produto</button>`;
    $("#pNovo").onclick = () => editarProduto({ novo: true, id: crypto.randomUUID ? crypto.randomUUID() : null, nome: "", preco: 0, descricao: "", estoque: null, ativo: true, ordem: l.length });
    $("#pLista").onclick = e => { const c = e.target.closest("[data-id]"); if (c && e.target.closest("[data-ed]")) editarProduto(Object.assign({}, l.find(x => x.id === c.dataset.id))); };
  }
  function editarProduto(p) {
    if (!p.id) return U.toast("Atualize o navegador para cadastrar produtos.");
    let novaFoto = null;
    const m = U.modal(`<h2>${p.novo ? "Novo produto" : "Editar produto"}</h2><form id="fPr" class="form-grid">
      <div class="full foto-linha"><div class="miniatura grande" id="prFotoPrev">${fotoProd(p) ? `<img src="${esc(fotoProd(p))}" alt="" width="88" height="88">` : `<span>sem foto</span>`}</div>
        <button type="button" class="btn btn-mini btn-sec" id="prFoto">${fotoProd(p) ? "Trocar foto" : "Adicionar foto"}</button></div>
      <label class="full">Nome<input name="nome" value="${esc(p.nome)}" maxlength="60" required placeholder="Ex.: Pomada modeladora"></label>
      <label>Preço (R$)<input name="preco" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(p.preco)}" required></label>
      <label>Estoque<input name="estoque" type="number" inputmode="numeric" min="0" step="1" value="${p.estoque == null ? "" : esc(p.estoque)}" placeholder="não controlar"></label>
      <label class="full">Descrição (opcional)<input name="descricao" value="${esc(p.descricao || "")}" maxlength="90" placeholder="Ex.: Efeito matte, 80 g"></label>
      <label class="switch full"><input type="checkbox" name="ativo" ${p.ativo ? "checked" : ""}> Mostrar na página da barbearia</label>
      <p class="erro full" id="prErro"></p>
      <button class="btn full" id="prSalvar">Salvar produto</button>
      ${p.novo ? "" : `<button type="button" class="btn btn-sec perigo-txt full" id="prExcluir">Excluir produto</button>`}
      <button type="button" class="btn btn-sec full" data-fechar>Cancelar</button></form>`);
    m.querySelector("#prFoto").onclick = () => escolherArquivo(async arq => {
      try { novaFoto = await fotoQuadrada(arq, 480); m.querySelector("#prFotoPrev").innerHTML = `<img src="${URL.createObjectURL(novaFoto)}" alt="" width="88" height="88">`; }
      catch (er) { U.toast(er.message); }
    });
    const ex = m.querySelector("#prExcluir");
    if (ex) ex.onclick = async () => { if (ex.dataset.ok !== "1") { ex.dataset.ok = "1"; ex.textContent = "Toque de novo para excluir"; return; }
      try { await S.removerProduto(ctx.bid, p.id); U.fecharModal(); U.toast("Produto excluído."); prod(); } catch (er) { m.querySelector("#prErro").textContent = er.message; } };
    m.querySelector("#fPr").onsubmit = async e => {
      e.preventDefault(); const f = e.target, btn = m.querySelector("#prSalvar"), err = m.querySelector("#prErro");
      if (!f.nome.value.trim()) return err.textContent = "Digite o nome do produto.";
      const est = f.estoque.value.trim() === "" ? null : Math.max(0, Math.floor(Number(f.estoque.value)));
      btn.disabled = true; btn.textContent = "Salvando…";
      try {
        if (novaFoto) { await S.enviarLogo(ctx.bid, [{ nome: "prod-" + p.id + ".webp", blob: novaFoto }]); p.foto_v = Date.now(); }
        await S.salvarProduto(ctx.bid, Object.assign(p, { nome: f.nome.value.trim(), preco: Number(f.preco.value) || 0, descricao: f.descricao.value.trim(), estoque: est, ativo: f.ativo.checked }));
        U.fecharModal(); U.toast("Produto salvo."); prod();
      } catch (er) { err.textContent = er.message; btn.disabled = false; btn.textContent = "Salvar produto"; }
    };
  }
  // registrar venda (no atendimento ou avulsa)
  function vender(agId) {
    const l = (ctx.produtos || []).filter(p => p.ativo); if (!l.length) return U.toast("Cadastre produtos em Mais → Produtos à venda.");
    let sel = (l.find(p => p.estoque !== 0) || {}).id, qtd = 1;
    const profs = ctx.profs.filter(p => p.ativo), escolheProf = !agId && dono() && profs.length > 1;
    const m = U.modal(`<h2>${agId ? "Produto no atendimento" : "Venda avulsa"}</h2><form id="fVd">
      <div class="prod-sel">${l.map(p => `<label class="op ${p.estoque === 0 ? "ocupado" : ""}"><input type="radio" name="p" value="${esc(p.id)}" ${p.id === sel ? "checked" : ""} ${p.estoque === 0 ? "disabled" : ""}>
        <span>${fotoProd(p) ? `<img src="${esc(fotoProd(p))}" alt="" width="44" height="44">` : `<i class="sem" aria-hidden="true"></i>`}<b>${esc(p.nome)}</b><small>${money(p.preco)}${p.estoque === 0 ? " · esgotado" : p.estoque != null ? " · " + p.estoque + " em estoque" : ""}</small></span></label>`).join("")}</div>
      <div class="qtd-linha"><span class="lbl" style="margin:0">Quantidade</span><div class="qtd"><button type="button" class="btn btn-sec btn-mini" data-q="-1" aria-label="Menos">−</button><b id="vdQ">1</b><button type="button" class="btn btn-sec btn-mini" data-q="1" aria-label="Mais">+</button></div></div>
      ${escolheProf ? `<label class="lbl">Vendido por<select name="prof">${profs.map(p => `<option value="${esc(p.id)}" ${p.id === (filtroProf || ctx.prof_id) ? "selected" : ""}>${esc(p.nome)}</option>`).join("")}</select></label>` : ""}
      <p class="erro" id="vdErro"></p><button class="btn btn-grande" id="vdBtn" style="width:100%"></button>
      <button type="button" class="btn btn-sec" data-fechar style="width:100%;margin-top:8px">Cancelar</button></form>`);
    const rot = () => { const p = l.find(x => x.id === sel); m.querySelector("#vdQ").textContent = qtd; m.querySelector("#vdBtn").textContent = p ? `Registrar ${money(p.preco * qtd)}` : "Escolha um produto"; m.querySelector("#vdBtn").disabled = !p; };
    rot();
    m.querySelector(".prod-sel").onchange = e => { sel = e.target.value; qtd = 1; rot(); };
    m.querySelector(".qtd").onclick = e => { const b = e.target.closest("[data-q]"); if (!b) return; const p = l.find(x => x.id === sel), max = p && p.estoque != null ? p.estoque : 99; qtd = Math.min(max, Math.max(1, qtd + Number(b.dataset.q))); rot(); };
    m.querySelector("#fVd").onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      try { await S.registrarVenda({ produto: sel, qtd, ag: agId, prof: f.prof ? f.prof.value : null });
        ctx.produtos = await S.produtos(ctx.bid).catch(() => ctx.produtos); U.fecharModal(); U.toast("Venda registrada."); if (aba === "agenda") listaDia(); }
      catch (er) { m.querySelector("#vdErro").textContent = er.message; }
    };
  }

  async function salvarCfg(patch, nome) {
    try { const c = Object.assign({}, cfg(), patch); await S.salvarBarbearia(ctx.bid, { config: c, nome }); ctx.b.config = c; if (nome) ctx.b.nome = nome; U.toast("Salvo!"); if (nome) desenhar(); }
    catch (err) { U.toast(err.message); }
  }

  // ---------- HORÁRIOS (dono) ----------
  function hor() {
    const c = cfg(), H = JSON.parse(JSON.stringify(c.horarios)), ORDEM = [1, 2, 3, 4, 5, 6, 0];
    const cartao = d => { const h = H[d], pausa = !!(h.almocoIni || h.almocoFim || h._pausa);
      return `<div class="dia-card ${h.aberto ? "" : "fechado"}" data-d="${d}">
        <div class="dia-cab"><b class="dia-nome">${DIAS[d]}</b>
          <span class="dia-resumo">${h.aberto ? `${esc(h.abre)} – ${esc(h.fecha)}${pausa && h.almocoIni ? ` · pausa ${esc(h.almocoIni)}` : ""}` : "Fechado"}</span>
          <label class="toggle"><input type="checkbox" data-k="aberto" ${h.aberto ? "checked" : ""} aria-label="${DIAS[d]} aberto"><span class="trilho" aria-hidden="true"></span></label></div>
        ${h.aberto ? `<div class="dia-corpo">
          <div class="faixa"><label><span>Abre</span><input type="time" data-k="abre" value="${esc(h.abre)}" step="900"></label><span class="ate" aria-hidden="true">→</span>
            <label><span>Fecha</span><input type="time" data-k="fecha" value="${esc(h.fecha)}" step="900"></label></div>
          ${pausa ? `<div class="faixa pausa"><label><span>Pausa de</span><input type="time" data-k="almocoIni" value="${esc(h.almocoIni)}" step="900"></label><span class="ate" aria-hidden="true">→</span>
            <label><span>Volta às</span><input type="time" data-k="almocoFim" value="${esc(h.almocoFim)}" step="900"></label>
            <button type="button" class="lnk sutil remover-pausa" data-a="sem-pausa">Remover pausa</button></div>`
          : `<button type="button" class="lnk" data-a="com-pausa">+ Adicionar pausa (almoço)</button>`}
          <button type="button" class="lnk sutil" data-a="copiar">Usar este horário em todos os dias abertos</button></div>` : ""}</div>`; };
    const desenharH = () => { $("#hDias").innerHTML = ORDEM.map(cartao).join(""); };
    box().innerHTML = `<p class="sub" style="margin-top:0">Toque no botão para abrir ou fechar o dia. Os dias de cada barbeiro ficam em Equipe.</p>
      <div id="hDias" class="dias-lista"></div>
      <h2 style="margin-top:28px">Regras do agendamento</h2><div class="form-grid">
      <label>Intervalo entre horários<select id="hInt">${[10, 15, 20, 30, 40, 45, 60].map(v => `<option ${c.intervalo == v ? "selected" : ""} value="${v}">A cada ${v} min</option>`).join("")}</select></label>
      <label>Antecedência mínima<select id="hAnt">${[0, 15, 30, 60, 120, 180, 1440].map(v => `<option ${c.antecedenciaMin == v ? "selected" : ""} value="${v}">${v === 0 ? "Sem mínimo" : v >= 1440 ? "1 dia antes" : v >= 60 ? v / 60 + " h antes" : v + " min antes"}</option>`).join("")}</select></label>
      <label class="full">Cliente pode agendar com até<select id="hDias2">${[7, 14, 21, 30, 45, 60].map(v => `<option ${c.diasAgenda == v ? "selected" : ""} value="${v}">${v} dias de antecedência</option>`).join("")}</select></label></div>
      <div class="barra-salvar"><button class="btn" id="hSalvar">Salvar horários</button></div>`;
    desenharH();
    $("#hDias").onchange = e => { const k = e.target.dataset.k; if (!k) return; const d = e.target.closest("[data-d]").dataset.d;
      H[d][k] = e.target.type === "checkbox" ? e.target.checked : e.target.value; if (k === "aberto") desenharH(); else e.target.closest(".dia-card").querySelector(".dia-resumo").textContent = `${H[d].abre} – ${H[d].fecha}${H[d].almocoIni ? " · pausa " + H[d].almocoIni : ""}`; };
    $("#hDias").onclick = e => { const b = e.target.closest("[data-a]"); if (!b) return; const d = b.closest("[data-d]").dataset.d, h = H[d];
      if (b.dataset.a === "com-pausa") { h.almocoIni = "12:00"; h.almocoFim = "13:00"; }
      if (b.dataset.a === "sem-pausa") { h.almocoIni = ""; h.almocoFim = ""; }
      if (b.dataset.a === "copiar") { ORDEM.forEach(x => { if (H[x].aberto && x != d) Object.assign(H[x], { abre: h.abre, fecha: h.fecha, almocoIni: h.almocoIni, almocoFim: h.almocoFim }); }); U.toast("Copiado para os dias abertos. Toque em Salvar."); }
      desenharH(); };
    $("#hSalvar").onclick = () => {
      for (const d of ORDEM) { const h = H[d]; delete h._pausa;
        if (h.aberto && (!h.abre || !h.fecha || h.abre >= h.fecha)) return U.toast(`${DIAS[d]}: o horário de fechar precisa ser depois do de abrir.`);
        if ((h.almocoIni && !h.almocoFim) || (!h.almocoIni && h.almocoFim)) return U.toast(`${DIAS[d]}: preencha o início e a volta da pausa.`);
        if (h.almocoIni && (h.almocoIni >= h.almocoFim || h.almocoIni < h.abre || h.almocoFim > h.fecha)) return U.toast(`${DIAS[d]}: a pausa precisa ficar dentro do horário aberto.`); }
      salvarCfg({ horarios: H, intervalo: +$("#hInt").value, antecedenciaMin: +$("#hAnt").value, diasAgenda: +$("#hDias2").value });
    };
  }

  // ---------- ASSINATURA (dono) — cobrança recorrente pelo Asaas ----------
  const FORMAS = { CREDIT_CARD: "Cartão de crédito", PIX: "Pix", BOLETO: "Boleto" };
  const ST_FAT = { PENDING: ["Em aberto", "agendado"], OVERDUE: ["Vencida", "cancelado"], RECEIVED: ["Paga", "concluido"], CONFIRMED: ["Paga", "concluido"],
    RECEIVED_IN_CASH: ["Paga", "concluido"], REFUNDED: ["Estornada", "cancelado"], REFUND_REQUESTED: ["Estorno pedido", "cancelado"],
    CHARGEBACK_REQUESTED: ["Contestada", "cancelado"], AWAITING_RISK_ANALYSIS: ["Em análise", "agendado"] };
  const mascaraDoc = v => { const d = U.soDig(v).slice(0, 14);
    return d.length <= 11 ? d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      : d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2"); };
  async function assin() {
    const b = ctx.b, se = A.statusEfetivo(b, U.hoje());
    box().innerHTML = `<p class="vazio">Carregando assinatura…</p>`;
    let planos = [], info = { assinatura: null, faturas: [] }, erroInfo = "";
    try { planos = await U.planos(); } catch (e) { box().innerHTML = `<p class="erro">${esc(e.message)}</p>`; return; }
    if (b.asaas_subscription_id) { try { info = await S.assinatura(ctx.bid, "info"); } catch (e) { erroInfo = e.message; } }
    if (aba !== "assin") return;
    const plano = planos.find(p => p.id === b.plano) || { nome: b.plano, preco: 0 };
    const dias = b.vence_em ? Math.round((A.parseYMD(b.vence_em) - A.parseYMD(U.hoje())) / 864e5) : null;
    const sub = info.assinatura, abertas = info.faturas.filter(f => ["PENDING", "OVERDUE"].includes(f.status));
    let linha = "";
    if (b.status === "teste" && !b.asaas_subscription_id) linha = dias >= 0 ? `Teste grátis até <b>${esc(fmtData(b.vence_em, true))}</b> (${dias === 0 ? "termina hoje" : dias + " dia(s)"})` : `Seu teste terminou em <b>${esc(fmtData(b.vence_em, true))}</b>`;
    else if (b.vence_em) linha = dias >= 0 ? `Liberada até <b>${esc(fmtData(b.vence_em, true))}</b>` : `Venceu em <b>${esc(fmtData(b.vence_em, true))}</b>`;
    box().innerHTML = `<div class="assin-card st-${esc(se)}">
        <div class="assin-top"><div><small>Seu plano</small><p class="quando">${esc(plano.nome)}</p></div>
        <span class="tag ${A.liberada(b, U.hoje()) ? (se === "carencia" ? "cancelado" : "concluido") : "cancelado"}">${esc(STATUS[se] || se)}</span></div>
        <p>${linha}</p>
        ${sub ? `<p class="sub">${esc(FORMAS[sub.forma] || sub.forma)} · ${money(sub.valor)}/mês${sub.proxima ? ` · próxima cobrança ${esc(fmtData(sub.proxima))}` : ""}${sub.forma === "CREDIT_CARD" ? " · débito automático" : ""}</p>` : ""}
        ${abertas.length ? `<a class="btn btn-ok" target="_blank" rel="noopener" href="${esc(abertas[abertas.length - 1].url)}">Pagar fatura de ${money(abertas[abertas.length - 1].valor)}</a>` : ""}
      </div>
      ${erroInfo ? `<p class="aviso ruim">Não foi possível consultar a cobrança agora: ${esc(erroInfo)}</p>` : ""}
      ${b.asaas_subscription_id ? `
        <h2>Faturas</h2>${info.faturas.length ? `<div class="faturas">${info.faturas.map(f => { const [t, cl] = ST_FAT[f.status] || [f.status, ""];
          return `<div class="fatura"><div><b>${money(f.valor)}</b><small>Vence ${esc(fmtData(f.vencimento))} · ${esc(FORMAS[f.forma] || f.forma || "")}${f.pago_em ? " · paga " + esc(fmtData(f.pago_em)) : ""}</small></div>
            <span class="tag ${cl}">${esc(t)}</span>${f.url ? `<a class="btn btn-mini ${["PENDING", "OVERDUE"].includes(f.status) ? "btn-ok" : "btn-sec"}" target="_blank" rel="noopener" href="${esc(f.url)}">${["PENDING", "OVERDUE"].includes(f.status) ? "Pagar" : "Ver"}</a>` : ""}</div>`; }).join("")}</div>` : `<p class="vazio">Nenhuma fatura ainda.</p>`}
        <div class="seg" style="margin-top:18px"><button class="btn btn-sec" id="aTrocar">Trocar plano ou forma de pagamento</button><button class="btn btn-sec perigo-txt" id="aCancelar">Cancelar assinatura</button></div>`
      : `<h2>Assinar o ${esc(P.nome)}</h2><div id="aForm"></div>`}`;
    if (!b.asaas_subscription_id) formAssinar(planos, false);
    const tr = $("#aTrocar"); if (tr) tr.onclick = () => { const m = U.modal(`<h2>Trocar plano ou pagamento</h2><div id="aForm"></div>`); formAssinar(planos, true, m); };
    const cc = $("#aCancelar"); if (cc) cc.onclick = () => {
      const m = U.modal(`<h2>Cancelar assinatura?</h2><p>Não haverá novas cobranças. Sua agenda online continua funcionando até <b>${esc(b.vence_em ? fmtData(b.vence_em, true) : "o fim do período pago")}</b> e depois pausa. Seus dados ficam guardados.</p>
        <div class="pilha"><button class="btn" id="cSim">Cancelar assinatura</button><button class="btn btn-sec" data-fechar>Manter assinatura</button></div>`);
      m.querySelector("#cSim").onclick = async () => { try { await S.assinatura(ctx.bid, "cancelar"); U.fecharModal(); U.toast("Assinatura cancelada."); ctx.b = await S.barbearia(ctx.bid); desenhar(); } catch (e) { U.toast(e.message); } };
    };
  }
  function formAssinar(planos, troca, raiz) {
    const b = ctx.b, el = (raiz || document).querySelector("#aForm");
    let sel = planos.some(p => p.id === b.plano) ? b.plano : (planos[0] || {}).id, forma = b.forma_pagamento || "CREDIT_CARD";
    const ativos = ctx.profs.filter(p => p.ativo).length;
    el.innerHTML = `<form id="fAss" novalidate>
      <fieldset><legend class="leg-p">Plano</legend><div class="planos-sel">${planos.map(p => { const cabe = !p.max_prof || ativos <= p.max_prof;
        return `<label class="op ${cabe ? "" : "ocupado"}"><input type="radio" name="plano" value="${esc(p.id)}" ${p.id === sel ? "checked" : ""} ${cabe ? "" : "disabled"}>
          <span><b>${esc(p.nome)}</b><span class="preco-op">${money(p.preco)}<small>/mês</small></span><small>${p.max_prof ? `Até ${p.max_prof} barbeiro${p.max_prof > 1 ? "s" : ""}` : "Barbeiros ilimitados"}${cabe ? "" : ` · você tem ${ativos}`}</small></span></label>`; }).join("")}</div></fieldset>
      <fieldset><legend class="leg-p">Forma de pagamento</legend><div class="formas">
        ${[["CREDIT_CARD", "Cartão de crédito", "Cobrança automática todo mês. Você não precisa lembrar."], ["PIX", "Pix", "Fatura todo mês por e-mail; pode virar Pix Automático."], ["BOLETO", "Boleto", "Fatura todo mês por e-mail. Compensa em até 3 dias úteis."]]
          .map(([v, t, d]) => `<label class="op"><input type="radio" name="forma" value="${v}" ${v === forma ? "checked" : ""}><span><b>${t}${v === "CREDIT_CARD" ? ` <em class="rec">recomendado</em>` : ""}</b><small class="quebra">${d}</small></span></label>`).join("")}</div></fieldset>
      ${b.asaas_customer_id ? "" : `<div class="form-grid">
        <label>CPF ou CNPJ do responsável<input name="doc" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" maxlength="18" required></label>
        <label>Celular (opcional)<input name="tel" type="tel" inputmode="tel" autocomplete="tel" placeholder="(38) 99999-0000"></label></div>`}
      <p class="sub">${troca ? "A mudança vale para as faturas em aberto e as próximas." : b.status === "teste" && b.vence_em >= U.hoje() ? `Seus dias de teste continuam valendo: a 1ª mensalidade vence em <b>${esc(fmtData(b.vence_em))}</b>. Se pagar antes, o mês pago começa no fim do teste.` : "A 1ª mensalidade vence hoje e libera sua agenda assim que o pagamento for confirmado."}
        O pagamento é feito na página segura do Asaas: o ${esc(P.nome)} não vê os dados do seu cartão.</p>
      <p class="erro" id="aErro" role="alert"></p>
      <button class="btn btn-grande" id="aBtn" style="width:100%"></button>${troca ? `<button type="button" class="btn btn-sec" data-fechar style="width:100%;margin-top:8px">Voltar</button>` : ""}</form>`;
    const f = el.querySelector("#fAss"), btn = el.querySelector("#aBtn");
    const rot = () => { const p = planos.find(x => x.id === sel); btn.textContent = p ? `${troca ? "Confirmar" : "Assinar"} ${p.nome} · ${money(p.preco)}/mês` : "Escolha um plano"; };
    rot();
    f.onchange = e => { if (e.target.name === "plano") sel = e.target.value; if (e.target.name === "forma") forma = e.target.value; rot(); };
    if (f.doc) f.doc.oninput = () => { f.doc.value = mascaraDoc(f.doc.value); };
    f.onsubmit = async e => {
      e.preventDefault(); const err = el.querySelector("#aErro"); err.textContent = "";
      if (f.doc && ![11, 14].includes(U.soDig(f.doc.value).length)) { err.textContent = "Digite o CPF (11 números) ou CNPJ (14 números)."; return; }
      btn.disabled = true; btn.textContent = "Gerando cobrança…";
      try {
        const r = await S.assinatura(ctx.bid, "assinar", { plano: sel, forma, cpfCnpj: f.doc ? f.doc.value : undefined, telefone: f.tel ? f.tel.value : undefined, nome: (S.usuario() || {}).email });
        ctx.b = await S.barbearia(ctx.bid); U.ls.set("lk_planos", null);
        const m = U.modal(`<h2>${troca ? "Assinatura atualizada" : "Falta só pagar"}</h2>
          <p>${r.url ? (forma === "CREDIT_CARD" ? "Cadastre o cartão na página do Asaas. As próximas mensalidades são cobradas sozinhas." : "Pague a fatura na página do Asaas. As próximas chegam por e-mail todo mês.") : "Tudo certo. As próximas faturas seguem a nova configuração."}</p>
          <div class="pilha">${r.url ? `<a class="btn btn-ok btn-grande" target="_blank" rel="noopener" href="${esc(r.url)}">Ir para o pagamento</a>` : ""}
          <button class="btn btn-sec" id="jaPaguei">${r.url ? "Já paguei" : "Fechar"}</button></div>`);
        m.querySelector("#jaPaguei").onclick = () => { U.fecharModal(); aguardarPagamento(); };
      } catch (er) { err.textContent = er.message; btn.disabled = false; rot(); }
    };
  }
  // o webhook do Asaas libera a barbearia; aqui só esperamos a confirmação aparecer
  async function aguardarPagamento() {
    const antes = ctx.b.vence_em; aba = "assin"; desenhar();
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try { const b = await S.barbearia(ctx.bid); if (b.vence_em !== antes || b.status !== ctx.b.status) { ctx.b = b; U.toast("Pagamento confirmado!"); if (aba === "assin") desenhar(); return; } } catch {}
    }
    if (aba === "assin") U.toast("Assim que o Asaas confirmar, a assinatura atualiza sozinha. Pix e cartão costumam levar segundos; boleto, até 3 dias úteis.");
  }

  // ---------- ÍCONE DA BARBEARIA ----------
  // Gera 3 PNGs no próprio navegador: 512 e 192 (ícone e topo) e 512 "maskable" (Android recorta em círculo/gota).
  function carregarImagem(arq) {
    return new Promise((ok, falha) => { const img = new Image(); img.onload = () => ok(img); img.onerror = () => falha(new Error("Não consegui abrir essa imagem.")); img.src = URL.createObjectURL(arq); });
  }
  function desenharIcone(img, tam, { modo, fundo, zoom = 1, margem = 0 }) {
    const c = document.createElement("canvas"); c.width = c.height = tam; const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    if (modo === "caber" || margem) { g.fillStyle = fundo; g.fillRect(0, 0, tam, tam); }
    const area = tam * (1 - margem * 2), lado = modo === "preencher" ? Math.min(img.width, img.height) : Math.max(img.width, img.height);
    const esc_ = (area / lado) * (modo === "preencher" ? zoom : zoom * 0.86), w = img.width * esc_, h = img.height * esc_;
    g.drawImage(img, (tam - w) / 2, (tam - h) / 2, w, h);
    return c;
  }
  const blobDe = c => new Promise(ok => c.toBlob(ok, "image/png"));
  async function escolherIcone() {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp";
    inp.onchange = async () => {
      const arq = inp.files[0]; if (!arq) return;
      if (arq.size > 8 * 1024 * 1024) return U.toast("Imagem muito grande (máximo 8 MB).");
      let img; try { img = await carregarImagem(arq); } catch (e) { return U.toast(e.message); }
      const op = { modo: Math.abs(img.width - img.height) / Math.max(img.width, img.height) < 0.08 ? "preencher" : "caber", fundo: "#ffffff", zoom: 1 };
      const m = U.modal(`<h2>Ícone da barbearia</h2><p class="sub" style="margin-top:-6px">Aparece no app instalado do cliente, no topo da página e no painel.</p>
        <div class="icone-prev"><div class="cel-ic"><canvas id="pvApp" width="192" height="192"></canvas><small>${esc(ctx.b.nome.slice(0, 14))}</small></div>
          <div class="topo-ic"><canvas id="pvTopo" width="192" height="192"></canvas><b>${esc(ctx.b.nome)}</b></div></div>
        <div class="seg" role="radiogroup" aria-label="Ajuste"><button class="chip" data-modo="preencher">Preencher</button><button class="chip" data-modo="caber">Mostrar inteira</button></div>
        <label class="lbl">Zoom<input type="range" id="icZoom" min="0.6" max="2" step="0.02" value="1"></label>
        <div class="lbl" id="icFundoBox">Cor de fundo <div class="cores">${["#ffffff", "#16181d", "#c8102e", "#1b3a6b", "#f2c14e", "#0f5132"].map(c => `<button class="cor" data-cor="${c}" style="background:${c}" aria-label="Fundo ${c}"></button>`).join("")}<input type="color" id="icCor" value="#ffffff" aria-label="Outra cor"></div></div>
        <p class="erro" id="icErro"></p>
        <div class="pilha"><button class="btn" id="icSalvar">Usar este ícone</button><button class="btn btn-sec" data-fechar>Cancelar</button></div>`);
      const atual = () => { ["pvApp", "pvTopo"].forEach(id => { const cv = m.querySelector("#" + id), g = cv.getContext("2d"); g.clearRect(0, 0, 192, 192); g.drawImage(desenharIcone(img, 192, op), 0, 0); });
        m.querySelectorAll("[data-modo]").forEach(b => b.classList.toggle("on", b.dataset.modo === op.modo));
        m.querySelectorAll("[data-cor]").forEach(b => b.classList.toggle("on", b.dataset.cor === op.fundo)); };
      atual();
      m.querySelector(".seg").onclick = e => { const b = e.target.closest("[data-modo]"); if (b) { op.modo = b.dataset.modo; atual(); } };
      m.querySelector("#icZoom").oninput = e => { op.zoom = +e.target.value; atual(); };
      m.querySelector(".cores").onclick = e => { const b = e.target.closest("[data-cor]"); if (b) { op.fundo = b.dataset.cor; atual(); } };
      m.querySelector("#icCor").oninput = e => { op.fundo = e.target.value; atual(); };
      m.querySelector("#icSalvar").onclick = async ev => {
        const btn = ev.target; btn.disabled = true; btn.textContent = "Enviando…";
        try {
          const fundoMask = op.modo === "caber" ? op.fundo : op.fundo;
          const arqs = [{ nome: "icon-512.png", blob: await blobDe(desenharIcone(img, 512, op)) }, { nome: "icon-192.png", blob: await blobDe(desenharIcone(img, 192, op)) },
            { nome: "maskable-512.png", blob: await blobDe(desenharIcone(img, 512, Object.assign({}, op, { modo: "caber", fundo: fundoMask, margem: 0.1, zoom: op.modo === "preencher" ? op.zoom * 1.16 : op.zoom }))) }];
          await S.enviarLogo(ctx.bid, arqs);
          await salvarCfg({ logo: { v: Date.now(), fundo: op.fundo } });
          U.fecharModal(); desenhar();
        } catch (e) { m.querySelector("#icErro").textContent = e.message; btn.disabled = false; btn.textContent = "Usar este ícone"; }
      };
    };
    inp.click();
  }

  // ---------- AJUSTES (dono) ----------
  function aj() {
    const c = cfg(), link = U.abs("/" + ctx.b.slug);
    const ic = U.iconesDe(ctx.bid, c.logo);
    const capa = c.capa && c.capa.v ? S.fotoURL(ctx.bid, "capa.webp", c.capa.v) : null, esc0 = c.capa && c.capa.escurecer != null ? c.capa.escurecer : 55;
    box().innerHTML = `<h2>Capa da página</h2>
      <p class="sub" style="margin-top:0">Uma foto da sua barbearia no topo da página que o cliente abre. Fica atrás do nome, escurecida para o texto aparecer bem.</p>
      <div class="capa-prev" id="capaPrev" style="${capa ? `background:#111 url('${esc(capa)}') center/cover no-repeat;` : ""}--capa-op:${esc0 / 100}"><small id="capaAviso">${capa ? "Prévia" : "Sem capa: aparece o fundo padrão"}</small><b>${esc(ctx.b.nome)}</b></div>
      <label class="capa-op">Escurecer<input type="range" id="capaOp" min="0" max="90" step="5" value="${esc0}" aria-label="Quanto escurecer a capa"><output id="capaOpV">${esc0}%</output></label>
      <div class="seg" style="margin:8px 0 0"><button class="btn btn-mini" id="ajCapa">${capa ? "Trocar foto" : "Enviar foto"}</button>
        <button class="btn btn-mini btn-sec" id="ajCapaSalvar" hidden>Salvar escurecimento</button>
        ${capa ? `<button class="btn btn-mini btn-sec" id="ajSemCapa">Remover capa</button>` : ""}</div>
      <h2 style="margin-top:28px">Ícone da barbearia</h2>
      <div class="icone-atual"><div class="ic-grande">${ic ? `<img src="${esc(ic.i192)}" alt="Ícone atual" width="88" height="88">` : `<img src="icons/icon-192.png" alt="Ícone padrão" width="88" height="88">`}</div>
        <div><p class="sub" style="margin:0 0 10px">${ic ? "Este é o ícone do app instalado pelos seus clientes." : "Sem ícone próprio: os clientes veem o poste de barbeiro."} Use o logo em PNG ou JPG, de preferência quadrado.</p>
        <div class="seg" style="margin:0"><button class="btn btn-mini" id="ajIcone">${ic ? "Trocar ícone" : "Enviar ícone"}</button>${ic ? `<button class="btn btn-mini btn-sec" id="ajSemIcone">Remover</button>` : ""}</div></div></div>
      <h2 style="margin-top:28px">Seu link</h2>
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
    $("#ajIcone").onclick = escolherIcone;
    // capa: prévia ao vivo do escurecimento; a foto é reduzida e comprimida no próprio celular antes de subir
    const prevCapa = $("#capaPrev"), opIn = $("#capaOp"), btSalvarOp = $("#ajCapaSalvar");
    opIn.oninput = () => { prevCapa.style.setProperty("--capa-op", opIn.value / 100); $("#capaOpV").textContent = opIn.value + "%"; if (capa) btSalvarOp.hidden = Number(opIn.value) === esc0; };
    btSalvarOp.onclick = async () => { await salvarCfg({ capa: Object.assign({}, c.capa, { escurecer: Number(opIn.value) }) }); aj(); };
    $("#ajCapa").onclick = () => escolherArquivo(async arq => {
      const bt = $("#ajCapa"); bt.disabled = true; bt.textContent = "Enviando…";
      try {
        const blob = await fotoCapa(arq);
        await S.enviarLogo(ctx.bid, [{ nome: "capa.webp", blob }]);
        await salvarCfg({ capa: { v: Date.now(), escurecer: Number(opIn.value) } }); aj();
      } catch (er) { U.toast(er.message || "Não foi possível enviar a foto."); bt.disabled = false; bt.textContent = capa ? "Trocar foto" : "Enviar foto"; }
    });
    const sc = $("#ajSemCapa"); if (sc) sc.onclick = async () => { await salvarCfg({ capa: null }); aj(); };
    const si = $("#ajSemIcone"); if (si) si.onclick = async () => { await salvarCfg({ logo: null }); desenhar(); };
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
