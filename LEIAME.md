# LKBarber — agenda online para barbearias (PWA + assinatura)

HTML, CSS e JavaScript puro, sem build. Um único código atende todas as barbearias assinantes.
Banco, login e arquivos no **Supabase**; cobrança recorrente no **Asaas**.

## Endereços

| Caminho | Quem usa | O que é |
|---|---|---|
| `/` | Donos de barbearia | Site de vendas com os planos (vêm do banco) |
| `/cadastro` | Dono novo | Cria conta + barbearia (14 dias grátis) |
| `/cadastro?convite=CODIGO` | Barbeiro convidado | Cria a senha e já entra vendo só a agenda dele |
| `/nome-da-barbearia` | Cliente final | Agenda sem login (`/agendar`, `/meus`, `/info`) |
| `/painel` | Dono e barbeiro | Mesmo login; o menu muda pelo papel |
| `/admin` | Você | Barbearias, cobrança, preços dos planos |

---

## Configuração (uma vez só, ~30 minutos)

### 1. Supabase (banco e login)
1. Crie um projeto em **supabase.com** (região São Paulo).
2. **SQL Editor** → cole todo o `supabase/schema.sql` → **Run**. Pode rodar de novo quando eu atualizar o arquivo; ele não apaga dados.
3. **Project Settings → API Keys**: copie a **Project URL** e a **chave publicável** (`sb_publishable_...`) para `js/config.js`.
   *Nunca* coloque no site a chave secreta (`sb_secret_...`) nem a `service_role`.
4. **Authentication → URL Configuration**:
   - Site URL: `https://lukbrdev.github.io/barbearia/` (ou seu domínio)
   - Redirect URLs: adicione `https://lukbrdev.github.io/barbearia/painel`
   (é para onde voltam os links de "confirmar e-mail" e "esqueci a senha").
5. **Authentication → Sign In / Providers → Email**: cadastro de usuários **ligado**. "Confirm email" pode ficar ligado: o dono confirma pelo e-mail e entra direto.
6. Cadastre-se no próprio site (`/cadastro`) e torne-se super admin no SQL Editor:
   ```sql
   insert into plataforma_admins (user_id) select id from auth.users where email = 'SEU-EMAIL';
   ```
   Depois disso `/admin` abre para você. (Sua barbearia de teste pode ficar; ou apague em Table Editor → barbearias.)

### 2. Asaas (cobrança) — comece no Sandbox
1. Crie uma conta de testes em **sandbox.asaas.com**.
2. **Integrações → Chaves de API** → gere a chave (`$aact_...`).
3. Gere um token aleatório para o webhook, com 32 caracteres ou mais (exemplo no PowerShell):
   `-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_})`

### 3. Funções de servidor (Edge Functions)
São 2: `assinatura` (o painel pede cobrança) e `asaas-webhook` (o Asaas avisa pagamentos).

**Pelo navegador (mais fácil):** Supabase → **Edge Functions → Deploy a new function → Via Editor**
- Nome `assinatura` → cole `supabase/functions/assinatura/index.ts` → Deploy.
- Nome `asaas-webhook` → cole `supabase/functions/asaas-webhook/index.ts` → Deploy.
- Em cada função, abra **Details/Settings** e **desligue "Verify JWT"** (o login é conferido dentro da função; o Asaas não manda login).

**Ou pelo terminal**, na pasta do projeto:
```powershell
npx supabase login
npx supabase init            # só na primeira vez (responda "n" às perguntas)
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase functions deploy assinatura --no-verify-jwt
npx supabase functions deploy asaas-webhook --no-verify-jwt
```

**Segredos:** Edge Functions → **Secrets** → adicione:
| Nome | Valor |
|---|---|
| `ASAAS_API_KEY` | a chave do Asaas (`$aact_...`) |
| `ASAAS_URL` | `https://api-sandbox.asaas.com/v3` (no Sandbox) |
| `ASAAS_WEBHOOK_TOKEN` | o token de 32+ caracteres do passo 2.3 |

> No PowerShell, a chave começa com `$`: use **aspas simples** se for pelo terminal:
> `npx supabase secrets set 'ASAAS_API_KEY=$aact_...'`

### 4. Webhook no Asaas
Asaas → **Integrações → Webhooks → Adicionar**:
- URL: `https://SEU-PROJETO.supabase.co/functions/v1/asaas-webhook`
- Token de autenticação: o mesmo `ASAAS_WEBHOOK_TOKEN`
- Tipo de envio: **sequencial**
- Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`,
  `PAYMENT_CHARGEBACK_REQUESTED`, `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED`

### 5. Testar a cobrança
Entre como dono → Mais → **Assinatura** → escolha plano, cartão, CPF de teste → "Ir para o pagamento".
No Sandbox use os cartões de teste do Asaas. Em segundos a assinatura muda para **Ativa** (webhook).
Em Supabase → Edge Functions → asaas-webhook → **Logs** você vê cada evento.

### 6. Produção
Com a conta Asaas de produção aprovada: gere a chave de produção, troque `ASAAS_API_KEY` e
`ASAAS_URL=https://api.asaas.com/v3`, e crie o mesmo webhook na conta de produção.

---

## Como a assinatura funciona
- Barbearia nova: **14 dias grátis** no plano Solo.
- O dono assina pelo painel (cartão com cobrança automática, Pix ou boleto). O pagamento acontece na
  **página segura do Asaas**: o LKBarber nunca vê dados de cartão. O CPF/CNPJ vai só para o Asaas.
- A 1ª mensalidade vence no fim do teste. Se pagar antes (o cartão é cobrado na hora), os dias de teste não se perdem.
- Cada pagamento confirmado soma **1 mês** (o "confirmado" e o "recebido" da mesma cobrança contam uma vez só; estorno tira o mês).
- Atrasou: **3 dias de carência** com aviso no painel; depois a agenda online pausa (o painel continua acessível).
- Trocar de plano: vale para as faturas em aberto e as próximas. Não deixa escolher plano menor que a equipe ativa.
- Cancelar: sem novas cobranças; a agenda funciona até o fim do período pago.
- **Preços**: em `/admin → Preços dos planos` (valem para novas assinaturas e trocas; quem já assina mantém o valor).
- Exceções manuais em `/admin`: "Ativar +30 dias", "Teste +7 dias", bloquear/desbloquear.

## Ícone de cada barbearia
Dono → Mais → **Ícone, dados, link e QR Code** → Enviar ícone. O app recorta e gera 3 PNGs (512, 192 e
"maskable" para Android) e salva no Storage (bucket `logos`, criado pelo `schema.sql`). O ícone aparece no
topo, na página da barbearia e no **app instalado pelo cliente**. Só o dono grava na pasta da barbearia dele.

## Hospedar
- **GitHub Pages:** `404.html` e `.nojekyll` inclusos. O app detecta `usuario.github.io/barbearia/` sozinho.
  Repositório com outro nome? Troque `REPO = "barbearia"` no topo do `index.html` **e** do `404.html`.
- **Vercel / Netlify / Cloudflare Pages:** `vercel.json` e `_redirects` inclusos.
- **No PC:** `npx serve -s .` (abrir o `index.html` direto não funciona).
- A cada atualização: troque `VERSAO` em `sw.js`. Se mudar o `index.html`, copie para o `404.html`.

## Estrutura
```
index.html / 404.html        casca do app
css/style.css                visual (claro/escuro automático, mobile first)
js/config.js                 conexão Supabase, nome e WhatsApp de suporte, padrão de barbearia nova
js/agenda.js                 horários livres por barbeiro e status da assinatura (carência)
js/store.js                  Supabase: REST, login, Storage (ícones), função de assinatura
js/app.js                    roteador por caminho, utilidades, PWA e ícones por barbearia
js/landing.js                site de vendas e cadastros
js/cliente.js                página pública da barbearia
js/painel.js                 painel do dono e do barbeiro (horários, assinatura, ícone…)
js/admin.js                  super admin
supabase/schema.sql          tabelas, RLS, planos, cobrança, Storage
supabase/functions/          Edge Functions: assinatura e asaas-webhook
sw.js, manifest.webmanifest, icons/, vercel.json, _redirects
```
