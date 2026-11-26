# Agenda Barber — plataforma de agendamento para barbearias (PWA)

HTML, CSS e JavaScript puro, sem build. Um único código atende todas as barbearias assinantes.

## Endereços

| Caminho | Quem usa | O que é |
|---|---|---|
| `/` | Donos de barbearia (prospects) | Site de vendas: como funciona, planos, perguntas, botão de teste grátis |
| `/cadastro` | Dono novo | Cria conta + barbearia, escolhe o endereço (`/nome-da-barbearia`) e começa o teste |
| `/cadastro?convite=CODIGO` | Barbeiro convidado | Cria a senha e já entra vendo só a agenda dele |
| `/nome-da-barbearia` | Cliente final | Página da barbearia + agendamento sem login (`/agendar`, `/meus`, `/info`) |
| `/painel` | Dono e barbeiro | Mesmo login; o menu muda pelo papel |
| `/admin` | Você | Todas as barbearias, planos, ativar, estender teste, bloquear |

## Papéis

- **Cliente:** sem conta. Escolhe serviço → barbeiro (ou "qualquer um", que pega o livre com menos atendimentos no dia) → dia → horário → nome.
- **Barbeiro:** vê e mexe só na própria agenda, folgas, ganhos (com comissão) e clientes dele.
- **Dono:** agenda de toda a equipe com filtro por barbeiro, encaixe para qualquer um, bloqueios da barbearia ou de um barbeiro, relatórios com comissão por barbeiro, clientes, equipe e convites, serviços, horários, assinatura, link + QR Code, exportação CSV. O dono também é um profissional da agenda.
- **Super admin (você):** receita mensal estimada, barbearias ativas/em teste/vencidas, troca de plano, "Ativar +30 dias", "Teste +7 dias", bloquear/desbloquear.

## Assinatura (por enquanto manual)

- Toda barbearia nova começa em **teste** por `PLATAFORMA.diasTeste` dias (padrão 14), no plano Solo.
- Teste vencido, assinatura vencida ou bloqueada → a página do cliente mostra "Agenda online pausada" (com botão de WhatsApp da barbearia). O painel continua acessível, com aviso.
- Planos, preços e limite de barbeiros ficam em `js/config.js` (`PLATAFORMA.planos`). No banco, o limite também é garantido por trigger (`limite_profissionais`).
- Na aba Assinatura o dono clica em "Quero este plano" e cai no seu WhatsApp (`suporteWhatsapp`). Você ativa em `/admin`.
- Pagamento online (Mercado Pago / Asaas) fica para a próxima etapa: o webhook só precisa atualizar `status`, `plano` e `vence_em` da tabela `barbearias`.

## Modo demonstração (padrão)

Com `SUPABASE_URL` vazio em `js/config.js`, tudo roda no navegador com dados de exemplo:

- `dono@demo.com` / `1234` → dono da Barbearia Navalha (`/navalha`)
- `barbeiro@demo.com` / `1234` → barbeiro Léo
- `admin@demo.com` / `1234` → super admin

Botão "Recomeçar demonstração" na página inicial limpa tudo.

## Produção com Supabase

1. Crie o projeto em supabase.com → SQL Editor → cole `supabase/schema.sql` → Run.
2. Authentication → Providers → Email: deixe o cadastro **ligado** (as barbearias se cadastram sozinhas).
   Se "Confirm email" estiver ligado, o app guarda o cadastro e cria a barbearia no primeiro login.
3. Cadastre sua conta e rode no SQL Editor:
   `insert into plataforma_admins (user_id) select id from auth.users where email = 'seu@email.com';`
4. Project Settings → API → copie URL e chave `anon public` para `js/config.js`.

Segurança (RLS): o cliente nunca lê tabelas, só funções que devolvem horários ocupados sem nomes; uma barbearia nunca vê outra; o barbeiro só lê e altera os agendamentos dele; o dono não consegue mudar a própria assinatura (trigger `proteger_assinatura`); convites valem 7 dias e uma vez só; conflito de horário é checado no servidor com trava.

## Hospedar

As rotas `/nome-da-barbearia` precisam cair no `index.html`:

- **Vercel:** `vercel.json` incluso.
- **Netlify / Cloudflare Pages:** `_redirects` incluso.
- **GitHub Pages:** `404.html` (cópia do index) e `.nojekyll` inclusos. O site fica em `usuario.github.io/NOME-DO-REPO/`;
  o app detecta isso sozinho se o repositório se chamar `barbearia`. Outro nome? Troque `REPO = "barbearia"` no topo do `index.html` **e** do `404.html`.
- **Testar no PC:** `npx serve -s .` dentro da pasta (o `-s` faz o redirecionamento). Abrir o `index.html` direto no navegador não funciona.

HTTPS é necessário para instalar. O app instalado a partir da página de uma barbearia abre direto nela, com o nome dela. O instalado a partir do painel abre no painel.

A cada atualização publicada, troque `VERSAO` em `sw.js`. Se mudar `index.html`, copie de novo para `404.html`.

## Estrutura

```
index.html / 404.html   casca do app
css/style.css           visual (claro/escuro automático, mobile first)
js/config.js            Supabase, sua plataforma (nome, planos, suporte) e padrão de barbearia nova
js/agenda.js            cálculo de horários livres por barbeiro e status da assinatura
js/store.js             dados: modo demonstração ou Supabase
js/app.js               roteador por caminho, utilidades, PWA
js/landing.js           site de vendas e cadastros
js/cliente.js           página pública da barbearia
js/painel.js            painel do dono e do barbeiro
js/admin.js             super admin
supabase/schema.sql     tabelas, RLS, funções e triggers
sw.js, manifest.webmanifest, icons/, vercel.json, _redirects
```
