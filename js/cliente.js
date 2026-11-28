{
  const U = window.UI, S = window.Store, A = window.Agenda, P = window.PLATAFORMA;
  const { esc, money, $, ls, fmtData, durTxt, wa, DIAS } = U;
  const app = () => $("#app");
  let atual = null;
  const st = { serv: null, prof: "", dia: null, hora: null, busy: [] };
  let pre = null, plano = null;

  async function carregar(slug) {
    if (atual && atual.slug === slug && Date.now() - atual.carregado < 60000) return atual;
    const d = await S.publico(slug);
    if (!d) return null;
    atual = { slug, b: d.b, cfg: d.b.config, profs: d.profs, produtos: d.produtos || [], pacotes: d.pacotes || [], carregado: Date.now() };
    ls.set("bb_cache_" + slug, d);
    Object.assign(st, { serv: null, prof: "", dia: null, hora: null });
    return atual;
  }

  async function render(slug, view) {
    if (!["inicio", "agendar", "meus", "info"].includes(view)) view = "inicio";
    let d;
    try { d = await carregar(slug); }
    catch { const c = ls.get("bb_cache_" + slug, null); if (c) { atual = { slug, b: c.b, cfg: c.b.config, profs: c.profs, produtos: c.produtos || [], pacotes: c.pacotes || [], carregado: 0 }; d = atual; U.toast("Sem conexão: mostrando dados salvos."); } }
    if (!d) return naoEncontrada(slug);
    const base = "/" + slug, nome = d.b.nome;
    const ic = U.iconesDe(d.b.id, d.cfg.logo);
    document.title = nome; U.manifestPara(nome, base, ic); ls.set("bb_ultima", slug);
    U.moldura({ marca: nome, marcaHref: base, ativo: view, logo: ic && ic.i192, tabs: [
      { id: "inicio", txt: "Início", href: base }, { id: "agendar", txt: "Agendar", href: base + "/agendar" },
      { id: "meus", txt: "Meus", href: base + "/meus" }, { id: "info", txt: "Info", href: base + "/info" }] });
    U.rodapeHTML(`<a href="/painel" data-link class="link-painel">Área do barbeiro</a><small class="lukdev">Agenda por <a href="/" data-link>${esc(P.nome)}</a> · <a href="/privacidade/">Privacidade</a></small>`);
    app().onclick = null;
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
  const IC = {
    zap: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.3 2 2.2 4.2 4.6 4.8l1.2-1.2 1.7.8c0 1-.8 1.8-2 1.8-3.4 0-6.8-3.4-6.8-6.8 0-1.2.8-2 1.8-2l.8 1.7z"/></svg>`,
    mapa: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6-5.6-6-10.5a6 6 0 1 1 12 0C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/></svg>`,
    insta: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.6" cy="7.4" r=".6"/></svg>`,
    tesoura: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="17.5" r="2.5"/><path d="M8.6 8 20 18M8.6 16 20 6"/></svg>`
  };
  const mapsDe = cfg => cfg.mapsUrl || (cfg.endereco ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(cfg.endereco) : "");
  function atalhos(cfg) {
    const l = [];
    if (cfg.whatsapp) l.push(`<a href="${esc(wa(cfg.whatsapp, "Olá! Vim pelo app da " + atual.b.nome + "."))}" target="_blank" rel="noopener">${IC.zap}WhatsApp</a>`);
    if (mapsDe(cfg)) l.push(`<a href="${esc(mapsDe(cfg))}" target="_blank" rel="noopener">${IC.mapa}Como chegar</a>`);
    if (cfg.instagram) l.push(`<a href="https://instagram.com/${esc(cfg.instagram.replace("@", ""))}" target="_blank" rel="noopener">${IC.insta}Instagram</a>`);
    return l.length ? `<div class="atalhos">${l.join("")}</div>` : "";
  }
  const meusDaqui = () => ls.get("bb_meus", []).filter(m => m.slug === atual.slug);
  function proximoMeu() {
    const n = new Date(), agora = U.hoje() + " " + A.toHM(n.getHours() * 60 + n.getMinutes());
    return meusDaqui().filter(m => (m.status || "agendado") === "agendado" && (m.data + " " + m.hora) >= agora).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))[0];
  }
  const diaRel = d => d === U.hoje() ? "hoje" : d === A.addDays(U.hoje(), 1) ? "amanhã" : fmtData(d);
  const cobre = (pc, sid) => !pc.servicos.length || pc.servicos.includes(sid);

  async function inicio() {
    const { cfg, b, profs } = atual, ab = abertoAgora(cfg), hj = new Date().getDay(), lib = A.liberada(b, U.hoje()), pacs = atual.pacotes || [];
    const capa = cfg.capa && cfg.capa.v ? S.fotoURL(b.id, "capa.webp", cfg.capa.v) : null;
    const opCapa = Math.min(0.9, Math.max(0, (cfg.capa && cfg.capa.escurecer != null ? cfg.capa.escurecer : 55) / 100));
    const prox = proximoMeu(), ic = U.iconesDe(b.id, cfg.logo);
    const todosNoPlano = cfg.servicos.every(s => pacs.some(pc => cobre(pc, s.id)));
    app().innerHTML = `<div class="hero${capa ? " com-capa" : ""}"${capa ? ` style="--capa:url('${esc(capa)}');--capa-op:${opCapa}"` : ""}>
      <div class="hero-txt"><p class="aberto ${ab ? "on" : ""}">${ab ? "Aberto agora" : "Fechado agora"}</p>
        <h1>${esc(b.nome)}</h1>${cfg.slogan ? `<p class="slogan">${esc(cfg.slogan)}</p>` : ""}
        ${lib ? `<a class="btn btn-grande" href="/${esc(b.slug)}/agendar" data-link>Agendar horário</a>`
              : `<p class="proximo">Agendamento online pausado no momento.</p>${cfg.whatsapp ? `<a class="btn btn-ok" target="_blank" rel="noopener" href="${esc(wa(cfg.whatsapp, "Olá! Quero agendar um horário."))}">Agendar pelo WhatsApp</a>` : ""}`}
      </div>
      ${ic ? `<img class="hero-logo" src="${esc(ic.i512)}" alt="Logo da ${esc(b.nome)}" width="160" height="160">` : `<svg class="poste" viewBox="0 0 120 300" aria-hidden="true"><use href="#posteGrande"/></svg>`}
      ${atalhos(cfg)}</div>
    ${prox ? `<div class="band band-curta"><a class="meu-prox" href="/${esc(b.slug)}/meus" data-link><span class="mp-data"><small>${esc(diaRel(prox.data))}</small><b>${esc(prox.hora)}</b></span>
      <span class="mp-txt"><small>Seu próximo horário</small><b>${esc(prox.servico)}${prox.prof ? " com " + esc(prox.prof) : ""}</b></span><span class="mp-seta" aria-hidden="true">›</span></a></div>` : ""}
    ${lib ? `<div class="band"><div class="sec-cab"><h2>Horários livres</h2><small id="livresQuando"></small></div><div class="livres" id="livres">${"<span class=\"sk\"></span>".repeat(6)}</div></div>` : ""}
    <div class="band"><h2>Serviços</h2><div class="serv-cards">${cfg.servicos.map(s => { const f = fotoServ(s), noPlano = pacs.some(pc => cobre(pc, s.id));
      return `<article class="serv-card">${f ? `<button class="sc-foto" data-zoom="${esc(f)}" data-tit="${esc(s.nome)}" aria-label="Ver foto de ${esc(s.nome)}"><img src="${esc(f)}" alt="" width="64" height="64" loading="lazy"></button>` : `<span class="sc-foto sc-ic">${IC.tesoura}</span>`}
        <div class="sc-txt"><b>${esc(s.nome)}</b><small>${esc(durTxt(s.dur))}${s.desc ? " · " + esc(s.desc) : ""}</small>${noPlano && !todosNoPlano ? `<span class="sc-plano">Incluso no plano</span>` : ""}</div>
        <div class="sc-dir"><span class="preco">${money(s.preco)}</span>${lib ? `<button class="btn btn-mini" data-serv="${esc(s.id)}" aria-label="Agendar ${esc(s.nome)}">Agendar</button>` : ""}</div></article>`; }).join("")}</div></div>
    ${pacs.length ? `<div class="band" id="planos"><h2>Planos <em>mensais</em></h2><p class="sub">Pague um valor por mês e corte sem pensar no preço. O pagamento é feito direto na barbearia.</p>
      <div id="meuPlanoBox"></div>
      <div class="pac-cards">${pacs.map((pc, i) => `<div class="pac-card${pacs.length > 1 && i === pacs.length - 1 ? " destaque" : ""}">
        <b class="pac-nome">${esc(pc.nome)}</b><div class="pac-preco">${money(pc.preco)}<small>/mês</small></div>
        <p class="pac-cortes"><b>${pc.cortes} ${pc.cortes === 1 ? "atendimento" : "atendimentos"}</b> por mês · sai por ${money(pc.preco / pc.cortes)} cada</p>
        <p class="pac-serv">Vale para: ${pc.servicos.length ? esc(pc.servicos.map(id => (cfg.servicos.find(s => s.id === id) || {}).nome).filter(Boolean).join(", ")) : "qualquer serviço"}</p>
        ${pc.descricao ? `<p class="pac-desc">${esc(pc.descricao)}</p>` : ""}
        <button class="btn pac-btn" data-assinar="${esc(pc.id)}">Quero assinar</button></div>`).join("")}</div>
      <p class="pac-cod"><button class="lnk" id="tenhoCodigo">Já assino e tenho um código</button></p></div>` : ""}
    ${profs.length > 1 ? `<div class="band"><h2>Equipe</h2><div class="equipe-pub">${profs.map(p => `<div><span class="avatar">${esc(U.iniciais(p.nome))}</span>${esc(p.nome)}</div>`).join("")}</div></div>` : ""}
    ${vitrine()}
    <div class="band band-escura"><h2>Horário de funcionamento</h2>
      <ul class="horarios">${[1, 2, 3, 4, 5, 6, 0].map(i => { const h = cfg.horarios[i];
        return `<li class="${i === hj ? "hoje" : ""}"><span>${DIAS[i]}</span><span>${h && h.aberto ? esc(h.abre) + " – " + esc(h.fecha) : "Fechado"}</span></li>`; }).join("")}</ul>
      ${cfg.endereco ? `<p class="endereco">${esc(cfg.endereco)}</p>` : ""}<div class="contato">${contatos(cfg)}</div></div>`;
    ligarZoom(app());
    const vt = $("#vitrine"); if (vt) { const passo = d => vt.scrollBy({ left: d * 170, behavior: "smooth" }); const a1 = $("#vtAnt"), a2 = $("#vtProx"); if (a1) { a1.onclick = () => passo(-1); a2.onclick = () => passo(1); } }
    app().onclick = e => {
      const s = e.target.closest("[data-serv]"); if (s) { pre = { serv: s.dataset.serv }; return U.go("/" + b.slug + "/agendar"); }
      const h = e.target.closest("[data-livre]"); if (h) { const [d, t] = h.dataset.livre.split("|"); pre = { dia: d, hora: t }; return U.go("/" + b.slug + "/agendar"); }
      const as = e.target.closest("[data-assinar]"); if (as) return assinar(pacs.find(p => p.id === as.dataset.assinar));
      if (e.target.closest("#tenhoCodigo")) return informarCodigo();
    };
    if (pacs.length) desenharMeuPlano($("#meuPlanoBox"));
    if (!lib) return;
    try {
      const menor = Math.min(...cfg.servicos.map(s => s.dur)), h0 = U.hoje(), busy = await S.ocupados(b.slug, h0, A.addDays(h0, 7)), box = $("#livres");
      if (!box) return;
      for (let i = 0; i <= 7; i++) {
        const d = A.addDays(h0, i), l = A.slotsEquipe(cfg, d, menor, busy, null, profs).slots.filter(x => x.livre);
        if (l.length) {
          $("#livresQuando").textContent = i === 0 ? "hoje" : i === 1 ? "amanhã" : fmtData(d);
          box.innerHTML = l.slice(0, 8).map(x => `<button class="livre" data-livre="${d}|${x.hora}">${x.hora}</button>`).join("") + (l.length > 8 ? `<a class="livre mais" href="/${esc(b.slug)}/agendar" data-link>+${l.length - 8}</a>` : "");
          return;
        }
      }
      box.innerHTML = `<p class="vazio">Sem horários livres nos próximos dias.</p>`;
    } catch { const box = $("#livres"); if (box) box.closest(".band").remove(); }
  }

  // ---------- plano de fidelidade (lado do cliente) ----------
  const chavePlano = () => "bb_plano_" + atual.slug;
  async function planoDoAparelho() {
    const cod = ls.get(chavePlano(), ""); if (!cod) return null;
    try { const p = await S.meuPlano(atual.slug, cod); if (!p) { ls.set(chavePlano(), ""); return null; } return p; } catch { return null; }
  }
  const ateTxt = d => d ? d.slice(8) + "/" + d.slice(5, 7) : "";
  function cartaoPlano(p) {
    const zap = atual.cfg.whatsapp, pc = p.pacote || { nome: "Plano", cortes: 0 };
    if (p.status === "pendente") return `<div class="meu-plano pendente"><small>Pedido enviado</small><b>${esc(pc.nome)}</b>
      <p>Assim que a barbearia confirmar o pagamento, seu plano é ativado. Seu código: <code>${esc(p.codigo)}</code></p>
      ${zap ? `<a class="btn btn-mini btn-ok" target="_blank" rel="noopener" href="${esc(wa(zap, `Olá! Pedi o plano ${pc.nome} pelo app. Nome: ${p.nome}. Código: ${p.codigo}.`))}">Combinar pagamento no WhatsApp</a>` : ""}</div>`;
    if (p.status === "cancelada") return `<div class="meu-plano"><small>Plano cancelado</small><b>${esc(pc.nome)}</b><p>Fale com a barbearia se quiser voltar.</p></div>`;
    if (!p.ciclo_ini) return `<div class="meu-plano vencido"><small>Plano vencido</small><b>${esc(pc.nome)}</b><p>${p.valido_ate ? "Venceu em " + esc(ateTxt(p.valido_ate)) + ". " : ""}Renove direto com a barbearia.</p>
      ${zap ? `<a class="btn btn-mini btn-ok" target="_blank" rel="noopener" href="${esc(wa(zap, `Olá! Quero renovar meu plano ${pc.nome}. Código: ${p.codigo}.`))}">Renovar pelo WhatsApp</a>` : ""}</div>`;
    const resta = Math.max(0, pc.cortes - p.usados);
    return `<div class="meu-plano ativo"><small>Seu plano · código ${esc(p.codigo)}</small><b>${esc(pc.nome)}</b>
      <div class="mp-barra" role="img" aria-label="${p.usados} de ${pc.cortes} usados"><i style="width:${Math.min(100, p.usados / pc.cortes * 100)}%"></i></div>
      <p><b>${resta}</b> de ${pc.cortes} ${pc.cortes === 1 ? "atendimento disponível" : "atendimentos disponíveis"} até ${esc(ateTxt(p.ciclo_fim))}</p>
      ${resta && A.liberada(atual.b, U.hoje()) ? `<a class="btn btn-mini" href="/${esc(atual.slug)}/agendar" data-link>Agendar com o plano</a>` : ""}</div>`;
  }
  async function desenharMeuPlano(box) {
    if (!box) return;
    const p = await planoDoAparelho();
    if (!box.isConnected) return;
    box.innerHTML = p ? cartaoPlano(p) : "";
    if (p && box.closest("#planos")) box.closest("#planos").querySelectorAll(".pac-btn, .pac-cod").forEach(x => x.hidden = true);
  }
  function assinar(pc) {
    const b = U.modal(`<h2>Assinar ${esc(pc.nome)}</h2><p class="sub" style="margin-top:-6px">${money(pc.preco)} por mês · ${pc.cortes} ${pc.cortes === 1 ? "atendimento" : "atendimentos"}</p>
      <form id="fAss" class="form-grid"><label class="full">Seu nome<input name="nome" required maxlength="60" autocomplete="name" value="${esc(ls.get("bb_nome", ""))}"></label>
      <label class="full">WhatsApp<input name="tel" type="tel" inputmode="tel" autocomplete="tel" required maxlength="20" placeholder="(00) 00000-0000" value="${esc(ls.get("bb_tel", ""))}"></label>
      <p class="sub full" style="margin:0">Você paga direto na barbearia (Pix, cartão ou dinheiro). Quando eles confirmarem, o plano ativa e você agenda por aqui sem pagar a cada corte.</p>
      <p class="erro full" id="assErro"></p><button class="btn full">Enviar pedido</button><button type="button" class="btn btn-sec full" data-fechar>Cancelar</button></form>`);
    const f = b.querySelector("#fAss");
    f.onsubmit = async e => {
      e.preventDefault(); const nome = f.nome.value.trim(), tel = f.tel.value.trim();
      if (nome.length < 2) { b.querySelector("#assErro").textContent = "Digite seu nome."; return; }
      if (U.soDig(tel).length < 10) { b.querySelector("#assErro").textContent = "Digite seu WhatsApp com DDD."; return; }
      const bt = f.querySelector("button.btn:not(.btn-sec)"); bt.disabled = true;
      try {
        const r = await S.pedirAssinatura(atual.slug, pc.id, nome, tel);
        ls.set(chavePlano(), r.codigo); ls.set("bb_nome", nome); ls.set("bb_tel", tel);
        const zap = atual.cfg.whatsapp;
        U.modal(`<div class="ticket"><span class="tag agendado">${r.existente ? "Você já tem um pedido" : "Pedido enviado"}</span><p class="quando">${esc(pc.nome)}</p>
          <p style="margin:0">Seu código do plano:</p><p class="codigo-grande">${esc(r.codigo)}</p></div>
          <p class="sub">Guarde este código: com ele você usa o plano em outro celular. A barbearia vai ativar assim que receber o pagamento.</p>
          <div class="pilha">${zap ? `<a class="btn btn-ok" target="_blank" rel="noopener" href="${esc(wa(zap, `Olá! Quero assinar o plano ${pc.nome} (${money(pc.preco)}/mês). Nome: ${nome}. Código: ${r.codigo}.`))}">Combinar pagamento no WhatsApp</a>` : ""}<button class="btn btn-sec" data-fechar>Fechar</button></div>`);
        desenharMeuPlano($("#meuPlanoBox"));
      } catch (er) { b.querySelector("#assErro").textContent = er.message; bt.disabled = false; }
    };
  }
  function informarCodigo() {
    const b = U.modal(`<h2>Código do plano</h2><form id="fCod" class="form-grid"><label class="full">Digite o código que você recebeu<input name="cod" required maxlength="8" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase;letter-spacing:.2em;font-weight:700"></label>
      <p class="erro full" id="codErro"></p><button class="btn full">Usar este código</button><button type="button" class="btn btn-sec full" data-fechar>Cancelar</button></form>`);
    const f = b.querySelector("#fCod");
    f.onsubmit = async e => {
      e.preventDefault(); const c = f.cod.value.trim().toUpperCase();
      try { const p = await S.meuPlano(atual.slug, c); if (!p) { b.querySelector("#codErro").textContent = "Código não encontrado nesta barbearia."; return; }
        ls.set(chavePlano(), c); U.fecharModal(); U.toast("Plano vinculado a este celular."); desenharMeuPlano($("#meuPlanoBox")); }
      catch (er) { b.querySelector("#codErro").textContent = er.message; }
    };
  }

  const fotoServ = s => s.foto && s.foto.v ? S.fotoURL(atual.b.id, "serv-" + s.id + ".webp", s.foto.v) : null;
  const fotoProd = p => p.foto_v ? S.fotoURL(atual.b.id, "prod-" + p.id + ".webp", p.foto_v) : null;
  function ligarZoom(raiz) {
    if (!raiz || raiz._zoom) return; raiz._zoom = true;
    raiz.addEventListener("click", e => {
      const z = e.target.closest("[data-zoom]"); if (!z) return;
      e.preventDefault(); e.stopPropagation();
      U.modal(`<figure class="zoom"><img src="${esc(z.dataset.zoom)}" alt="${esc(z.dataset.tit || "")}"><figcaption>${esc(z.dataset.tit || "")}</figcaption></figure><button class="btn btn-sec" data-fechar style="width:100%">Fechar</button>`);
    });
  }
  function vitrine() {
    const l = atual.produtos || []; if (!l.length) return "";
    const zap = atual.cfg.whatsapp;
    return `<div class="band"><div class="vitrine-cab"><h2>Produtos</h2>${l.length > 2 ? `<div class="seg" style="margin:0"><button class="btn btn-mini btn-sec" id="vtAnt" aria-label="Anteriores">‹</button><button class="btn btn-mini btn-sec" id="vtProx" aria-label="Próximos">›</button></div>` : ""}</div>
      <div class="vitrine" id="vitrine">${l.map(p => { const f = fotoProd(p);
        return `<div class="vit-item ${p.esgotado ? "esgotado" : ""}">${f ? `<button class="vit-foto" data-zoom="${esc(f)}" data-tit="${esc(p.nome)}" aria-label="Ver foto de ${esc(p.nome)}"><img src="${esc(f)}" alt="" width="150" height="150" loading="lazy"></button>` : `<div class="vit-foto vazio-foto" aria-hidden="true"></div>`}
          <b>${esc(p.nome)}</b>${p.descricao ? `<small>${esc(p.descricao)}</small>` : ""}<span class="preco">${money(p.preco)}</span>
          ${p.esgotado ? `<span class="tag cancelado">Esgotado</span>` : zap ? `<a class="btn btn-mini btn-ok" target="_blank" rel="noopener" href="${esc(wa(zap, `Olá! Quero reservar: ${p.nome} (${money(p.preco)}). Retiro na barbearia.`))}">Reservar</a>` : `<small>Disponível na barbearia</small>`}</div>`; }).join("")}</div></div>`;
  }

  async function agendar() {
    const { cfg, profs } = atual, varios = profs.length > 1;
    let n = 1;
    app().innerHTML = `<div class="band"><h1 class="titulo-pag">Agendar</h1><form id="fAg" novalidate>
      <div id="atalhoAg"></div>
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
    if (pre) { ["serv", "prof", "dia", "hora"].forEach(k => { if (pre[k] != null) st[k] = pre[k]; }); pre = null; }
    $("#escServ").innerHTML = cfg.servicos.map(s => { const f = fotoServ(s);
      return `<label class="op ${f ? "op-foto" : ""}"><input type="radio" name="serv" value="${esc(s.id)}" ${st.serv === s.id ? "checked" : ""}><span>${f ? `<img src="${esc(f)}" alt="" width="40" height="40" loading="lazy" data-zoom="${esc(f)}" data-tit="${esc(s.nome)}" title="Toque para ampliar">` : ""}<b>${esc(s.nome)}</b><small>${money(s.preco)} · ${esc(durTxt(s.dur))}</small></span></label>`; }).join("");
    ligarZoom($("#escServ"));
    if (varios) $("#escProf").innerHTML = [{ id: "", nome: "Qualquer um", sub: "mais horários" }].concat(profs).map(p =>
      `<label class="op"><input type="radio" name="prof" value="${esc(p.id)}" ${st.prof === p.id ? "checked" : ""}><span><span class="avatar">${p.id ? esc(U.iniciais(p.nome)) : "★"}</span><b>${esc(p.nome)}</b>${p.sub ? `<small>${p.sub}</small>` : ""}</span></label>`).join("");
    const h0 = U.hoje();
    const [busy, pl] = await Promise.all([S.ocupados(atual.slug, h0, A.addDays(h0, cfg.diasAgenda - 1)).catch(() => null), (atual.pacotes || []).length || ls.get(chavePlano(), "") ? planoDoAparelho() : null]);
    if (!$("#fAg")) return;
    if (busy) st.busy = busy; else { $("#erroAg").textContent = "Sem conexão. Tente novamente."; st.busy = []; }
    plano = pl && pl.status === "ativa" && pl.pacote && (pl.ciclos || []).some(x => x.usados < pl.pacote.cortes) ? pl : null;
    const ult = meusDaqui().slice().sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora))[0];
    const ultServ = ult && cfg.servicos.find(s => s.id === ult.servico_id || s.nome === ult.servico), ultProf = ult && profs.find(p => p.id === ult.prof_id || p.nome === ult.prof);
    $("#atalhoAg").innerHTML = (plano ? `<label class="usar-plano"><input type="checkbox" id="usarPlano" checked><span><b>Usar meu plano</b><small>${esc(plano.pacote.nome)} · ${Math.max(0, plano.pacote.cortes - plano.usados)} de ${plano.pacote.cortes} disponíveis${plano.ciclo_fim ? " até " + esc(ateTxt(plano.ciclo_fim)) : ""}</small></span></label>` : "")
      + (ultServ && !st.serv ? `<button type="button" class="chip repetir" id="btnRepetir">↻ Repetir: ${esc(ultServ.nome)}${varios && ultProf ? " com " + esc(ultProf.nome) : ""}</button>` : "");
    if (plano) $("#escServ").querySelectorAll("input[name=serv]").forEach(i => { if (cobre(plano.pacote, i.value)) i.nextElementSibling.insertAdjacentHTML("beforeend", `<em class="op-plano">no plano</em>`); });
    const rp = $("#btnRepetir"); if (rp) rp.onclick = () => { pre = { serv: ultServ.id, prof: varios && ultProf ? ultProf.id : "" }; agendar(); };
    const up = $("#usarPlano"); if (up) up.onchange = atualizar;
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
      const d = A.addDays(h0, i), dt = A.parseYMD(d), rr = calc(d), fechado = rr.fechado || !rr.slots.some(x => x.livre);
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
  const usaPlano = s => !!(plano && s && $("#usarPlano") && $("#usarPlano").checked && cobre(plano.pacote, s.id));
  function atualizar() {
    const s = atual.cfg.servicos.find(x => x.id === st.serv), nome = $("#inNome").value.trim(), varios = atual.profs.length > 1;
    if (varios) $("#fsProf").classList.toggle("travado", !s);
    $("#fsDia").classList.toggle("travado", !s);
    $("#fsHora").classList.toggle("travado", !s || !st.dia);
    $("#fsNome").classList.toggle("travado", !st.hora);
    let r = "Escolha um serviço";
    const precoTxt = s ? (usaPlano(s) ? "incluso no plano" : money(s.preco) + (plano && $("#usarPlano") && $("#usarPlano").checked ? " · fora do plano" : "")) : "";
    if (s) r = `<b>${esc(s.nome)}</b> · ${precoTxt}${varios ? " · " + esc(st.prof ? profSel().nome : "qualquer barbeiro") : ""}<br>` + (st.dia ? esc(fmtData(st.dia)) + (st.hora ? " às " + st.hora : " · escolha o horário") : "escolha o dia");
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
      const cod = usaPlano(s) ? plano.codigo : null;
      const r = await S.agendar(atual.slug, { servico_id: st.serv, prof_id: st.prof || null, nome, telefone: tel, data: st.dia, hora: st.hora, codigo: cod });
      const ag = { id: r.id, token: r.token, slug: atual.slug, data: st.dia, hora: st.hora, dur: s.dur, servico: s.nome, servico_id: s.id, preco: cod ? 0 : s.preco, plano: !!cod, nome, prof: r.prof_nome || "", prof_id: st.prof || "" };
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
      <p style="margin:0"><b>${esc(ag.servico)}</b> · ${ag.plano ? "incluso no plano" : money(ag.preco)} · ${esc(durTxt(ag.dur))}${ag.prof ? `<br>com <b>${esc(ag.prof)}</b>` : ""}<br>${esc(ag.nome)}</p></div>
      <p style="color:var(--mut);margin-top:0">Seu horário fica salvo em <b>Meus</b>. Se não puder vir, cancele por lá.</p>
      <div class="pilha">${cfg.whatsapp ? `<a class="btn btn-ok" target="_blank" rel="noopener" href="${esc(wa(cfg.whatsapp, msgWa(ag)))}">Avisar no WhatsApp</a>` : ""}
        <button class="btn btn-sec" id="mIcs">Adicionar ao calendário</button><button class="btn" id="mOk">Ver meus horários</button></div>`);
    b.querySelector("#mIcs").onclick = () => U.ics(ag, atual.b.nome, cfg.endereco);
    b.querySelector("#mOk").onclick = () => U.go("/" + atual.slug + "/meus");
  }

  async function meus() {
    app().innerHTML = `<div class="band"><h1 class="titulo-pag">Meus horários</h1><div id="meuPlanoBox"></div><div id="listaMeus"><p class="vazio">Carregando…</p></div>
      ${(atual.pacotes || []).length && !ls.get(chavePlano(), "") ? `<p class="pac-cod"><button class="lnk" id="tenhoCodigo">Assino um plano e tenho um código</button></p>` : ""}</div>`;
    desenharMeuPlano($("#meuPlanoBox"));
    const tc = $("#tenhoCodigo"); if (tc) tc.onclick = informarCodigo;
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
      <p style="margin:0"><b>${esc(m.servico)}</b> · ${m.plano ? "pelo plano" : money(m.preco)}${m.prof ? " · com " + esc(m.prof) : ""}</p>
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
