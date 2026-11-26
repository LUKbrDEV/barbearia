// ===== CONEXÃO COM O SUPABASE (obrigatório) =====
// Supabase → Project Settings → API Keys. Use a chave PUBLICÁVEL (sb_publishable_...) ou a "anon" antiga.
// NUNCA coloque aqui a chave secreta (sb_secret_...) nem a service_role.
window.BARBER_BACKEND = {
  SUPABASE_URL: "https://psolqyvhsxdpuodxlpwh.supabase.co",              // ex: "https://abcdefgh.supabase.co"
  SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb2xxeXZoc3hkcHVvZHhscHdoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTcyMDI2OSwiZXhwIjoyMTExMjk2MjY5fQ.2Sk3PfuRezF8YVOJKVKCDBg3urmkACiu8ZLiuJBcpd0"   // ex: "sb_publishable_..."
};

// ===== SUA PLATAFORMA =====
// Preços e limites dos planos ficam no banco (tabela "planos"), editáveis em /admin.
window.PLATAFORMA = {
  nome: "LKBarber",
  suporteWhatsapp: "38998504119",           // seu WhatsApp de suporte, com DDD (ex.: "38999990000")
  diasTeste: 14,                 // só texto; o prazo real está em criar_barbearia() no schema.sql
  reservados: ["painel", "admin", "entrar", "cadastro", "api", "css", "js", "icons", "supabase", "index.html", "404.html", "sw.js",
    "manifest.webmanifest", "termos", "privacidade", "lkbarber", "suporte", "ajuda", "app"]
};

// Configuração inicial de toda barbearia nova (editável no painel).
window.DEFAULT_CONFIG = {
  slogan: "Corte, barba e conversa boa.",
  whatsapp: "",
  endereco: "",
  instagram: "",
  mapsUrl: "",
  logo: null,          // { v: versão } quando a barbearia envia o próprio ícone
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
