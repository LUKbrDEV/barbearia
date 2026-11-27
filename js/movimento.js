// Movimento da página de vendas: GSAP + ScrollTrigger (animações ligadas à rolagem) e Lenis (rolagem suave).
// As bibliotecas são carregadas sob demanda, só nesta página. Sem elas (offline, bloqueio, movimento reduzido),
// a página funciona igual, apenas parada.
{
  const LIBS = [
    "https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js",
    "https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js",
    "https://cdn.jsdelivr.net/npm/lenis@1/dist/lenis.min.js"
  ];
  let carregando = null, lenis = null, cena = null, tick = null, ativo = false, limparEspuma = null;
  const reduz = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function script(src) {
    return new Promise((ok, falha) => {
      if (document.querySelector(`script[data-mov="${src}"]`)) return ok();
      const s = document.createElement("script"); s.src = src; s.async = false; s.dataset.mov = src;
      s.onload = ok; s.onerror = () => { s.remove(); falha(new Error("não carregou " + src)); };
      document.head.appendChild(s);
    });
  }
  function carregar() {
    if (window.gsap && window.ScrollTrigger && window.Lenis) return Promise.resolve();
    carregando = carregando || LIBS.reduce((p, u) => p.then(() => script(u)), Promise.resolve()).catch(e => { carregando = null; throw e; });
    return carregando;
  }

  // espuma de barbear: onde o mouse passa no topo nascem bolhas que somem devagar (só com mouse; não depende das bibliotecas)
  function espuma(hero) {
    const cv = document.createElement("canvas"); cv.className = "espuma"; cv.setAttribute("aria-hidden", "true"); hero.prepend(cv);
    const cx = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
    let bolhas = [], raf = 0, ult = null, W = 0, H = 0;
    const medir = () => { const r = hero.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; };
    const solta = (x, y) => bolhas.push({ x: x + (Math.random() - .5) * 28, y: y + (Math.random() - .5) * 28, r: 3 + Math.random() * 10, vida: 1, dv: .005 + Math.random() * .007 });
    function mover(e) {
      const r = hero.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const n = ult ? Math.min(6, Math.ceil(Math.hypot(x - ult.x, y - ult.y) / 14)) : 1;
      for (let i = 1; i <= n; i++) { const px = ult ? ult.x + (x - ult.x) * i / n : x, py = ult ? ult.y + (y - ult.y) * i / n : y; solta(px, py); solta(px, py); }
      ult = { x, y };
      if (bolhas.length > 280) bolhas.splice(0, bolhas.length - 280);
      if (!raf) raf = requestAnimationFrame(desenhar);
    }
    function desenhar() {
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
      bolhas = bolhas.filter(b => (b.vida -= b.dv) > 0);
      for (const b of bolhas) {
        const a = Math.min(1, b.vida * 1.5) * .9, y = b.y + (1 - b.vida) * 8, r = b.r * (.75 + .25 * b.vida);
        const g = cx.createRadialGradient(b.x - r * .35, y - r * .35, r * .1, b.x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(.75, `rgba(241,234,220,${a * .7})`); g.addColorStop(1, "rgba(241,234,220,0)");
        cx.fillStyle = g; cx.beginPath(); cx.arc(b.x, y, r, 0, 7); cx.fill();
        cx.strokeStyle = `rgba(255,255,255,${a * .35})`; cx.lineWidth = .8; cx.stroke();
      }
      raf = bolhas.length ? requestAnimationFrame(desenhar) : 0;
    }
    const sair = () => { ult = null; };
    medir();
    hero.addEventListener("pointerenter", medir); hero.addEventListener("pointermove", mover); hero.addEventListener("pointerleave", sair); addEventListener("resize", medir);
    return () => { cancelAnimationFrame(raf); hero.removeEventListener("pointerenter", medir); hero.removeEventListener("pointermove", mover);
      hero.removeEventListener("pointerleave", sair); removeEventListener("resize", medir); cv.remove(); };
  }

  async function iniciar() {
    parar(); ativo = true;
    if (reduz()) return;
    const hero = document.querySelector("#landing .l-hero");
    if (hero && matchMedia("(pointer: fine)").matches) limparEspuma = espuma(hero);
    try { await carregar(); } catch { return; }                    // sem internet/CDN: fica estático
    const raiz = document.getElementById("landing");
    if (!ativo || !raiz) return;                                     // saiu da página enquanto carregava
    const { gsap, ScrollTrigger, Lenis } = window;
    gsap.registerPlugin(ScrollTrigger);

    // rolagem suave só com mouse/trackpad; no toque o celular continua com a rolagem nativa
    lenis = new Lenis({ lerp: 0.12, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    tick = t => lenis && lenis.raf(t * 1000);
    gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0);

    cena = gsap.context(() => {
      const entra = { opacity: 0, duration: 0.7, ease: "power3.out" };
      // abertura: o texto sobe em sequência e o celular chega inclinado
      gsap.from(".l-hero h1, .l-hero .l-sub, .l-hero .l-ctas, .l-hero .l-mini", { ...entra, y: 26, stagger: 0.08 });
      gsap.from(".l-hero .celular", { ...entra, y: 70, rotate: 5, duration: 1, delay: 0.15 });
      // o piso xadrez do topo desliza e o celular sobe devagar enquanto rola
      const topo = { trigger: ".l-hero", start: "top top", end: "bottom top", scrub: true };
      gsap.to(".l-hero", { "--xadrez-x": "176px", ease: "none", scrollTrigger: topo });
      gsap.to(".l-hero .celular", { yPercent: -14, rotate: -2, ease: "none", scrollTrigger: { ...topo } });
      // títulos de seção
      gsap.utils.toArray("#landing .band > h2").forEach(h => gsap.from(h, { ...entra, y: 30, scrollTrigger: { trigger: h, start: "top 86%" } }));
      // antes x depois: cada lado entra de um lado
      gsap.from(".antes", { ...entra, x: -46, scrollTrigger: { trigger: ".antes-depois", start: "top 80%" } });
      gsap.from(".depois", { ...entra, x: 46, delay: 0.12, scrollTrigger: { trigger: ".antes-depois", start: "top 80%" } });
      // benefícios: os selos giram como um poste e o texto sobe
      gsap.from(".bf", { ...entra, y: 24, stagger: 0.07, scrollTrigger: { trigger: ".beneficios", start: "top 82%" } });
      gsap.from(".bf svg", { rotate: -120, scale: 0.7, duration: 0.9, ease: "back.out(1.7)", stagger: 0.07, scrollTrigger: { trigger: ".beneficios", start: "top 82%" } });
      gsap.from(".passos li", { ...entra, y: 30, stagger: 0.1, scrollTrigger: { trigger: ".passos", start: "top 84%" } });
      gsap.from(".tres > div", { ...entra, y: 30, stagger: 0.1, scrollTrigger: { trigger: ".tres", start: "top 84%" } });
      gsap.from(".cta-final h2, .cta-final .l-ctas", { ...entra, y: 26, stagger: 0.1, scrollTrigger: { trigger: ".cta-final", start: "top 85%" } });

      // palco: o cliente confirma, o comprovante gira de frente para você e a agenda do barbeiro sobe com o horário novo.
      // Se a seção cabe na tela, ela fica parada enquanto a cena acontece; senão a cena acompanha a rolagem normal.
      const palco = document.getElementById("palco");
      if (palco) {
        const fixa = palco.offsetHeight <= innerHeight;
        gsap.timeline({ scrollTrigger: { trigger: palco, start: fixa ? "top top" : "top 70%", end: fixa ? "+=120%" : "bottom 45%", scrub: 0.6, pin: fixa } })
          .to(".pc-botao", { scale: 0.9, duration: 0.25 }).to(".pc-botao", { scale: 1, duration: 0.25 })
          .from(".pc-ticket", { opacity: 0, xPercent: -55, yPercent: -95, rotateY: -100, rotateZ: -10, transformPerspective: 900, duration: 1.4, ease: "power2.out" }, "<")
          .from(".pc-agenda", { opacity: 0, yPercent: 55, duration: 1.1, ease: "power2.out" }, "-=0.7")
          .from(".pc-novo", { backgroundColor: "rgba(0,0,0,0)", outlineColor: "rgba(168,32,26,0)", duration: 0.5 })
          .from(".pc-novo em", { scale: 0, duration: 0.4, ease: "back.out(2.2)" }, "<")
          .to({}, { duration: 0.4 });                                   // respiro antes de soltar a seção
      }

      // telas do app: entram em sequência (no computador ficam as 4 lado a lado; no celular, carrossel)
      gsap.from(".tela", { ...entra, y: 40, stagger: 0.1, scrollTrigger: { trigger: "#telasTrilho", start: "top 85%" } });
    }, raiz);
    // os planos chegam do banco depois: recalcula as posições quando a página termina de montar
    setTimeout(() => window.ScrollTrigger && ScrollTrigger.refresh(), 1200);
  }

  function parar() {
    ativo = false;
    if (limparEspuma) { limparEspuma(); limparEspuma = null; }
    if (cena) { cena.revert(); cena = null; }
    if (lenis) { if (window.gsap && tick) gsap.ticker.remove(tick); lenis.destroy(); lenis = null; tick = null; }
  }

  window.Movimento = { iniciar, parar };
}
