// Lógica pura de datas e horários (sem DOM) — testável no Node.
(function (root) {
  const pad = n => String(n).padStart(2, "0");
  const toMin = hm => { if (!hm) return null; const [h, m] = String(hm).slice(0, 5).split(":").map(Number); return h * 60 + m; };
  const toHM = m => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parseYMD = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseYMD(s); d.setDate(d.getDate() + n); return ymd(d); };
  const overlap = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
  const dow = s => parseYMD(s).getDay();
  const trabalha = (prof, data) => !prof || !prof.dias || prof.dias.includes(dow(data));

  // busy: [{prof:id|null, data, ini:"HH:MM"|"", fim}]  prof null = vale para todos; ini "" = dia inteiro
  // prof: {id, dias:[0..6]} opcional — calcula só para esse profissional
  function slotsDoDia(cfg, data, dur, busy, agora, prof) {
    const h = cfg.horarios[dow(data)];
    if (!h || !h.aberto || !trabalha(prof, data)) return { fechado: true, slots: [] };
    const abre = toMin(h.abre), fecha = toMin(h.fecha), aIni = toMin(h.almocoIni), aFim = toMin(h.almocoFim);
    const doDia = busy.filter(b => b.data === data && (!prof || !b.prof || b.prof === prof.id));
    if (doDia.some(b => !b.ini)) return { fechado: true, slots: [] };
    const ocup = doDia.map(b => [toMin(b.ini), toMin(b.fim)]);
    agora = agora || new Date();
    let minimo = -1;
    if (data === ymd(agora)) minimo = agora.getHours() * 60 + agora.getMinutes() + (cfg.antecedenciaMin || 0);
    else if (data < ymd(agora)) return { fechado: false, slots: [] };
    const passo = Math.max(5, cfg.intervalo || 30), slots = [];
    for (let t = abre; t + dur <= fecha; t += passo) {
      let livre = t >= minimo;
      if (livre && aIni != null && aFim != null && overlap(t, t + dur, aIni, aFim)) livre = false;
      if (livre && ocup.some(([i, f]) => overlap(t, t + dur, i, f))) livre = false;
      slots.push({ hora: toHM(t), livre });
    }
    return { fechado: false, slots };
  }

  // Junta a agenda de vários profissionais: um horário está livre se algum deles estiver livre.
  function slotsEquipe(cfg, data, dur, busy, agora, profs) {
    const rs = profs.map(p => [p.id, slotsDoDia(cfg, data, dur, busy, agora, p)]);
    const abertos = rs.filter(([, r]) => !r.fechado);
    if (!abertos.length) return { fechado: true, slots: [] };
    const mapa = new Map();
    abertos.forEach(([id, r]) => r.slots.forEach(s => {
      const m = mapa.get(s.hora) || { hora: s.hora, livre: false, profs: [] };
      if (s.livre) { m.livre = true; m.profs.push(id); }
      mapa.set(s.hora, m);
    }));
    return { fechado: false, slots: [...mapa.values()].sort((a, b) => a.hora.localeCompare(b.hora)) };
  }

  // Assinatura efetiva: teste vencido conta como bloqueada.
  function statusEfetivo(b, hoje) {
    if (!b) return "inexistente";
    if (b.status === "bloqueada") return "bloqueada";
    if (b.vence_em && b.vence_em < hoje) {
      if (b.status === "teste") return "teste_vencido";
      return addDays(b.vence_em, 3) >= hoje ? "carencia" : "vencida"; // 3 dias de carência (igual ao banco)
    }
    return b.status;
  }
  const liberada = (b, hoje) => ["ativa", "teste", "carencia"].includes(statusEfetivo(b, hoje));

  root.Agenda = { pad, toMin, toHM, ymd, parseYMD, addDays, overlap, dow, trabalha, slotsDoDia, slotsEquipe, statusEfetivo, liberada };
  if (typeof module !== "undefined") module.exports = root.Agenda;
})(typeof window !== "undefined" ? window : globalThis);
