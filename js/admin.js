// /admin — administração da plataforma (você): barbearias, planos, liberar e bloquear.
{
  const U = window.UI, S = window.Store, A = window.Agenda, P = window.PLATAFORMA;
  const { esc, money, $, fmtData } = U;
  const app = () => $("#app");
  const ROT = { teste: "Teste", ativa: "Ativa", bloqueada: "Bloqueada", teste_vencido: "Teste vencido", vencida: "Vencida" };
  let filtro = "todas", busca = "";

  async function render() {
    U.manifestPadrao(); document.title = "Admin · " + P.nome;
    U.moldura({ marca: P.nome + " · Admin", marcaHref: "/admin", acoes: S.logado() ? `<button class="btn btn-mini btn-claro" id="admSair">Sair</button>` : "" });
    U.rodapeHTML(`<span>${esc(P.nome)} · Admin</span>`);
    const sb = $("#admSair"); if (sb) sb.onclick = () => { S.sair(); U.go("/admin"); };
    if (!S.logado()) {
      app().innerHTML = `<form class="form-pag" id="fA"><h1>Administração</h1>${S.modo === "local" ? `<p class="aviso">Demonstração: <b>admin@demo.com</b> / <b>1234</b></p>` : ""}
        <label class="lbl">E-mail<input name="email" type="email" autocomplete="username" required></label>
        <label class="lbl">Senha<input name="senha" type="password" autocomplete="current-password" required></label>
        <p class="erro" id="aErro"></p><button class="btn btn-grande" style="width:100%">Entrar</button></form>`;
      $("#fA").onsubmit = async e => { e.preventDefault(); try { await S.entrar(e.target.email.value.trim(), e.target.senha.value); render(); } catch (er) { $("#aErro").textContent = er.message; } };
      return;
    }
    if (!(await S.souSuper().catch(() => false))) {
      app().innerHTML = `<div class="form-pag"><h1>Sem permissão</h1><p>Esta área é só para o administrador da plataforma.</p><a class="btn" href="/painel" data-link>Ir para o painel</a></div>`; return;
    }
    app().innerHTML = `<div class="p-top"><h1>Barbearias</h1></div><div class="p-sec"><div id="adKpis" class="kpis"></div>
      <input class="busca" id="adBusca" type="search" placeholder="Buscar por nome, endereço ou e-mail" value="${esc(busca)}">
      <div class="seg" id="adFiltro"></div><div id="adLista"><p class="vazio">Carregando…</p></div></div>`;
    $("#adBusca").oninput = e => { busca = e.target.value.trim().toLowerCase(); lista(); };
    await carregar();
  }

  let todas = [];
  async function carregar() {
    try { todas = await S.todas(); } catch (e) { $("#adLista").innerHTML = `<p class="erro">${esc(e.message)}</p>`; return; }
    const h = U.hoje(), ef = b => A.statusEfetivo(b, h);
    const n = k => todas.filter(b => ef(b) === k).length;
    const mrr = todas.filter(b => ef(b) === "ativa").reduce((s, b) => s + ((P.planos.find(p => p.id === b.plano) || {}).preco || 0), 0);
    const vence7 = todas.filter(b => b.vence_em && b.vence_em >= h && b.vence_em <= A.addDays(h, 7) && b.status !== "bloqueada").length;
    $("#adKpis").innerHTML = `<div class="kpi"><small>Receita mensal (ativas)</small><b>${money(mrr)}</b></div>
      <div class="kpi"><small>Ativas</small><b>${n("ativa")}</b></div><div class="kpi"><small>Em teste</small><b>${n("teste")}</b></div>
      <div class="kpi"><small>Vencem em 7 dias</small><b>${vence7}</b></div><div class="kpi"><small>Bloqueadas / vencidas</small><b>${n("bloqueada") + n("teste_vencido") + n("vencida")}</b></div>`;
    const F = { todas: "Todas", ativa: "Ativas", teste: "Em teste", atencao: "Vencidas", bloqueada: "Bloqueadas" };
    $("#adFiltro").innerHTML = Object.entries(F).map(([k, t]) => `<button class="chip ${filtro === k ? "on" : ""}" data-f="${k}">${t}</button>`).join("");
    $("#adFiltro").onclick = e => { const b = e.target.closest("[data-f]"); if (b) { filtro = b.dataset.f; carregar(); } };
    lista();
  }

  function lista() {
    const h = U.hoje();
    const l = todas.filter(b => {
      const e = A.statusEfetivo(b, h);
      if (filtro === "atencao" && !["teste_vencido", "vencida"].includes(e)) return false;
      if (!["todas", "atencao"].includes(filtro) && e !== filtro) return false;
      return !busca || [b.nome, b.slug, b.dono_email].some(x => String(x || "").toLowerCase().includes(busca));
    });
    const el = $("#adLista");
    el.innerHTML = l.length ? l.map(b => {
      const e = A.statusEfetivo(b, h), dias = b.vence_em ? Math.round((A.parseYMD(b.vence_em) - A.parseYMD(h)) / 864e5) : null;
      return `<div class="adm-card" data-id="${esc(b.id)}">
        <div class="adm-top"><div><b>${esc(b.nome)}</b><small><a href="/${esc(b.slug)}" data-link>/${esc(b.slug)}</a> · ${esc(b.dono_email || "—")}</small></div>
          <span class="tag ${A.liberada(b, h) ? (e === "ativa" ? "concluido" : "agendado") : "cancelado"}">${esc(ROT[e] || e)}</span></div>
        <p class="sub">${b.vence_em ? (dias >= 0 ? `Vence ${esc(fmtData(b.vence_em))} (${dias} dia${dias === 1 ? "" : "s"})` : `Venceu ${esc(fmtData(b.vence_em))}`) : "Sem vencimento"} ·
          ${b.n_profs} barbeiro(s) · ${b.n_ags_30} agend. em 30 dias · desde ${esc(fmtData(String(b.criado_em).slice(0, 10)))}</p>
        <div class="acoes"><select data-a="plano" aria-label="Plano">${P.planos.map(p => `<option value="${p.id}" ${p.id === b.plano ? "selected" : ""}>${esc(p.nome)} · ${money(p.preco)}</option>`).join("")}</select>
          <button class="btn btn-mini btn-ok" data-a="ativar">Ativar +30 dias</button>
          ${b.status === "teste" ? `<button class="btn btn-mini btn-sec" data-a="teste">Teste +7 dias</button>` : ""}
          ${b.status === "bloqueada" ? `<button class="btn btn-mini btn-sec" data-a="desbloquear">Desbloquear</button>` : `<button class="btn btn-mini btn-sec" data-a="bloquear">Bloquear</button>`}</div></div>`;
    }).join("") : `<p class="vazio">Nenhuma barbearia ${filtro === "todas" ? "cadastrada ainda" : "neste filtro"}.</p>`;
    el.onchange = e => { if (e.target.dataset.a === "plano") acao(e.target.closest("[data-id]").dataset.id, { plano: e.target.value }, "Plano alterado."); };
    el.onclick = e => {
      const b = e.target.closest("button[data-a]"); if (!b) return;
      const id = b.closest("[data-id]").dataset.id, x = todas.find(t => t.id === id), base = x.vence_em && x.vence_em > h ? x.vence_em : h;
      if (b.dataset.a === "ativar") acao(id, { status: "ativa", vence_em: A.addDays(base, 30) }, "Ativada por mais 30 dias.");
      if (b.dataset.a === "teste") acao(id, { vence_em: A.addDays(base, 7) }, "Teste estendido.");
      if (b.dataset.a === "desbloquear") acao(id, { status: x.vence_em && x.vence_em >= h ? "ativa" : "teste", vence_em: x.vence_em && x.vence_em >= h ? x.vence_em : A.addDays(h, 7) }, "Desbloqueada.");
      if (b.dataset.a === "bloquear") {
        const m = U.modal(`<h2>Bloquear ${esc(x.nome)}?</h2><p>A agenda online para de aceitar agendamentos. O dono continua vendo o painel e os dados não são apagados.</p>
          <div class="pilha"><button class="btn" id="bqSim">Bloquear</button><button class="btn btn-sec" data-fechar>Cancelar</button></div>`);
        m.querySelector("#bqSim").onclick = () => { U.fecharModal(); acao(id, { status: "bloqueada" }, "Bloqueada."); };
      }
    };
  }
  async function acao(id, patch, msg) { try { await S.atualizarAssinatura(id, patch); U.toast(msg); carregar(); } catch (e) { U.toast(e.message); } }

  window.Admin = { render };
}
