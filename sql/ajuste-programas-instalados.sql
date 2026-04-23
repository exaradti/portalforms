alter table if exists public.trocas_ativos
  add column if not exists programas_instalados text[] not null default array[]::text[];

alter table if exists public.instalacoes_ativos
  add column if not exists programas_instalados text[] not null default array[]::text[];
