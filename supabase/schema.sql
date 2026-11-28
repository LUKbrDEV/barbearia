-- roda no SQL Editor do supabase, pode rodar de novo sem perder nada
create extension if not exists pgcrypto;

create table if not exists plataforma_admins (user_id uuid primary key references auth.users on delete cascade);

create table if not exists planos (
  id text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  nome text not null,
  preco numeric(10,2) not null check (preco >= 0),
  max_prof int check (max_prof is null or max_prof > 0),
  descricao text default '',
  ordem int not null default 0,
  ativo boolean not null default true
);
insert into planos (id, nome, preco, max_prof, descricao, ordem) values
  ('solo', 'Solo', 39.90, 1, 'Para quem atende sozinho.', 0),
  ('equipe', 'Equipe', 69.90, 5, 'Até 5 barbeiros, cada um com sua agenda.', 1),
  ('ilimitado', 'Ilimitado', 99.90, null, 'Barbeiros sem limite e relatórios por profissional.', 2)
on conflict (id) do nothing;

create table if not exists barbearias (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  nome text not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'teste' check (status in ('teste','ativa','bloqueada')),
  plano text not null default 'solo' references planos,
  vence_em date,
  dono_email text,
  criado_em timestamptz not null default now()
);
alter table barbearias add column if not exists asaas_customer_id text;
alter table barbearias add column if not exists asaas_subscription_id text;
alter table barbearias add column if not exists forma_pagamento text;
alter table barbearias add column if not exists ultimo_pagamento_em timestamptz;
create index if not exists barb_sub_idx on barbearias (asaas_subscription_id);

create table if not exists pagamentos (
  id text primary key,
  barbearia_id uuid references barbearias on delete set null,
  valor numeric(10,2),
  status text,
  forma text,
  vencimento date,
  pago_em date,
  fatura_url text,
  creditado boolean not null default false,
  atualizado_em timestamptz not null default now()
);
create table if not exists webhook_eventos (id text primary key, evento text, recebido_em timestamptz not null default now());

create table if not exists profissionais (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references barbearias on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  dias int[] not null default '{0,1,2,3,4,5,6}',
  ativo boolean not null default true,
  comissao numeric(5,2) not null default 0,
  ordem int not null default 0,
  email text default ''
);

create table if not exists membros (
  user_id uuid not null references auth.users on delete cascade,
  barbearia_id uuid not null references barbearias on delete cascade,
  papel text not null check (papel in ('dono','barbeiro')),
  prof_id uuid references profissionais on delete set null,
  primary key (user_id, barbearia_id)
);

create table if not exists convites (
  codigo text primary key,
  barbearia_id uuid not null references barbearias on delete cascade,
  prof_id uuid not null references profissionais on delete cascade,
  usado boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists agendamentos (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references barbearias on delete cascade,
  prof_id uuid references profissionais on delete set null,
  data date not null,
  hora time not null,
  dur int not null check (dur between 5 and 480),
  servico_id text,
  servico_nome text not null,
  preco numeric(10,2) not null default 0,
  nome text not null check (char_length(nome) between 2 and 80),
  telefone text default '',
  status text not null default 'agendado' check (status in ('agendado','concluido','faltou','cancelado')),
  origem text not null default 'online',
  token text not null default gen_random_uuid()::text,
  criado_em timestamptz not null default now()
);
create index if not exists ag_idx on agendamentos (barbearia_id, data, hora);
create index if not exists ag_prof_idx on agendamentos (prof_id, data);

create table if not exists bloqueios (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references barbearias on delete cascade,
  prof_id uuid references profissionais on delete cascade,
  data date not null,
  ini time, fim time,
  motivo text default ''
);
create index if not exists blq_idx on bloqueios (barbearia_id, data);

create or replace function is_super() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from plataforma_admins where user_id = auth.uid()) $$;
create or replace function papel_em(p_bid uuid) returns text language sql stable security definer set search_path = public as $$
  select papel from membros where user_id = auth.uid() and barbearia_id = p_bid $$;
create or replace function meu_prof(p_bid uuid) returns uuid language sql stable security definer set search_path = public as $$
  select prof_id from membros where user_id = auth.uid() and barbearia_id = p_bid $$;
create or replace function hoje_br() returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;
create or replace function liberada(b barbearias) returns boolean language sql stable as $$
  select b.status <> 'bloqueada' and (b.vence_em is null
    or (case when b.status = 'teste' then b.vence_em else b.vence_em + 3 end) >= hoje_br()) $$;
create or replace function e_servidor() returns boolean language sql stable as $$
  select current_user in ('service_role', 'postgres', 'supabase_admin') $$;

alter table plataforma_admins enable row level security;
alter table barbearias enable row level security;
alter table profissionais enable row level security;
alter table membros enable row level security;
alter table convites enable row level security;
alter table planos enable row level security;
alter table pagamentos enable row level security;
alter table webhook_eventos enable row level security;
alter table agendamentos enable row level security;
alter table bloqueios enable row level security;

drop policy if exists pl_sel on planos;  create policy pl_sel on planos for select using (true);
drop policy if exists pl_adm on planos;  create policy pl_adm on planos for all to authenticated using (is_super()) with check (is_super());
drop policy if exists pg_sel on pagamentos; create policy pg_sel on pagamentos for select to authenticated using (is_super() or papel_em(barbearia_id) = 'dono');

drop policy if exists b_sel on barbearias;  create policy b_sel on barbearias for select to authenticated using (is_super() or papel_em(id) is not null);
drop policy if exists b_upd on barbearias;  create policy b_upd on barbearias for update to authenticated using (is_super() or papel_em(id) = 'dono') with check (is_super() or papel_em(id) = 'dono');

drop policy if exists p_sel on profissionais; create policy p_sel on profissionais for select to authenticated using (is_super() or papel_em(barbearia_id) is not null);
drop policy if exists p_ins on profissionais; create policy p_ins on profissionais for insert to authenticated with check (is_super() or papel_em(barbearia_id) = 'dono');
drop policy if exists p_upd on profissionais; create policy p_upd on profissionais for update to authenticated using (is_super() or papel_em(barbearia_id) = 'dono');

drop policy if exists m_sel on membros; create policy m_sel on membros for select to authenticated using (user_id = auth.uid() or is_super() or papel_em(barbearia_id) = 'dono');

drop policy if exists a_sel on agendamentos; create policy a_sel on agendamentos for select to authenticated
  using (is_super() or papel_em(barbearia_id) = 'dono' or (papel_em(barbearia_id) = 'barbeiro' and prof_id = meu_prof(barbearia_id)));
drop policy if exists a_ins on agendamentos; create policy a_ins on agendamentos for insert to authenticated
  with check (papel_em(barbearia_id) = 'dono' or (papel_em(barbearia_id) = 'barbeiro' and prof_id = meu_prof(barbearia_id)));
drop policy if exists a_upd on agendamentos; create policy a_upd on agendamentos for update to authenticated
  using (is_super() or papel_em(barbearia_id) = 'dono' or (papel_em(barbearia_id) = 'barbeiro' and prof_id = meu_prof(barbearia_id)))
  with check (is_super() or papel_em(barbearia_id) = 'dono' or (papel_em(barbearia_id) = 'barbeiro' and prof_id = meu_prof(barbearia_id)));

drop policy if exists bl_sel on bloqueios; create policy bl_sel on bloqueios for select to authenticated using (is_super() or papel_em(barbearia_id) is not null);
drop policy if exists bl_ins on bloqueios; create policy bl_ins on bloqueios for insert to authenticated
  with check (papel_em(barbearia_id) = 'dono' or (papel_em(barbearia_id) = 'barbeiro' and prof_id = meu_prof(barbearia_id)));
drop policy if exists bl_del on bloqueios; create policy bl_del on bloqueios for delete to authenticated
  using (papel_em(barbearia_id) = 'dono' or (papel_em(barbearia_id) = 'barbeiro' and prof_id = meu_prof(barbearia_id)));

create or replace function proteger_assinatura() returns trigger language plpgsql as $$
begin
  if not is_super() and not e_servidor() and (new.status is distinct from old.status or new.plano is distinct from old.plano
     or new.vence_em is distinct from old.vence_em or new.slug is distinct from old.slug or new.dono_email is distinct from old.dono_email
     or new.asaas_customer_id is distinct from old.asaas_customer_id or new.asaas_subscription_id is distinct from old.asaas_subscription_id
     or new.forma_pagamento is distinct from old.forma_pagamento or new.ultimo_pagamento_em is distinct from old.ultimo_pagamento_em) then
    raise exception 'somente o administrador da plataforma pode alterar a assinatura';
  end if;
  return new;
end $$;
drop trigger if exists trg_proteger on barbearias;
create trigger trg_proteger before update on barbearias for each row execute function proteger_assinatura();

create or replace function limite_profissionais() returns trigger language plpgsql security definer set search_path = public as $$
declare v_max int; v_n int;
begin
  if not new.ativo then return new; end if;
  select p.max_prof into v_max from barbearias b join planos p on p.id = b.plano where b.id = new.barbearia_id;
  if v_max is null then return new; end if;
  select count(*) into v_n from profissionais where barbearia_id = new.barbearia_id and ativo and id <> new.id;
  if v_n >= v_max then raise exception 'limite_plano'; end if;
  return new;
end $$;
drop trigger if exists trg_limite on profissionais;
create trigger trg_limite before insert or update on profissionais for each row execute function limite_profissionais();

create or replace function slug_disponivel(p_slug text) returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from barbearias where slug = lower(p_slug)) $$;

create or replace function dados_publicos(p_slug text) returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'b', json_build_object('id', b.id, 'slug', b.slug, 'nome', b.nome, 'status', b.status, 'vence_em', b.vence_em, 'config', b.config),
    'profs', coalesce((select json_agg(json_build_object('id', p.id, 'nome', p.nome, 'dias', p.dias) order by p.ordem, p.nome)
                       from profissionais p where p.barbearia_id = b.id and p.ativo), '[]'::json))
  from barbearias b where b.slug = lower(p_slug) $$;

create or replace function horarios_ocupados(p_slug text, p_de date, p_ate date)
returns table (prof uuid, data date, ini time, fim time) language sql stable security definer set search_path = public as $$
  select a.prof_id, a.data, a.hora, a.hora + make_interval(mins => a.dur)
    from agendamentos a join barbearias b on b.id = a.barbearia_id
   where b.slug = lower(p_slug) and a.data between p_de and p_ate and a.status in ('agendado','concluido')
  union all
  select k.prof_id, k.data, k.ini, k.fim
    from bloqueios k join barbearias b on b.id = k.barbearia_id
   where b.slug = lower(p_slug) and k.data between p_de and p_ate $$;

create or replace function agendar(p_slug text, p_servico text, p_prof uuid, p_nome text, p_tel text, p_data date, p_hora time)
returns json language plpgsql security definer set search_path = public as $$
declare
  b barbearias; s jsonb; h jsonb; v_dur int; v_fim time; v_prof profissionais; r agendamentos;
begin
  select * into b from barbearias where slug = lower(p_slug);
  if b.id is null or not liberada(b) then raise exception 'indisponivel'; end if;
  select e into s from jsonb_array_elements(b.config->'servicos') e where e->>'id' = p_servico limit 1;
  if s is null then raise exception 'servico invalido'; end if;
  if p_data < hoje_br() then raise exception 'data no passado'; end if;
  h := b.config->'horarios'->(extract(dow from p_data)::int::text);
  v_dur := (s->>'dur')::int; v_fim := p_hora + make_interval(mins => v_dur);
  if h is null or not coalesce((h->>'aberto')::boolean, false)
     or p_hora < (h->>'abre')::time or v_fim > (h->>'fecha')::time then raise exception 'ocupado'; end if;

  perform pg_advisory_xact_lock(hashtext(b.id::text || p_data::text));

  select p.* into v_prof from profissionais p
   where p.barbearia_id = b.id and p.ativo and (p_prof is null or p.id = p_prof)
     and extract(dow from p_data)::int = any(p.dias)
     and not exists (select 1 from agendamentos a where a.prof_id = p.id and a.data = p_data and a.status in ('agendado','concluido')
                       and a.hora < v_fim and p_hora < a.hora + make_interval(mins => a.dur))
     and not exists (select 1 from bloqueios k where k.barbearia_id = b.id and k.data = p_data and (k.prof_id is null or k.prof_id = p.id)
                       and (k.ini is null or (k.ini < v_fim and p_hora < k.fim)))
   order by (select count(*) from agendamentos a where a.prof_id = p.id and a.data = p_data and a.status in ('agendado','concluido')), p.ordem
   limit 1;
  if v_prof.id is null then raise exception 'ocupado'; end if;

  insert into agendamentos (barbearia_id, prof_id, data, hora, dur, servico_id, servico_nome, preco, nome, telefone)
  values (b.id, v_prof.id, p_data, p_hora, v_dur, p_servico, s->>'nome', coalesce((s->>'preco')::numeric, 0), left(trim(p_nome), 80), left(coalesce(p_tel, ''), 20))
  returning * into r;
  return json_build_object('id', r.id, 'token', r.token, 'prof_nome', v_prof.nome);
end $$;

create or replace function cancelar_agendamento(p_id uuid, p_token text) returns void language plpgsql security definer set search_path = public as $$
begin
  update agendamentos set status = 'cancelado' where id = p_id and token = p_token and status = 'agendado';
  if not found then raise exception 'nao foi possivel cancelar'; end if;
end $$;

create or replace function status_agendamentos(p_ids uuid[]) returns table (id uuid, status text)
language sql stable security definer set search_path = public as $$ select a.id, a.status from agendamentos a where a.id = any(p_ids) $$;

create or replace function sou_super() returns boolean language sql stable security definer set search_path = public as $$ select is_super() $$;

create or replace function meus_acessos() returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('barbearia_id', b.id, 'slug', b.slug, 'nome', b.nome, 'papel', m.papel, 'prof_id', m.prof_id) order by b.nome), '[]'::json)
    from membros m join barbearias b on b.id = m.barbearia_id where m.user_id = auth.uid() $$;

create or replace function criar_barbearia(p_nome text, p_slug text, p_nome_dono text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_b uuid; v_p uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'entre na sua conta'; end if;
  if exists (select 1 from barbearias where slug = lower(p_slug)) then raise exception 'slug em uso'; end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into barbearias (slug, nome, status, plano, vence_em, dono_email)
  values (lower(p_slug), left(trim(p_nome), 60), 'teste', 'solo', hoje_br() + 14, v_email) returning id into v_b;
  insert into profissionais (barbearia_id, nome, email) values (v_b, left(trim(p_nome_dono), 40), v_email) returning id into v_p;
  insert into membros (user_id, barbearia_id, papel, prof_id) values (auth.uid(), v_b, 'dono', v_p);
  return v_b;
end $$;

create or replace function criar_barbearia_pendente() returns json
language plpgsql security definer set search_path = public as $$
declare v_cad jsonb; v_id uuid;
begin
  if auth.uid() is null then raise exception 'entre na sua conta'; end if;
  if exists (select 1 from membros where user_id = auth.uid()) then return null; end if;
  select raw_user_meta_data->'cad' into v_cad from auth.users where id = auth.uid();
  if v_cad is null or coalesce(v_cad->>'slug', '') = '' then return null; end if;
  v_id := criar_barbearia(coalesce(v_cad->>'nome', 'Minha barbearia'), v_cad->>'slug', coalesce(nullif(v_cad->>'nomeDono', ''), 'Dono'));
  return json_build_object('id', v_id, 'slug', lower(v_cad->>'slug'));
end $$;

create or replace function profissionais_da_barbearia(p_bid uuid) returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', p.id, 'nome', p.nome, 'dias', p.dias, 'ativo', p.ativo, 'comissao', p.comissao,
           'ordem', p.ordem, 'email', p.email, 'tem_acesso', exists (select 1 from membros m where m.prof_id = p.id)) order by p.ordem, p.nome), '[]'::json)
    from profissionais p where p.barbearia_id = p_bid and (is_super() or papel_em(p_bid) is not null) $$;

create or replace function gerar_convite(p_prof uuid) returns text language plpgsql security definer set search_path = public as $$
declare v_bid uuid; v_cod text;
begin
  select barbearia_id into v_bid from profissionais where id = p_prof;
  if papel_em(v_bid) is distinct from 'dono' then raise exception 'sem permissao'; end if;
  update convites set usado = true where prof_id = p_prof;
  v_cod := upper(substr(translate(encode(gen_random_bytes(8), 'base64'), '+/=0O1IL', ''), 1, 6));
  insert into convites (codigo, barbearia_id, prof_id) values (v_cod, v_bid, p_prof);
  return v_cod;
end $$;

create or replace function aceitar_convite(p_codigo text) returns void language plpgsql security definer set search_path = public as $$
declare c convites; v_email text;
begin
  if auth.uid() is null then raise exception 'entre na sua conta'; end if;
  select * into c from convites where codigo = upper(trim(p_codigo)) and not usado and criado_em > now() - interval '7 days';
  if c.codigo is null then raise exception 'convite invalido'; end if;
  if exists (select 1 from membros where prof_id = c.prof_id) then raise exception 'convite invalido'; end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into membros (user_id, barbearia_id, papel, prof_id) values (auth.uid(), c.barbearia_id, 'barbeiro', c.prof_id)
    on conflict (user_id, barbearia_id) do update set prof_id = excluded.prof_id;
  update profissionais set email = v_email where id = c.prof_id;
  update convites set usado = true where codigo = c.codigo;
end $$;

create or replace function remover_acesso(p_prof uuid) returns void language plpgsql security definer set search_path = public as $$
declare v_bid uuid;
begin
  select barbearia_id into v_bid from profissionais where id = p_prof;
  if papel_em(v_bid) is distinct from 'dono' then raise exception 'sem permissao'; end if;
  delete from membros where prof_id = p_prof and papel = 'barbeiro';
  update profissionais set email = '' where id = p_prof;
end $$;

create or replace function todas_barbearias() returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not is_super() then raise exception 'sem permissao'; end if;
  return (select coalesce(json_agg(json_build_object('id', b.id, 'slug', b.slug, 'nome', b.nome, 'status', b.status, 'plano', b.plano,
      'vence_em', b.vence_em, 'dono_email', b.dono_email, 'criado_em', b.criado_em, 'logo', b.config->>'logo',
      'assinatura', b.asaas_subscription_id is not null, 'forma_pagamento', b.forma_pagamento, 'ultimo_pagamento_em', b.ultimo_pagamento_em,
      'n_profs', (select count(*) from profissionais p where p.barbearia_id = b.id and p.ativo),
      'n_ags_30', (select count(*) from agendamentos a where a.barbearia_id = b.id and a.data >= hoje_br() - 30 and a.status <> 'cancelado'))
    order by b.criado_em desc), '[]'::json) from barbearias b);
end $$;

create or replace function processar_pagamento_asaas(p_evento_id text, p_evento text, p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v_b barbearias; v_pg pagamentos; v_venc date;
begin
  if p_evento_id is not null then
    insert into webhook_eventos (id, evento) values (p_evento_id, p_evento) on conflict do nothing;
    if not found then return 'duplicado'; end if;
  end if;
  if p is null or p->>'id' is null then return 'sem cobranca'; end if;

  select * into v_b from barbearias
   where (p->>'subscription' is not null and asaas_subscription_id = p->>'subscription')
      or (p->>'externalReference' is not null and id::text = p->>'externalReference')
      or (p->>'customer' is not null and asaas_customer_id = p->>'customer')
   order by (asaas_subscription_id = p->>'subscription') desc nulls last limit 1;

  insert into pagamentos (id, barbearia_id, valor, status, forma, vencimento, pago_em, fatura_url)
  values (p->>'id', v_b.id, (p->>'value')::numeric, p->>'status', p->>'billingType', (p->>'dueDate')::date,
          coalesce((p->>'paymentDate')::date, (p->>'confirmedDate')::date), p->>'invoiceUrl')
  on conflict (id) do update set status = excluded.status, valor = excluded.valor, vencimento = excluded.vencimento,
     pago_em = coalesce(excluded.pago_em, pagamentos.pago_em), fatura_url = coalesce(excluded.fatura_url, pagamentos.fatura_url),
     barbearia_id = coalesce(pagamentos.barbearia_id, excluded.barbearia_id), atualizado_em = now()
  returning * into v_pg;

  if v_b.id is null then return 'barbearia nao encontrada'; end if;

  if p_evento in ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED') and not v_pg.creditado then
    v_venc := greatest(coalesce(v_b.vence_em, hoje_br()), coalesce(v_pg.vencimento, hoje_br()), hoje_br() - 3);
    update barbearias set status = case when status = 'bloqueada' then status else 'ativa' end,
           vence_em = (v_venc + interval '1 month')::date, ultimo_pagamento_em = now() where id = v_b.id;
    update pagamentos set creditado = true where id = v_pg.id;
    return 'creditado';
  end if;

  if p_evento in ('PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_DELETED') and v_pg.creditado then
    update barbearias set vence_em = (vence_em - interval '1 month')::date where id = v_b.id;
    update pagamentos set creditado = false where id = v_pg.id;
    return 'estornado';
  end if;
  return 'registrado';
end $$;

create or replace function encerrar_assinatura_asaas(p_evento_id text, p_sub text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if p_evento_id is not null then
    insert into webhook_eventos (id, evento) values (p_evento_id, 'SUBSCRIPTION_END') on conflict do nothing;
    if not found then return 'duplicado'; end if;
  end if;
  update barbearias set asaas_subscription_id = null where asaas_subscription_id = p_sub;
  return 'encerrada';
end $$;

revoke all on function processar_pagamento_asaas(text, text, jsonb), encerrar_assinatura_asaas(text, text) from public, anon, authenticated;
grant execute on function processar_pagamento_asaas(text, text, jsonb), encerrar_assinatura_asaas(text, text) to service_role;

do $do$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update set public = true;
    execute 'drop policy if exists logos_ler on storage.objects';
    execute $p$create policy logos_ler on storage.objects for select using (bucket_id = 'logos')$p$;
    execute 'drop policy if exists logos_gravar on storage.objects';
    execute $p$create policy logos_gravar on storage.objects for insert to authenticated
      with check (bucket_id = 'logos' and papel_em(((storage.foldername(name))[1])::uuid) = 'dono')$p$;
    execute 'drop policy if exists logos_trocar on storage.objects';
    execute $p$create policy logos_trocar on storage.objects for update to authenticated
      using (bucket_id = 'logos' and papel_em(((storage.foldername(name))[1])::uuid) = 'dono')$p$;
    execute 'drop policy if exists logos_apagar on storage.objects';
    execute $p$create policy logos_apagar on storage.objects for delete to authenticated
      using (bucket_id = 'logos' and papel_em(((storage.foldername(name))[1])::uuid) = 'dono')$p$;
  end if;
end $do$;

revoke all on function slug_disponivel(text), dados_publicos(text), horarios_ocupados(text, date, date),
  agendar(text, text, uuid, text, text, date, time), cancelar_agendamento(uuid, text), status_agendamentos(uuid[]) from public;
grant execute on function slug_disponivel(text), dados_publicos(text), horarios_ocupados(text, date, date),
  agendar(text, text, uuid, text, text, date, time), cancelar_agendamento(uuid, text), status_agendamentos(uuid[]) to anon, authenticated;
revoke all on function criar_barbearia_pendente() from public, anon;
grant execute on function criar_barbearia_pendente() to authenticated;
revoke all on function sou_super(), meus_acessos(), criar_barbearia(text, text, text), profissionais_da_barbearia(uuid),
  gerar_convite(uuid), aceitar_convite(text), remover_acesso(uuid), todas_barbearias() from public, anon;
grant execute on function sou_super(), meus_acessos(), criar_barbearia(text, text, text), profissionais_da_barbearia(uuid),
  gerar_convite(uuid), aceitar_convite(text), remover_acesso(uuid), todas_barbearias() to authenticated;

grant usage on schema public to anon, authenticated, service_role;

grant select on planos to anon;

grant select, update on planos to authenticated;
grant select, update on barbearias to authenticated;
grant select, insert, update on profissionais to authenticated;
grant select on membros to authenticated;
grant select, insert, update on agendamentos to authenticated;
grant select, insert, delete on bloqueios to authenticated;
grant select on pagamentos to authenticated;

grant all on all tables in schema public to service_role;

grant execute on function is_super(), papel_em(uuid), meu_prof(uuid), hoje_br(), liberada(barbearias), e_servidor()
  to anon, authenticated, service_role;

create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references barbearias on delete cascade,
  nome text not null check (char_length(nome) between 1 and 60),
  descricao text default '',
  preco numeric(10,2) not null default 0 check (preco >= 0),
  foto_v bigint,
  estoque int check (estoque is null or estoque >= 0),
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists prod_idx on produtos (barbearia_id, ordem);

create table if not exists vendas (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references barbearias on delete cascade,
  prof_id uuid references profissionais on delete set null,
  produto_id uuid references produtos on delete set null,
  produto_nome text not null,
  preco numeric(10,2) not null,
  qtd int not null default 1 check (qtd between 1 and 99),
  agendamento_id uuid references agendamentos on delete set null,
  data date not null default hoje_br(),
  criado_em timestamptz not null default now()
);
create index if not exists vendas_idx on vendas (barbearia_id, data);

alter table produtos enable row level security;
alter table vendas enable row level security;
drop policy if exists pr_sel on produtos; create policy pr_sel on produtos for select to authenticated using (is_super() or papel_em(barbearia_id) is not null);
drop policy if exists pr_ins on produtos; create policy pr_ins on produtos for insert to authenticated with check (papel_em(barbearia_id) = 'dono');
drop policy if exists pr_upd on produtos; create policy pr_upd on produtos for update to authenticated using (papel_em(barbearia_id) = 'dono') with check (papel_em(barbearia_id) = 'dono');
drop policy if exists pr_del on produtos; create policy pr_del on produtos for delete to authenticated using (papel_em(barbearia_id) = 'dono');
drop policy if exists vd_sel on vendas; create policy vd_sel on vendas for select to authenticated
  using (is_super() or papel_em(barbearia_id) = 'dono' or (papel_em(barbearia_id) = 'barbeiro' and prof_id = meu_prof(barbearia_id)));

create or replace function registrar_venda(p_produto uuid, p_qtd int, p_ag uuid, p_prof uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_p produtos; v_papel text; v_prof uuid; v_id uuid; v_ag agendamentos;
begin
  select * into v_p from produtos where id = p_produto;
  if v_p.id is null then raise exception 'produto nao encontrado'; end if;
  v_papel := papel_em(v_p.barbearia_id);
  if v_papel is null then raise exception 'sem permissao'; end if;
  if p_qtd is null or p_qtd < 1 or p_qtd > 99 then raise exception 'quantidade invalida'; end if;
  v_prof := case when v_papel = 'dono' then coalesce(p_prof, meu_prof(v_p.barbearia_id)) else meu_prof(v_p.barbearia_id) end;
  if p_ag is not null then
    select * into v_ag from agendamentos where id = p_ag and barbearia_id = v_p.barbearia_id;
    if v_ag.id is null or (v_papel = 'barbeiro' and v_ag.prof_id is distinct from v_prof) then raise exception 'atendimento invalido'; end if;
    v_prof := coalesce(v_ag.prof_id, v_prof);
  end if;
  if v_p.estoque is not null then
    update produtos set estoque = estoque - p_qtd where id = p_produto and estoque >= p_qtd returning id into v_id;
    if v_id is null then raise exception 'sem estoque'; end if;
  end if;
  insert into vendas (barbearia_id, prof_id, produto_id, produto_nome, preco, qtd, agendamento_id, data)
  values (v_p.barbearia_id, v_prof, v_p.id, v_p.nome, v_p.preco, p_qtd, p_ag, coalesce(v_ag.data, hoje_br()))
  returning id into v_id;
  return v_id;
end $$;

create or replace function desfazer_venda(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v vendas;
begin
  select * into v from vendas where id = p_id;
  if v.id is null then raise exception 'venda nao encontrada'; end if;
  if not (papel_em(v.barbearia_id) = 'dono' or (papel_em(v.barbearia_id) = 'barbeiro' and v.prof_id = meu_prof(v.barbearia_id))) then
    raise exception 'sem permissao'; end if;
  update produtos set estoque = estoque + v.qtd where id = v.produto_id and estoque is not null;
  delete from vendas where id = p_id;
end $$;

create or replace function dados_publicos(p_slug text) returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'b', json_build_object('id', b.id, 'slug', b.slug, 'nome', b.nome, 'status', b.status, 'vence_em', b.vence_em, 'config', b.config),
    'profs', coalesce((select json_agg(json_build_object('id', p.id, 'nome', p.nome, 'dias', p.dias) order by p.ordem, p.nome)
                       from profissionais p where p.barbearia_id = b.id and p.ativo), '[]'::json),
    'produtos', coalesce((select json_agg(json_build_object('id', x.id, 'nome', x.nome, 'descricao', x.descricao, 'preco', x.preco,
                       'foto_v', x.foto_v, 'esgotado', x.estoque is not null and x.estoque = 0) order by x.ordem, x.nome)
                       from produtos x where x.barbearia_id = b.id and x.ativo), '[]'::json))
  from barbearias b where b.slug = lower(p_slug) $$;

grant select, insert, update, delete on produtos to authenticated;
grant select on vendas to authenticated;
grant all on produtos, vendas to service_role;
revoke all on function registrar_venda(uuid, int, uuid, uuid), desfazer_venda(uuid) from public, anon;
grant execute on function registrar_venda(uuid, int, uuid, uuid), desfazer_venda(uuid) to authenticated;
grant execute on function dados_publicos(text) to anon, authenticated;
