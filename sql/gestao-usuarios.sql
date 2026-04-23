create table if not exists public.informatica_gestao_permissoes (
    id bigserial primary key,
    profile_id uuid not null unique,
    ativo boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint informatica_gestao_permissoes_profile_id_fkey
        foreign key (profile_id)
        references public.profiles(id)
        on delete cascade
);

create index if not exists idx_informatica_gestao_permissoes_profile_id
    on public.informatica_gestao_permissoes(profile_id);
