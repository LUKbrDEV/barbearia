// Núcleo: utilidades de interface, roteador por caminho e PWA.
{
  const A = window.Agenda, P = window.PLATAFORMA;
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
               set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const fmtData = (s, longo) => A.parseYMD(s).toLocaleDateString("pt-BR", longo ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "2-digit", month: "2-digit" });
  const cap = s => s.replace(/^./, c => c.toUpperCase());
  const durTxt = m => m >= 60 ? Math.floor(m / 60) + "h" + (m % 60 ? String(m % 60).padStart(2, "0") : "") : m + " min";
  const soDig = s => String(s || "").replace(/\D/g, "");
  const wa = (num, txt) => { let n = soDig(num); if (n && n.length <= 11) n = "55" + n; return "https://wa.me/" + n + (txt ? "?text=" + encodeURIComponent(txt) : ""); };
  const slugify = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const hoje = () => A.ymd(new Date());
  // Caminho base: "/" num domínio próprio; "/repo/" no GitHub Pages (definido no <head> do index.html).
  const BASE = window.BASE || "/";
  const url = p => p.startsWith("/") ? BASE + p.slice(1) : p;          // "/painel" -> "/barbearia/painel"
  const abs = p => location.origin + url(p);                             // link completo para compartilhar
  const iniciais = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();

  let toastT;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 3000); }
  function modal(html) { $("#modalBox").innerHTML = html; $("#modal").hidden = false; const f = $("#modalBox").querySelector("input,select,button"); return $("#modalBox"); }
  function fecharModal() { $("#modal").hidden = true; $("#modalBox").innerHTML = ""; }
  $("#modal").addEventListener("click", e => { if (e.target.id === "modal" || e.target.closest("[data-fechar]")) fecharModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) fecharModal(); });

  function baixar(nome, conteudo, tipo) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo })); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
  }
  function ics(ag, nomeLocal, endereco) {
    const d = ag.data.replace(/-/g, ""), h = ag.hora.replace(":", "") + "00", f = A.toHM(A.toMin(ag.hora) + ag.dur).replace(":", "") + "00";
    baixar("agendamento.ics", ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LKBarber//PT", "BEGIN:VEVENT", "UID:" + ag.id,
      "DTSTART:" + d + "T" + h, "DTEND:" + d + "T" + f, "SUMMARY:" + ag.servico + " - " + nomeLocal, "LOCATION:" + (endereco || ""),
      "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Lembrete", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n"), "text/calendar");
  }
  async function copiar(txt) { try { await navigator.clipboard.writeText(txt); toast("Copiado!"); } catch { toast("Não foi possível copiar. Selecione e copie manualmente."); } }

  // ---------- moldura: topo, barra inferior, rodapé ----------
  const ICON = {
    inicio: '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    agendar: '<path d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM12 11v6M9 14h6"/>',
    meus: '<path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>',
    info: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>',
    agenda: '<path d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 12h3M8 16h6"/>',
    bloq: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8"/>',
    rel: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    cli: '<path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8"/>',
    mais: '<path d="M4 6h16M4 12h16M4 18h16"/>'
  };
  function moldura({ marca, marcaHref = "/", acoes = "", tabs = null, ativo = "", rodape = true, logo = null }) {
    $("#topo").innerHTML = `<a class="marca" href="${esc(marcaHref)}" data-link>${logo ? `<img src="${esc(logo)}" alt="" width="30" height="30">` : `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#poste"/></svg>`}<span>${esc(marca)}</span></a>
      <div class="topo-acoes"><button id="btnInstalar" class="btn-inst" ${promptInst ? "" : "hidden"}>Instalar app</button>${acoes}</div>`;
    $("#btnInstalar").onclick = instalar;
    const tb = $("#tabbar");
    if (tabs) {
      tb.hidden = false; tb.style.gridTemplateColumns = `repeat(${tabs.length},1fr)`;
      tb.innerHTML = tabs.map(t => `<a href="${esc(t.href || "#")}" ${t.href ? "data-link" : ""} data-tab="${t.id}" class="${t.id === ativo ? "ativo" : ""}"><svg viewBox="0 0 24 24">${ICON[t.icon || t.id]}</svg>${esc(t.txt)}</a>`).join("");
    } else { tb.hidden = true; tb.innerHTML = ""; }
    document.body.classList.toggle("com-tabs", !!tabs);
    $("#rodape").hidden = !rodape;
  }
  function rodapeHTML(extra = "") {
    $("#rodape").innerHTML = `${extra}<small class="lukdev">Feito por LukDev</small>`;
  }

  // ---------- roteador ----------
  function partes() {
    let cam = decodeURIComponent(location.pathname); if (cam.startsWith(BASE)) cam = "/" + cam.slice(BASE.length);
    const p = cam.split("/").filter(Boolean);
    if (p[0] === "index.html") p.shift();
    return p;
  }
  function go(path, substituir) {
    try { history[substituir ? "replaceState" : "pushState"]({}, "", url(path)); } catch { location.href = url(path); return; }
    rota();
  }
  document.addEventListener("click", e => {
    const a = e.target.closest("a[data-link]");
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || a.target === "_blank") return;
    const href = a.dataset.raw || a.getAttribute("href"); if (!href || !href.startsWith("/")) return;
    e.preventDefault(); go(href);
  });
  // links internos escritos como "/painel" ganham o caminho base automaticamente
  function ajustarLinks(raiz) {
    if (BASE === "/") return;
    raiz.querySelectorAll('a[href^="/"]:not([data-raw])').forEach(a => { const h = a.getAttribute("href"); a.dataset.raw = h; a.setAttribute("href", url(h)); });
  }
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && ajustarLinks(n.parentNode || n)))).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("popstate", rota);

  function rota() {
    fecharModal(); window.scrollTo(0, 0);
    const p = partes(), r = p[0] || "";
    document.body.dataset.area = r === "painel" ? "painel" : r === "admin" ? "admin" : !r || r === "cadastro" ? "site" : "cliente";
    if (window.Painel) window.Painel.parar && window.Painel.parar();
    if (!window.Store.configurado) return naoConfigurado();
    // link de e-mail (confirmação/nova senha) que caiu na página inicial: leva para o painel, que faz o login
    if (!r && /access_token=|error_description=/.test(location.hash)) { history.replaceState({}, "", url("/painel") + location.hash); return window.Painel.render(); }
    if (!r) {
      if (standalone()) { // app instalado abre direto onde a pessoa usa
        if (window.Store.logado() && ls.get("bb_ultimo_painel", false)) return go("/painel", true);
        const u = ls.get("bb_ultima", ""); if (u) return go("/" + u, true);
      }
      return window.Landing.inicio();
    }
    if (r === "cadastro") return window.Landing.cadastro();
    if (r === "painel") return window.Painel.render();
    if (r === "admin") return window.Admin.render();
    return window.Cliente.render(r.toLowerCase(), p[1] || "inicio");
  }

  function naoConfigurado() {
    moldura({ marca: P.nome }); rodapeHTML("");
    $("#app").innerHTML = `<div class="form-pag"><h1>Quase lá</h1><p>O ${esc(P.nome)} ainda não está conectado ao banco de dados.</p>
      <p class="sub">Preencha <code>SUPABASE_URL</code> e <code>SUPABASE_PUBLISHABLE_KEY</code> em <code>js/config.js</code>. O passo a passo está no LEIAME.md.</p></div>`;
  }
  const iconesDe = (bid, logo) => logo && logo.v && window.Store.logoURL
    ? { i192: window.Store.logoURL(bid, logo, "icon-192.png"), i512: window.Store.logoURL(bid, logo, "icon-512.png"), mask: window.Store.logoURL(bid, logo, "maskable-512.png") } : null;
  // planos vêm do banco (cache de 5 min)
  let planosCache = null;
  async function planos(forcar) {
    if (!forcar && planosCache && Date.now() - planosCache.t < 300000) return planosCache.l;
    try { const l = await window.Store.planos(); planosCache = { t: Date.now(), l }; ls.set("lk_planos", l); return l; }
    catch (e) { const c = ls.get("lk_planos", null); if (c) return c; throw e; }
  }

  // ---------- PWA ----------
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let promptInst = null;
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); promptInst = e; const b = $("#btnInstalar"); if (b) b.hidden = false; });
  async function instalar() { if (!promptInst) return; promptInst.prompt(); await promptInst.userChoice; promptInst = null; const b = $("#btnInstalar"); if (b) b.hidden = true; }
  addEventListener("appinstalled", () => { const b = $("#btnInstalar"); if (b) b.hidden = true; toast("App instalado!"); });
  // manifest próprio por barbearia: o app instalado abre direto nela, com o nome dela
  let manifestURL = null;
  // icones: { i192, i512, mask } (ícone enviado pela barbearia) ou nada (ícone do LKBarber)
  function manifestPara(nome, startPath, icones) {
    const o = location.origin + BASE.slice(0, -1), m = { name: nome, short_name: nome.slice(0, 24), start_url: o + startPath, scope: o + "/", id: o + startPath,
      display: "standalone", orientation: "portrait", background_color: "#16181d", theme_color: "#16181d", lang: "pt-BR",
      icons: icones ? [{ src: icones.i192, sizes: "192x192", type: "image/png" }, { src: icones.i512, sizes: "512x512", type: "image/png" },
        { src: icones.mask, sizes: "512x512", type: "image/png", purpose: "maskable" }]
      : [{ src: o + "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: o + "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: o + "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
    $("link[rel=icon]").href = icones ? icones.i192 : url("/icons/icon-192.png");
    $("link[rel=apple-touch-icon]").href = icones ? icones.i192 : url("/icons/apple-touch-icon.png");
    if (manifestURL) URL.revokeObjectURL(manifestURL);
    manifestURL = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: "application/manifest+json" }));
    $("link[rel=manifest]").href = manifestURL;
    $("meta[name=apple-mobile-web-app-title]").content = nome;
  }
  function manifestPadrao() {
    $("link[rel=manifest]").href = url("/manifest.webmanifest"); $("meta[name=apple-mobile-web-app-title]").content = P.nome;
    $("link[rel=icon]").href = url("/icons/icon-192.png"); $("link[rel=apple-touch-icon]").href = url("/icons/apple-touch-icon.png");
  }
  if ("serviceWorker" in navigator) { try { navigator.serviceWorker.register(url("/sw.js")).catch(() => {}); } catch {} }

  window.UI = { $, esc, money, DIAS, ls, fmtData, cap, durTxt, soDig, wa, slugify, hoje, iniciais, toast, modal, fecharModal, baixar, ics, copiar,
    moldura, rodapeHTML, go, rota, partes, url, abs, BASE, standalone, manifestPara, manifestPadrao, ICON, planos, iconesDe };
  addEventListener("DOMContentLoaded", rota);
}
