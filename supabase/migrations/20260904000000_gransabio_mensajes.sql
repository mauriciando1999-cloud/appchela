-- Bitácora de comunicación entre el usuario y Gran Sabio (Claude Code) para
-- cuando el usuario está fuera y solo tiene el teléfono. La UI vive en
-- apps.html (ya protegida por login Supabase solo para
-- mauriciando1999@gmail.com); esta tabla es de bajo riesgo (solo texto de
-- bitácora, sin datos de negocio) así que las políticas son abiertas por
-- anon, igual que la anon key ya es pública en el código del sitio.

create table if not exists public.gransabio_mensajes (
  id bigint generated always as identity primary key,
  role text not null check (role in ('user', 'gransabio')),
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.gransabio_mensajes enable row level security;

drop policy if exists "gransabio_mensajes_select_anon" on public.gransabio_mensajes;
create policy "gransabio_mensajes_select_anon"
  on public.gransabio_mensajes for select
  to anon, authenticated
  using (true);

drop policy if exists "gransabio_mensajes_insert_anon" on public.gransabio_mensajes;
create policy "gransabio_mensajes_insert_anon"
  on public.gransabio_mensajes for insert
  to anon, authenticated
  with check (true);
