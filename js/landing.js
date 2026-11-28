{
  const U = window.UI, S = window.Store, P = window.PLATAFORMA;
  const { esc, money, $ } = U;
  const app = () => $("#app");

  const LANDING_HTML = (() => { const el = document.getElementById("landing");
    return el ? el.outerHTML.replace(/href="[^"]*" data-link-l="([^"]*)"/g, 'href="$1" data-link') : ""; })();

  function topoSite() {
    U.manifestPadrao(); document.title = P.nome + " · Agenda online para barbearias";
    U.moldura({ marca: P.nome, acoes: `<a class="btn btn-mini btn-claro" href="/painel" data-link>Entrar</a>` });
    U.rodapeHTML(`<span>© ${new Date().getFullYear()} ${esc(P.nome)}</span><span class="links-legais"><a href="/termos/">Termos de Uso</a> · <a href="/privacidade/">Privacidade</a>${P.suporteWhatsapp ? ` · <a href="${esc(U.wa(P.suporteWhatsapp, "Olá! Preciso de ajuda com o " + P.nome + "."))}" target="_blank" rel="noopener">Suporte</a>` : ""}</span>`);
  }

  function inicio() {
    topoSite();
    app().innerHTML = LANDING_HTML || `<div class="form-pag"><h1>${esc(P.nome)}</h1></div>`;
    document.querySelectorAll(".dominio").forEach(el => el.textContent = dominio());
    const wa = $("#waVendas");
    if (wa) { if (P.suporteWhatsapp) wa.href = U.wa(P.suporteWhatsapp, "Olá! Quero saber mais sobre o " + P.nome + "."); else wa.hidden = true; }
    if (P.demoSlug) S.publico(P.demoSlug).then(d => { const l = $("#demoLink"); if (d && l) { l.hidden = false; l.setAttribute("href", U.url("/" + P.demoSlug)); l.dataset.raw = "/" + P.demoSlug; l.setAttribute("data-link", ""); } }).catch(() => {});
    const tr = $("#telasTrilho");
    if (tr) { const passo = d => tr.scrollBy({ left: d * (tr.querySelector(".tela").offsetWidth + 16), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      $("#telaAnt").onclick = () => passo(-1); $("#telaProx").onclick = () => passo(1);
      tr.onkeydown = e => { if (e.key === "ArrowRight") passo(1); if (e.key === "ArrowLeft") passo(-1); }; }
    U.planos().then(l => { const el = $("#lPlanos"); if (el && l.length) el.innerHTML = cartoesPlanos(l, "/cadastro", "Começar teste grátis"); if (window.ScrollTrigger) ScrollTrigger.refresh(); }).catch(() => {});
    if (window.Movimento) requestAnimationFrame(() => window.Movimento.iniciar());
  }
  const dominio = () => location.host + (window.BASE || "/");
  function cartoesPlanos(l, href, txt, atual) {
    const meio = Math.floor((l.length - 1) / 2);
    return l.map((p, i) => { const dest = atual ? p.id === atual : i === meio && l.length > 2;
      return `<div class="plano ${dest ? "destaque" : ""}">${dest ? `<span class="tag agendado">${atual ? "Seu plano" : "Mais escolhido"}</span>` : ""}
        <h3>${esc(p.nome)}</h3><p class="preco-plano">${money(p.preco)}<small>/mês</small></p><p>${esc(p.descricao || "")}</p>
        <p class="lim">${p.max_prof ? `Até ${p.max_prof} barbeiro${p.max_prof > 1 ? "s" : ""}` : "Barbeiros ilimitados"}</p>
        ${href ? `<a class="btn ${dest ? "" : "btn-sec"}" href="${href}" data-link>${txt}</a>` : ""}</div>`; }).join("");
  }

  function cadastro() {
    topoSite();
    const conv = new URLSearchParams(location.search).get("convite") || "";
    if (conv || location.search.includes("barbeiro")) return cadastroBarbeiro(conv);
    const logado = S.logado(), eu = S.usuario() || {};
    app().innerHTML = `<form class="form-pag" id="fCad" novalidate>
      <h1>Crie sua barbearia</h1><p class="l-sub2">${P.diasTeste} dias grátis. Leva 1 minuto.</p>
      ${logado ? `<p class="aviso">Você está conectado como <b>${esc(eu.email || "")}</b>. A barbearia será criada nessa conta. <button type="button" class="lnk" id="cadSair">Usar outra conta</button></p>` : ""}
      <label class="lbl">Nome da barbearia<input name="nome" required maxlength="60" placeholder="Ex.: Barbearia do Zé"></label>
      <label class="lbl">Endereço da sua página
        <input name="slug" required maxlength="40" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="ex.: barbearia-do-ze">
        <small class="link-prev">Seu link: ${esc(dominio())}<b id="slugPrev">sua-barbearia</b></small>
        <small id="slugMsg" class="dica"></small></label>
      <label class="lbl">Seu nome<input name="dono" required maxlength="40" autocomplete="name" placeholder="Como aparece para os clientes"></label>
      ${logado ? "" : `<label class="lbl">E-mail<input name="email" type="email" required autocomplete="email"></label>
      <label class="lbl">Senha<input name="senha" type="password" required minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres"></label>`}
      <p class="erro" id="cadErro" role="alert"></p>
      <button class="btn btn-grande" id="cadBtn" style="width:100%">Criar e começar o teste</button>
      ${logado ? "" : `<p class="centro">Já tem conta? <a href="/painel" data-link>Entrar</a> · Recebeu convite? <a href="/cadastro?barbeiro=1" data-link>Sou barbeiro</a></p>`}</form>`;
    const cs = $("#cadSair"); if (cs) cs.onclick = () => { S.sair(); U.ls.set("bb_bid", null); cadastro(); };
    const f = $("#fCad"), msg = $("#slugMsg");
    let editouSlug = false, t;
    const checar = () => {
      clearTimeout(t); const s = f.slug.value; $("#slugPrev").textContent = s || "sua-barbearia";
      if (!s) { msg.textContent = ""; return; }
      if (!S.slugOk(s)) { msg.textContent = "Use de 3 a 40 letras minúsculas, números e hífen."; msg.className = "dica ruim"; return; }
      msg.textContent = "Verificando…"; msg.className = "dica";
      t = setTimeout(async () => { const ok = await S.slugLivre(s).catch(() => false); if (f.slug.value !== s) return;
        msg.textContent = ok ? "Disponível" : "Já está em uso, tente outro."; msg.className = "dica " + (ok ? "bom" : "ruim"); }, 350);
    };
    f.nome.oninput = () => { if (!editouSlug) { f.slug.value = U.slugify(f.nome.value); checar(); } };
    f.slug.oninput = () => { editouSlug = true; f.slug.value = U.slugify(f.slug.value.replace(/\s/g, "-")).slice(0, 40); checar(); };
    f.onsubmit = async e => {
      e.preventDefault(); const err = $("#cadErro"); err.textContent = "";
      const d = { nome: f.nome.value.trim(), slug: f.slug.value.trim(), nomeDono: f.dono.value.trim(), email: logado ? "" : f.email.value.trim(), senha: logado ? "" : f.senha.value };
      if (d.nome.length < 2 || !d.nomeDono || (!logado && !d.email.includes("@"))) { err.textContent = "Preencha todos os campos."; return; }
      if (!S.slugOk(d.slug)) { err.textContent = "Escolha um endereço com 3 a 40 letras minúsculas, números e hífen."; return; }
      if (!logado && d.senha.length < 6) { err.textContent = "A senha precisa de pelo menos 6 caracteres."; return; }
      const btn = $("#cadBtn"); btn.disabled = true; btn.textContent = "Criando…";
      try {
        if (!(await S.slugLivre(d.slug))) throw new Error("Esse endereço já está em uso.");
        const r = logado ? { pendente: false } : await S.criarConta(d.email, d.senha, { cad: { nome: d.nome, slug: d.slug, nomeDono: d.nomeDono } });
        if (r.pendente) {
          U.ls.set("bb_cad_pendente", { nome: d.nome, slug: d.slug, nomeDono: d.nomeDono });
          app().innerHTML = `<div class="form-pag"><h1>Confirme seu e-mail</h1><p>Enviamos um link para <b>${esc(d.email)}</b>. Abra o link (pode ser no celular ou em outro navegador): você entra direto e a <b>${esc(d.nome)}</b> é criada automaticamente.</p><p class="sub">Não chegou? Veja a caixa de spam ou promoções.</p><a class="btn" href="/painel" data-link>Ir para o login</a></div>`;
          return;
        }
        await S.criarBarbearia(d);
        U.ls.set("bb_bid", null); U.toast("Barbearia criada! Configure seus serviços e horários.");
        U.go("/painel");
      } catch (er) { err.textContent = er.message; btn.disabled = false; btn.textContent = "Criar e começar o teste"; }
    };
  }

  function cadastroBarbeiro(conv) {
    app().innerHTML = `<form class="form-pag" id="fBarb" novalidate>
      <h1>Acesso de barbeiro</h1><p class="l-sub2">Use o código que o dono da barbearia te enviou.</p>
      <label class="lbl">Código do convite<input name="cod" required maxlength="6" value="${esc(conv)}" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase;letter-spacing:.2em;font-weight:800"></label>
      <label class="lbl">E-mail<input name="email" type="email" required autocomplete="email"></label>
      <label class="lbl">Crie uma senha<input name="senha" type="password" required minlength="6" autocomplete="new-password"></label>
      <p class="erro" id="bErro" role="alert"></p>
      <button class="btn btn-grande" style="width:100%">Criar meu acesso</button>
      <p class="centro">Já tem conta? <a href="/painel${conv ? "?convite=" + encodeURIComponent(conv) : ""}" data-link>Entrar e usar o convite</a></p></form>`;
    const f = $("#fBarb");
    f.onsubmit = async e => {
      e.preventDefault(); const err = $("#bErro"); err.textContent = "";
      if (f.cod.value.trim().length < 6) { err.textContent = "Digite o código de 6 caracteres."; return; }
      if (f.senha.value.length < 6) { err.textContent = "A senha precisa de pelo menos 6 caracteres."; return; }
      try {
        const r = await S.criarConta(f.email.value.trim(), f.senha.value);
        if (r.pendente) { U.ls.set("bb_convite_pendente", f.cod.value.trim());
          app().innerHTML = `<div class="form-pag"><h1>Confirme seu e-mail</h1><p>Depois de confirmar, entre com sua senha: o convite será usado automaticamente.</p><a class="btn" href="/painel" data-link>Ir para o login</a></div>`; return; }
        await S.aceitarConvite(f.cod.value); U.ls.set("bb_bid", null); U.toast("Acesso liberado!"); U.go("/painel");
      } catch (er) { err.textContent = er.message; }
    };
  }

  window.Landing = { inicio, cadastro, cartoesPlanos };
}
