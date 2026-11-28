(function () {
  const cfg = window.BARBER_BACKEND || {};
  const URL_ = (cfg.SUPABASE_URL || "").replace(/\/+$/, "");
  const KEY = cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_ANON_KEY || "";
  const P = window.PLATAFORMA;
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const slugOk = s => /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/.test(s) && !P.reservados.includes(s);
  if (!URL_ || !KEY) { window.Store = { configurado: false, slugOk }; return; }

  const sess = { get: () => ls.get("lk_sess", null), set: v => ls.set("lk_sess", v) };
  const guardar = j => sess.set({ access: j.access_token, refresh: j.refresh_token, exp: Date.now() + j.expires_in * 1000, user: { id: j.user.id, email: j.user.email } });
  async function auth(path, body) {
    const r = await fetch(URL_ + "/auth/v1/" + path, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json().catch(() => ({}));
  }
  let renovando = null;
  async function token() {
    let s = sess.get(); if (!s) return null;
    if (s.exp < Date.now() + 60000) {
      renovando = renovando || auth("token?grant_type=refresh_token", { refresh_token: s.refresh }).finally(() => setTimeout(() => renovando = null, 0));
      const j = await renovando;
      if (!j.access_token) { sess.set(null); return null; } guardar(j); s = sess.get();
    }
    return s.access;
  }
  // publishable não é jwt, vai só no apikey
  function headers(t, extra) {
    const h = Object.assign({ apikey: KEY, "Content-Type": "application/json" }, extra || {});
    if (t) h.Authorization = "Bearer " + t; else if (!KEY.startsWith("sb_")) h.Authorization = "Bearer " + KEY;
    return h;
  }
  const traduz = m => /ocupado/i.test(m) ? "Esse horário acabou de ser ocupado. Escolha outro."
    : /indisponivel/i.test(m) ? "Agenda indisponível no momento." : /limite_plano/i.test(m) ? "Seu plano não permite mais barbeiros ativos. Troque de plano em Assinatura."
    : /sem estoque/i.test(m) ? "Sem estoque suficiente desse produto." : /atendimento invalido/i.test(m) ? "Esse atendimento não é seu."
    : /slug/i.test(m) ? "Esse endereço já está em uso." : /convite/i.test(m) ? "Convite inválido ou já usado."
    : /plano nao cobre/i.test(m) ? "Seu plano não cobre esse serviço." : /plano esgotado/i.test(m) ? "Você já usou todos os cortes do seu plano neste período."
    : /plano fora do periodo/i.test(m) ? "Essa data fica fora do período pago do seu plano." : /plano invalido/i.test(m) ? "Código do plano inválido ou plano ainda não ativado pela barbearia."
    : /telefone invalido/i.test(m) ? "Digite um WhatsApp válido, com DDD." : /muitos pedidos/i.test(m) ? "Muitos pedidos agora. Tente daqui a pouco." : /lancamentos_conta_fixa_id_competencia/i.test(m) ? "Essa conta já foi paga neste mês." : /JWT|token/i.test(m) ? "Sessão expirada. Entre novamente." : /Failed to fetch|NetworkError/i.test(m) ? "Sem conexão com a internet." : m;
  async function sb(path, opt = {}) {
    const t = opt.auth ? await token() : null;
    if (opt.auth && !t) throw new Error("Sessão expirada. Entre novamente.");
    let r;
    try { r = await fetch(URL_ + path, { method: opt.method || "GET", body: opt.body ? JSON.stringify(opt.body) : undefined, headers: headers(t, opt.headers) }); }
    catch { throw new Error("Sem conexão com a internet."); }
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch {}
    if (!r.ok) throw new Error(traduz((j && (j.message || j.msg || j.error_description || j.erro || j.error)) || "Erro de conexão (" + r.status + ")."));
    return j;
  }
  const rpc = (fn, body, a) => sb("/rest/v1/rpc/" + fn, { method: "POST", body, auth: a });
  const t5 = v => v ? String(v).slice(0, 5) : "";
  const normAg = a => Object.assign({}, a, { hora: t5(a.hora), preco: Number(a.preco), valor_ref: a.valor_ref != null ? Number(a.valor_ref) : null });
  const normBl = b => Object.assign({}, b, { ini: t5(b.ini), fim: t5(b.fim) });
  const q = encodeURIComponent;
  const fotoURL = (bid, arq, v) => v ? `${URL_}/storage/v1/object/public/logos/${bid}/${arq}?v=${v}` : null;
  const logoURL = (bid, logo, arq = "icon-512.png") => logo && logo.v ? `${URL_}/storage/v1/object/public/logos/${bid}/${arq}?v=${logo.v}` : null;

  window.Store = {
    configurado: true, slugOk, logoURL, fotoURL,
    async planos() { return ((await sb("/rest/v1/planos?ativo=eq.true&order=ordem")) || []).map(p => Object.assign(p, { preco: Number(p.preco) })); },
    async publico(slug) {
      const r = await rpc("dados_publicos", { p_slug: slug }); if (!r) return null;
      r.b.config = Object.assign({}, window.DEFAULT_CONFIG, r.b.config || {}); r.profs = r.profs || [];
      r.produtos = (r.produtos || []).map(p => Object.assign(p, { preco: Number(p.preco) }));
      r.pacotes = (r.pacotes || []).map(p => Object.assign(p, { preco: Number(p.preco), servicos: p.servicos || [] })); return r;
    },
    async ocupados(slug, de, ate) { return ((await rpc("horarios_ocupados", { p_slug: slug, p_de: de, p_ate: ate })) || []).map(x => ({ prof: x.prof, data: x.data, ini: t5(x.ini), fim: t5(x.fim) })); },
    async agendar(slug, r) {
      const p = { p_slug: slug, p_servico: r.servico_id, p_prof: r.prof_id || null, p_nome: r.nome, p_tel: r.telefone || "", p_data: r.data, p_hora: r.hora };
      return r.codigo ? await rpc("agendar_plano", Object.assign(p, { p_codigo: r.codigo })) : await rpc("agendar", p);
    },
    async pedirAssinatura(slug, pacote, nome, tel) { return await rpc("pedir_assinatura", { p_slug: slug, p_pacote: pacote, p_nome: nome, p_tel: tel }); },
    async meuPlano(slug, codigo) { const r = await rpc("meu_plano", { p_slug: slug, p_codigo: codigo }); if (r && r.pacote) r.pacote.preco = Number(r.pacote.preco); return r; },
    async statusCliente(ids) { return ids.length ? (await rpc("status_agendamentos", { p_ids: ids })) || [] : []; },
    async cancelar(id, token) { await rpc("cancelar_agendamento", { p_id: id, p_token: token }); },
    async slugLivre(slug) { return slugOk(slug) && !!(await rpc("slug_disponivel", { p_slug: slug })); },
    async entrar(email, senha) {
      const j = await auth("token?grant_type=password", { email, password: senha });
      if (!j.access_token) throw new Error(/confirm/i.test(j.msg || j.error_description || j.error_code || "") ? "Confirme seu e-mail pelo link que enviamos e tente de novo." : "E-mail ou senha incorretos.");
      guardar(j);
    },
    async recuperarSenha(email) {
      const base = location.origin + (window.BASE || "/");
      const r = await fetch(URL_ + "/auth/v1/recover", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, redirect_to: base + "painel" }) });
      if (!r.ok && r.status !== 429) throw new Error("Não foi possível enviar agora. Tente em alguns minutos.");
    },
    async capturarRetornoAuth() {
      const h = new URLSearchParams(location.hash.replace(/^#/, ""));
      if (h.get("error_description")) { history.replaceState({}, "", location.pathname + location.search); throw new Error(h.get("error_description").replace(/\+/g, " ")); }
      const at = h.get("access_token"); if (!at) return null;
      history.replaceState({}, "", location.pathname + location.search);
      const r = await fetch(URL_ + "/auth/v1/user", { headers: { apikey: KEY, Authorization: "Bearer " + at } });
      if (!r.ok) throw new Error("Link expirado. Peça um novo.");
      const u = await r.json();
      guardar({ access_token: at, refresh_token: h.get("refresh_token"), expires_in: +h.get("expires_in") || 3600, user: u });
      return h.get("type") || "login";
    },
    async trocarSenha(nova) {
      if (nova.length < 6) throw new Error("A senha precisa de pelo menos 6 caracteres.");
      await sb("/auth/v1/user", { method: "PUT", auth: true, body: { password: nova } });
    },
    sair() { const t = (sess.get() || {}).access; if (t) fetch(URL_ + "/auth/v1/logout", { method: "POST", headers: headers(t) }).catch(() => {}); sess.set(null); },
    logado() { return !!sess.get(); },
    usuario() { const s = sess.get(); return s && s.user; },
    async souSuper() { return !!(await rpc("sou_super", {}, true)); },
    async acessos() { return (await rpc("meus_acessos", {}, true)) || []; },
    async criarConta(email, senha, meta) {
      const base = location.origin + (window.BASE || "/");
      const r = await fetch(URL_ + "/auth/v1/signup?redirect_to=" + q(base + "painel"), { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: senha, data: meta || {} }) });
      const j = await r.json().catch(() => ({}));
      if (j.access_token) { guardar(j); return { pendente: false }; }
      if (r.ok && (j.id || (j.user && j.user.id))) return { pendente: true };
      const m = j.msg || j.error_description || j.message || "";
      throw new Error(/registered|exists/i.test(m) ? "Este e-mail já tem conta. Use Entrar." : /password/i.test(m) ? "Senha fraca: use pelo menos 6 caracteres." : m || "Não foi possível criar a conta.");
    },
    async criarPendente() { return await rpc("criar_barbearia_pendente", {}, true); },
    async criarBarbearia({ nome, slug, nomeDono }) { return await rpc("criar_barbearia", { p_nome: nome, p_slug: slug, p_nome_dono: nomeDono }, true); },
    async aceitarConvite(cod) { await rpc("aceitar_convite", { p_codigo: cod.toUpperCase().trim() }, true); },
    async barbearia(bid) { const r = await sb(`/rest/v1/barbearias?id=eq.${q(bid)}&select=*`, { auth: true }); const b = r[0];
      if (!b) throw new Error("Barbearia não encontrada."); b.config = Object.assign({}, window.DEFAULT_CONFIG, b.config || {}); return b; },
    async salvarBarbearia(bid, { nome, config }) { const body = {}; if (nome) body.nome = nome; if (config) body.config = config;
      await sb(`/rest/v1/barbearias?id=eq.${q(bid)}`, { method: "PATCH", auth: true, body }); },
    async enviarLogo(bid, arquivos) {
      const t = await token(); if (!t) throw new Error("Sessão expirada. Entre novamente.");
      for (const a of arquivos) {
        const r = await fetch(`${URL_}/storage/v1/object/logos/${bid}/${a.nome}`, { method: "POST", body: a.blob,
          headers: { apikey: KEY, Authorization: "Bearer " + t, "Content-Type": a.blob.type || "image/png", "x-upsert": "true", "cache-control": "3600" } });
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || j.error || "Não foi possível enviar a imagem."); }
      }
    },
    async produtos(bid) { return ((await sb(`/rest/v1/produtos?barbearia_id=eq.${q(bid)}&order=ordem,nome`, { auth: true })) || []).map(p => Object.assign(p, { preco: Number(p.preco) })); },
    async salvarProduto(bid, p) {
      const body = { nome: p.nome, descricao: p.descricao || "", preco: p.preco, estoque: p.estoque, ativo: p.ativo, foto_v: p.foto_v || null, ordem: p.ordem || 0 };
      if (p.novo) await sb("/rest/v1/produtos", { method: "POST", auth: true, body: Object.assign({ id: p.id, barbearia_id: bid }, body), headers: { Prefer: "return=minimal" } });
      else await sb(`/rest/v1/produtos?id=eq.${q(p.id)}`, { method: "PATCH", auth: true, body });
    },
    async removerProduto(bid, id) { await sb(`/rest/v1/produtos?id=eq.${q(id)}`, { method: "DELETE", auth: true }); },
    async registrarVenda({ produto, qtd, ag, prof }) { return await rpc("registrar_venda", { p_produto: produto, p_qtd: qtd || 1, p_ag: ag || null, p_prof: prof || null }, true); },
    async desfazerVenda(id) { await rpc("desfazer_venda", { p_id: id }, true); },
    async vendas(bid, de, ate, profId) {
      return ((await sb(`/rest/v1/vendas?barbearia_id=eq.${q(bid)}&data=gte.${de}&data=lte.${ate}${profId ? "&prof_id=eq." + q(profId) : ""}&order=data,criado_em`, { auth: true })) || [])
        .map(v => Object.assign(v, { preco: Number(v.preco) }));
    },
    async pacotes(bid) { return ((await sb(`/rest/v1/pacotes?barbearia_id=eq.${q(bid)}&order=ordem,preco`, { auth: true })) || []).map(p => Object.assign(p, { preco: Number(p.preco), servicos: p.servicos || [] })); },
    async salvarPacote(bid, p) {
      const body = { nome: p.nome, descricao: p.descricao || "", preco: p.preco, cortes: p.cortes, servicos: p.servicos || [], ativo: p.ativo !== false, ordem: p.ordem || 0 };
      if (p.id) await sb(`/rest/v1/pacotes?id=eq.${q(p.id)}`, { method: "PATCH", auth: true, body });
      else await sb("/rest/v1/pacotes", { method: "POST", auth: true, body: Object.assign({ barbearia_id: bid }, body), headers: { Prefer: "return=minimal" } });
    },
    async removerPacote(bid, id) { await sb(`/rest/v1/pacotes?id=eq.${q(id)}`, { method: "DELETE", auth: true }); },
    async assinantes(bid) {
      const [l, c] = await Promise.all([sb(`/rest/v1/assinantes?barbearia_id=eq.${q(bid)}&order=criado_em.desc`, { auth: true }), sb(`/rest/v1/assinatura_ciclos?barbearia_id=eq.${q(bid)}&order=ini`, { auth: true })]);
      return (l || []).map(a => Object.assign(a, { ciclos: (c || []).filter(x => x.assinante_id === a.id).map(x => Object.assign(x, { valor: Number(x.valor) })) }));
    },
    async usosPlano(bid, de) { return (await sb(`/rest/v1/agendamentos?barbearia_id=eq.${q(bid)}&assinante_id=not.is.null&data=gte.${de}&select=id,assinante_id,data,status`, { auth: true })) || []; },
    async criarAssinante(bid, a) {
      const alfa = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", cod = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), n => alfa[n % alfa.length]).join("");
      for (let i = 0; i < 3; i++) {
        try { const c = cod(); await sb("/rest/v1/assinantes", { method: "POST", auth: true, headers: { Prefer: "return=minimal" }, body: { id: a.id || crypto.randomUUID(), barbearia_id: bid, pacote_id: a.pacote_id, nome: a.nome, telefone: (a.telefone || "").replace(/\D/g, ""), codigo: c } }); return c; }
        catch (e) { if (!/duplicate|codigo/i.test(e.message) || i === 2) throw e; }
      }
    },
    async atualizarAssinante(bid, id, patch) { await sb(`/rest/v1/assinantes?id=eq.${q(id)}`, { method: "PATCH", auth: true, body: patch }); },
    async removerAssinante(bid, id) { await sb(`/rest/v1/assinantes?id=eq.${q(id)}`, { method: "DELETE", auth: true }); },
    async renovarAssinante(id, valor, lancar) { return await rpc("renovar_assinante", { p_id: id, p_valor: valor, p_lancar: lancar !== false }, true); },
    async desfazerCiclo(bid, id) { await sb(`/rest/v1/assinatura_ciclos?id=eq.${q(id)}`, { method: "DELETE", auth: true }); },
    async contasFixas(bid) { return ((await sb(`/rest/v1/contas_fixas?barbearia_id=eq.${q(bid)}&order=dia,descricao`, { auth: true })) || []).map(c => Object.assign(c, { valor: Number(c.valor) })); },
    async salvarContaFixa(bid, c) {
      const body = { descricao: c.descricao, categoria: c.categoria || "Outros", valor: c.valor, dia: c.dia, ativo: c.ativo !== false };
      if (c.id) await sb(`/rest/v1/contas_fixas?id=eq.${q(c.id)}`, { method: "PATCH", auth: true, body });
      else await sb("/rest/v1/contas_fixas", { method: "POST", auth: true, body: Object.assign({ barbearia_id: bid }, body), headers: { Prefer: "return=minimal" } });
    },
    async removerContaFixa(bid, id) { await sb(`/rest/v1/contas_fixas?id=eq.${q(id)}`, { method: "DELETE", auth: true }); },
    async lancamentos(bid, de, ate) {
      return ((await sb(`/rest/v1/lancamentos?barbearia_id=eq.${q(bid)}&data=gte.${de}&data=lte.${ate}&order=data,criado_em`, { auth: true })) || []).map(l => Object.assign(l, { valor: Number(l.valor) }));
    },
    async pagosDoMes(bid, ym) { return ((await sb(`/rest/v1/lancamentos?barbearia_id=eq.${q(bid)}&competencia=eq.${q(ym)}`, { auth: true })) || []).map(l => Object.assign(l, { valor: Number(l.valor) })); },
    async salvarLancamento(bid, l) {
      const body = { tipo: l.tipo, descricao: l.descricao, categoria: l.categoria || "Outros", valor: l.valor, data: l.data, pago: l.pago !== false, conta_fixa_id: l.conta_fixa_id || null, competencia: l.competencia || null };
      if (l.id) await sb(`/rest/v1/lancamentos?id=eq.${q(l.id)}`, { method: "PATCH", auth: true, body });
      else await sb("/rest/v1/lancamentos", { method: "POST", auth: true, body: Object.assign({ barbearia_id: bid }, body), headers: { Prefer: "return=minimal" } });
    },
    async removerLancamento(bid, id) { await sb(`/rest/v1/lancamentos?id=eq.${q(id)}`, { method: "DELETE", auth: true }); },
    async profs(bid) { return (await rpc("profissionais_da_barbearia", { p_bid: bid }, true)) || []; },
    async salvarProf(bid, p) {
      const body = { nome: p.nome, dias: p.dias, ativo: p.ativo, comissao: p.comissao || 0 };
      if (p.id) await sb(`/rest/v1/profissionais?id=eq.${q(p.id)}`, { method: "PATCH", auth: true, body });
      else await sb("/rest/v1/profissionais", { method: "POST", auth: true, body: Object.assign({ barbearia_id: bid }, body), headers: { Prefer: "return=minimal" } });
    },
    async convite(bid, prof_id) { return await rpc("gerar_convite", { p_prof: prof_id }, true); },
    async removerAcesso(bid, prof_id) { await rpc("remover_acesso", { p_prof: prof_id }, true); },
    async listar(bid, de, ate, profId) {
      return ((await sb(`/rest/v1/agendamentos?barbearia_id=eq.${q(bid)}&data=gte.${de}&data=lte.${ate}${profId ? "&prof_id=eq." + q(profId) : ""}&order=data,hora`, { auth: true })) || []).map(normAg);
    },
    async atualizar(bid, id, patch) { await sb(`/rest/v1/agendamentos?id=eq.${q(id)}`, { method: "PATCH", auth: true, body: patch }); },
    async criar(bid, ag) { await sb("/rest/v1/agendamentos", { method: "POST", auth: true, body: Object.assign({ barbearia_id: bid }, ag), headers: { Prefer: "return=minimal" } }); },
    async bloqueios(bid, de) { return ((await sb(`/rest/v1/bloqueios?barbearia_id=eq.${q(bid)}&data=gte.${de}&order=data,ini`, { auth: true })) || []).map(normBl); },
    async bloquear(bid, b) { await sb("/rest/v1/bloqueios", { method: "POST", auth: true, headers: { Prefer: "return=minimal" },
      body: { barbearia_id: bid, prof_id: b.prof_id || null, data: b.data, ini: b.ini || null, fim: b.fim || null, motivo: b.motivo || "" } }); },
    async desbloquear(bid, id) { await sb(`/rest/v1/bloqueios?id=eq.${q(id)}`, { method: "DELETE", auth: true }); },
    async assinatura(bid, acao, dados) {
      return await sb("/functions/v1/assinatura", { method: "POST", auth: true, body: Object.assign({ bid, acao }, dados || {}) });
    },
    async pagamentos(bid) { return ((await sb(`/rest/v1/pagamentos?barbearia_id=eq.${q(bid)}&order=vencimento.desc&limit=12`, { auth: true })) || []); },
    async todas() { return (await rpc("todas_barbearias", {}, true)) || []; },
    async atualizarAssinatura(id, patch) { await sb(`/rest/v1/barbearias?id=eq.${q(id)}`, { method: "PATCH", auth: true, body: patch }); },
    async salvarPlano(p) { await sb(`/rest/v1/planos?id=eq.${q(p.id)}`, { method: "PATCH", auth: true, body: { nome: p.nome, preco: p.preco, max_prof: p.max_prof, descricao: p.descricao, ativo: p.ativo } }); }
  };
})();
