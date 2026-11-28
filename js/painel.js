{
  const U = window.UI, S = window.Store, A = window.Agenda, P = window.PLATAFORMA;
  const { esc, money, $, ls, fmtData, durTxt, wa, DIAS, cap } = U;
  const app = () => $("#app");
  const ROT = { agendado: "Agendado", concluido: "Concluído", cancelado: "Cancelado", faltou: "Faltou" };
  const STATUS = { teste: "Teste grátis", ativa: "Ativa", carencia: "Pagamento pendente", bloqueada: "Bloqueada", teste_vencido: "Teste encerrado", vencida: "Vencida" };
  let ctx = null, aba = "agenda", dia = U.hoje(), filtroProf = "", periodo = "30", timer = null, conhecidos = null, modoAg = "dia", diasProx = 14, subRel = "fin", mesFin = U.hoje().slice(0, 7);
  const dono = () => ctx.papel === "dono" || ctx.papel === "super";
  const cfg = () => ctx.b.config;
  const nomeProf = id => (ctx.profs.find(p => p.id === id) || {}).nome || "—";

  function parar() { clearInterval(timer); timer = null; }

  let avisoCad = "";
  async function render() {
    parar(); U.manifestPadrao(); document.title = "Painel · " + P.nome;
    U.rodapeHTML(`<span>${esc(P.nome)}</span>`);
    if (location.hash.length > 20) {
      try { const tipo = await S.capturarRetornoAuth(); if (tipo === "recovery") return novaSenha(); if (tipo) U.toast("E-mail confirmado!"); }
      catch (e) { U.toast(e.message); }
    }
    if (!S.logado()) return login();
    U.moldura({ marca: "Painel", marcaHref: "/painel" });
    app().innerHTML = `<p class="vazio band">Carregando…</p>`;
    try {
      const conv = new URLSearchParams(location.search).get("convite") || ls.get("bb_convite_pendente", "");
      if (conv) { try { await S.aceitarConvite(conv); U.toast("Convite aceito!"); } catch (e) { U.toast(e.message); } ls.set("bb_convite_pendente", ""); if (location.search) history.replaceState({}, "", U.url("/painel")); }
      let acessos = await S.acessos();
      avisoCad = "";
      if (!acessos.length) {
        let criou = null;
        try { criou = await S.criarPendente(); }
        catch (e) { avisoCad = /slug|uso/i.test(e.message) ? "O endereço escolhido no cadastro foi usado por outra barbearia. Crie a sua com outro endereço." : e.message; }
        const pend = ls.get("bb_cad_pendente", null);
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

  function desenhar() {
    parar();
    const tabs = dono()
      ? [{ id: "agenda", txt: "Agenda" }, { id: "bloq", txt: "Bloqueios" }, { id: "rel", txt: "Relatórios" }, { id: "cli", txt: "Clientes" }, { id: "mais", txt: "Mais" }]
      : [{ id: "agenda", txt: "Agenda" }, { id: "bloq", txt: "Folgas" }, { id: "rel", txt: "Ganhos" }, { id: "cli", txt: "Clientes" }, { id: "mais", txt: "Mais" }];
    const extras = ["equipe", "serv", "prod", "plan", "hor", "assin", "aj"];
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
      equipe: "Equipe", serv: "Serviços", plan: "Planos de fidelidade", hor: "Horários", assin: "Assinatura", aj: "Ajustes" };
    app().innerHTML = `<div class="p-top"><h1>${titulos[aba]}</h1>${!dono() ? `<span class="tag">Barbeiro · ${esc(nomeProf(ctx.prof_id))}</span>` : ""}</div>
      <div class="p-sec">${aviso}<div id="pc"></div></div>`;
    app().querySelectorAll("[data-ir]").forEach(b => b.onclick = () => { aba = b.dataset.ir; desenhar(); });
    const fn = { agenda, bloq, rel, cli, equipe, serv, prod, plan, hor, assin, aj }[aba];
    if ((["equipe", "serv", "prod", "plan", "hor", "assin", "aj"].includes(aba)) && !dono()) { aba = "agenda"; return desenhar(); }
    fn();
  }
  const box = () => $("#pc");

  function menuMais() {
    const it = dono()
      ? [["equipe", "Equipe e acessos"], ["serv", "Serviços, preços e fotos"], ["prod", "Produtos à venda"], ["plan", "Planos de fidelidade"], ["hor", "Horários de funcionamento"], ["assin", "Assinatura"], ["aj", "Capa, ícone, dados, link e QR Code"]]
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

  async function agenda() {
    const profsAt = ctx.profs.filter(p => p.ativo);
    box().innerHTML = `<div class="seg ag-modo" id="agModo" role="tablist"><button class="chip ${modoAg === "dia" ? "on" : ""}" data-m="dia" role="tab" aria-selected="${modoAg === "dia"}">Dia</button><button class="chip ${modoAg === "prox" ? "on" : ""}" data-m="prox" role="tab" aria-selected="${modoAg === "prox"}">Próximos dias</button></div>
      ${dono() && profsAt.length > 1 ? `<div class="seg chips-filtro" id="fProf">${[{ id: "", nome: "Todos" }].concat(profsAt).map(p => `<button class="chip chip-sm ${filtroProf === p.id ? "on" : ""}" data-p="${esc(p.id)}">${esc(p.nome)}</button>`).join("")}</div>` : ""}
      <div id="agCorpo"></div>`;
    $("#agModo").onclick = e => { const b = e.target.closest("[data-m]"); if (b && b.dataset.m !== modoAg) { modoAg = b.dataset.m; agenda(); } };
    const fp = $("#fProf"); if (fp) fp.onclick = e => { const b = e.target.closest("[data-p]"); if (b) { filtroProf = b.dataset.p; agenda(); } };
    if (modoAg === "prox") return proximos();
    $("#agCorpo").innerHTML = `<div class="dia-topo">
        <button class="btn btn-sec dia-seta" id="dAnt" aria-label="Dia anterior">‹</button>
        <button class="dia-tit" id="dTit" type="button" aria-label="Escolher data"><b id="aTit"></b><small id="aSub"></small></button>
        <input type="date" id="dSel" value="${dia}" tabindex="-1" aria-hidden="true">
        <button class="btn btn-sec dia-seta" id="dProx" aria-label="Próximo dia">›</button></div>
      <div class="seg ag-atalhos">${dia !== U.hoje() ? `<button class="btn btn-mini btn-sec" id="dHoje">Voltar para hoje</button>` : ""}<button class="btn btn-mini" id="dEnc">+ Encaixe</button>${temProdutos() ? `<button class="btn btn-mini btn-sec" id="dVenda">+ Venda avulsa</button>` : ""}</div>
      <div id="aProx"></div><div id="aResumo" class="ag-resumo"></div><div id="aLista"><p class="vazio">Carregando…</p></div>`;
    const ir = d => { dia = d; agenda(); }, sel = $("#dSel");
    $("#dAnt").onclick = () => ir(A.addDays(dia, -1)); $("#dProx").onclick = () => ir(A.addDays(dia, 1));
    $("#dTit").onclick = () => { try { sel.showPicker(); } catch { sel.focus(); sel.click(); } };
    sel.onchange = e => e.target.value && ir(e.target.value);
    const dh = $("#dHoje"); if (dh) dh.onclick = () => ir(U.hoje());
    $("#dEnc").onclick = () => encaixe();
    const dv = $("#dVenda"); if (dv) dv.onclick = () => vender(null);
    await listaDia();
    timer = setInterval(() => { if (!document.hidden && aba === "agenda" && modoAg === "dia" && U.partes()[0] === "painel") listaDia(true); }, 30000);
  }

  const relDia = d => d === U.hoje() ? "Hoje" : d === A.addDays(U.hoje(), 1) ? "Amanhã" : d === A.addDays(U.hoje(), -1) ? "Ontem" : "";
  const agoraMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
  const faltaTxt = m => m <= 0 ? "agora" : m < 60 ? `em ${m} min` : `em ${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;

  // espaços livres do dia (só quando dá pra saber de qual barbeiro)
  function livresDoDia(ags, blq, profId) {
    const h = cfg().horarios[A.dow(dia)], prof = ctx.profs.find(p => p.id === profId);
    if (!h || !h.aberto || !prof || !A.trabalha(prof, dia) || dia < U.hoje()) return [];
    if (blq.some(b => !b.ini && (!b.prof_id || b.prof_id === profId))) return [];
    const T = A.toMin, janelas = h.almocoIni && h.almocoFim ? [[T(h.abre), T(h.almocoIni)], [T(h.almocoFim), T(h.fecha)]] : [[T(h.abre), T(h.fecha)]];
    const ocup = ags.filter(a => a.prof_id === profId && ["agendado", "concluido"].includes(a.status)).map(a => [T(a.hora), T(a.hora) + a.dur])
      .concat(blq.filter(b => b.ini && (!b.prof_id || b.prof_id === profId)).map(b => [T(b.ini), T(b.fim)])).sort((x, y) => x[0] - y[0]);
    const minimo = dia === U.hoje() ? Math.ceil(agoraMin() / 5) * 5 : 0, passo = Math.max(15, cfg().intervalo || 30), out = [];
    janelas.forEach(([ini, fim]) => {
      let t = Math.max(ini, minimo);
      ocup.forEach(([oi, of]) => { if (of <= t || oi >= fim) return; if (oi - t >= passo) out.push([t, Math.min(oi, fim)]); t = Math.max(t, of); });
      if (fim - t >= passo) out.push([t, fim]);
    });
    return out.map(([i, f]) => ({ ini: A.toHM(i), fim: A.toHM(f) }));
  }

  async function listaDia(silencioso) {
    let ags, blq, vendas;
    const pf = dono() ? filtroProf : ctx.prof_id;
    try { [ags, blq, vendas] = await Promise.all([S.listar(ctx.bid, dia, dia, pf || undefined), S.bloqueios(ctx.bid, dia), S.vendas(ctx.bid, dia, dia, pf || undefined).catch(() => [])]); }
    catch (e) { if (!silencioso && $("#aLista")) $("#aLista").innerHTML = `<p class="erro">${esc(e.message)}</p>`; return; }
    if (!$("#aLista")) return;
    novosAvisos(ags);
    blq = blq.filter(b => b.data === dia && (!pf || !b.prof_id || b.prof_id === pf));
    const r = relDia(dia);
    $("#aTit").textContent = r || cap(fmtData(dia, true).split(",")[0]);
    $("#aSub").textContent = r ? fmtData(dia, true) : fmtData(dia, true).split(",").slice(1).join(",").trim();

    const vivos = ags.filter(a => a.status === "agendado" || a.status === "concluido");
    const recebido = ags.filter(a => a.status === "concluido").reduce((s, a) => s + a.preco, 0), aReceber = ags.filter(a => a.status === "agendado").reduce((s, a) => s + a.preco, 0);
    const totProd = vendas.reduce((t, v) => t + v.preco * v.qtd, 0);
    $("#aResumo").innerHTML = `<span><b>${vivos.length}</b> ${vivos.length === 1 ? "cliente" : "clientes"}</span><span><b>${money(recebido)}</b> recebido</span><span><b>${money(aReceber)}</b> a receber</span>${totProd ? `<span><b>${money(totProd)}</b> em produtos</span>` : ""}`;

    const ehHoje = dia === U.hoje(), agora = agoraMin(), T = A.toMin;
    const pend = ags.filter(a => a.status === "agendado").sort((x, y) => x.hora.localeCompare(y.hora));
    const prox = ehHoje ? pend.find(a => T(a.hora) + a.dur > agora) : null;
    const mostraProf = dono() && !filtroProf && ctx.profs.length > 1;
    $("#aProx").innerHTML = prox ? `<div class="prox-card" data-id="${esc(prox.id)}"><small>${T(prox.hora) <= agora ? "Atendendo agora" : "Próximo cliente · " + faltaTxt(T(prox.hora) - agora)}</small>
        <div class="pxc-l"><b class="pxc-h">${esc(prox.hora)}</b><div><b class="pxc-n">${esc(prox.nome)}</b><span>${esc(prox.servico_nome)} · ${prox.assinante_id ? "pelo plano" : money(prox.preco)}${mostraProf ? " · " + esc(nomeProf(prox.prof_id)) : ""}</span></div></div>
        <div class="acoes"><button class="btn btn-mini btn-ok" data-s="concluido">Concluir</button><button class="btn btn-mini btn-sec" data-abrir>Mais opções</button>${prox.telefone ? `<a class="btn btn-mini btn-sec" target="_blank" rel="noopener" href="${esc(wa(prox.telefone, `Olá ${prox.nome}! Seu horário na ${ctx.b.nome} é hoje às ${prox.hora}.`))}">WhatsApp</a>` : ""}</div></div>`
      : (ehHoje && vivos.length && !pend.length ? `<p class="aviso ok-aviso">Todos os clientes de hoje foram atendidos.</p>` : "");

    const profLivre = pf || (ctx.profs.filter(p => p.ativo).length === 1 ? ctx.profs.filter(p => p.ativo)[0].id : "");
    const h = cfg().horarios[A.dow(dia)];
    const itens = ags.filter(a => a.status !== "cancelado").map(a => ({ t: a.hora, tipo: "ag", a }))
      .concat(blq.map(b => ({ t: b.ini || "00:00", tipo: "blq", b })))
      .concat(profLivre ? livresDoDia(ags, blq, profLivre).map(l => ({ t: l.ini, tipo: "livre", l })) : []);
    if (h && h.aberto && h.almocoIni) itens.push({ t: h.almocoIni, tipo: "alm" });
    itens.sort((x, y) => x.t.localeCompare(y.t) || (x.tipo === "livre") - (y.tipo === "livre"));
    const canc = ags.filter(a => a.status === "cancelado"), avulsas = vendas.filter(v => !v.agendamento_id);
    const lista = $("#aLista");
    if (!itens.some(i => i.tipo === "ag" || i.tipo === "livre" || i.tipo === "blq") && !canc.length && !avulsas.length) {
      lista.innerHTML = `<p class="vazio">${h && h.aberto ? "Nenhum agendamento neste dia." : "Barbearia fechada neste dia."}</p>`; lista.onclick = null; return;
    }
    const linha = a => {
      const atras = ehHoje && a.status === "agendado" && T(a.hora) + a.dur <= agora, vs = vendas.filter(v => v.agendamento_id === a.id);
      return `<div class="ag-row st-${esc(a.status)}${atras ? " atrasado" : ""}" data-id="${esc(a.id)}" role="button" tabindex="0" aria-label="${esc(a.hora)}, ${esc(a.nome)}, ${esc(ROT[a.status] || a.status)}">
        <span class="ag-h">${esc(a.hora)}<small>${esc(durTxt(a.dur))}</small></span>
        <span class="ag-info"><b>${esc(a.nome)}</b><small>${esc(a.servico_nome)} · ${a.assinante_id ? `<span class="tag-plano">Plano</span>` : money(a.preco)}${mostraProf ? " · " + esc(nomeProf(a.prof_id)) : ""}${a.origem === "encaixe" ? " · encaixe" : ""}</small>
          ${atras ? `<em class="ag-atras">Passou do horário. Concluir?</em>` : ""}${vs.length ? `<small class="ag-vendas">+ ${vs.map(v => esc(v.produto_nome) + (v.qtd > 1 ? " ×" + v.qtd : "")).join(", ")}</small>` : ""}</span>
        ${a.status === "agendado" ? `<button class="ag-ok" data-s="concluido" aria-label="Concluir atendimento de ${esc(a.nome)}">✓</button>` : `<span class="tag ${esc(a.status)}">${esc(ROT[a.status])}</span>`}</div>`;
    };
    lista.innerHTML = `<div class="linha-tempo">${itens.map(i => {
      if (i.tipo === "ag") return linha(i.a);
      if (i.tipo === "alm") return `<div class="ag-row ag-pausa"><span class="ag-h">${esc(h.almocoIni)}<small>até ${esc(h.almocoFim)}</small></span><span class="ag-info"><small>Pausa / almoço</small></span></div>`;
      if (i.tipo === "blq") return `<div class="ag-row ag-pausa"><span class="ag-h">${i.b.ini ? esc(i.b.ini) : "Dia"}<small>${i.b.ini ? "até " + esc(i.b.fim) : "inteiro"}</small></span><span class="ag-info"><small>Bloqueado${i.b.prof_id ? " · " + esc(nomeProf(i.b.prof_id)) : ""}${i.b.motivo ? " · " + esc(i.b.motivo) : ""}</small></span></div>`;
      return `<button class="ag-row ag-livre" data-encaixe="${esc(i.l.ini)}"><span class="ag-h">${esc(i.l.ini)}</span><span class="ag-info"><small>Livre até ${esc(i.l.fim)}</small></span><span class="ag-mais">+ Encaixar</span></button>`;
    }).join("")}</div>
      ${canc.length ? `<details class="ag-canc"><summary>${canc.length} ${canc.length === 1 ? "cancelado" : "cancelados"}</summary>${canc.map(linha).join("")}</details>` : ""}
      ${avulsas.length ? `<h3 class="tit-avulsas">Vendas avulsas</h3>${avulsas.map(v => `<div class="cli"><div><b>${esc(v.produto_nome)}${v.qtd > 1 ? " ×" + v.qtd : ""}</b><small>${money(v.preco * v.qtd)}${ctx.profs.length > 1 ? " · " + esc(nomeProf(v.prof_id)) : ""}</small></div><button class="btn btn-mini btn-sec" data-desfazer="${esc(v.id)}">Desfazer</button></div>`).join("")}` : ""}`;

    const acao = async e => {
      const enc = e.target.closest("[data-encaixe]"); if (enc) return encaixe(enc.dataset.encaixe);
      const bd = e.target.closest("[data-desfazer]");
      if (bd) { try { await S.desfazerVenda(bd.dataset.desfazer); ctx.produtos = await S.produtos(ctx.bid).catch(() => ctx.produtos); U.toast("Venda desfeita."); listaDia(); } catch (err) { U.toast(err.message); } return; }
      const card = e.target.closest("[data-id]"); if (!card) return;
      const a = ags.find(x => x.id === card.dataset.id);
      const bs = e.target.closest("[data-s]");
      if (bs) { try { await S.atualizar(ctx.bid, a.id, { status: bs.dataset.s }); U.toast(bs.dataset.s === "concluido" ? `${a.nome}: atendimento concluído.` : "Atualizado."); listaDia(); } catch (err) { U.toast(err.message); } return; }
      if (e.target.closest("a")) return;
      abrirAg(a, vendas.filter(v => v.agendamento_id === a.id), listaDia);
    };
    lista.onclick = acao; $("#aProx").onclick = acao;
    lista.onkeydown = e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".ag-row[data-id]")) { e.preventDefault(); acao(e); } };
  }

  // detalhes do atendimento, com todas as ações
  function abrirAg(a, vs, depois) {
    const b = U.modal(`<div id="agDet"><h2>${esc(a.nome)}</h2>
      <p class="ag-det">${esc(cap(fmtData(a.data, true)))} · <b>${esc(a.hora)}</b> (${esc(durTxt(a.dur))})<br>${esc(a.servico_nome)} · ${a.assinante_id ? "pelo plano (já pago)" : money(a.preco)}${ctx.profs.length > 1 ? " · " + esc(nomeProf(a.prof_id)) : ""}
        <br><span class="tag ${esc(a.status)}">${esc(ROT[a.status] || a.status)}</span>${a.origem === "encaixe" ? ` <span class="tag">Encaixe</span>` : a.origem === "online" ? ` <span class="tag">Agendou online</span>` : ""}${a.telefone ? `<br>WhatsApp: ${esc(a.telefone)}` : ""}</p>
      ${vs.length ? `<div class="vendas-ag">${vs.map(v => `<span>${esc(v.produto_nome)}${v.qtd > 1 ? " ×" + v.qtd : ""} · ${money(v.preco * v.qtd)} <button class="lnk sutil" data-desfazer="${esc(v.id)}">desfazer</button></span>`).join("")}</div>` : ""}
      <div class="menu">${a.status === "agendado" ? `<button data-s="concluido">Concluir atendimento</button><button data-s="faltou">Cliente faltou</button><button data-s="cancelado" class="perigo">Cancelar horário</button>` : `<button data-s="agendado">Desfazer (voltar para agendado)</button>`}
        ${temProdutos() && !["cancelado", "faltou"].includes(a.status) ? `<button data-produto>Adicionar produto vendido</button>` : ""}
        ${a.telefone ? `<a target="_blank" rel="noopener" href="${esc(wa(a.telefone, `Olá ${a.nome}! Confirmando seu horário na ${ctx.b.nome}: ${fmtData(a.data)} às ${a.hora}.`))}">Mandar WhatsApp</a>` : ""}
        <button data-fechar>Fechar</button></div></div>`);
    b.querySelector("#agDet").onclick = async e => {
      if (e.target.closest("[data-produto]")) { U.fecharModal(); return vender(a.id); }
      const bd = e.target.closest("[data-desfazer]");
      if (bd) { try { await S.desfazerVenda(bd.dataset.desfazer); ctx.produtos = await S.produtos(ctx.bid).catch(() => ctx.produtos); U.fecharModal(); U.toast("Venda desfeita."); depois(); } catch (err) { U.toast(err.message); } return; }
      const bs = e.target.closest("[data-s]"); if (!bs) return;
      try { await S.atualizar(ctx.bid, a.id, { status: bs.dataset.s }); U.fecharModal(); U.toast("Atualizado."); depois(); } catch (err) { U.toast(err.message); }
    };
  }

  async function proximos() {
    const corpo = $("#agCorpo"), ini = U.hoje(), fim = A.addDays(ini, diasProx - 1), pf = dono() ? filtroProf : ctx.prof_id;
    corpo.innerHTML = `<p class="vazio">Carregando…</p>`;
    let ags, blq;
    try { [ags, blq] = await Promise.all([S.listar(ctx.bid, ini, fim, pf || undefined), S.bloqueios(ctx.bid, ini)]); }
    catch (e) { corpo.innerHTML = `<p class="erro">${esc(e.message)}</p>`; return; }
    if (!$("#agCorpo")) return;
    const vivos = ags.filter(a => a.status !== "cancelado").sort((x, y) => (x.data + x.hora).localeCompare(y.data + y.hora));
    const dias = Array.from({ length: diasProx }, (_, i) => A.addDays(ini, i));
    const doDia = d => vivos.filter(a => a.data === d), mostraProf = dono() && !filtroProf && ctx.profs.length > 1;
    const prev = vivos.filter(a => a.status === "agendado").reduce((s, a) => s + a.preco, 0);
    const fechado = d => { const h = cfg().horarios[A.dow(d)]; return !h || !h.aberto; };
    const blqDia = d => blq.some(b => b.data === d && !b.ini && (!pf || !b.prof_id || b.prof_id === pf));
    corpo.innerHTML = `<div class="semana">${dias.slice(0, 7).map(d => { const n = doDia(d).length;
        return `<button class="sem-dia${d === ini ? " hoje" : ""}${fechado(d) ? " fechado" : ""}" data-d="${d}" aria-label="${esc(fmtData(d, true))}: ${n} agendamentos"><small>${DIAS[A.dow(d)].slice(0, 3)}</small><b>${Number(d.slice(8))}</b><i>${n || ""}</i></button>`; }).join("")}</div>
      <div class="ag-resumo"><span><b>${vivos.length}</b> ${vivos.length === 1 ? "agendamento" : "agendamentos"}</span><span><b>${money(prev)}</b> previsto</span><span>próximos ${diasProx} dias</span></div>
      <div class="px-lista">${dias.map(d => { const l = doDia(d), r = relDia(d), soma = l.reduce((s, a) => s + a.preco, 0);
        return `<section class="px-dia"><header data-d="${d}"><div><b>${r || cap(fmtData(d, true).split(",")[0])}</b><small>${esc(fmtData(d, true).split(",").slice(1).join(",").trim())}</small></div><span>${l.length ? `${l.length} ${l.length === 1 ? "cliente" : "clientes"} · ${money(soma)}` : ""}</span></header>
          ${l.length ? l.map(a => `<div class="px-item st-${esc(a.status)}" data-id="${esc(a.id)}" role="button" tabindex="0"><span class="ag-h">${esc(a.hora)}</span><span class="ag-info"><b>${esc(a.nome)}</b><small>${esc(a.servico_nome)}${a.assinante_id ? " · plano" : ""}${mostraProf ? " · " + esc(nomeProf(a.prof_id)) : ""}</small></span>${a.status !== "agendado" ? `<span class="tag ${esc(a.status)}">${esc(ROT[a.status])}</span>` : ""}</div>`).join("")
            : `<p class="px-vazio">${fechado(d) ? "Fechado" : blqDia(d) ? "Bloqueado" : "Nenhum agendamento"}</p>`}</section>`; }).join("")}</div>
      ${diasProx < 60 ? `<button class="btn btn-sec btn-bloco" id="pxMais">Ver mais 14 dias</button>` : ""}`;
    corpo.onclick = e => {
      if (e.target.closest("#pxMais")) { diasProx += 14; return proximos(); }
      const d = e.target.closest("[data-d]"); if (d) { dia = d.dataset.d; modoAg = "dia"; return agenda(); }
      const it = e.target.closest("[data-id]"); if (it) abrirAg(vivos.find(a => a.id === it.dataset.id), [], proximos);
    };
    corpo.onkeydown = e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-id]")) { e.preventDefault(); corpo.onclick(e); } };
  }
  function novosAvisos(ags) {
    const ids = new Set(ags.map(a => a.id));
    const chave = dia + "|" + filtroProf;
    if (conhecidos && conhecidos.dia === chave) {
      const n = ags.find(a => !conhecidos.ids.has(a.id) && a.origem === "online");
      if (n) { const txt = `Novo agendamento: ${n.nome} às ${n.hora}`; U.toast(txt);
        try { if (Notification.permission === "granted") navigator.serviceWorker.ready.then(r => r.showNotification(ctx.b.nome, { body: txt, icon: U.url("/icons/icon-192.png"), tag: n.id })); } catch {} }
    }
    conhecidos = { dia: chave, ids };
  }
  function encaixe(horaSug) {
    const n = new Date(), hr = horaSug || A.toHM(Math.min(1425, Math.ceil((n.getHours() * 60 + n.getMinutes()) / 15) * 15));
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

  async function rel() {
    if (!dono()) return relAtend();
    box().innerHTML = `<div class="seg ag-modo" id="rSub" role="tablist"><button class="chip ${subRel === "fin" ? "on" : ""}" data-r="fin" role="tab">Financeiro</button><button class="chip ${subRel === "at" ? "on" : ""}" data-r="at" role="tab">Atendimentos</button></div><div id="rCorpo"></div>`;
    $("#rSub").onclick = e => { const b = e.target.closest("[data-r]"); if (b && b.dataset.r !== subRel) { subRel = b.dataset.r; rel(); } };
    return subRel === "fin" ? financeiro() : relAtend();
  }

  // ---------- planos de fidelidade ----------
  async function plan() {
    box().innerHTML = `<p class="vazio">Carregando…</p>`;
    let pacs, ass, usos;
    try { [pacs, ass, usos] = await Promise.all([S.pacotes(ctx.bid), S.assinantes(ctx.bid), S.usosPlano(ctx.bid, A.addDays(U.hoje(), -62))]); }
    catch (e) {
      box().innerHTML = /pacotes|assinantes|assinatura_ciclos|schema cache|does not exist|PGRST20/i.test(e.message)
        ? `<div class="aviso ruim"><b>Falta atualizar o banco.</b> Rode o arquivo <code>supabase/schema.sql</code> atualizado no SQL Editor do Supabase para liberar os planos.</div>` : `<p class="erro">${esc(e.message)}</p>`;
      return;
    }
    if (aba !== "plan" || !box()) return;
    const h = U.hoje(), dm = d => d ? d.slice(8) + "/" + d.slice(5, 7) : "";
    const pacDe = a => pacs.find(p => p.id === a.pacote_id), validoAte = a => a.ciclos.length ? a.ciclos.map(c => c.fim).sort().pop() : null;
    const cicloAt = a => a.ciclos.find(c => c.ini <= h && c.fim > h);
    const usados = (a, c) => usos.filter(u => u.assinante_id === a.id && u.data >= c.ini && u.data < c.fim && ["agendado", "concluido", "faltou"].includes(u.status)).length;
    const pend = ass.filter(a => a.status === "pendente"), ativos = ass.filter(a => a.status === "ativa" && validoAte(a) > h);
    const vencidos = ass.filter(a => a.status === "ativa" && !(validoAte(a) > h)), canc = ass.filter(a => a.status === "cancelada");
    const mrr = ativos.reduce((s, a) => s + ((pacDe(a) || {}).preco || 0), 0);
    const zapA = (a, t) => a.telefone ? `<a class="btn btn-mini btn-sec" target="_blank" rel="noopener" href="${esc(wa(a.telefone, t))}">WhatsApp</a>` : "";
    const linhaAss = a => {
      const pc = pacDe(a) || { nome: "Plano removido", cortes: 0 }, c = cicloAt(a), va = validoAte(a), u = c ? usados(a, c) : 0;
      return `<div class="fin-item ass-item" data-ass="${esc(a.id)}"><div><b>${esc(a.nome)}</b><small>${esc(pc.nome)}${a.telefone ? " · " + esc(a.telefone) : ""} · código ${esc(a.codigo)}</small>
          ${a.status === "ativa" && c ? `<div class="mp-barra"><i style="width:${pc.cortes ? Math.min(100, u / pc.cortes * 100) : 0}%"></i></div><small>${u} de ${pc.cortes} usados neste período</small>` : ""}</div>
        <div class="fin-dir">${a.status === "pendente" ? `<span class="tag faltou">Aguardando pagamento</span>` : a.status === "cancelada" ? `<span class="tag cancelado">Cancelado</span>`
          : va > h ? `<span class="tag concluido">Até ${dm(va)}</span>` : `<span class="tag cancelado">Venceu ${dm(va)}</span>`}</div>
        <div class="fin-ac">${a.status === "pendente" ? `<button class="btn btn-mini btn-ok" data-renovar="${esc(a.id)}">Recebi o pagamento</button><button class="btn btn-mini btn-sec" data-recusar="${esc(a.id)}">Recusar</button>`
          : a.status === "cancelada" ? `<button class="btn btn-mini btn-sec" data-renovar="${esc(a.id)}">Reativar</button><button class="btn btn-mini btn-sec perigo-txt" data-excluir="${esc(a.id)}">Excluir</button>`
          : `<button class="btn btn-mini ${va > h ? "btn-sec" : "btn-ok"}" data-renovar="${esc(a.id)}">${va > h ? "Renovar +1 mês" : "Renovar"}</button><button class="btn btn-mini btn-sec" data-mais-ass="${esc(a.id)}">Mais</button>`}
          ${zapA(a, a.status === "pendente" ? `Olá ${a.nome}! Recebemos seu pedido do plano ${pc.nome} (${money(pc.preco || 0)}/mês).` : `Olá ${a.nome}! Seu plano ${pc.nome} na ${ctx.b.nome}`)}</div></div>`;
    };
    box().innerHTML = `<div class="kpis"><div class="kpi"><small>Assinantes ativos</small><b>${ativos.length}</b></div><div class="kpi"><small>Receita mensal dos planos</small><b>${money(mrr)}</b></div>
        <div class="kpi"><small>Pedidos novos</small><b>${pend.length}</b></div></div>
      <div class="fin-sec" style="margin-top:6px"><div class="fin-cab"><h2>Seus planos</h2><button class="btn btn-mini" id="pNovo">+ Plano</button></div>
        ${pacs.length ? pacs.map(p => `<div class="fin-item"><div><b>${esc(p.nome)}</b><small>${p.cortes} ${p.cortes === 1 ? "atendimento" : "atendimentos"} por mês · ${p.servicos.length ? esc(p.servicos.map(id => (cfg().servicos.find(s => s.id === id) || {}).nome).filter(Boolean).join(", ")) : "qualquer serviço"}</small></div>
          <div class="fin-dir"><b>${money(p.preco)}<small style="display:inline"> /mês</small></b>${p.ativo ? "" : `<span class="tag">Oculto</span>`}</div><div class="fin-ac"><button class="btn btn-mini btn-sec" data-pac="${esc(p.id)}">Editar</button></div></div>`).join("")
          : `<p class="vazio">Crie um plano, por exemplo “Clube do Corte”: R$ 150 por mês com 4 cortes. Ele aparece na página da barbearia e o cliente pede para assinar.</p>`}</div>
      ${pend.length ? `<div class="fin-sec"><h2>Pedidos para confirmar</h2><p class="sub">Combine o pagamento com o cliente. Quando receber, toque em “Recebi o pagamento” para ativar.</p>${pend.map(linhaAss).join("")}</div>` : ""}
      <div class="fin-sec"><div class="fin-cab"><h2>Assinantes</h2>${pacs.length ? `<button class="btn btn-mini btn-sec" id="aNovo">+ Assinante</button>` : ""}</div>
        ${ativos.length || vencidos.length ? ativos.concat(vencidos).map(linhaAss).join("") : `<p class="vazio">Nenhum assinante ativo ainda.</p>`}
        ${canc.length ? `<details class="ag-canc"><summary>${canc.length} ${canc.length === 1 ? "cancelado" : "cancelados"}</summary>${canc.map(linhaAss).join("")}</details>` : ""}</div>
      <p class="sub fin-nota">O cliente usa o plano agendando pela página (o app reconhece pelo código). Cada horário marcado pelo plano entra na agenda com a etiqueta “Plano” e não cobra de novo. Cancelamento devolve o crédito; falta consome.</p>`;
    box().onclick = async e => {
      const t = e.target;
      if (t.closest("#pNovo")) return editarPacote(null);
      const ep = t.closest("[data-pac]"); if (ep) return editarPacote(pacs.find(p => p.id === ep.dataset.pac));
      if (t.closest("#aNovo")) return novoAssinante(pacs);
      const rn = t.closest("[data-renovar]"); if (rn) { const a = ass.find(x => x.id === rn.dataset.renovar); return renovar(a, pacDe(a), validoAte(a)); }
      const rc = t.closest("[data-recusar]");
      if (rc) { if (!confirm("Recusar este pedido?")) return; try { await S.atualizarAssinante(ctx.bid, rc.dataset.recusar, { status: "cancelada" }); U.toast("Pedido recusado."); plan(); } catch (er) { U.toast(er.message); } return; }
      const ex = t.closest("[data-excluir]");
      if (ex) { if (!confirm("Excluir este assinante de vez? Os horários dele continuam na agenda.")) return; try { await S.removerAssinante(ctx.bid, ex.dataset.excluir); U.toast("Excluído."); plan(); } catch (er) { U.toast(er.message); } return; }
      const mm = t.closest("[data-mais-ass]"); if (mm) return maisAssinante(ass.find(x => x.id === mm.dataset.maisAss), pacs);
    };
  }

  function editarPacote(p) {
    const novo = !p; p = p || { nome: "", descricao: "", preco: "", cortes: 4, servicos: [], ativo: true };
    const b = U.modal(`<h2>${novo ? "Novo plano" : "Editar plano"}</h2><form id="fPac" class="form-grid">
      <label class="full">Nome do plano<input name="nome" required maxlength="60" value="${esc(p.nome)}" placeholder="Ex.: Clube do Corte"></label>
      <label>Preço por mês (R$)<input name="preco" type="number" inputmode="decimal" min="0" step="0.01" required value="${esc(p.preco)}"></label>
      <label>Atendimentos por mês<input name="cortes" type="number" inputmode="numeric" min="1" max="31" required value="${esc(p.cortes)}"></label>
      <fieldset class="full pac-servs"><legend>Vale para quais serviços?</legend><p class="sub" style="margin:0 0 6px">Deixe tudo desmarcado para valer em qualquer serviço.</p>
        ${cfg().servicos.map(s => `<label class="switch"><input type="checkbox" name="serv" value="${esc(s.id)}" ${p.servicos.includes(s.id) ? "checked" : ""}> ${esc(s.nome)} <small style="color:var(--mut);font-weight:400">${money(s.preco)}</small></label>`).join("")}</fieldset>
      <label class="full">Descrição (opcional)<input name="descricao" maxlength="160" value="${esc(p.descricao)}" placeholder="Ex.: Corte toda semana, agendando pelo app"></label>
      ${novo ? "" : `<label class="switch full"><input type="checkbox" name="ativo" ${p.ativo ? "checked" : ""}> Mostrar na página da barbearia</label>`}
      <p class="erro full" id="pcErro"></p><button class="btn full">Salvar</button>
      ${novo ? "" : `<button type="button" class="btn btn-sec full perigo-txt" id="pcDel">Excluir plano</button>`}<button type="button" class="btn btn-sec full" data-fechar>Cancelar</button></form>`);
    const f = b.querySelector("#fPac");
    f.onsubmit = async e => {
      e.preventDefault(); const preco = Number(f.preco.value), cortes = Math.round(Number(f.cortes.value));
      if (!(preco >= 0) || !(cortes >= 1 && cortes <= 31)) { b.querySelector("#pcErro").textContent = "Confira o preço e a quantidade."; return; }
      try { await S.salvarPacote(ctx.bid, { id: p.id, nome: f.nome.value.trim(), descricao: f.descricao.value.trim(), preco, cortes, servicos: [...f.querySelectorAll("[name=serv]:checked")].map(i => i.value), ativo: novo ? true : f.ativo.checked });
        U.fecharModal(); U.toast("Plano salvo."); plan(); }
      catch (er) { b.querySelector("#pcErro").textContent = er.message; }
    };
    const del = b.querySelector("#pcDel");
    if (del) del.onclick = async () => { if (!confirm(`Excluir o plano “${p.nome}”? Para só esconder da página, desmarque “Mostrar na página”.`)) return;
      try { await S.removerPacote(ctx.bid, p.id); U.fecharModal(); U.toast("Plano excluído."); plan(); } catch (er) { b.querySelector("#pcErro").textContent = er.message; } };
  }

  function renovar(a, pc, va) {
    if (!pc) return U.toast("Esse plano foi excluído. Escolha outro em “Mais”.");
    const h = U.hoje(), ini = va && va > h ? va : h, dm = d => d.slice(8) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4);
    const fimD = A.parseYMD(ini); fimD.setMonth(fimD.getMonth() + 1);
    const b = U.modal(`<h2>${a.status === "pendente" ? "Ativar plano" : "Renovar plano"}</h2><p class="sub" style="margin-top:-6px">${esc(a.nome)} · ${esc(pc.nome)}</p><form id="fRen" class="form-grid">
      <label class="full">Valor recebido (R$)<input name="valor" type="number" inputmode="decimal" min="0" step="0.01" required value="${esc(pc.preco)}"></label>
      <p class="full" style="margin:0">Período: <b>${dm(ini)}</b> até <b>${dm(A.ymd(fimD))}</b> · ${pc.cortes} ${pc.cortes === 1 ? "atendimento" : "atendimentos"}</p>
      <label class="switch full"><input type="checkbox" name="lancar" checked> Lançar como entrada no Financeiro</label>
      <p class="erro full" id="rnErro"></p><button class="btn btn-ok full">Confirmar</button><button type="button" class="btn btn-sec full" data-fechar>Cancelar</button></form>`);
    const f = b.querySelector("#fRen");
    f.onsubmit = async e => {
      e.preventDefault();
      try { await S.renovarAssinante(a.id, Number(f.valor.value) || 0, f.lancar.checked); U.fecharModal(); U.toast(a.status === "pendente" ? "Plano ativado!" : "Plano renovado."); plan(); }
      catch (er) { b.querySelector("#rnErro").textContent = er.message; }
    };
  }

  function novoAssinante(pacs) {
    const at = pacs.filter(p => p.ativo).length ? pacs.filter(p => p.ativo) : pacs;
    const b = U.modal(`<h2>Novo assinante</h2><form id="fNA" class="form-grid">
      <label class="full">Nome do cliente<input name="nome" required maxlength="60"></label>
      <label class="full">WhatsApp<input name="tel" type="tel" inputmode="tel" maxlength="20" placeholder="(00) 00000-0000"></label>
      <label class="full">Plano<select name="pac">${at.map(p => `<option value="${esc(p.id)}">${esc(p.nome)} · ${money(p.preco)}/mês</option>`).join("")}</select></label>
      <label class="switch full"><input type="checkbox" name="pago" checked> Já pagou o primeiro mês (ativar agora)</label>
      <p class="erro full" id="naErro"></p><button class="btn full">Salvar</button><button type="button" class="btn btn-sec full" data-fechar>Cancelar</button></form>`);
    const f = b.querySelector("#fNA");
    f.onsubmit = async e => {
      e.preventDefault(); if (f.nome.value.trim().length < 2) { b.querySelector("#naErro").textContent = "Digite o nome."; return; }
      try {
        const id = crypto.randomUUID(), pc = pacs.find(p => p.id === f.pac.value);
        const cod = await S.criarAssinante(ctx.bid, { id, nome: f.nome.value.trim(), telefone: f.tel.value, pacote_id: pc.id });
        if (f.pago.checked) await S.renovarAssinante(id, pc.preco, true);
        U.modal(`<h2>Assinante salvo</h2><p>Mande o código para ${esc(f.nome.value.trim())}. Ele digita na página da barbearia em “Já assino e tenho um código” e passa a agendar pelo plano.</p><p class="codigo-grande">${esc(cod)}</p>
          <div class="pilha">${f.tel.value.trim() ? `<a class="btn btn-ok" target="_blank" rel="noopener" href="${esc(wa(f.tel.value, `Olá! Seu plano ${pc.nome} na ${ctx.b.nome} está ${f.pago.checked ? "ativo" : "cadastrado"}. Para agendar pelo plano, abra ${location.origin}${U.url("/" + ctx.b.slug)} e use o código ${cod}.`))}">Enviar pelo WhatsApp</a>` : ""}<button class="btn btn-sec" data-fechar>Fechar</button></div>`);
        plan();
      } catch (er) { b.querySelector("#naErro").textContent = er.message; }
    };
  }

  function maisAssinante(a, pacs) {
    const ult = a.ciclos.slice().sort((x, y) => y.ini.localeCompare(x.ini))[0];
    const b = U.modal(`<div id="mAss"><h2>${esc(a.nome)}</h2><p class="sub" style="margin-top:-6px">Código do plano: <b>${esc(a.codigo)}</b></p>
      <div class="menu"><button data-op="trocar">Trocar de plano</button>${ult ? `<button data-op="desfazer">Desfazer a última renovação (${esc(ult.ini.slice(8))}/${esc(ult.ini.slice(5, 7))} a ${esc(ult.fim.slice(8))}/${esc(ult.fim.slice(5, 7))})</button>` : ""}
        <button data-op="cancelar" class="perigo">Cancelar plano</button><button data-fechar>Fechar</button></div></div>`);
    b.querySelector("#mAss").onclick = async e => {
      const op = (e.target.closest("[data-op]") || {}).dataset; if (!op || !op.op) return;
      try {
        if (op.op === "cancelar") { if (!confirm(`Cancelar o plano de ${a.nome}? Ele deixa de agendar pelo plano.`)) return; await S.atualizarAssinante(ctx.bid, a.id, { status: "cancelada" }); U.toast("Plano cancelado."); }
        if (op.op === "desfazer") { if (!confirm("Desfazer a última renovação? Se lançou no Financeiro, apague a entrada por lá.")) return; await S.desfazerCiclo(ctx.bid, ult.id); U.toast("Renovação desfeita."); }
        if (op.op === "trocar") {
          const m = U.modal(`<h2>Trocar plano de ${esc(a.nome)}</h2><div class="menu">${pacs.map(p => `<button data-p="${esc(p.id)}" ${p.id === a.pacote_id ? "disabled" : ""}>${esc(p.nome)} · ${money(p.preco)}/mês · ${p.cortes} atend.</button>`).join("")}<button data-fechar>Cancelar</button></div>`);
          m.querySelector(".menu").onclick = async ev => { const x = ev.target.closest("[data-p]"); if (!x) return; try { await S.atualizarAssinante(ctx.bid, a.id, { pacote_id: x.dataset.p }); U.fecharModal(); U.toast("Plano trocado."); plan(); } catch (er) { U.toast(er.message); } };
          return;
        }
        U.fecharModal(); plan();
      } catch (er) { U.toast(er.message); }
    };
  }

  // ---------- financeiro ----------
  const CAT_SAIDA = ["Aluguel", "Energia", "Água", "Internet e telefone", "Produtos e estoque", "Manutenção", "Marketing", "Impostos e taxas", "Salários e pró-labore", "Contador", "Equipamentos", "Outros"];
  const CAT_ENTRADA = ["Aluguel de cadeira", "Serviço fora da agenda", "Planos de fidelidade", "Outros"];
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const somaMes = (ym, n) => { const [y, m] = ym.split("-").map(Number), d = new Date(y, m - 1 + n, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
  const fimMes = ym => { const [y, m] = ym.split("-").map(Number); return ym + "-" + String(new Date(y, m, 0).getDate()).padStart(2, "0"); };
  const nomeMes = ym => MESES[+ym.slice(5) - 1];
  const diaNoMes = (ym, d) => ym + "-" + String(Math.min(d, +fimMes(ym).slice(8))).padStart(2, "0");
  const pct = (a, b) => b ? Math.round((a - b) / Math.abs(b) * 100) : null;

  function calcMes(ym, ags, vendas, lanc, pagos, contas) {
    const conc = ags.filter(a => a.status === "concluido");
    const soma = (l, f) => l.reduce((s, x) => s + f(x), 0);
    const serv = soma(conc, a => a.preco), prod = soma(vendas, v => v.preco * v.qtd);
    const avulsos = lanc.filter(l => !l.competencia), PL = "Planos de fidelidade";
    const planos = soma(avulsos.filter(l => l.tipo === "entrada" && l.categoria === PL), l => l.valor), outrasE = soma(avulsos.filter(l => l.tipo === "entrada" && l.categoria !== PL), l => l.valor);
    const variaveis = soma(avulsos.filter(l => l.tipo === "saida"), l => l.valor);
    const comissoes = soma(conc, a => { const p = ctx.profs.find(x => x.id === a.prof_id); return (a.preco || a.valor_ref || 0) * Number((p && p.comissao) || 0) / 100; });
    const fixas = contas.map(c => { const pg = pagos.find(l => l.conta_fixa_id === c.id); return { c, pg, valor: pg ? pg.valor : c.ativo ? c.valor : 0 }; }).filter(x => x.pg || x.c.ativo);
    const totFixas = soma(fixas, x => x.valor);
    const entradas = serv + prod + planos + outrasE, saidas = totFixas + comissoes + variaveis;
    const aReceber = soma(ags.filter(a => a.status === "agendado" && a.data >= U.hoje()), a => a.preco);
    return { conc, serv, prod, planos, outrasE, variaveis, comissoes, fixas, totFixas, entradas, saidas, resultado: entradas - saidas, avulsos, aReceber };
  }

  async function financeiro() {
    const alvo = $("#rCorpo"), ym = mesFin, ymAnt = somaMes(ym, -1), atual = U.hoje().slice(0, 7);
    alvo.innerHTML = `<div class="dia-topo"><button class="btn btn-sec dia-seta" id="mAnt" aria-label="Mês anterior">‹</button>
      <div class="dia-tit"><b>${cap(nomeMes(ym))}</b><small>${ym.slice(0, 4)} · ${ym === atual ? "mês atual" : ym < atual ? "mês fechado" : "mês futuro"}</small></div>
      <button class="btn btn-sec dia-seta" id="mProx" aria-label="Próximo mês">›</button></div><div id="fOut"><p class="vazio">Carregando…</p></div>`;
    $("#mAnt").onclick = () => { mesFin = somaMes(ym, -1); financeiro(); };
    $("#mProx").onclick = () => { mesFin = somaMes(ym, 1); financeiro(); };
    let d;
    try {
      const [contas, ags, vendas, lanc, pagos, agsA, vendasA, lancA, pagosA] = await Promise.all([S.contasFixas(ctx.bid),
        S.listar(ctx.bid, ym + "-01", fimMes(ym)), S.vendas(ctx.bid, ym + "-01", fimMes(ym)).catch(() => []), S.lancamentos(ctx.bid, ym + "-01", fimMes(ym)), S.pagosDoMes(ctx.bid, ym),
        S.listar(ctx.bid, ymAnt + "-01", fimMes(ymAnt)), S.vendas(ctx.bid, ymAnt + "-01", fimMes(ymAnt)).catch(() => []), S.lancamentos(ctx.bid, ymAnt + "-01", fimMes(ymAnt)), S.pagosDoMes(ctx.bid, ymAnt)]);
      d = { contas, m: calcMes(ym, ags, vendas, lanc, pagos, contas), ant: calcMes(ymAnt, agsA, vendasA, lancA, pagosA, contas), ags, vendas };
    } catch (e) {
      const falta = /contas_fixas|lancamentos|schema cache|does not exist|PGRST20/i.test(e.message);
      $("#fOut").innerHTML = falta ? `<div class="aviso ruim"><b>Falta atualizar o banco.</b> Rode o arquivo <code>supabase/schema.sql</code> atualizado no SQL Editor do Supabase para liberar o financeiro.</div>` : `<p class="erro">${esc(e.message)}</p>`;
      return;
    }
    if (!$("#fOut")) return;
    const { m, ant, contas } = d, hoje = U.hoje();
    const dif = pct(m.resultado, ant.resultado), margem = m.entradas ? Math.round(m.resultado / m.entradas * 100) : 0;
    const linha = (rot, v, extra) => `<div class="fin-l"><span>${rot}${extra ? ` <small>${extra}</small>` : ""}</span><b>${money(v)}</b></div>`;
    const stFixa = x => {
      if (x.pg) return `<span class="tag concluido">Paga ${x.pg.data ? "em " + esc(x.pg.data.slice(8) + "/" + x.pg.data.slice(5, 7)) : ""}</span>`;
      const venc = diaNoMes(ym, x.c.dia), dias = Math.round((A.parseYMD(venc) - A.parseYMD(hoje)) / 864e5);
      if (ym > hoje.slice(0, 7)) return `<span class="tag">Vence dia ${x.c.dia}</span>`;
      if (ym < hoje.slice(0, 7)) return `<span class="tag cancelado">Não paga</span>`;
      if (dias < 0) return `<span class="tag cancelado">Vencida há ${-dias} ${dias === -1 ? "dia" : "dias"}</span>`;
      if (dias === 0) return `<span class="tag faltou">Vence hoje</span>`;
      return `<span class="tag ${dias <= 3 ? "faltou" : ""}">Vence ${dias === 1 ? "amanhã" : `em ${dias} dias`}</span>`;
    };
    const pagas = m.fixas.filter(x => x.pg).length;
    const cats = {};
    m.fixas.forEach(x => { cats[x.c.categoria] = (cats[x.c.categoria] || 0) + x.valor; });
    m.avulsos.filter(l => l.tipo === "saida").forEach(l => { cats[l.categoria] = (cats[l.categoria] || 0) + l.valor; });
    if (m.comissoes) cats["Comissões dos barbeiros"] = m.comissoes;
    const catLista = Object.entries(cats).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]), mxCat = Math.max(1, ...catLista.map(c => c[1]));

    $("#fOut").innerHTML = `<div class="fin-res ${m.resultado < 0 ? "neg" : ""}">
        <small>${m.resultado < 0 ? "Prejuízo" : "Lucro"} em ${nomeMes(ym)}</small><b>${money(m.resultado)}</b>
        <span>${m.entradas ? `Margem de ${margem}%` : "Sem entradas no mês"}${dif != null && (ant.entradas || ant.saidas) ? ` · ${dif >= 0 ? "▲" : "▼"} ${Math.abs(dif)}% vs. ${nomeMes(ymAnt)}` : ""}</span>
        ${m.aReceber ? `<em>+ ${money(m.aReceber)} ainda agendados para este mês</em>` : ""}</div>
      <div class="fin-cols">
        <div class="fin-box"><h3>Entradas <b class="pos">${money(m.entradas)}</b></h3>${linha("Serviços", m.serv, `${m.conc.length} atend.`)}${linha("Produtos", m.prod)}${m.planos ? linha("Planos de fidelidade", m.planos) : ""}${linha("Outras entradas", m.outrasE)}</div>
        <div class="fin-box"><h3>Saídas <b class="neg">${money(m.saidas)}</b></h3>${linha("Contas fixas", m.totFixas)}${linha("Comissões", m.comissoes, "calculadas")}${linha("Despesas avulsas", m.variaveis)}</div>
      </div>

      <div class="fin-sec"><div class="fin-cab"><h2>Contas fixas</h2><button class="btn btn-mini" id="fNovaFixa">+ Conta fixa</button></div>
        ${m.fixas.length ? `<p class="sub">${money(m.totFixas)} no mês · ${pagas} de ${m.fixas.length} ${pagas === 1 ? "paga" : "pagas"}</p>
        ${m.fixas.sort((a, b) => a.c.dia - b.c.dia).map(x => `<div class="fin-item" data-fixa="${esc(x.c.id)}"><div><b>${esc(x.c.descricao)}</b><small>${esc(x.c.categoria)} · dia ${x.c.dia}</small></div>
          <div class="fin-dir"><b>${money(x.valor)}</b>${stFixa(x)}</div>
          <div class="fin-ac">${x.pg ? `<button class="btn btn-mini btn-sec" data-desfazer-fixa="${esc(x.pg.id)}">Desfazer</button>` : `<button class="btn btn-mini btn-ok" data-pagar="${esc(x.c.id)}">Pagar</button>`}<button class="btn btn-mini btn-sec" data-editar-fixa="${esc(x.c.id)}">Editar</button></div></div>`).join("")}`
        : `<p class="vazio">Cadastre as contas que se repetem todo mês: aluguel, energia, água, internet, contador… Elas entram sozinhas em todos os meses.</p>`}
        ${contas.some(c => !c.ativo) ? `<p class="sub">${contas.filter(c => !c.ativo).length} conta(s) desativada(s): ${contas.filter(c => !c.ativo).map(c => `<button class="lnk" data-editar-fixa="${esc(c.id)}">${esc(c.descricao)}</button>`).join(", ")}</p>` : ""}</div>

      <div class="fin-sec"><div class="fin-cab"><h2>Despesas e entradas avulsas</h2><div class="seg"><button class="btn btn-mini" data-novo="saida">+ Despesa</button><button class="btn btn-mini btn-sec" data-novo="entrada">+ Entrada</button></div></div>
        ${m.avulsos.length ? m.avulsos.sort((a, b) => b.data.localeCompare(a.data)).map(l => `<div class="fin-item" data-lanc="${esc(l.id)}" role="button" tabindex="0"><div><b>${esc(l.descricao)}</b><small>${esc(l.data.slice(8) + "/" + l.data.slice(5, 7))} · ${esc(l.categoria)}</small></div>
          <div class="fin-dir"><b class="${l.tipo === "entrada" ? "pos" : "neg"}">${l.tipo === "entrada" ? "+" : "−"} ${money(l.valor)}</b>${l.pago ? "" : `<span class="tag faltou">${l.tipo === "entrada" ? "a receber" : "a pagar"}</span>`}</div>
          <div class="fin-ac">${l.pago ? "" : `<button class="btn btn-mini btn-ok" data-quitar="${esc(l.id)}">${l.tipo === "entrada" ? "Recebido" : "Pago"}</button>`}</div></div>`).join("")
          : `<p class="vazio">Nada lançado em ${nomeMes(ym)}. Use “+ Despesa” para gastos do dia a dia (lâminas, produtos, conserto) e “+ Entrada” para dinheiro que não veio da agenda.</p>`}</div>

      ${catLista.length ? `<div class="fin-sec"><h2>Para onde foi o dinheiro</h2>${catLista.map(([n, v]) => `<div class="barra"><span>${esc(n)}</span><span>${money(v)}</span><div class="trilho"><i style="width:${(v / mxCat * 100).toFixed(1)}%"></i></div></div>`).join("")}</div>` : ""}
      <button class="btn btn-sec btn-bloco" id="fCsv">Baixar planilha do mês (CSV)</button>
      <p class="sub fin-nota">Serviços e produtos vêm da agenda (atendimentos concluídos e vendas). Comissões usam a % de cada barbeiro em Equipe.</p>`;

    $("#fOut").onclick = async e => {
      const t = e.target;
      if (t.closest("#fNovaFixa")) return editarFixa(null);
      const ef = t.closest("[data-editar-fixa]"); if (ef) return editarFixa(contas.find(c => c.id === ef.dataset.editarFixa));
      const pg = t.closest("[data-pagar]"); if (pg) return pagarFixa(contas.find(c => c.id === pg.dataset.pagar), ym);
      const df = t.closest("[data-desfazer-fixa]");
      if (df) { try { await S.removerLancamento(ctx.bid, df.dataset.desfazerFixa); U.toast("Pagamento desfeito."); financeiro(); } catch (er) { U.toast(er.message); } return; }
      const nv = t.closest("[data-novo]"); if (nv) return editarLanc({ tipo: nv.dataset.novo }, ym);
      const qt = t.closest("[data-quitar]");
      if (qt) { const l = m.avulsos.find(x => x.id === qt.dataset.quitar); try { await S.salvarLancamento(ctx.bid, Object.assign({}, l, { pago: true })); U.toast("Atualizado."); financeiro(); } catch (er) { U.toast(er.message); } return; }
      if (t.closest("#fCsv")) return baixarCsv(ym, d);
      const it = t.closest("[data-lanc]"); if (it) editarLanc(m.avulsos.find(x => x.id === it.dataset.lanc), ym);
    };
    $("#fOut").onkeydown = e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-lanc]")) { e.preventDefault(); $("#fOut").onclick(e); } };
  }

  const opcoes = (lista, sel) => lista.concat(sel && !lista.includes(sel) ? [sel] : []).map(c => `<option ${c === sel ? "selected" : ""}>${esc(c)}</option>`).join("");

  function editarFixa(c) {
    const novo = !c; c = c || { descricao: "", categoria: "Aluguel", valor: "", dia: 10, ativo: true };
    const b = U.modal(`<h2>${novo ? "Nova conta fixa" : "Editar conta fixa"}</h2><form id="fFixa" class="form-grid">
      <label class="full">Nome da conta<input name="descricao" required maxlength="60" value="${esc(c.descricao)}" placeholder="Ex.: Aluguel do salão, Energia"></label>
      <label>Valor por mês (R$)<input name="valor" type="number" inputmode="decimal" min="0" step="0.01" required value="${esc(c.valor)}"></label>
      <label>Vence todo dia<input name="dia" type="number" inputmode="numeric" min="1" max="31" required value="${esc(c.dia)}"></label>
      <label class="full">Categoria<select name="categoria">${opcoes(CAT_SAIDA, c.categoria)}</select></label>
      ${novo ? "" : `<label class="switch full"><input type="checkbox" name="ativo" ${c.ativo ? "checked" : ""}> Conta ativa (desmarque se parou de pagar)</label>`}
      <p class="sub full" style="margin:0">Se o valor mudar de um mês para outro (como a energia), ajuste na hora de pagar.</p>
      <p class="erro full" id="fxErro"></p><button class="btn full">Salvar</button>
      ${novo ? "" : `<button type="button" class="btn btn-sec full perigo-txt" id="fxDel">Excluir conta</button>`}<button type="button" class="btn btn-sec full" data-fechar>Cancelar</button></form>`);
    const f = b.querySelector("#fFixa");
    f.onsubmit = async e => {
      e.preventDefault();
      const valor = Number(f.valor.value), dia = Math.round(Number(f.dia.value));
      if (!(valor >= 0) || !(dia >= 1 && dia <= 31)) { b.querySelector("#fxErro").textContent = "Confira o valor e o dia."; return; }
      try { await S.salvarContaFixa(ctx.bid, { id: c.id, descricao: f.descricao.value.trim(), categoria: f.categoria.value, valor, dia, ativo: novo ? true : f.ativo.checked }); U.fecharModal(); U.toast("Conta salva."); financeiro(); }
      catch (er) { b.querySelector("#fxErro").textContent = er.message; }
    };
    const del = b.querySelector("#fxDel");
    if (del) del.onclick = async () => {
      if (!confirm(`Excluir “${c.descricao}”? Os pagamentos já feitos continuam no histórico.`)) return;
      try { await S.removerContaFixa(ctx.bid, c.id); U.fecharModal(); U.toast("Conta excluída."); financeiro(); } catch (er) { b.querySelector("#fxErro").textContent = er.message; }
    };
  }

  function pagarFixa(c, ym) {
    const hoje = U.hoje(), sug = hoje.slice(0, 7) === ym ? hoje : diaNoMes(ym, c.dia);
    const b = U.modal(`<h2>Pagar ${esc(c.descricao)}</h2><p class="sub" style="margin-top:-6px">Referente a ${nomeMes(ym)} de ${ym.slice(0, 4)}</p><form id="fPag" class="form-grid">
      <label>Valor pago (R$)<input name="valor" type="number" inputmode="decimal" min="0.01" step="0.01" required value="${esc(c.valor)}"></label>
      <label>Data do pagamento<input name="data" type="date" required value="${sug}"></label>
      <p class="erro full" id="pgErro"></p><button class="btn btn-ok full">Confirmar pagamento</button><button type="button" class="btn btn-sec full" data-fechar>Cancelar</button></form>`);
    const f = b.querySelector("#fPag");
    f.onsubmit = async e => {
      e.preventDefault(); const valor = Number(f.valor.value);
      if (!(valor > 0)) { b.querySelector("#pgErro").textContent = "Digite o valor pago."; return; }
      try { await S.salvarLancamento(ctx.bid, { tipo: "saida", descricao: c.descricao, categoria: c.categoria, valor, data: f.data.value, pago: true, conta_fixa_id: c.id, competencia: ym });
        U.fecharModal(); U.toast("Pagamento registrado."); financeiro(); }
      catch (er) { b.querySelector("#pgErro").textContent = er.message; }
    };
  }

  function editarLanc(l, ym) {
    const novo = !l.id, ent = l.tipo === "entrada", hoje = U.hoje();
    l = Object.assign({ descricao: "", categoria: ent ? CAT_ENTRADA[0] : "Produtos e estoque", valor: "", data: hoje.slice(0, 7) === ym ? hoje : ym + "-01", pago: true }, l);
    const b = U.modal(`<h2>${novo ? (ent ? "Nova entrada" : "Nova despesa") : (ent ? "Editar entrada" : "Editar despesa")}</h2><form id="fLanc" class="form-grid">
      <label class="full">Descrição<input name="descricao" required maxlength="80" value="${esc(l.descricao)}" placeholder="${ent ? "Ex.: Aluguel de cadeira do Pedro" : "Ex.: Lâminas, conserto da máquina"}"></label>
      <label>Valor (R$)<input name="valor" type="number" inputmode="decimal" min="0.01" step="0.01" required value="${esc(l.valor)}"></label>
      <label>Data<input name="data" type="date" required value="${esc(l.data)}"></label>
      <label class="full">Categoria<select name="categoria">${opcoes(ent ? CAT_ENTRADA : CAT_SAIDA, l.categoria)}</select></label>
      <label class="switch full"><input type="checkbox" name="pago" ${l.pago ? "checked" : ""}> ${ent ? "Já recebi" : "Já paguei"}</label>
      <p class="erro full" id="lErro"></p><button class="btn full">Salvar</button>
      ${novo ? "" : `<button type="button" class="btn btn-sec full perigo-txt" id="lDel">Excluir</button>`}<button type="button" class="btn btn-sec full" data-fechar>Cancelar</button></form>`);
    const f = b.querySelector("#fLanc");
    f.onsubmit = async e => {
      e.preventDefault(); const valor = Number(f.valor.value);
      if (!(valor > 0)) { b.querySelector("#lErro").textContent = "Digite o valor."; return; }
      try { await S.salvarLancamento(ctx.bid, { id: l.id, tipo: l.tipo, descricao: f.descricao.value.trim(), categoria: f.categoria.value, valor, data: f.data.value, pago: f.pago.checked });
        U.fecharModal(); U.toast("Salvo."); if (f.data.value.slice(0, 7) !== mesFin) mesFin = f.data.value.slice(0, 7); financeiro(); }
      catch (er) { b.querySelector("#lErro").textContent = er.message; }
    };
    const del = b.querySelector("#lDel");
    if (del) del.onclick = async () => { if (!confirm("Excluir este lançamento?")) return;
      try { await S.removerLancamento(ctx.bid, l.id); U.fecharModal(); U.toast("Excluído."); financeiro(); } catch (er) { b.querySelector("#lErro").textContent = er.message; } };
  }

  function baixarCsv(ym, d) {
    const m = d.m, br = n => n.toFixed(2).replace(".", ","), cel = s => `"${String(s).replace(/"/g, '""')}"`;
    const linhas = [["Data", "Tipo", "Categoria", "Descrição", "Valor", "Situação"]];
    m.conc.forEach(a => linhas.push([a.data, "Entrada", "Serviços", `${a.servico_nome} - ${a.nome} (${nomeProf(a.prof_id)})`, br(a.preco), "Recebido"]));
    d.vendas.forEach(v => linhas.push([v.data, "Entrada", "Produtos", `${v.produto_nome}${v.qtd > 1 ? " x" + v.qtd : ""}`, br(v.preco * v.qtd), "Recebido"]));
    m.avulsos.forEach(l => linhas.push([l.data, l.tipo === "entrada" ? "Entrada" : "Saída", l.categoria, l.descricao, br(l.tipo === "entrada" ? l.valor : -l.valor), l.pago ? (l.tipo === "entrada" ? "Recebido" : "Pago") : (l.tipo === "entrada" ? "A receber" : "A pagar")]));
    m.fixas.forEach(x => linhas.push([x.pg ? x.pg.data : diaNoMes(ym, x.c.dia), "Saída", x.c.categoria, x.c.descricao + " (conta fixa)", br(-x.valor), x.pg ? "Pago" : "A pagar"]));
    if (m.comissoes) linhas.push([fimMes(ym), "Saída", "Comissões dos barbeiros", "Comissões calculadas sobre os serviços", br(-m.comissoes), "Calculado"]);
    linhas.push([], ["", "", "", "Entradas", br(m.entradas)], ["", "", "", "Saídas", br(-m.saidas)], ["", "", "", "Resultado", br(m.resultado)]);
    const csv = "﻿" + linhas.map(l => l.map(cel).join(";")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `financeiro-${ctx.b.slug}-${ym}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function relAtend() {
    const PER = { "0": "Hoje", "7": "7 dias", "mes": "Este mês", "30": "30 dias", "90": "90 dias" };
    ($("#rCorpo") || box()).innerHTML = `<div class="seg" id="rPer">${Object.entries(PER).map(([k, t]) => `<button class="btn btn-mini ${periodo === k ? "" : "btn-sec"}" data-p="${k}">${t}</button>`).join("")}</div><div id="rOut"><p class="vazio">Carregando…</p></div>`;
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
      ${!dono() && com ? `<div class="kpi destaque"><small>Sua comissão (${com}%)</small><b>${money(conc.reduce((s, a) => s + (a.preco || a.valor_ref || 0), 0) * com / 100)}</b></div>` : ""}
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
          return `<tr><td>${esc(p.nome)}</td><td class="num">${s.n}</td><td class="num">${money(s.v)}</td><td class="num">${prodP ? money(prodP) : "—"}</td><td class="num">${p.comissao ? money(conc.filter(a => a.prof_id === id).reduce((t, a) => t + (a.preco || a.valor_ref || 0), 0) * p.comissao / 100) + ` <small>(${Number(p.comissao)}%)</small>` : "—"}</td></tr>`; }).join("")}</tbody></table></div>`;
      }
      html += `<h2>Receita por serviço</h2>${barras(agrupa(conc, a => a.servico_nome), "", s => money(s.v))}
        <h2 style="margin-top:24px">Movimento por dia da semana</h2>${barras(porDia, "var(--azul)", s => s.n)}`;
    }
    $("#rOut").innerHTML = html;
  }

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
  function escolherArquivo(cb) {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/png,image/jpeg,image/webp";
    inp.onchange = () => { const f = inp.files[0]; if (!f) return; if (f.size > 12 * 1024 * 1024) return U.toast("Imagem muito grande (máximo 12 MB)."); cb(f); };
    inp.click();
  }
  async function fotoQuadrada(arq, tam) {
    const img = await carregarImagem(arq), lado = Math.min(img.width, img.height);
    const c = document.createElement("canvas"); c.width = c.height = tam; const g = c.getContext("2d"); g.imageSmoothingQuality = "high";
    g.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, tam, tam);
    let b = await new Promise(ok => c.toBlob(ok, "image/webp", 0.8));
    if (!b || b.type !== "image/webp") b = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.82));
    return new Blob([b], { type: "image/webp" === b.type ? "image/webp" : "image/jpeg" });
  }

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
  async function aguardarPagamento() {
    const antes = ctx.b.vence_em; aba = "assin"; desenhar();
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try { const b = await S.barbearia(ctx.bid); if (b.vence_em !== antes || b.status !== ctx.b.status) { ctx.b = b; U.toast("Pagamento confirmado!"); if (aba === "assin") desenhar(); return; } } catch {}
    }
    if (aba === "assin") U.toast("Assim que o Asaas confirmar, a assinatura atualiza sozinha. Pix e cartão costumam levar segundos; boleto, até 3 dias úteis.");
  }

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
