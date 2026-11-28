// @ts-nocheck
// deploy: supabase functions deploy asaas-webhook --no-verify-jwt

const TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = (() => {
  try { const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default; if (k) return k; } catch (_) { }
  return Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("LK_SECRET_KEY") || "";
})();

async function sha256(s) { return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
async function tokenOk(recebido) {
  if (!TOKEN || !recebido) return false;
  const [a, b] = await Promise.all([sha256(recebido), sha256(TOKEN)]);
  let dif = 0; for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}
async function rpc(fn, body) {
  const h = { apikey: SB_KEY, "Content-Type": "application/json" };
  if (!SB_KEY.startsWith("sb_")) h.Authorization = "Bearer " + SB_KEY;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`banco ${r.status}: ${await r.text()}`);
  return r.json();
}

Deno.serve(async req => {
  if (req.method !== "POST") return new Response("use POST", { status: 405 });
  if (!TOKEN) return new Response("falta o segredo ASAAS_WEBHOOK_TOKEN", { status: 500 });
  if (!SB_KEY) return new Response("falta a chave secreta do Supabase (segredo LK_SECRET_KEY)", { status: 500 });
  if (!(await tokenOk(req.headers.get("asaas-access-token")))) return new Response("token inválido", { status: 401 });
  let ev; try { ev = await req.json(); } catch (_) { return new Response("json inválido", { status: 400 }); }
  const tipo = String(ev.event ?? "");
  try {
    let r = "ignorado";
    if (tipo.startsWith("PAYMENT_") && ev.payment)
      r = await rpc("processar_pagamento_asaas", { p_evento_id: ev.id ?? null, p_evento: tipo, p: ev.payment });
    else if ((tipo === "SUBSCRIPTION_DELETED" || tipo === "SUBSCRIPTION_INACTIVATED") && ev.subscription?.id)
      r = await rpc("encerrar_assinatura_asaas", { p_evento_id: ev.id ?? null, p_sub: ev.subscription.id });
    console.log(tipo, ev.payment?.id ?? ev.subscription?.id ?? "", r);
    return Response.json({ ok: true, r });
  } catch (e) {
    // devolve 500 pro asaas tentar de novo
    console.error(tipo, e.message);
    return new Response("erro", { status: 500 });
  }
});
