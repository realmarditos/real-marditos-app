-- =====================================================================
-- Real Marditos FC — banco de dados (V1 a V4)
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Depois rode o seed.sql.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type player_role   as enum ('membro', 'presidente', 'tesoureiro', 'organizador');
create type player_status as enum ('ativo', 'afastado');
create type match_status  as enum ('aberta', 'times_postados', 'encerrada');
create type team_color    as enum ('preto', 'branco');
create type rsvp_kind     as enum ('vou', 'nao_vou');
create type vote_kind     as enum ('mvp', 'bagre');
create type due_status    as enum ('pendente', 'informado', 'pago');
create type move_kind     as enum ('entrada', 'saida');

-- ---------- Tabelas ----------
create table club_settings (
  id               int primary key default 1 check (id = 1),
  club_code        text not null,
  season           int  not null default 2026,
  confirm_deadline time not null default '14:00',
  max_players      int  not null default 12,
  pts_win          int  not null default 3,
  pts_draw         int  not null default 1,
  pts_loss         int  not null default 0,
  pts_presence     int  not null default 1,
  pts_mvp          int  not null default 1,
  -- V3: caixa
  fee_line         numeric(10,2) not null default 50,
  fee_goalkeeper   numeric(10,2) not null default 15,
  fee_away         numeric(10,2) not null default 15,
  due_day          int  not null default 10 check (due_day between 1 and 28),
  reminder_day     int  not null default 5  check (reminder_day between 1 and 28),
  pix_key          text,
  pix_name         text,
  pix_city         text default 'GASPAR',
  opening_balance  numeric(10,2) not null default 0,
  -- pontos iniciais (ranking de antes do app) só valem nesta temporada
  initial_points_season int not null default 2026,
  -- Caixa: o saldo inicial vale nesta data (dia em que o caixa passou para o app)
  cash_start       date not null default current_date,
  -- Previsão: quanto custa a quadra por jogo
  court_fee        numeric(10,2) not null default 70
);

create table players (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid unique references auth.users(id) on delete set null,
  name           text not null,
  phone          text,
  position       text check (position in ('Goleiro', 'Defesa', 'Meio', 'Ataque')),
  is_goalkeeper  boolean not null default false,
  foot           text,
  shirt_number   int,
  birthday       date,
  status         player_status not null default 'ativo',
  role           player_role   not null default 'membro',
  avatar         jsonb,
  initial_points int not null default 0,
  is_guest       boolean not null default false, -- convidado: joga, mas não entra no ranking
  approved       boolean not null default true,  -- conta nova só entra depois que a diretoria aprova
  self_created   boolean not null default false, -- criado pela própria pessoa ("sou novo")
  created_at     timestamptz not null default now()
);

-- Temporada = ano atual no horário de Brasília. O ranking zera sozinho em 1º de janeiro;
-- o caixa e as mensalidades continuam de um ano para o outro.
create or replace function current_season() returns int
language sql stable as $$
  select extract(year from now() at time zone 'America/Sao_Paulo')::int
$$;

-- Login é pelo nome: não pode haver dois membros com o mesmo nome (sem diferenciar maiúsculas e acentos)
create or replace function norm_name(n text) returns text
language sql immutable as $$
  select translate(lower(trim(n)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
$$;
create unique index players_name_unique on players (norm_name(name)) where not is_guest;

create table player_ratings (
  player_id   uuid primary key references players(id) on delete cascade,
  tecnica     int not null default 5 check (tecnica between 0 and 10),
  fisico      int not null default 5 check (fisico between 0 and 10),
  marcacao    int not null default 5 check (marcacao between 0 and 10),
  finalizacao int not null default 5 check (finalizacao between 0 and 10),
  updated_at  timestamptz not null default now()
);

create table matches (
  id           uuid primary key default gen_random_uuid(),
  date         date not null unique,
  starts_at    time not null default '19:00',
  ends_at      time not null default '20:00',
  venue        text not null default 'Lince Arena',
  status       match_status not null default 'aberta',
  score_preto  int,
  score_branco int,
  photo_url    text, -- Marditos da Noite: foto do time vencedor
  created_at   timestamptz not null default now()
);

create table attendances (
  match_id   uuid not null references matches(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  rsvp       rsvp_kind not null,
  rsvp_at    timestamptz not null default now(),
  team       team_color,
  is_reserve boolean not null default false,
  played     boolean not null default false,
  reason     text,  -- motivo de quem não vai (opcional)
  primary key (match_id, player_id)
);

create table announcements (
  id         uuid primary key default gen_random_uuid(),
  body       text not null,
  pinned     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references players(id) on delete set null
);

-- Duplas que o sorteio deve sempre separar
create table draw_separations (
  id       uuid primary key default gen_random_uuid(),
  player_a uuid not null references players(id) on delete cascade,
  player_b uuid not null references players(id) on delete cascade,
  check (player_a <> player_b)
);

-- V2: votação aberta de MVP e bagre da noite
create table votes (
  match_id   uuid not null references matches(id) on delete cascade,
  voter_id   uuid not null references players(id) on delete cascade,
  kind       vote_kind not null,
  target_id  uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, voter_id, kind)
);

-- MVP e bagre definidos pela diretoria: só valem quando ninguém votou naquela partida
create table match_awards (
  match_id  uuid not null references matches(id) on delete cascade,
  kind      vote_kind not null,
  player_id uuid not null references players(id) on delete cascade,
  primary key (match_id, kind, player_id)
);

-- V3: mensalidade de cada jogador em cada mês (month = dia 1 do mês)
create table dues (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references players(id) on delete cascade,
  month        date not null check (extract(day from month) = 1),
  amount       numeric(10,2) not null,
  status       due_status not null default 'pendente',
  receipt_path text,
  informed_at  timestamptz,
  paid_at      timestamptz,
  confirmed_by uuid references players(id) on delete set null,
  unique (player_id, month)
);

-- V3: gastos e outras entradas do caixa
create table cash_moves (
  id          uuid primary key default gen_random_uuid(),
  kind        move_kind not null,
  category    text not null,
  amount      numeric(10,2) not null check (amount > 0),
  date        date not null default current_date,
  description text,
  created_by  uuid references players(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Prestação de contas de um período (mês, semestre, ano), publicada quando a diretoria quiser
create table cash_reports (
  id            uuid primary key default gen_random_uuid(),
  month         date not null check (extract(day from month) = 1),        -- primeiro mês do período
  period_end    date not null check (extract(day from period_end) = 1),   -- último mês do período
  unique (month, period_end),
  opening       numeric(10,2) not null,
  dues_in       numeric(10,2) not null,
  income        numeric(10,2) not null,
  expenses      numeric(10,2) not null,
  closing       numeric(10,2) not null,
  by_category   jsonb not null default '[]',
  paid_count    int not null,
  total_count   int not null,
  notes         text,
  published_at  timestamptz not null default now(),
  published_by  uuid references players(id) on delete set null
);

-- V4: feed das partidas
create table match_comments (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  body       text not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create table match_reactions (
  match_id   uuid not null references matches(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  emoji      text not null check (emoji in ('🔥', '😂', '👏', '💀', '🐟')),
  created_at timestamptz not null default now(),
  primary key (match_id, player_id, emoji)
);

-- V4: eventos extras (churrasco, confraternização)
create table events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  date        date not null,
  time        time,
  place       text,
  price       numeric(10,2),
  created_by  uuid references players(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table event_rsvps (
  event_id  uuid not null references events(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  rsvp      rsvp_kind not null,
  guests    int not null default 0 check (guests between 0 and 10),
  updated_at timestamptz not null default now(),
  primary key (event_id, player_id)
);

-- ---------- Funções de permissão ----------
create or replace function my_player_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from players where user_id = auth.uid() and approved
$$;

create or replace function my_role() returns player_role
language sql stable security definer set search_path = public as $$
  select role from players where user_id = auth.uid() and approved
$$;

create or replace function is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from players where user_id = auth.uid() and approved)
$$;

-- Presidente ou tesoureiro ou organizador
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('presidente', 'tesoureiro', 'organizador'), false)
$$;

-- Presidente, organizador ou tesoureiro: membros, notas, sorteio, súmula
create or replace function can_manage_game() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('presidente', 'organizador', 'tesoureiro'), false)
$$;

-- Presidente ou tesoureiro: dinheiro
create or replace function can_manage_money() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role() in ('presidente', 'tesoureiro'), false)
$$;

-- ---------- Código do clube ----------
-- Público: só diz se o código está certo, sem revelar qual é.
create or replace function verify_club_code(code text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from club_settings where lower(trim(club_code)) = lower(trim(code)))
$$;

create or replace function get_club_code() returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if my_role() is distinct from 'presidente' then raise exception 'Só o presidente vê o código do clube'; end if;
  return (select club_code from club_settings where id = 1);
end $$;

create or replace function set_club_code(code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role() is distinct from 'presidente' then raise exception 'Só o presidente troca o código do clube'; end if;
  if length(trim(code)) < 4 then raise exception 'Use pelo menos 4 caracteres'; end if;
  update club_settings set club_code = trim(code) where id = 1;
end $$;

-- Bloqueia cadastro sem o código do clube certo
create or replace function check_signup_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not verify_club_code(coalesce(new.raw_user_meta_data ->> 'club_code', '')) then
    raise exception 'Código do clube inválido';
  end if;
  return new;
end $$;

create trigger on_auth_user_signup
  before insert on auth.users
  for each row execute function check_signup_code();

-- ---------- Primeiro acesso: vincular a conta a um jogador ----------
create or replace function unclaimed_players() returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select id, name from players
  where user_id is null and not is_guest and auth.uid() is not null
    and not exists (select 1 from players where user_id = auth.uid())
  order by name
$$;

create or replace function claim_player(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if exists (select 1 from players where user_id = auth.uid()) then raise exception 'Sua conta já está vinculada'; end if;
  -- O presidente cadastrado entra direto; os demais esperam a aprovação da diretoria
  update players set user_id = auth.uid(), approved = (role = 'presidente')
   where id = pid and user_id is null and not is_guest;
  if not found then raise exception 'Esse jogador já foi escolhido por outra conta'; end if;
end $$;

create or replace function join_as_new_player(player_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if exists (select 1 from players where user_id = auth.uid()) then raise exception 'Sua conta já está vinculada'; end if;
  insert into players (user_id, name, approved, self_created) values (auth.uid(), trim(player_name), false, true);
end $$;

-- ---------- Aprovação de novos membros ----------
-- Presidente e organizador aprovam ou recusam quem criou conta.
create or replace function approve_member(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_manage_game() then raise exception 'Só presidente e organizador aprovam membros'; end if;
  update players set approved = true where id = pid and user_id is not null;
  if not exists (select 1 from player_ratings where player_id = pid) then
    insert into player_ratings (player_id) values (pid);
  end if;
end $$;

-- Recusar: quem se cadastrou como novo some; quem escolheu um nome da lista libera o nome de novo.
create or replace function reject_member(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_manage_game() then raise exception 'Só presidente e organizador recusam membros'; end if;
  if exists (select 1 from players where id = pid and approved) then raise exception 'Esse membro já foi aprovado'; end if;
  delete from players where id = pid and self_created and not approved;
  update players set user_id = null, approved = true where id = pid and not approved;
end $$;

-- ---------- Login por nome + PIN ----------
-- O app transforma o PIN de 4 números na senha 'rm-<PIN>-marditos' (o Supabase exige 6+ caracteres).

-- Público: nomes ainda sem dono, só para quem tem o código do clube
create or replace function unclaimed_players_public(code text) returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name from players p
  where verify_club_code(code) and p.user_id is null and not p.is_guest
  order by p.name
$$;

-- Público: devolve o login interno de quem já tem conta, a partir do nome digitado
create or replace function login_email(p_name text) returns text
language sql stable security definer set search_path = public as $$
  select u.email from players p join auth.users u on u.id = p.user_id
  where norm_name(p.name) = norm_name(p_name) and not p.is_guest
  limit 1
$$;

-- Presidente define um PIN novo para quem esqueceu
create or replace function reset_pin(p_player uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid;
begin
  if my_role() is distinct from 'presidente' then raise exception 'Só o presidente redefine PIN'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'O PIN precisa ter 4 números'; end if;
  select user_id into uid from players where id = p_player;
  if uid is null then raise exception 'Esse jogador ainda não criou conta'; end if;
  update auth.users set encrypted_password = crypt('rm-' || p_pin || '-marditos', gen_salt('bf')), updated_at = now()
   where id = uid;
end $$;

-- ---------- Perfil do próprio jogador ----------
create or replace function update_my_profile(
  p_position text, p_foot text, p_shirt_number int, p_birthday date, p_avatar jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update players
     set position = p_position, foot = p_foot, shirt_number = p_shirt_number,
         birthday = p_birthday, avatar = coalesce(p_avatar, avatar)
   where user_id = auth.uid();
end $$;

-- Só o presidente muda papéis
create or replace function guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() nulo = SQL Editor do Supabase (dono do banco), sempre liberado
  if new.role is distinct from old.role and auth.uid() is not null
     and my_role() is distinct from 'presidente' then
    raise exception 'Só o presidente pode mudar permissões';
  end if;
  return new;
end $$;

create trigger players_guard_role before update on players
  for each row execute function guard_role_change();

-- ---------- Presença ----------
-- O membro confirma ou desconfirma enquanto a lista está aberta (até os times serem postados).
create or replace function set_rsvp(p_match uuid, p_rsvp rsvp_kind, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  pid uuid := my_player_id();
  why text := case when p_rsvp = 'nao_vou' then nullif(trim(left(coalesce(p_reason, ''), 80)), '') end;
begin
  if pid is null then raise exception 'Faça login primeiro'; end if;
  if (select status from matches where id = p_match) is distinct from 'aberta' then
    raise exception 'A lista já fechou: os times foram postados';
  end if;
  insert into attendances (match_id, player_id, rsvp, rsvp_at, reason)
  values (p_match, pid, p_rsvp, now(), why)
  on conflict (match_id, player_id)
  do update set rsvp = excluded.rsvp, reason = excluded.reason,
                rsvp_at = case when attendances.rsvp = excluded.rsvp then attendances.rsvp_at else now() end;
end $$;

-- ---------- V2: votação ----------
-- A votação fecha 24h depois do horário de fim do jogo (horário de Brasília)
create or replace function vote_deadline(d date, t time) returns timestamptz
language sql stable as $$
  select ((d + t) at time zone 'America/Sao_Paulo') + interval '24 hours'
$$;

-- Só quem jogou vota; pode votar em si mesmo; dá para trocar o voto até fechar
create or replace function cast_vote(p_match uuid, p_kind vote_kind, p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  pid uuid := my_player_id();
  m matches;
begin
  if pid is null then raise exception 'Faça login primeiro'; end if;
  select * into m from matches where id = p_match;
  if m.status is distinct from 'encerrada' then raise exception 'A votação abre quando a súmula for lançada'; end if;
  if now() > vote_deadline(m.date, m.ends_at) then raise exception 'A votação dessa noite já fechou'; end if;
  if not exists (select 1 from attendances where match_id = p_match and player_id = pid and played and team is not null) then
    raise exception 'Só quem jogou nessa noite pode votar';
  end if;
  if not exists (select 1 from attendances where match_id = p_match and player_id = p_target and played and team is not null) then
    raise exception 'Esse jogador não jogou nessa noite';
  end if;
  insert into votes (match_id, voter_id, kind, target_id) values (p_match, pid, p_kind, p_target)
  on conflict (match_id, voter_id, kind) do update set target_id = excluded.target_id, created_at = now();
end $$;

-- Vencedores de cada votação já fechada (empate: todos os empatados levam)
create or replace function vote_winners()
returns table (match_id uuid, kind vote_kind, player_id uuid, votes int)
language sql stable security definer set search_path = public as $$
  with c as (
    select v.match_id, v.kind, v.target_id, count(*)::int as n
    from votes v join matches m on m.id = v.match_id
    where is_member() and m.status = 'encerrada' and now() > vote_deadline(m.date, m.ends_at)
    group by 1, 2, 3
  )
  select c.match_id, c.kind, c.target_id, c.n from c
  where c.n = (select max(n) from c c2 where c2.match_id = c.match_id and c2.kind = c.kind)
  union all
  -- Ninguém votou: vale a escolha da diretoria (votes = 0)
  select a.match_id, a.kind, a.player_id, 0
  from match_awards a join matches m on m.id = a.match_id
  where is_member() and m.status = 'encerrada'
    and not exists (select 1 from votes v where v.match_id = a.match_id and v.kind = a.kind)
$$;

-- Presidente e organizador definem o MVP ou o bagre de uma partida sem votos (lista vazia = apaga)
create or replace function set_match_award(p_match uuid, p_kind vote_kind, p_players uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_manage_game() then raise exception 'Só presidente e organizador definem MVP e bagre'; end if;
  delete from match_awards where match_id = p_match and kind = p_kind;
  insert into match_awards (match_id, kind, player_id)
  select p_match, p_kind, unnest(coalesce(p_players, '{}'));
end $$;

-- ---------- V3: caixa ----------
-- Cria as mensalidades do mês que ainda não existem. O valor sai da categoria do jogador
-- no momento em que o mês é aberto: quem se afasta no meio do mês continua pagando o valor cheio.
create or replace function ensure_month_dues(p_month date) returns void
language plpgsql security definer set search_path = public as $$
declare s club_settings;
begin
  if not is_member() then raise exception 'Faça login primeiro'; end if;
  select * into s from club_settings where id = 1;
  insert into dues (player_id, month, amount)
  select p.id, date_trunc('month', p_month)::date,
         case when p.status = 'afastado' then s.fee_away
              when p.is_goalkeeper then s.fee_goalkeeper
              else s.fee_line end
  from players p
  where not p.is_guest and p.approved
  on conflict (player_id, month) do nothing;
end $$;

-- O membro avisa que pagou (com ou sem comprovante); o tesoureiro confirma depois
create or replace function inform_payment(p_month date, p_receipt_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update dues set status = 'informado', informed_at = now(), receipt_path = coalesce(p_receipt_path, receipt_path)
   where player_id = my_player_id() and month = date_trunc('month', p_month)::date and status <> 'pago';
  if not found then raise exception 'Mensalidade não encontrada ou já confirmada'; end if;
end $$;

-- Saldo do caixa: saldo inicial + mensalidades pagas + entradas - gastos
create or replace function cash_balance()
returns table (balance numeric, dues_paid numeric, income numeric, expenses numeric)
language sql stable security definer set search_path = public as $$
  -- Saldo = saldo de quando o app começou (cash_start) + o que entrou e saiu dali em diante
  select
    s.opening_balance + coalesce(d.v, 0) + coalesce(i.v, 0) - coalesce(e.v, 0),
    coalesce(d.v, 0), coalesce(i.v, 0), coalesce(e.v, 0)
  from club_settings s
  left join lateral (select sum(amount) v from dues where status = 'pago'
    and paid_at >= (s.cash_start::timestamp at time zone 'America/Sao_Paulo')) d on true
  left join lateral (select sum(amount) v from cash_moves where kind = 'entrada' and date >= s.cash_start) i on true
  left join lateral (select sum(amount) v from cash_moves where kind = 'saida' and date >= s.cash_start) e on true
  where s.id = 1 and is_admin()  -- toda a diretoria vê o saldo
$$;

-- Resumo de um período, do mês p_month até o mês p_end (regime de caixa: mensalidade conta quando foi confirmada)
create or replace function month_cash_summary(p_month date, p_end date default null)
returns table (opening numeric, dues_in numeric, income numeric, expenses numeric, closing numeric,
               by_category jsonb, paid_count int, total_count int)
language plpgsql stable security definer set search_path = public as $$
declare
  m0 date := date_trunc('month', p_month)::date;
  m1 date := (date_trunc('month', coalesce(p_end, p_month)) + interval '1 month')::date;
  t0 timestamptz := (m0::timestamp at time zone 'America/Sao_Paulo');
  t1 timestamptz := (m1::timestamp at time zone 'America/Sao_Paulo');
  ob numeric;
  cs date;
  c0 timestamptz;
begin
  if not is_admin() then raise exception 'Só a diretoria'; end if;
  select opening_balance, cash_start into ob, cs from club_settings where id = 1;
  -- Antes do app não há registro: o período começa, no mínimo, no dia em que o caixa entrou no app
  if m0 < cs then m0 := cs; t0 := (cs::timestamp at time zone 'America/Sao_Paulo'); end if;
  c0 := (cs::timestamp at time zone 'America/Sao_Paulo');
  opening := ob
    + coalesce((select sum(amount) from dues where status = 'pago' and paid_at >= c0 and paid_at < t0), 0)
    + coalesce((select sum(amount) from cash_moves where kind = 'entrada' and date >= cs and date < m0), 0)
    - coalesce((select sum(amount) from cash_moves where kind = 'saida' and date >= cs and date < m0), 0);
  dues_in  := coalesce((select sum(amount) from dues where status = 'pago' and paid_at >= t0 and paid_at < t1), 0);
  income   := coalesce((select sum(amount) from cash_moves where kind = 'entrada' and date >= m0 and date < m1), 0);
  expenses := coalesce((select sum(amount) from cash_moves where kind = 'saida' and date >= m0 and date < m1), 0);
  closing  := opening + dues_in + income - expenses;
  by_category := coalesce((
    select jsonb_agg(jsonb_build_object('category', category, 'amount', total) order by total desc)
    from (select category, sum(amount) total from cash_moves where kind = 'saida' and date >= m0 and date < m1 group by category) c
  ), '[]'::jsonb);
  select count(*) filter (where status = 'pago'), count(*) into paid_count, total_count from dues where month >= date_trunc('month', m0)::date and month < m1;
  return next;
end $$;

-- Publica (ou republica) a prestação de contas do mês para todos os membros
create or replace function publish_cash_report(p_month date, p_notes text, p_end date default null) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not can_manage_money() then raise exception 'Só presidente e tesoureiro'; end if;
  if p_end is not null and p_end < p_month then raise exception 'O fim do período vem antes do começo'; end if;
  select * into r from month_cash_summary(p_month, p_end);
  insert into cash_reports (month, period_end, opening, dues_in, income, expenses, closing, by_category, paid_count, total_count, notes, published_by)
  values (date_trunc('month', p_month)::date, date_trunc('month', coalesce(p_end, p_month))::date, r.opening, r.dues_in, r.income, r.expenses, r.closing, r.by_category, r.paid_count, r.total_count, nullif(trim(p_notes), ''), my_player_id())
  on conflict (month, period_end) do update set opening = excluded.opening, dues_in = excluded.dues_in, income = excluded.income,
    expenses = excluded.expenses, closing = excluded.closing, by_category = excluded.by_category,
    paid_count = excluded.paid_count, total_count = excluded.total_count, notes = excluded.notes,
    published_at = now(), published_by = excluded.published_by;
end $$;

-- Quem está devendo: só mensalidades vencidas e não pagas (todos os membros veem)
create or replace function debtors()
returns table (player_id uuid, name text, avatar jsonb, months int, total numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.avatar, count(*)::int, sum(d.amount)
  from dues d join players p on p.id = d.player_id
  cross join club_settings s
  where is_member() and s.id = 1 and d.status <> 'pago'
    and (d.month + (s.due_day - 1)) < (now() at time zone 'America/Sao_Paulo')::date
  group by p.id, p.name, p.avatar
  order by sum(d.amount) desc, p.name
$$;

-- ---------- Ranking ----------
create or replace function ranking()
returns table (
  player_id uuid, name text, avatar jsonb, is_goalkeeper boolean, status player_status,
  points int, games int, wins int, draws int, losses int, mvps int, bagres int
)
language sql stable security definer set search_path = public as $$
  with s as (select * from club_settings where id = 1),
  res as (
    select a.player_id, m.id as match_id,
      case
        when m.score_preto = m.score_branco then 'E'
        when (a.team = 'preto'  and m.score_preto  > m.score_branco)
          or (a.team = 'branco' and m.score_branco > m.score_preto) then 'V'
        else 'D'
      end as r
    from attendances a
    join matches m on m.id = a.match_id
    cross join s
    where is_member() and m.status = 'encerrada' and a.played and a.team is not null
      and m.score_preto is not null and m.score_branco is not null
      and extract(year from m.date) = current_season()
  ),
  game_pts as (
    select res.player_id,
      sum(s.pts_presence + case res.r when 'V' then s.pts_win when 'E' then s.pts_draw else s.pts_loss end)::int as pts,
      count(*)::int as games,
      (count(*) filter (where res.r = 'V'))::int as wins,
      (count(*) filter (where res.r = 'E'))::int as draws,
      (count(*) filter (where res.r = 'D'))::int as losses
    from res cross join s group by res.player_id
  ),
  awards as (
    select w.player_id,
      (count(*) filter (where w.kind = 'mvp'))::int as mvps,
      (count(*) filter (where w.kind = 'bagre'))::int as bagres
    from vote_winners() w
    join matches m on m.id = w.match_id
    cross join s
    where extract(year from m.date) = current_season()
    group by w.player_id
  )
  select p.id, p.name, p.avatar, p.is_goalkeeper, p.status,
    ((case when current_season() = s.initial_points_season then p.initial_points else 0 end) + coalesce(g.pts, 0) + coalesce(aw.mvps, 0) * s.pts_mvp)::int,
    coalesce(g.games, 0), coalesce(g.wins, 0), coalesce(g.draws, 0), coalesce(g.losses, 0),
    coalesce(aw.mvps, 0), coalesce(aw.bagres, 0)
  from players p
  cross join s
  left join game_pts g on g.player_id = p.id
  left join awards aw on aw.player_id = p.id
  where is_member() and not p.is_guest and p.approved
  order by 6 desc, p.name
$$;

-- ---------- Segurança (RLS) ----------
alter table club_settings    enable row level security;
alter table players          enable row level security;
alter table player_ratings   enable row level security;
alter table matches          enable row level security;
alter table attendances      enable row level security;
alter table announcements    enable row level security;
alter table draw_separations enable row level security;
alter table votes            enable row level security;
alter table match_awards     enable row level security;
alter table dues             enable row level security;
alter table cash_moves       enable row level security;
alter table cash_reports     enable row level security;
alter table match_comments   enable row level security;
alter table match_reactions  enable row level security;
alter table events           enable row level security;
alter table event_rsvps      enable row level security;

-- Configurações: membros leem tudo menos o código; presidente edita
revoke all on club_settings from anon, authenticated;
grant select (id, season, confirm_deadline, max_players, pts_win, pts_draw, pts_loss, pts_presence, pts_mvp,
              fee_line, fee_goalkeeper, fee_away, due_day, reminder_day, pix_key, pix_name, pix_city, opening_balance,
              cash_start, court_fee)
  on club_settings to authenticated;
grant update on club_settings to authenticated;
create policy cs_read   on club_settings for select using (is_member());
-- Só o presidente muda as configurações
create policy cs_update on club_settings for update using (my_role() = 'presidente');
-- Só o presidente troca o código do clube
revoke update on club_settings from authenticated;
grant update (fee_line, fee_goalkeeper, fee_away, due_day, reminder_day, pix_key, pix_name, pix_city, opening_balance) on club_settings to authenticated;

-- Jogadores
create policy pl_read   on players for select using (is_member() or user_id = auth.uid());
create policy pl_insert on players for insert with check (can_manage_game());
create policy pl_update on players for update using (can_manage_game());
create policy pl_delete on players for delete using (my_role() = 'presidente');

-- Notas: só presidente e organizador
create policy pr_all on player_ratings for all using (can_manage_game()) with check (can_manage_game());

-- Partidas
create policy m_read  on matches for select using (is_member());
create policy m_write on matches for all using (can_manage_game()) with check (can_manage_game());

-- Presença: membros leem; escrita do membro só pelo set_rsvp; ADMs do jogo escrevem direto
create policy a_read  on attendances for select using (is_member());
create policy a_write on attendances for all using (can_manage_game()) with check (can_manage_game());

-- Avisos: todos os ADMs publicam
create policy an_read  on announcements for select using (is_member());
create policy an_write on announcements for all using (is_admin()) with check (is_admin());

-- Duplas separadas
create policy ds_read  on draw_separations for select using (can_manage_game());
create policy ds_write on draw_separations for all using (can_manage_game()) with check (can_manage_game());

-- Votos: abertos para todos os membros; escrita só pelo cast_vote
create policy v_read on votes for select using (is_member());
create policy ma_read on match_awards for select using (is_member());

-- Caixa: membros veem a tabela de mensalidades e as prestações publicadas;
-- saldo e lançamentos ao vivo só para presidente e tesoureiro
-- Quem pagou e quem deve é visível para todos (os valores do caixa, não)
create policy du_read  on dues       for select using (is_member());
create policy du_write on dues       for all    using (can_manage_money()) with check (can_manage_money());
create policy cr_read  on cash_reports for select using (is_member());
create policy cr_write on cash_reports for all  using (can_manage_money()) with check (can_manage_money());
create policy cm_read  on cash_moves for select using (is_admin());
create policy cm_write on cash_moves for all    using (can_manage_money()) with check (can_manage_money());

-- Feed: todos leem; cada um escreve e apaga o que é seu; a diretoria apaga qualquer comentário
create policy mc_read   on match_comments  for select using (is_member());
create policy mc_insert on match_comments  for insert with check (player_id = my_player_id());
create policy mc_delete on match_comments  for delete using (player_id = my_player_id() or is_admin());
create policy mr_read   on match_reactions for select using (is_member());
create policy mr_insert on match_reactions for insert with check (player_id = my_player_id());
create policy mr_delete on match_reactions for delete using (player_id = my_player_id());

-- Eventos: diretoria cria; cada membro responde por si
create policy ev_read   on events      for select using (is_member());
create policy ev_write  on events      for all    using (is_admin()) with check (is_admin());
create policy er_read   on event_rsvps for select using (is_member());
create policy er_insert on event_rsvps for insert with check (player_id = my_player_id());
create policy er_update on event_rsvps for update using (player_id = my_player_id()) with check (player_id = my_player_id());
create policy er_delete on event_rsvps for delete using (player_id = my_player_id());

-- Funções públicas
revoke execute on function get_club_code() from anon;
grant execute on function verify_club_code(text) to anon, authenticated;
grant execute on function unclaimed_players_public(text) to anon, authenticated;
grant execute on function login_email(text) to anon, authenticated;
revoke execute on function reset_pin(uuid, text) from anon;

-- ---------- V2: fotos do Marditos da Noite (Supabase Storage) ----------
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true)
on conflict (id) do nothing;

create policy fotos_read   on storage.objects for select using (bucket_id = 'fotos');
create policy fotos_insert on storage.objects for insert to authenticated with check (bucket_id = 'fotos' and public.can_manage_game());
create policy fotos_update on storage.objects for update to authenticated using (bucket_id = 'fotos' and public.can_manage_game());
create policy fotos_delete on storage.objects for delete to authenticated using (bucket_id = 'fotos' and public.can_manage_game());

-- ---------- V3: comprovantes de pagamento (privados) ----------
-- Cada jogador sobe na própria pasta: comprovantes/<id do jogador>/...
insert into storage.buckets (id, name, public) values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

create policy comp_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and (storage.foldername(name))[1] = public.my_player_id()::text);
create policy comp_read on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and (public.is_admin() or (storage.foldername(name))[1] = public.my_player_id()::text));
