// Página pública de cada barbearia: /slug, /slug/agendar, /slug/meus, /slug/info
{
  const U = window.UI, S = window.Store, A = window.Agenda, P = window.PLATAFORMA;
  const { esc, money, $, ls, fmtData, durTxt, wa, DIAS } = U;
  const app = () => $("#app");
  let atual = null; // { slug, b, cfg, profs, carregado }
  const st = { serv: null, prof: "", dia: null, hora: null, busy: [] };

  async function carregar(slug) {
    if (atual && atual.slug === slug && Date.now() - atual.carregado < 60000) return atual;
    const d = await S.publico(slug);
    if (!d) return null;
    atual = { slug, b: d.b, cfg: d.b.config, profs: d.profs, carregado: Date.now() };
    ls.set("bb_cache_" + slug, d);
    Object.assign(st, { serv: null, prof: "", dia: null, hora: null });
    return atual;
  }

  async function render(slug, view) {
    if (!["inicio", "agendar", "meus", "info"].includes(view)) view = "inicio";
    let d;
    try { d = await carregar(slug); }
    catch { const c = ls.get("bb_cache_" + slug, null); if (c) { atual = { slug, b: c.b, cfg: c.b.config, profs: c.profs, carregado: 0 }; d = atual; U.toast("Sem conexão: mostrando dados salvos."); } }
    if (!d) return naoEncontrada(slug);
    const base = "/" + slug, nome = d.b.nome;
    document.title = nome; U.manifestPara(nome, base); ls.set("bb_ultima", slug);
    U.moldura({ marca: nome, marcaHref: base, ativo: view, tabs: [
      { id: "inicio", txt: "Início", href: base }, { id: "agendar", txt: "Agendar", href: base + "/agendar" },
      { id: "meus", txt: "Meus", href: base + "/meus" }, { id: "info", txt: "Info", href: base + "/info" }] });
    U.rodapeHTML(`<a href="/painel" data-link class="link-painel">Área do barbeiro</a><small class="lukdev">Agenda por <a href="/" data-link>${esc(P.nome)}</a></small>`);
    if (!A.liberada(d.b, U.hoje()) && view === "agendar") return pausada();
    ({ inicio, agendar, meus, info })[view]();
  }

  function naoEncontrada(slug) {
    U.manifestPadrao();
    U.moldura({ marca: P.nome });
    U.rodapeHTML("");
    app().innerHTML = `<div class="form-pag"><h1>Barbearia não encontrada</h1><p>Não existe nenhuma barbearia em <b>/${esc(slug)}</b>. Confira o link com a barbearia.</p>
      <a class="btn" href="/" data-link>Conhecer o ${esc(P.nome)}</a></div>`;
  }
  function pausada() {
    app().innerHTML = `<div class="form-pag"><h1>Agenda online pausada</h1><p>No momento a ${esc(atual.b.nome)} não está recebendo agendamentos pelo app.</p>
      ${atual.cfg.whatsapp ? `<a class="btn btn-ok" target="_blank" rel="noopener" href="${esc(wa(atual.cfg.whatsapp, "Olá! Quero agendar um horário."))}">Agendar pelo WhatsApp</a>` : ""}</div>`;
  }

  // ---------- INÍCIO ----------
  function abertoAgora(cfg) {
    const n = new Date(), h = cfg.horarios[n.getDay()], m = n.getHours() * 60 + n.getMinutes();
    if (!h || !h.aberto || m < A.toMin(h.abre) || m >= A.toMin(h.fecha)) return false;
    return !(h.almocoIni && h.almocoFim && m >= A.toMin(h.almocoIni) && m < A.toMin(h.almocoFim));
  }
  function contatos(cfg) {
    let h = "";
    if (cfg.whatsapp) h += `<a class="btn btn-ok" href="${esc(wa(cfg.whatsapp, "Olá! Vim pelo app da " + atual.b.nome + "."))}" target="_blank" rel="noopener">WhatsApp</a>`;
    if (cfg.instagram) h += `<a class="btn btn-sec" href="https://instagram.com/${esc(cfg.instagram.replace("@", ""))}" target="_blank" rel="noopener">Instagram</a>`;
    const maps = cfg.mapsUrl || (cfg.endereco ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(cfg.endereco) : "");
    if (maps) h += `<a class="btn btn-sec" href="${esc(maps)}" target="_blank" rel="noopener">Como chegar</a>`;
    return h;
  }
  async function inicio() {
    const { cfg, b, profs } = atual, ab = abertoAgora(cfg), hj = new Date().getDay(), lib = A.liberada(b, U.hoje());
    app().innerHTML = `<div class="hero">
      <div class="hero-txt"><p class="aberto ${ab ? "on" : ""}">${ab ? "Aberto agora" : "Fechado agora"}</p>
        <h1>${esc(b.nome)}</h1><p class="slogan">${esc(cfg.slogan || "")}</p>
        ${lib ? `<a class="btn btn-grande" href="/${esc(b.slug)}/agendar" data-link>Agendar horário</a><p class="proximo" id="proximoLivre"></p>`
              : `<p class="proximo">Agendamento online pausado no momento.</p>${cfg.whatsapp ? `<a class="btn btn-ok" target="_blank" rel="noopener" href="${esc(wa(cfg.whatsapp, "Olá! Quero agendar um horário."))}">Agendar pelo WhatsApp</a>` : ""}`}
      </div>
      <svg class="poste" viewBox="0 0 120 300" aria-hidden="true"><use href="#posteGrande"/></svg></div>
    ${profs.length > 1 ? `<div class="band"><h2>Equipe</h2><div class="equipe-pub">${profs.map(p => `<div><span class="avatar">${esc(U.iniciais(p.nome))}</span>${esc(p.nome)}</div>`).join("")}</div></div>` : ""}
    <div class="band"><h2>Serviços</h2><ul class="servicos">${cfg.servicos.map(s => `<li><b>${esc(s.nome)}</b><span class="preco">${money(s.preco)}</span><small>${esc(durTxt(s.dur))}${s.desc ? " · " + esc(s.desc) : ""}</small></li>`).join("")}</ul></div>
    <div class="band band-escura"><h2>Horário de funcionamento</h2>
      <ul class="horarios">${[1, 2, 3, 4, 5, 6, 0].map(i => { const h = cfg.horarios[i];
        return `<li class="${i === hj ? "hoje" : ""}"><span>${DIAS[i]}</span><span>${h && h.aberto ? esc(h.abre) + " – " + esc(h.fecha) : "Fechado"}</span></li>`; }).join("")}</ul>
      <div class="contato">${contatos(cfg)}</div></div>`;
    if (!lib) return;
    try {
      const menor = Math.min(...cfg.servicos.map(s => s.dur)), h0 = U.hoje(), busy = await S.ocupados(b.slug, h0, A.addDays(h0, 7));
      for (let i = 0; i <= 7; i++) {
        const d = A.addDays(h0, i), r = A.slotsEquipe(cfg, d, menor, busy, null, profs).slots.find(x => x.livre);
        if (r) { const el = $("#proximoLivre"); if (el) el.innerHTML = `Próximo horário livre: <b>${i === 0 ? "hoje" : i === 1 ? "amanhã" : esc(fmtData(d))} às ${r.hora}</b>`; break; }
      }
    } catch {}
  }

  // ---------- AGENDAR ----------
  async function agendar() {
    const { cfg, profs } = atual, varios = profs.length > 1;
    let n = 1;
    app().innerHTML = `<div class="band"><h1 class="titulo-pag">Agendar</h1><form id="fAg" novalidate>
      <fieldset><legend><b>${n++}</b> Serviço</legend><div class="chips-serv" id="escServ"></div></fieldset>
      ${varios ? `<fieldset id="fsProf" class="travado"><legend><b>${n++}</b> Com quem?</legend><div class="chips-prof" id="escProf"></div></fieldset>` : ""}
      <fieldset id="fsDia" class="travado"><legend><b>${n++}</b> Dia</legend><div class="dias" id="escDia"></div></fieldset>
      <fieldset id="fsHora" class="travado"><legend><b>${n++}</b> Horário</legend><div class="horas" id="escHora"></div></fieldset>
      <fieldset id="fsNome" class="travado"><legend><b>${n++}</b> Seu nome</legend>
        <label class="campo"><span class="sr">Seu nome</span><input id="inNome" autocomplete="name" placeholder="Como podemos te chamar?" maxlength="60"></label>
        ${cfg.pedirTelefone ? `<label class="campo"><span class="sr">WhatsApp</span><input id="inTel" type="tel" inputmode="tel" autocomplete="tel" placeholder="WhatsApp (opcional)" maxlength="20"></label>` : ""}</fieldset>
      <p class="erro" id="erroAg" role="alert"></p>
      <div class="barra-conf"><div id="resumo" class="resumo">Escolha um serviço</div><button class="btn" id="btnConf" disabled>Confirmar</button></div>
    </form></div>`;
    $("#inNome").value = ls.get("bb_nome", ""); if ($("#inTel")) $("#inTel").value = ls.get("bb_tel", "");
    if (st.serv && !cfg.servicos.some(s => s.id === st.serv)) st.serv = null;
    if (st.prof && !profs.some(p => p.id === st.prof)) st.prof = "";
    $("#escServ").innerHTML = cfg.servicos.map(s => `<label class="op"><input type="radio" name="serv" value="${esc(s.id)}" ${st.serv === s.id ? "checked" : ""}><span><b>${esc(s.nome)}</b><small>${money(s.preco)} · ${esc(durTxt(s.dur))}</small></span></label>`).join("");
    if (varios) $("#escProf").innerHTML = [{ id: "", nome: "Qualquer um", sub: "mais horários" }].concat(profs).map(p =>
      `<label class="op"><input type="radio" name="prof" value="${esc(p.id)}" ${st.prof === p.id ? "checked" : ""}><span><span class="avatar">${p.id ? esc(U.iniciais(p.nome)) : "★"}</span><b>${esc(p.nome)}</b>${p.sub ? `<small>${p.sub}</small>` : ""}</span></label>`).join("");
    const h0 = U.hoje();
    try { st.busy = await S.ocupados(atual.slug, h0, A.addDays(h0, cfg.diasAgenda - 1)); } catch { $("#erroAg").textContent = "Sem conexão. Tente novamente."; st.busy = []; }
    desenharDias(); desenharHoras(); atualizar();
    const f = $("#fAg");
    f.onchange = e => {
      const t = e.target;
      if (t.name === "serv") { st.serv = t.value; desenharHoras(); }
      if (t.name === "prof") { st.prof = t.value; st.hora = null; desenharDias(); desenharHoras(); }
      if (t.name === "dia") { st.dia = t.value; st.hora = null; desenharHoras(); }
      if (t.name === "hora") { st.hora = t.value; setTimeout(() => $("#inNome").focus(), 50); }
      atualizar();
    };
    $("#inNome").oninput = atualizar;
    f.onsubmit = confirmar;
  }
  const profSel = () => atual.profs.find(p => p.id === st.prof);
  function calc(data) {
    const s = atual.cfg.servicos.find(x => x.id === st.serv), dur = s ? s.dur : Math.min(...atual.cfg.servicos.map(x => x.dur));
    return st.prof ? A.slotsDoDia(atual.cfg, data, dur, st.busy, null, profSel()) : A.slotsEquipe(atual.cfg, data, dur, st.busy, null, atual.profs);
  }
  function desenharDias() {
    const h0 = U.hoje(); let html = "";
    for (let i = 0; i < atual.cfg.diasAgenda; i++) {
      const d = A.addDays(h0, i), dt = A.parseYMD(d), fechado = calc(d).fechado;
      html += `<label class="op ${fechado ? "fechado" : ""}"><input type="radio" name="dia" value="${d}" ${st.dia === d ? "checked" : ""}><span><small>${i === 0 ? "hoje" : i === 1 ? "amanhã" : dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</small><b>${dt.getDate()}</b><small>${dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</small></span></label>`;
    }
    $("#escDia").innerHTML = html;
    if (!st.dia || $(`#escDia input[value="${st.dia}"]`).closest(".op").classList.contains("fechado")) {
      const p = $("#escDia .op:not(.fechado) input"); st.dia = p ? p.value : null; if (p) p.checked = true;
    }
  }
  function desenharHoras() {
    const box = $("#escHora");
    if (!st.serv || !st.dia) { box.innerHTML = `<p class="vazio">Escolha o serviço e o dia.</p>`; return; }
    const r = calc(st.dia), livres = r.slots.filter(x => x.livre);
    if (r.fechado) { box.innerHTML = `<p class="vazio">${st.prof ? esc(profSel().nome) + " não atende neste dia." : "Fechado neste dia."} Escolha outro.</p>`; st.hora = null; return; }
    if (!livres.length) { box.innerHTML = `<p class="vazio">Sem horários livres neste dia. Tente o próximo${atual.profs.length > 1 && st.prof ? " ou outro barbeiro" : ""}.</p>`; st.hora = null; return; }
    if (st.hora && !livres.some(x => x.hora === st.hora)) st.hora = null;
    box.innerHTML = r.slots.map(x => `<label class="op ${x.livre ? "" : "ocupado"}"><input type="radio" name="hora" value="${x.hora}" ${x.livre ? "" : "disabled"} ${st.hora === x.hora ? "checked" : ""}><span>${x.hora}</span></label>`).join("");
  }
  function atualizar() {
    const s = atual.cfg.servicos.find(x => x.id === st.serv), nome = $("#inNome").value.trim(), varios = atual.profs.length > 1;
    if (varios) $("#fsProf").classList.toggle("travado", !s);
    $("#fsDia").classList.toggle("travado", !s);
    $("#fsHora").classList.toggle("travado", !s || !st.dia);
    $("#fsNome").classList.toggle("travado", !st.hora);
    let r = "Escolha um serviço";
    if (s) r = `<b>${esc(s.nome)}</b> · ${money(s.preco)}${varios ? " · " + esc(st.prof ? profSel().nome : "qualquer barbeiro") : ""}<br>` + (st.dia ? esc(fmtData(st.dia)) + (st.hora ? " às " + st.hora : " · escolha o horário") : "escolha o dia");
    $("#resumo").innerHTML = r;
    $("#btnConf").disabled = !(s && st.dia && st.hora && nome.length >= 2);
  }
  async function confirmar(e) {
    e.preventDefault();
    const nome = $("#inNome").value.trim(), tel = $("#inTel") ? $("#inTel").value.trim() : "";
    if (nome.length < 2) { $("#erroAg").textContent = "Digite seu nome."; return; }
    const btn = $("#btnConf"); btn.disabled = true; btn.textContent = "Agendando…";
    try {
      const s = atual.cfg.servicos.find(x => x.id === st.serv);
      const r = await S.agendar(atual.slug, { servico_id: st.serv, prof_id: st.prof || null, nome, telefone: tel, data: st.dia, hora: st.hora });
      const ag = { id: r.id, token: r.token, slug: atual.slug, data: st.dia, hora: st.hora, dur: s.dur, servico: s.nome, preco: s.preco, nome, prof: r.prof_nome || "" };
      ls.set("bb_meus", ls.get("bb_meus", []).concat(ag)); ls.set("bb_nome", nome); if (tel) ls.set("bb_tel", tel);
      st.hora = null; atual.carregado = 0; await agendar(); sucesso(ag);
    } catch (err) {
      $("#erroAg").textContent = err.message || "Não foi possível agendar.";
      try { const b = await S.ocupados(atual.slug, st.dia, st.dia); st.busy = st.busy.filter(x => x.data !== st.dia).concat(b); } catch {}
      st.hora = null; desenharHoras(); atualizar(); btn.textContent = "Confirmar";
    }
  }
  const msgWa = (ag, cancel) => (cancel ? "Olá! Cancelei meu horário: " : "Olá! Acabei de agendar pelo app: ") + `${ag.servico}${ag.prof ? " com " + ag.prof : ""} em ${fmtData(ag.data)} às ${ag.hora}. Nome: ${ag.nome}`;
  function sucesso(ag) {
    const cfg = atual.cfg;
    const b = U.modal(`<div class="ticket"><span class="tag agendado">Confirmado</span>
      <p class="quando">${esc(fmtData(ag.data, true))}<br>às ${esc(ag.hora)}</p>
      <p style="margin:0"><b>${esc(ag.servico)}</b> · ${money(ag.preco)} · ${esc(durTxt(ag.dur))}${ag.prof ? `<br>com <b>${esc(ag.prof)}</b>` : ""}<br>${esc(ag.nome)}</p></div>
      <p style="color:var(--mut);margin-top:0">Seu horário fica salvo em <b>Meus</b>. Se não puder vir, cancele por lá.</p>
      <div class="pilha">${cfg.whatsapp ? `<a class="btn btn-ok" target="_blank" rel="noopener" href="${esc(wa(cfg.whatsapp, msgWa(ag)))}">Avisar no WhatsApp</a>` : ""}
        <button class="btn btn-sec" id="mIcs">Adicionar ao calendário</button><button class="btn" id="mOk">Ver meus horários</button></div>`);
    b.querySelector("#mIcs").onclick = () => U.ics(ag, atual.b.nome, cfg.endereco);
    b.querySelector("#mOk").onclick = () => U.go("/" + atual.slug + "/meus");
  }

  // ---------- MEUS ----------
  async function meus() {
    app().innerHTML = `<div class="band"><h1 class="titulo-pag">Meus horários</h1><div id="listaMeus"><p class="vazio">Carregando…</p></div></div>`;
    const box = $("#listaMeus"), todos = ls.get("bb_meus", []);
    let meus = todos.filter(m => m.slug === atual.slug);
    if (!meus.length) { box.innerHTML = `<p class="vazio">Você ainda não tem horários aqui.</p><p><a class="btn" href="/${esc(atual.slug)}/agendar" data-link>Agendar agora</a></p>`; return; }
    const sts = {}; try { (await S.statusCliente(meus.map(m => m.id))).forEach(x => sts[x.id] = x.status); } catch {}
    const n = new Date(), agora = U.hoje() + " " + A.toHM(n.getHours() * 60 + n.getMinutes());
    meus.forEach(m => { m.status = sts[m.id] || m.status || "agendado"; m.passado = (m.data + " " + m.hora) < agora; });
    meus.sort((a, b) => a.passado !== b.passado ? (a.passado ? 1 : -1) : a.passado ? (b.data + b.hora).localeCompare(a.data + a.hora) : (a.data + a.hora).localeCompare(b.data + b.hora));
    ls.set("bb_meus", todos.map(t => { const m = meus.find(x => x.id === t.id); if (!m) return t; const { passado, ...r } = m; return r; }));
    const rot = { agendado: "Agendado", concluido: "Concluído", cancelado: "Cancelado", faltou: "Não compareceu" };
    box.innerHTML = meus.map(m => `<div class="ticket" data-id="${esc(m.id)}">
      <span class="tag ${esc(m.status)}">${m.passado && m.status === "agendado" ? "Passado" : esc(rot[m.status] || m.status)}</span>
      <p class="quando">${esc(fmtData(m.data, true))} · ${esc(m.hora)}</p>
      <p style="margin:0"><b>${esc(m.servico)}</b> · ${money(m.preco)}${m.prof ? " · com " + esc(m.prof) : ""}</p>
      <div class="acoes">${!m.passado && m.status === "agendado" ? `<button class="btn btn-mini btn-sec" data-a="ics">Calendário</button><button class="btn btn-mini" data-a="cancelar">Cancelar</button>`
        : `<button class="lnk" data-a="remover">Remover da lista</button><a class="lnk" href="/${esc(atual.slug)}/agendar" data-link>Agendar de novo</a>`}</div></div>`).join("");
    box.onclick = e => {
      const b = e.target.closest("[data-a]"); if (!b) return;
      const id = b.closest("[data-id]").dataset.id, lista = ls.get("bb_meus", []), m = lista.find(x => x.id === id);
      if (b.dataset.a === "ics") U.ics(m, atual.b.nome, atual.cfg.endereco);
      if (b.dataset.a === "remover") { ls.set("bb_meus", lista.filter(x => x.id !== id)); meus(); }
      if (b.dataset.a === "cancelar") {
        const mb = U.modal(`<h2>Cancelar horário?</h2><p>${esc(m.servico)} em ${esc(fmtData(m.data, true))} às ${esc(m.hora)}.</p>
          <div class="pilha"><button class="btn" id="mSim">Sim, cancelar</button><button class="btn btn-sec" data-fechar>Manter horário</button></div>`);
        mb.querySelector("#mSim").onclick = async () => {
          try {
            await S.cancelar(m.id, m.token); m.status = "cancelado"; ls.set("bb_meus", lista); atual.carregado = 0; U.toast("Horário cancelado.");
            if (atual.cfg.whatsapp) U.modal(`<h2>Cancelado</h2><p>Quer avisar a barbearia?</p><div class="pilha"><a class="btn btn-ok" target="_blank" rel="noopener" href="${esc(wa(atual.cfg.whatsapp, msgWa(m, true)))}">Avisar no WhatsApp</a><button class="btn btn-sec" data-fechar>Fechar</button></div>`);
            else U.fecharModal();
            meus();
          } catch (err) { U.toast(err.message); U.fecharModal(); }
        };
      }
    };
  }

  // ---------- INFO ----------
  function info() {
    const { cfg } = atual, maps = cfg.mapsUrl || (cfg.endereco ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(cfg.endereco) : "");
    app().innerHTML = `<div class="band"><h1 class="titulo-pag">Informações</h1><ul class="info-lista">
      ${cfg.endereco ? `<li><small>Endereço</small>${maps ? `<a href="${esc(maps)}" target="_blank" rel="noopener">${esc(cfg.endereco)}</a>` : esc(cfg.endereco)}</li>` : ""}
      ${cfg.whatsapp ? `<li><small>WhatsApp</small><a href="${esc(wa(cfg.whatsapp))}" target="_blank" rel="noopener">+${esc(U.soDig(cfg.whatsapp))}</a></li>` : ""}
      ${cfg.instagram ? `<li><small>Instagram</small><a href="https://instagram.com/${esc(cfg.instagram.replace("@", ""))}" target="_blank" rel="noopener">@${esc(cfg.instagram.replace("@", ""))}</a></li>` : ""}
      <li><small>Agendamento</small>Até ${esc(cfg.diasAgenda)} dias de antecedência, com no mínimo ${esc(cfg.antecedenciaMin)} min antes do horário.</li></ul>
      <div class="contato" style="margin-bottom:24px">${contatos(cfg)}</div>
      <div class="instalar-box"><h2>Instale no seu celular</h2>
        <p><b>Android (Chrome):</b> toque em <i>Instalar app</i> no topo ou no menu ⋮ → <i>Instalar aplicativo</i>.</p>
        <p><b>iPhone (Safari):</b> toque em Compartilhar → <i>Adicionar à Tela de Início</i>.</p></div></div>`;
  }

  window.Cliente = { render };
}
