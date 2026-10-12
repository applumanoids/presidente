-- PRESIDENTE · Lumanoids — instalação do banco (rode UMA vez no SQL Editor do Supabase)
create extension if not exists pgcrypto;

create table if not exists jogadores(
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome))>0),
  imagem text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now());
create unique index if not exists jogadores_nome_uq on jogadores (lower(nome));

create table if not exists campeonatos(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  iniciado_em timestamptz not null default now(),
  encerrado_em timestamptz,
  status text not null default 'em_andamento' check (status in ('em_andamento','finalizado')),
  reaberto_em timestamptz);

create table if not exists campeonato_jogadores(
  campeonato_id uuid not null references campeonatos(id) on delete cascade,
  jogador_id uuid not null references jogadores(id),
  entrou_em timestamptz not null default now(),
  saiu_em timestamptz,
  pontos_entrada int not null default 0,
  status text not null default 'ativo' check (status in ('ativo','saiu')),
  primary key (campeonato_id, jogador_id));

create table if not exists rodadas(
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references campeonatos(id) on delete cascade,
  numero int not null,
  tipo text not null check (tipo in ('aberta','fechada')),
  juiz text not null check (length(trim(juiz))>0),
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz,
  duracao_seg int,
  status text not null default 'em_andamento' check (status in ('em_andamento','finalizada')),
  bolsa_familia boolean not null default false,
  unique (campeonato_id, numero));

create table if not exists rodada_participantes(
  rodada_id uuid not null references rodadas(id) on delete cascade,
  jogador_id uuid not null references jogadores(id),
  ordem_inicial int not null,
  status text not null default 'participou',
  primary key (rodada_id, jogador_id));

create table if not exists rodada_resultados(
  rodada_id uuid not null references rodadas(id) on delete cascade,
  jogador_id uuid not null references jogadores(id),
  posicao int not null check (posicao>0),
  pontos int not null,
  cargo text check (cargo in ('presidente','vice','suplente','lixinho','lixao')),
  primary key (rodada_id, jogador_id),
  unique (rodada_id, posicao));

create table if not exists historico_alteracoes(
  id bigint generated always as identity primary key,
  campeonato_id uuid references campeonatos(id) on delete cascade,
  rodada_id uuid references rodadas(id) on delete set null,
  tipo text not null,
  descricao text,
  autor text,
  criado_em timestamptz not null default now());

-- VIEWS (security_invoker: respeitam as permissões de quem consulta)
create or replace view v_pontuacao_campeonato with (security_invoker=true) as
select cj.campeonato_id, cj.jogador_id, cj.pontos_entrada,
  coalesce(sum(rr.pontos),0)::int as pontos_rodadas,
  (cj.pontos_entrada+coalesce(sum(rr.pontos),0))::int as total,
  count(rr.rodada_id)::int as rodadas,
  count(*) filter (where rr.cargo='presidente')::int as presidencias,
  count(*) filter (where rr.cargo='vice')::int as vices,
  count(*) filter (where rr.cargo='lixinho')::int as lixinhos,
  count(*) filter (where rr.cargo='lixao')::int as lixoes
from campeonato_jogadores cj
left join rodadas r on r.campeonato_id=cj.campeonato_id
left join rodada_resultados rr on rr.rodada_id=r.id and rr.jogador_id=cj.jogador_id
group by cj.campeonato_id, cj.jogador_id, cj.pontos_entrada;

create or replace view v_ranking_geral_ano with (security_invoker=true) as
select extract(year from c.iniciado_em)::int as ano, p.jogador_id,
  sum(p.total)::int as pontos, count(distinct p.campeonato_id)::int as campeonatos
from v_pontuacao_campeonato p join campeonatos c on c.id=p.campeonato_id
where c.status='finalizado' group by 1,2;

create or replace view v_relatorio_rodadas with (security_invoker=true) as
select r.id as rodada_id, r.campeonato_id, c.nome as campeonato, r.numero, r.juiz, r.tipo,
  r.iniciada_em, r.finalizada_em, r.duracao_seg, r.bolsa_familia,
  (select count(*) from rodada_participantes p where p.rodada_id=r.id)::int as participantes,
  (select j.nome from rodada_resultados x join jogadores j on j.id=x.jogador_id where x.rodada_id=r.id and x.cargo='presidente') as presidente,
  (select j.nome from rodada_resultados x join jogadores j on j.id=x.jogador_id where x.rodada_id=r.id and x.cargo='vice') as vice,
  (select j.nome from rodada_resultados x join jogadores j on j.id=x.jogador_id where x.rodada_id=r.id and x.cargo='lixinho') as lixinho,
  (select j.nome from rodada_resultados x join jogadores j on j.id=x.jogador_id where x.rodada_id=r.id and x.cargo='lixao') as lixao
from rodadas r join campeonatos c on c.id=r.campeonato_id;

create or replace view v_relatorio_jogadores with (security_invoker=true) as
select j.id as jogador_id, j.nome, j.imagem,
  count(distinct r.campeonato_id)::int as campeonatos,
  count(rr.rodada_id)::int as rodadas,
  coalesce(sum(rr.pontos),0)::int as pontos,
  round(avg(rr.pontos),2) as media_pontos, max(rr.pontos) as maior_pontuacao,
  min(rr.posicao) as melhor_posicao, max(rr.posicao) as pior_posicao, round(avg(rr.posicao),2) as media_posicao,
  count(*) filter (where rr.cargo='presidente')::int as presidencias,
  count(*) filter (where rr.cargo='vice')::int as vices,
  count(*) filter (where rr.cargo='lixinho')::int as lixinhos,
  count(*) filter (where rr.cargo='lixao')::int as lixoes,
  count(*) filter (where r.tipo='aberta')::int as rodadas_abertas,
  count(*) filter (where r.tipo='fechada')::int as rodadas_fechadas,
  round(avg(r.duracao_seg))::int as duracao_media_seg
from jogadores j
left join rodada_resultados rr on rr.jogador_id=j.id
left join rodadas r on r.id=rr.rodada_id
group by j.id;

-- SEGURANÇA: só usuários logados (Auth) leem/escrevem. Visitantes anônimos não têm acesso.
do $$ declare t text; begin
  foreach t in array array['jogadores','campeonatos','campeonato_jogadores','rodadas','rodada_participantes','rodada_resultados','historico_alteracoes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "grupo_total" on %I', t);
    execute format('create policy "grupo_total" on %I for all to authenticated using (true) with check (true)', t);
  end loop; end $$;
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- TEMPO REAL
alter publication supabase_realtime add table campeonatos, campeonato_jogadores, rodadas, rodada_participantes, rodada_resultados;
