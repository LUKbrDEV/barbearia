// supabase: aqui vai só a chave publishable, nunca a secret
window.BARBER_BACKEND = {
  SUPABASE_URL: "https://psolqyvhsxdpuodxlpwh.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ul0lVVWTqWjfzCc9sQetXA_M0bCsz3O"
};

window.PLATAFORMA = {
  nome: "LKBarber",
  suporteWhatsapp: "38998504119",
  diasTeste: 14,
  demoSlug: "demo",
  // dados que aparecem nos termos e na privacidade
  responsavel: "Lucas Santos",
  documento: "70047445661",
  email: "lucasinfotec20@gmail.com",
  foro: "Paracatu/ MG",
  reservados: ["painel", "admin", "entrar", "cadastro", "api", "css", "js", "icons", "supabase", "index.html", "404.html", "sw.js",
    "manifest.webmanifest", "termos", "privacidade", "img", "lkbarber", "suporte", "ajuda", "app"]
};

window.DEFAULT_CONFIG = {
  slogan: "Corte, barba e conversa boa.",
  whatsapp: "",
  endereco: "",
  instagram: "",
  mapsUrl: "",
  logo: null,
  pedirTelefone: false,
  intervalo: 30,
  antecedenciaMin: 60,
  diasAgenda: 21,
  horarios: {
    0: { aberto: false, abre: "09:00", fecha: "13:00", almocoIni: "", almocoFim: "" },
    1: { aberto: false, abre: "09:00", fecha: "19:00", almocoIni: "12:00", almocoFim: "13:00" },
    2: { aberto: true,  abre: "09:00", fecha: "19:00", almocoIni: "12:00", almocoFim: "13:00" },
    3: { aberto: true,  abre: "09:00", fecha: "19:00", almocoIni: "12:00", almocoFim: "13:00" },
    4: { aberto: true,  abre: "09:00", fecha: "19:00", almocoIni: "12:00", almocoFim: "13:00" },
    5: { aberto: true,  abre: "09:00", fecha: "20:00", almocoIni: "12:00", almocoFim: "13:00" },
    6: { aberto: true,  abre: "08:00", fecha: "17:00", almocoIni: "", almocoFim: "" }
  },
  servicos: [
    { id: "corte",   nome: "Corte",             preco: 40, dur: 30, desc: "Máquina e tesoura, acabamento na navalha." },
    { id: "barba",   nome: "Barba",             preco: 30, dur: 30, desc: "Toalha quente, navalha e balm." },
    { id: "combo",   nome: "Corte + Barba",     preco: 65, dur: 60, desc: "O completo, com desconto." },
    { id: "degrade", nome: "Degradê navalhado", preco: 50, dur: 45, desc: "Fade bem marcado e risco opcional." },
    { id: "sobr",    nome: "Sobrancelha",       preco: 15, dur: 15, desc: "Limpeza na navalha ou pinça." }
  ]
};
