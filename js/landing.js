// Site de vendas da plataforma (/) e cadastro de barbearias e barbeiros (/cadastro).
{
  const U = window.UI, S = window.Store, P = window.PLATAFORMA;
  const { esc, money, $ } = U;
  const app = () => $("#app");

  function topoSite() {
    U.manifestPadrao(); document.title = P.nome;
    U.moldura({ marca: P.nome, acoes: `<a class="btn btn-mini btn-claro" href="/painel" data-link>Entrar</a>` });
    U.rodapeHTML(`<span>© ${new Date().getFullYear()} ${esc(P.nome)}</span>`);
  }

  function inicio() {
    topoSite();
    const demo = S.modo === "local";
    app().innerHTML = `
    <section class="l-hero">
      <div class="l-hero-txt">
        <h1>A agenda da sua barbearia, no celular do cliente.</h1>
        <p class="l-sub">Seu link próprio, horários livres em tempo real e o cliente marca em 4 toques, só com o nome. Cada barbeiro com a sua agenda.</p>
        <div class="l-ctas"><a class="btn btn-grande" href="/cadastro" data-link>Testar grátis por ${P.diasTeste} dias</a>
        <a class="btn btn-grande btn-vidro" href="/navalha" data-link>Ver exemplo</a></div>
        <p class="l-mini">Sem cartão. Sem app para baixar: o cliente instala direto do navegador.</p>
      </div>
      <div class="celular" aria-hidden="true">
        <div class="cel-tela">
          <div class="cel-topo"><svg viewBox="0 0 24 24"><use href="#poste"/></svg>Barbearia Navalha</div>
          <div class="cel-corpo">
            <b class="cel-t">Com quem?</b>
            <div class="cel-profs"><span class="on">Qualquer um</span><span>Rafa</span><span>Léo</span></div>
            <b class="cel-t">Sábado, 28</b>
            <div class="cel-horas">${["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00"].map((h, i) => `<span class="${i === 4 ? "on" : [1, 2, 6].includes(i) ? "x" : ""}">${h}</span>`).join("")}</div>
            <div class="cel-nome">João</div>
            <div class="cel-btn">Confirmar · Corte R$ 40</div>
          </div>
        </div>
      </div>
    </section>
    ${demo ? `<div class="band"><div class="aviso"><b>Modo demonstração.</b> Contas de teste (senha <b>1234</b>): <b>dono@demo.com</b> (dono), <b>barbeiro@demo.com</b> (barbeiro), <b>admin@demo.com</b> (você, super admin). Barbearia de exemplo em <a href="/navalha" data-link>/navalha</a>.
      <button class="lnk" id="resetDemo">Recomeçar demonstração</button></div></div>` : ""}
    <section class="band">
      <h2>Como funciona</h2>
      <ol class="passos">
        <li><b>Crie sua barbearia</b><span>Escolha o endereço: ${esc(P.dominio)}/<i>sua-barbearia</i>.</span></li>
        <li><b>Configure em minutos</b><span>Serviços, preços, horários e a equipe. Cada barbeiro recebe um convite.</span></li>
        <li><b>Divulgue o link</b><span>Na bio do Instagram, no WhatsApp ou no QR Code do balcão.</span></li>
      </ol>
    </section>
    <section class="band band-escura">
      <h2>Um app, três visões</h2>
      <div class="tres">
        <div><h3>Cliente</h3><ul><li>Agenda sem cadastro, só o nome</li><li>Escolhe o barbeiro ou “qualquer um”</li><li>Lembrete no calendário e aviso no WhatsApp</li><li>Cancela sozinho, sem ligar</li></ul></div>
        <div><h3>Barbeiro</h3><ul><li>Vê só a própria agenda</li><li>Conclui, marca falta, faz encaixe</li><li>Bloqueia as próprias folgas</li><li>Acompanha o que ganhou</li></ul></div>
        <div><h3>Dono</h3><ul><li>Agenda de toda a equipe</li><li>Serviços, preços e horários</li><li>Faturamento e comissão por barbeiro</li><li>Histórico de clientes</li></ul></div>
      </div>
    </section>
    <section class="band" id="planos">
      <h2>Planos</h2>
      <div class="planos">${P.planos.map((p, i) => `<div class="plano ${i === 1 ? "destaque" : ""}">${i === 1 ? `<span class="tag agendado">Mais escolhido</span>` : ""}
        <h3>${esc(p.nome)}</h3><p class="preco-plano">${money(p.preco)}<small>/mês</small></p><p>${esc(p.desc)}</p>
        <p class="lim">${p.maxProf ? `Até ${p.maxProf} barbeiro${p.maxProf > 1 ? "s" : ""}` : "Barbeiros ilimitados"}</p>
        <a class="btn ${i === 1 ? "" : "btn-sec"}" href="/cadastro" data-link>Começar teste grátis</a></div>`).join("")}</div>
      <p class="l-mini" style="color:var(--mut)">Todos os planos com agenda online, painel, relatórios e app instalável. Valores de exemplo.</p>
    </section>
    <section class="band">
      <h2>Perguntas</h2>
      <details class="faq"><summary>O cliente precisa baixar algum app?</summary><p>Não. Ele abre o link da barbearia e agenda. Se quiser, instala na tela inicial pelo próprio navegador.</p></details>
      <details class="faq"><summary>E se dois clientes tentarem o mesmo horário?</summary><p>O sistema confere na hora de salvar. O segundo recebe o aviso e escolhe outro horário.</p></details>
      <details class="faq"><summary>Cada barbeiro tem login próprio?</summary><p>Sim. O dono envia um convite e o barbeiro cria a senha dele. Ele só enxerga a própria agenda.</p></details>
      <details class="faq"><summary>O que acontece depois do teste?</summary><p>Você escolhe um plano para continuar. Sem plano, a agenda online pausa, mas seus dados ficam guardados.</p></details>
      <p style="margin-top:22px"><a class="btn btn-grande" href="/cadastro" data-link>Criar minha barbearia</a></p>
    </section>`;
    const r = $("#resetDemo"); if (r) r.onclick = () => { S.resetDemo(); U.toast("Demonstração reiniciada."); U.rota(); };
  }

  function cadastro() {
    topoSite();
    const conv = new URLSearchParams(location.search).get("convite") || "";
    if (conv || location.search.includes("barbeiro")) return cadastroBarbeiro(conv);
    app().innerHTML = `<form class="form-pag" id="fCad" novalidate>
      <h1>Crie sua barbearia</h1><p class="l-sub2">${P.diasTeste} dias grátis. Leva 1 minuto.</p>
      <label class="lbl">Nome da barbearia<input name="nome" required maxlength="60" placeholder="Ex.: Barbearia do Zé"></label>
      <label class="lbl">Endereço da sua página
        <div class="slug-box"><span>${esc(P.dominio)}/</span><input name="slug" required maxlength="40" autocapitalize="none" autocomplete="off" spellcheck="false"></div>
        <small id="slugMsg" class="dica"></small></label>
      <label class="lbl">Seu nome<input name="dono" required maxlength="40" autocomplete="name" placeholder="Como aparece para os clientes"></label>
      <label class="lbl">E-mail<input name="email" type="email" required autocomplete="email"></label>
      <label class="lbl">Senha<input name="senha" type="password" required minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres"></label>
      <p class="erro" id="cadErro" role="alert"></p>
      <button class="btn btn-grande" style="width:100%">Criar e começar o teste</button>
      <p class="centro">Já tem conta? <a href="/painel" data-link>Entrar</a> · Recebeu convite? <a href="/cadastro?barbeiro=1" data-link>Sou barbeiro</a></p></form>`;
    const f = $("#fCad"), msg = $("#slugMsg");
    let editouSlug = false, t;
    const checar = () => {
      clearTimeout(t); const s = f.slug.value;
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
      const d = { nome: f.nome.value.trim(), slug: f.slug.value.trim(), nomeDono: f.dono.value.trim(), email: f.email.value.trim(), senha: f.senha.value };
      if (d.nome.length < 2 || !d.nomeDono || !d.email.includes("@")) { err.textContent = "Preencha todos os campos."; return; }
      if (d.senha.length < 6) { err.textContent = "A senha precisa de pelo menos 6 caracteres."; return; }
      const btn = f.querySelector("button"); btn.disabled = true; btn.textContent = "Criando…";
      try {
        if (!(await S.slugLivre(d.slug))) throw new Error("Esse endereço já está em uso.");
        const r = await S.criarConta(d.email, d.senha);
        if (r.pendente) {
          U.ls.set("bb_cad_pendente", { nome: d.nome, slug: d.slug, nomeDono: d.nomeDono });
          app().innerHTML = `<div class="form-pag"><h1>Confirme seu e-mail</h1><p>Enviamos um link para <b>${esc(d.email)}</b>. Depois de confirmar, entre com sua senha e sua barbearia será criada.</p><a class="btn" href="/painel" data-link>Ir para o login</a></div>`;
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

  window.Landing = { inicio, cadastro };
}
