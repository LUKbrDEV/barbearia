// @ts-nocheck  (JavaScript puro dentro de .ts: o Deno não precisa checar tipos)
// LKBarber — Edge Function "assinatura"
// Chamada pelo painel do dono (com o login dele). Fala com o Asaas usando a SUA chave de API,
// que fica só aqui no servidor. Ações: info, assinar (também troca plano/forma), cancelar.
//
// Segredos (Supabase → Edge Functions → Secrets):
//   ASAAS_API_KEY   chave da API do Asaas ($aact_...)
//   ASAAS_URL       https://api-sandbox.asaas.com/v3 (testes) ou https://api.asaas.com/v3 (produção)
// Deploy: supabase functions deploy assinatura --no-verify-jwt   (o login é conferido aqui dentro)

const ASAAS_URL = Deno.env.get("ASAAS_URL") ?? "https://api-sandbox.asaas.com/v3";
const ASAAS_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = (() => {
  try { const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default; if (k) return k; } catch (_) { /* usa a legada */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
})();
const FORMAS = ["CREDIT_CARD", "PIX", "BOLETO"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
class Erro extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

// ---------- Supabase (com a chave secreta: ignora RLS, por isso tudo é conferido aqui) ----------
function sbHeaders(extra = {}) {
  const h = { apikey: SB_KEY, "Content-Type": "application/json", ...extra };
  if (!SB_KEY.startsWith("sb_")) h.Authorization = "Bearer " + SB_KEY; // chave legada (JWT)
  return h;
}
async function db(path, opt = {}) {
  const r = await fetch(SB_URL + "/rest/v1" + path, { method: opt.method ?? "GET", headers: sbHeaders(opt.headers), body: opt.body ? JSON.stringify(opt.body) : undefined });
  const t = await r.text(); const j = t ? JSON.parse(t) : null;
  if (!r.ok) throw new Error((j && (j.message || j.hint)) || "Erro no banco.");
  return j;
}
async function usuario(req) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt || jwt.startsWith("sb_")) throw new Erro("Entre na sua conta.", 401);
  const r = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + jwt } });
  if (!r.ok) throw new Erro("Sessão expirada. Entre novamente.", 401);
  return await r.json();
}

// ---------- Asaas ----------
async function asaas(path, method = "GET", body) {
  const r = await fetch(ASAAS_URL + path, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { access_token: ASAAS_KEY, "Content-Type": "application/json", "User-Agent": "LKBarber" },
  });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) { /* sem corpo */ }
  if (!r.ok) throw new Erro((j && j.errors && j.errors[0] && j.errors[0].description) || "Erro no Asaas (" + r.status + ").");
  return j;
}
const hojeBR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()); // AAAA-MM-DD
const soDig = s => String(s ?? "").replace(/\D/g, "");
function cpfCnpjValido(v) {
  const d = soDig(v);
  if (d.length === 11) {
    if (/^(\d)\1+$/.test(d)) return false;
    for (const t of [9, 10]) { let s = 0; for (let i = 0; i < t; i++) s += +d[i] * (t + 1 - i); if (((s * 10) % 11) % 10 !== +d[t]) return false; }
    return true;
  }
  if (d.length === 14) {
    if (/^(\d)\1+$/.test(d)) return false;
    const calc = n => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += +d[i] * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === +d[12] && calc(13) === +d[13];
  }
  return false;
}
const fatura = p => ({ id: p.id, valor: p.value, status: p.status, forma: p.billingType, vencimento: p.dueDate,
  pago_em: p.paymentDate || p.confirmedDate || null, url: p.invoiceUrl });

// ---------- ações ----------
async function carregar(user, bid) {
  if (!/^[0-9a-f-]{36}$/i.test(bid ?? "")) throw new Erro("Barbearia inválida.");
  const [m, sup, b] = await Promise.all([
    db(`/membros?user_id=eq.${user.id}&barbearia_id=eq.${bid}&select=papel`),
    db(`/plataforma_admins?user_id=eq.${user.id}&select=user_id`),
    db(`/barbearias?id=eq.${bid}&select=*`),
  ]);
  if (!b.length) throw new Erro("Barbearia não encontrada.", 404);
  if (!(m[0]?.papel === "dono" || sup.length)) throw new Erro("Só o dono da barbearia pode mexer na assinatura.", 403);
  return b[0];
}

async function info(b) {
  if (!b.asaas_subscription_id) return { assinatura: null, faturas: [] };
  const [s, p] = await Promise.all([
    asaas(`/subscriptions/${b.asaas_subscription_id}`),
    asaas(`/subscriptions/${b.asaas_subscription_id}/payments?limit=12`),
  ]);
  const faturas = (p.data ?? []).map(fatura).sort((x, y) => String(y.vencimento).localeCompare(String(x.vencimento)));
  return { assinatura: { status: s.status, forma: s.billingType, valor: s.value, proxima: s.nextDueDate }, faturas };
}

async function assinar(b, user, x) {
  const forma = String(x.forma ?? "");
  if (!FORMAS.includes(forma)) throw new Erro("Escolha cartão, Pix ou boleto.");
  const planos = await db(`/planos?id=eq.${encodeURIComponent(String(x.plano ?? ""))}&ativo=eq.true&select=*`);
  const plano = planos[0]; if (!plano) throw new Erro("Plano indisponível.");
  if (plano.max_prof) {
    const ativos = await db(`/profissionais?barbearia_id=eq.${b.id}&ativo=eq.true&select=id`);
    if (ativos.length > plano.max_prof)
      throw new Erro(`O plano ${plano.nome} permite ${plano.max_prof} barbeiro(s) ativo(s) e você tem ${ativos.length}. Desative alguém em Equipe antes.`);
  }
  const descricao = `LKBarber ${plano.nome} - ${b.nome}`.slice(0, 500);

  // cliente no Asaas (o pagador é a barbearia)
  let cliente = b.asaas_customer_id;
  if (!cliente) {
    if (!cpfCnpjValido(x.cpfCnpj)) throw new Erro("Informe um CPF ou CNPJ válido do responsável pela barbearia.");
    const c = await asaas("/customers", "POST", { name: String(x.nome || b.nome).slice(0, 100), cpfCnpj: soDig(x.cpfCnpj),
      email: b.dono_email || user.email, mobilePhone: soDig(x.telefone) || undefined, externalReference: b.id });
    cliente = c.id;
  }

  let sub = b.asaas_subscription_id;
  if (sub) {
    // troca de plano e/ou forma: vale para as próximas cobranças e as pendentes
    await asaas(`/subscriptions/${sub}`, "PUT", { value: Number(plano.preco), billingType: forma, description: descricao, updatePendingPayments: true });
  } else {
    // primeira cobrança no fim do teste (ou hoje, se já venceu); pagar antes não faz perder dias
    const hoje = hojeBR(), venc = b.vence_em && b.vence_em > hoje ? b.vence_em : hoje;
    const s = await asaas("/subscriptions", "POST", { customer: cliente, billingType: forma, value: Number(plano.preco), nextDueDate: venc,
      cycle: "MONTHLY", description: descricao, externalReference: b.id });
    sub = s.id;
  }
  await db(`/barbearias?id=eq.${b.id}`, { method: "PATCH", body: { plano: plano.id, asaas_customer_id: cliente, asaas_subscription_id: sub, forma_pagamento: forma } });

  // link da fatura em aberto: o dono paga na página segura do Asaas (cartão nunca passa pelo LKBarber)
  const p = await asaas(`/subscriptions/${sub}/payments?limit=12`);
  const aberta = (p.data ?? []).filter(f => ["PENDING", "OVERDUE"].includes(f.status)).sort((a, c) => String(a.dueDate).localeCompare(String(c.dueDate)))[0];
  return { ok: true, plano: plano.id, url: aberta ? aberta.invoiceUrl : null };
}

async function cancelar(b) {
  if (!b.asaas_subscription_id) throw new Erro("Não há assinatura ativa.");
  await asaas(`/subscriptions/${b.asaas_subscription_id}`, "DELETE");
  await db(`/barbearias?id=eq.${b.id}`, { method: "PATCH", body: { asaas_subscription_id: null } });
  return { ok: true, ate: b.vence_em };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ erro: "Use POST." }, 405);
  try {
    if (!ASAAS_KEY || !SB_URL || !SB_KEY) throw new Erro("Cobrança ainda não configurada no servidor.", 500);
    const user = await usuario(req);
    const x = await req.json().catch(() => ({}));
    const b = await carregar(user, x.bid);
    if (x.acao === "info") return resp(await info(b));
    if (x.acao === "assinar") return resp(await assinar(b, user, x));
    if (x.acao === "cancelar") return resp(await cancelar(b));
    throw new Erro("Ação inválida.");
  } catch (e) {
    return resp({ erro: e.message || "Erro inesperado." }, e.status || 500);
  }
});
