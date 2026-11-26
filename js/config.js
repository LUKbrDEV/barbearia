// ===== BACKEND =====
// Vazio = modo demonstração (tudo salvo neste navegador, com contas de teste).
// Produção: crie um projeto Supabase, rode supabase/schema.sql e preencha abaixo.
window.BARBER_BACKEND = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: ""
};

// ===== SUA PLATAFORMA =====
window.PLATAFORMA = {
  nome: "Agenda Barber",                 // nome do seu produto
  dominio: "seuapp.com.br",              // usado só nos textos
  suporteWhatsapp: "5538999990000",      // seu WhatsApp de suporte/vendas
  diasTeste: 14,
  planos: [
    { id: "solo",      nome: "Solo",      preco: 39.9, maxProf: 1,    desc: "Para quem atende sozinho." },
    { id: "equipe",    nome: "Equipe",    preco: 69.9, maxProf: 5,    desc: "Até 5 barbeiros, cada um com sua agenda." },
    { id: "ilimitado", nome: "Ilimitado", preco: 99.9, maxProf: null, desc: "Barbeiros sem limite e relatórios por profissional." }
  ],
  // caminhos que não podem virar nome de barbearia
  reservados: ["painel", "admin", "entrar", "cadastro", "api", "css", "js", "icons", "supabase", "index.html", "sw.js", "manifest.webmanifest", "termos", "privacidade"]
};

// Configuração inicial de toda barbearia nova (editável no painel).
window.DEFAULT_CONFIG = {
  slogan: "Corte, barba e conversa boa.",
  whatsapp: "",
  endereco: "",
  instagram: "",
  mapsUrl: "",
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
