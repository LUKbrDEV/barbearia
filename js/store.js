// Camada de dados multi-barbearia: modo demonstração (localStorage) ou Supabase.
(function () {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.BARBER_BACKEND || {};
  const A = window.Agenda, P = window.PLATAFORMA;
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const codigo = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const hoje = () => A.ymd(new Date());
  const ATIVOS = ["agendado", "concluido"];
  const fimDe = a => A.toHM(A.toMin(a.hora) + a.dur);
  const slugOk = s => /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/.test(s) && !P.reservados.includes(s);

  // =====================================================================
  // MODO DEMONSTRAÇÃO
  // =====================================================================
  function seed() {
    const d = hoje(), b = { id: "b-demo", slug: "navalha", nome: "Barbearia Navalha", status: "teste", plano: "equipe",
      vence_em: A.addDays(d, P.diasTeste), criado_em: new Date().toISOString(), dono_email: "dono@demo.com",
      config: Object.assign({}, window.DEFAULT_CONFIG, { whatsapp: "5538999990000", endereco: "Rua Exemplo, 123 - Centro", instagram: "barbearianavalha" }) };
    const users = [{ id: "u-super", email: "admin@demo.com", senha: "1234" }, { id: "u-dono", email: "dono@demo.com", senha: "1234" }, { id: "u-barb", email: "barbeiro@demo.com", senha: "1234" }];
    const profs = [{ id: "p-rafa", barbearia_id: b.id, nome: "Rafa", dias: [1, 2, 3, 4, 5, 6], ativo: true, comissao: 0, ordem: 0, email: "dono@demo.com" },
                   { id: "p-leo", barbearia_id: b.id, nome: "Léo", dias: [2, 3, 4, 5, 6], ativo: true, comissao: 40, ordem: 1, email: "barbeiro@demo.com" }];
    const membros = [{ user_id: "u-dono", barbearia_id: b.id, papel: "dono", prof_id: "p-rafa" }, { user_id: "u-barb", barbearia_id: b.id, papel: "barbeiro", prof_id: "p-leo" }];
    // histórico de exemplo para os relatórios não começarem vazios
    const nomes = ["Carlos", "Pedro H.", "Marcos", "Gustavo", "Thiago", "Bruno", "Diego", "Felipe", "André", "Lucas"], ags = [];
    for (let i = -20; i <= 3; i++) {
      const dia = A.addDays(d, i), w = A.dow(dia); if (w === 0 || w === 1) continue;
      const hs = ["09:00", "10:00", "11:00", "14:00", "15:30", "17:00"];
      hs.forEach((h, k) => {
        if ((i * 7 + k) % 3 === 0) return;
        const s = b.config.servicos[(k + i + 20) % b.config.servicos.length], p = profs[(k + i) % 2 === 0 ? 0 : 1];
        if (!p.dias.includes(w)) return;
        const st = i < 0 ? ((i + k) % 9 === 0 ? "faltou" : "concluido") : "agendado";
        ags.push({ id: uid(), token: uid(), barbearia_id: b.id, prof_id: p.id, data: dia, hora: h, dur: s.dur, servico_id: s.id, servico_nome: s.nome,
          preco: s.preco, nome: nomes[(k * 3 + i + 40) % nomes.length], telefone: "", status: st, origem: "online", criado_em: new Date().toISOString() });
      });
    }
    return { v: 2, users, supers: ["u-super"], barbearias: [b], profs, membros, ags, blq: [], convites: [] };
  }
  const db = () => { let x = ls.get("bb_db", null); if (!x || x.v !== 2) { x = seed(); ls.set("bb_db", x); } return x; };
  const save = x => ls.set("bb_db", x);
  const eu = () => ls.get("bb_sess_local", null);
  const papel = (x, bid) => { const s = eu(); if (!s) return null; if (x.supers.includes(s)) return "super";
    const m = x.membros.find(m => m.user_id === s && m.barbearia_id === bid); return m ? m.papel : null; };
  const exigir = (x, bid, ...ok) => { const p = papel(x, bid); if (!p || !(ok.includes(p) || p === "super")) throw new Error("Sem permissão."); return p; };
  const meuProf = (x, bid) => (x.membros.find(m => m.user_id === eu() && m.barbearia_id === bid) || {}).prof_id;
  const busyDe = (x, bid, de, ate) => x.ags.filter(a => a.barbearia_id === bid && ATIVOS.includes(a.status) && a.data >= de && a.data <= ate)
      .map(a => ({ prof: a.prof_id, data: a.data, ini: a.hora, fim: fimDe(a) }))
    .concat(x.blq.filter(b => b.barbearia_id === bid && b.data >= de && b.data <= ate).map(b => ({ prof: b.prof_id || null, data: b.data, ini: b.ini, fim: b.fim })));

  const Local = {
    modo: "local",
    // ---- público ----
    async publico(slug) {
      const x = db(), b = x.barbearias.find(b => b.slug === slug); if (!b) return null;
      return { b: { id: b.id, slug: b.slug, nome: b.nome, status: b.status, vence_em: b.vence_em, config: Object.assign({}, window.DEFAULT_CONFIG, b.config) },
        profs: x.profs.filter(p => p.barbearia_id === b.id && p.ativo).sort((a, c) => a.ordem - c.ordem).map(p => ({ id: p.id, nome: p.nome, dias: p.dias })) };
    },
    async ocupados(slug, de, ate) { const x = db(), b = x.barbearias.find(b => b.slug === slug); return b ? busyDe(x, b.id, de, ate) : []; },
    async agendar(slug, r) {
      const x = db(), b = x.barbearias.find(b => b.slug === slug);
      if (!b || !A.liberada(b, hoje())) throw new Error("Agenda indisponível no momento.");
      const cfg = Object.assign({}, window.DEFAULT_CONFIG, b.config), s = cfg.servicos.find(s => s.id === r.servico_id);
      if (!s) throw new Error("Serviço indisponível.");
      const profs = x.profs.filter(p => p.barbearia_id === b.id && p.ativo && (!r.prof_id || p.id === r.prof_id));
      const busy = busyDe(x, b.id, r.data, r.data);
      const livres = profs.filter(p => A.slotsDoDia(cfg, r.data, s.dur, busy, null, p).slots.some(t => t.hora === r.hora && t.livre));
      if (!livres.length) throw new Error("Esse horário acabou de ser ocupado. Escolha outro.");
      const carga = id => x.ags.filter(a => a.prof_id === id && a.data === r.data && ATIVOS.includes(a.status)).length;
      const p = livres.sort((a, c) => carga(a.id) - carga(c.id))[0];
      const ag = { id: uid(), token: uid(), barbearia_id: b.id, prof_id: p.id, data: r.data, hora: r.hora, dur: s.dur, servico_id: s.id, servico_nome: s.nome,
        preco: s.preco, nome: r.nome, telefone: r.telefone || "", status: "agendado", origem: "online", criado_em: new Date().toISOString() };
      x.ags.push(ag); save(x);
      return { id: ag.id, token: ag.token, prof_nome: p.nome };
    },
    async statusCliente(ids) { return db().ags.filter(a => ids.includes(a.id)).map(a => ({ id: a.id, status: a.status })); },
    async cancelar(id, token) {
      const x = db(), a = x.ags.find(a => a.id === id && a.token === token);
      if (!a || a.status !== "agendado") throw new Error("Não foi possível cancelar."); a.status = "cancelado"; save(x);
    },
    async slugLivre(slug) { return slugOk(slug) && !db().barbearias.some(b => b.slug === slug); },
    // ---- conta ----
    async entrar(email, senha) {
      const u = db().users.find(u => u.email === email.toLowerCase() && u.senha === senha);
      if (!u) throw new Error("E-mail ou senha incorretos."); ls.set("bb_sess_local", u.id);
    },
    sair() { ls.set("bb_sess_local", null); },
    logado() { return !!eu(); },
    usuario() { const u = db().users.find(u => u.id === eu()); return u ? { id: u.id, email: u.email } : null; },
    async souSuper() { return db().supers.includes(eu()); },
    async acessos() {
      const x = db();
      return x.membros.filter(m => m.user_id === eu()).map(m => { const b = x.barbearias.find(b => b.id === m.barbearia_id) || {};
        return { barbearia_id: m.barbearia_id, slug: b.slug, nome: b.nome, papel: m.papel, prof_id: m.prof_id }; });
    },
    async criarConta(email, senha) {
      const x = db(); email = email.toLowerCase();
      if (x.users.some(u => u.email === email)) throw new Error("Este e-mail já tem conta. Use Entrar.");
      if (senha.length < 6) throw new Error("A senha precisa de pelo menos 6 caracteres.");
      const u = { id: uid(), email, senha }; x.users.push(u); save(x); ls.set("bb_sess_local", u.id); return { pendente: false };
    },
    async criarBarbearia({ nome, slug, nomeDono }) {
      const x = db(), me = eu(); if (!me) throw new Error("Entre na sua conta.");
      if (!(await this.slugLivre(slug))) throw new Error("Esse endereço já está em uso.");
      const b = { id: uid(), slug, nome, status: "teste", plano: "solo", vence_em: A.addDays(hoje(), P.diasTeste), criado_em: new Date().toISOString(),
        dono_email: this.usuario().email, config: Object.assign({}, window.DEFAULT_CONFIG) };
      const p = { id: uid(), barbearia_id: b.id, nome: nomeDono, dias: [0, 1, 2, 3, 4, 5, 6], ativo: true, comissao: 0, ordem: 0, email: b.dono_email };
      x.barbearias.push(b); x.profs.push(p); x.membros.push({ user_id: me, barbearia_id: b.id, papel: "dono", prof_id: p.id }); save(x);
      return b.id;
    },
    async aceitarConvite(cod) {
      const x = db(), c = x.convites.find(c => c.codigo === cod.toUpperCase().trim() && !c.usado);
      if (!c) throw new Error("Convite inválido ou já usado.");
      if (x.membros.some(m => m.prof_id === c.prof_id)) throw new Error("Esse barbeiro já tem acesso.");
      c.usado = true; const u = this.usuario();
      x.membros.push({ user_id: u.id, barbearia_id: c.barbearia_id, papel: "barbeiro", prof_id: c.prof_id });
      const p = x.profs.find(p => p.id === c.prof_id); if (p) p.email = u.email; save(x);
    },
    // ---- barbearia ----
    async barbearia(bid) { const x = db(); exigir(x, bid, "dono", "barbeiro");
      const b = x.barbearias.find(b => b.id === bid); return Object.assign({}, b, { config: Object.assign({}, window.DEFAULT_CONFIG, b.config) }); },
    async salvarBarbearia(bid, { nome, config }) {
      const x = db(); exigir(x, bid, "dono"); const b = x.barbearias.find(b => b.id === bid);
      if (nome) b.nome = nome; if (config) b.config = config; save(x);
    },
    async profs(bid) { const x = db(); exigir(x, bid, "dono", "barbeiro");
      return x.profs.filter(p => p.barbearia_id === bid).sort((a, b) => a.ordem - b.ordem).map(p => Object.assign({}, p, { tem_acesso: x.membros.some(m => m.prof_id === p.id) })); },
    async salvarProf(bid, p) {
      const x = db(); exigir(x, bid, "dono"); const b = x.barbearias.find(b => b.id === bid);
      const plano = P.planos.find(pl => pl.id === b.plano), ativos = x.profs.filter(q => q.barbearia_id === bid && q.ativo && q.id !== p.id).length;
      if (p.ativo && plano && plano.maxProf && ativos >= plano.maxProf) throw new Error(`O plano ${plano.nome} permite ${plano.maxProf} barbeiro(s) ativo(s). Troque de plano em Assinatura.`);
      if (p.id) Object.assign(x.profs.find(q => q.id === p.id), p);
      else x.profs.push(Object.assign({ id: uid(), barbearia_id: bid, ordem: x.profs.length, email: "" }, p));
      save(x);
    },
    async convite(bid, prof_id) {
      const x = db(); exigir(x, bid, "dono");
      x.convites.forEach(c => { if (c.prof_id === prof_id) c.usado = true; });
      const c = { codigo: codigo(), barbearia_id: bid, prof_id, usado: false }; x.convites.push(c); save(x); return c.codigo;
    },
    async removerAcesso(bid, prof_id) { const x = db(); exigir(x, bid, "dono");
      x.membros = x.membros.filter(m => !(m.prof_id === prof_id && m.papel === "barbeiro")); const p = x.profs.find(p => p.id === prof_id); if (p) p.email = ""; save(x); },
    async listar(bid, de, ate, profId) {
      const x = db(), pp = exigir(x, bid, "dono", "barbeiro"); if (pp === "barbeiro") profId = meuProf(x, bid);
      return x.ags.filter(a => a.barbearia_id === bid && a.data >= de && a.data <= ate && (!profId || a.prof_id === profId))
        .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
    },
    async atualizar(bid, id, patch) {
      const x = db(), pp = exigir(x, bid, "dono", "barbeiro"), a = x.ags.find(a => a.id === id && a.barbearia_id === bid);
      if (!a || (pp === "barbeiro" && a.prof_id !== meuProf(x, bid))) throw new Error("Sem permissão."); Object.assign(a, patch); save(x);
    },
    async criar(bid, ag) {
      const x = db(), pp = exigir(x, bid, "dono", "barbeiro"); if (pp === "barbeiro") ag.prof_id = meuProf(x, bid);
      x.ags.push(Object.assign({ id: uid(), token: uid(), barbearia_id: bid, criado_em: new Date().toISOString() }, ag)); save(x);
    },
    async bloqueios(bid, de) {
      const x = db(), pp = exigir(x, bid, "dono", "barbeiro"), mp = meuProf(x, bid);
      return x.blq.filter(b => b.barbearia_id === bid && b.data >= de && (pp !== "barbeiro" || !b.prof_id || b.prof_id === mp))
        .sort((a, b) => (a.data + (a.ini || "")).localeCompare(b.data + (b.ini || "")));
    },
    async bloquear(bid, b) {
      const x = db(), pp = exigir(x, bid, "dono", "barbeiro"); if (pp === "barbeiro") b.prof_id = meuProf(x, bid);
      x.blq.push(Object.assign({ id: uid(), barbearia_id: bid }, b)); save(x);
    },
    async desbloquear(bid, id) {
      const x = db(), pp = exigir(x, bid, "dono", "barbeiro"), b = x.blq.find(b => b.id === id);
      if (!b || (pp === "barbeiro" && b.prof_id !== meuProf(x, bid))) throw new Error("Sem permissão.");
      x.blq = x.blq.filter(q => q.id !== id); save(x);
    },
    // ---- super admin ----
    async todas() {
      const x = db(); if (!x.supers.includes(eu())) throw new Error("Sem permissão."); const lim = A.addDays(hoje(), -30);
      return x.barbearias.map(b => Object.assign({}, b, { n_profs: x.profs.filter(p => p.barbearia_id === b.id && p.ativo).length,
        n_ags_30: x.ags.filter(a => a.barbearia_id === b.id && a.data >= lim && a.status !== "cancelado").length }));
    },
    async atualizarAssinatura(id, patch) {
      const x = db(); if (!x.supers.includes(eu())) throw new Error("Sem permissão.");
      Object.assign(x.barbearias.find(b => b.id === id), patch); save(x);
    },
    resetDemo() { localStorage.removeItem("bb_db"); localStorage.removeItem("bb_sess_local"); }
  };

  // =====================================================================
  // MODO SUPABASE
  // =====================================================================
  const sess = { get: () => ls.get("bb_sess", null), set: v => ls.set("bb_sess", v) };
  const guardar = j => sess.set({ access: j.access_token, refresh: j.refresh_token, exp: Date.now() + j.expires_in * 1000, user: { id: j.user.id, email: j.user.email } });
  async function auth(path, body) {
    const r = await fetch(SUPABASE_URL + "/auth/v1/" + path, { method: "POST", headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json();
  }
  async function token() {
    let s = sess.get(); if (!s) return null;
    if (s.exp < Date.now() + 60000) {
      const j = await auth("token?grant_type=refresh_token", { refresh_token: s.refresh });
      if (!j.access_token) { sess.set(null); return null; } guardar(j); s = sess.get();
    }
    return s.access;
  }
  const traduz = m => /ocupado/i.test(m) ? "Esse horário acabou de ser ocupado. Escolha outro."
    : /indisponivel/i.test(m) ? "Agenda indisponível no momento." : /limite_plano/i.test(m) ? "Seu plano não permite mais barbeiros ativos. Troque de plano em Assinatura."
    : /slug/i.test(m) ? "Esse endereço já está em uso." : /convite/i.test(m) ? "Convite inválido ou já usado." : m;
  async function sb(path, opt = {}) {
    const t = opt.auth ? await token() : null;
    if (opt.auth && !t) throw new Error("Sessão expirada. Entre novamente.");
    const r = await fetch(SUPABASE_URL + path, { method: opt.method || "GET", body: opt.body ? JSON.stringify(opt.body) : undefined,
      headers: Object.assign({ apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json", Authorization: "Bearer " + (t || SUPABASE_ANON_KEY) }, opt.headers || {}) });
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch {}
    if (!r.ok) throw new Error(traduz((j && (j.message || j.msg || j.error_description)) || "Erro de conexão."));
    return j;
  }
  const rpc = (fn, body, a) => sb("/rest/v1/rpc/" + fn, { method: "POST", body, auth: a });
  const t5 = v => v ? String(v).slice(0, 5) : "";
  const normAg = a => Object.assign({}, a, { hora: t5(a.hora), preco: Number(a.preco) });
  const normBl = b => Object.assign({}, b, { ini: t5(b.ini), fim: t5(b.fim) });
  const q = encodeURIComponent;

  const Supa = {
    modo: "supabase",
    async publico(slug) {
      const r = await rpc("dados_publicos", { p_slug: slug }); if (!r) return null;
      r.b.config = Object.assign({}, window.DEFAULT_CONFIG, r.b.config || {}); r.profs = r.profs || []; return r;
    },
    async ocupados(slug, de, ate) { return ((await rpc("horarios_ocupados", { p_slug: slug, p_de: de, p_ate: ate })) || []).map(x => ({ prof: x.prof, data: x.data, ini: t5(x.ini), fim: t5(x.fim) })); },
    async agendar(slug, r) { return await rpc("agendar", { p_slug: slug, p_servico: r.servico_id, p_prof: r.prof_id || null, p_nome: r.nome, p_tel: r.telefone || "", p_data: r.data, p_hora: r.hora }); },
    async statusCliente(ids) { return ids.length ? (await rpc("status_agendamentos", { p_ids: ids })) || [] : []; },
    async cancelar(id, token) { await rpc("cancelar_agendamento", { p_id: id, p_token: token }); },
    async slugLivre(slug) { return slugOk(slug) && !!(await rpc("slug_disponivel", { p_slug: slug })); },
    async entrar(email, senha) { const j = await auth("token?grant_type=password", { email, password: senha }); if (!j.access_token) throw new Error("E-mail ou senha incorretos."); guardar(j); },
    sair() { sess.set(null); },
    logado() { return !!sess.get(); },
    usuario() { const s = sess.get(); return s && s.user; },
    async souSuper() { return !!(await rpc("sou_super", {}, true)); },
    async acessos() { return (await rpc("meus_acessos", {}, true)) || []; },
    async criarConta(email, senha) {
      const j = await auth("signup", { email, password: senha });
      if (j.access_token) { guardar(j); return { pendente: false }; }
      if (j.id || (j.user && j.user.id)) return { pendente: true };
      throw new Error(/registered/i.test(j.msg || j.error_description || "") ? "Este e-mail já tem conta. Use Entrar." : (j.msg || j.error_description || "Não foi possível criar a conta."));
    },
    async criarBarbearia({ nome, slug, nomeDono }) { return await rpc("criar_barbearia", { p_nome: nome, p_slug: slug, p_nome_dono: nomeDono }, true); },
    async aceitarConvite(cod) { await rpc("aceitar_convite", { p_codigo: cod.toUpperCase().trim() }, true); },
    async barbearia(bid) { const r = await sb(`/rest/v1/barbearias?id=eq.${q(bid)}&select=*`, { auth: true }); const b = r[0];
      b.config = Object.assign({}, window.DEFAULT_CONFIG, b.config || {}); return b; },
    async salvarBarbearia(bid, { nome, config }) { const body = {}; if (nome) body.nome = nome; if (config) body.config = config;
      await sb(`/rest/v1/barbearias?id=eq.${q(bid)}`, { method: "PATCH", auth: true, body }); },
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
    async todas() { return (await rpc("todas_barbearias", {}, true)) || []; },
    async atualizarAssinatura(id, patch) { await sb(`/rest/v1/barbearias?id=eq.${q(id)}`, { method: "PATCH", auth: true, body: patch }); }
  };

  window.Store = SUPABASE_URL && SUPABASE_ANON_KEY ? Supa : Local;
  window.Store.slugOk = slugOk;
})();
