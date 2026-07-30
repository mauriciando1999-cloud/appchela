-- ============================================================================
-- Modulo "Arbitraje de Vehiculos" (Caracas) - Ejecutar una sola vez en el
-- SQL Editor de Supabase (proyecto ekvzmfsdshyoeggudksm).
-- Prefijo veh_ para no colisionar con las tablas de Chela Sport.
-- Idempotente: seguro de re-ejecutar.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- veh_config: fila unica (id=1) con el estado del capital de trabajo.
-- ----------------------------------------------------------------------------
create table if not exists veh_config (
    id                          int primary key default 1 check (id = 1),
    capital_base                numeric not null default 8000,
    capital_disponible          numeric not null default 8000,
    ganancias_acumuladas        numeric not null default 0,
    ganancia_objetivo_default   numeric not null default 1000,
    holgura_pct_default         numeric not null default 10,
    updated_at                  timestamptz not null default now()
);
insert into veh_config (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- veh_referencias_mercado: catalogo de modelos de alta rotacion en Caracas.
-- ----------------------------------------------------------------------------
create table if not exists veh_referencias_mercado (
    id                   uuid primary key default gen_random_uuid(),
    created_at           timestamptz not null default now(),
    marca                text not null,
    modelo               text not null,
    precio_min           numeric,
    precio_max           numeric,
    dias_stock_promedio  int,
    demanda              text default 'media' check (demanda in ('alta','media','baja')),
    notas                text
);

insert into veh_referencias_mercado (marca, modelo, precio_min, precio_max, dias_stock_promedio, demanda, notas)
select * from (values
    ('Chevrolet', 'Spark',  4500,  7500, 20, 'alta', 'Alta rotacion, ideal para arbitraje rapido'),
    ('Chevrolet', 'Aveo',   5500,  9500, 25, 'alta', 'Muy solicitado, repuestos economicos'),
    ('Ford',      'Fiesta', 5000,  8500, 30, 'media', 'Buena demanda, cuidar caja automatica'),
    ('Toyota',    'Corolla',7000, 13000, 25, 'alta', 'Alta reventa, exige revisar papeles al dia'),
    ('Renault',   'Logan',  4000,  7000, 35, 'media', 'Economico, mantenimiento accesible')
) as seed(marca, modelo, precio_min, precio_max, dias_stock_promedio, demanda, notas)
where not exists (select 1 from veh_referencias_mercado);

-- ----------------------------------------------------------------------------
-- veh_proveedores: directorio de confianza (mecanicos, latoneros, gestores).
-- ----------------------------------------------------------------------------
create table if not exists veh_proveedores (
    id                uuid primary key default gen_random_uuid(),
    created_at        timestamptz not null default now(),
    nombre            text not null,
    tipo              text not null default 'otro' check (tipo in ('mecanico','latonero','gestor','notaria','repuestos','otro')),
    telefono          text,
    zona              text,
    costo_referencia  numeric,
    notas             text
);

-- ----------------------------------------------------------------------------
-- veh_unidades: cada vehiculo evaluado / comprado / vendido.
-- ----------------------------------------------------------------------------
create table if not exists veh_unidades (
    id                          uuid primary key default gen_random_uuid(),
    created_at                  timestamptz not null default now(),
    estado                      text not null default 'evaluando' check (estado in ('evaluando','descartada','comprada','vendida')),

    marca                       text,
    modelo                      text,
    anio                        int,
    placa                       text,
    color                       text,

    -- Inputs de la Calculadora de Viabilidad (Modulo 1)
    precio_ofertado             numeric,
    precio_objetivo_venta       numeric,
    ganancia_deseada            numeric default 1000,
    gastos_legales_estimados    numeric default 0,
    puesta_a_punto_estimada     numeric default 0,
    holgura_pct                 numeric default 10,

    -- Contacto del vendedor / origen de la publicacion
    enlace_publicacion          text,
    telefono_contacto           text,

    -- Output congelado de la evaluacion
    precio_maximo_compra        numeric,
    colchon_imprevistos         numeric,
    veredicto                   text check (veredicto in ('aprobado','rechazado')),

    -- Compra real
    precio_compra_real          numeric,
    fecha_compra                date,

    -- Modulo 4: legal y multas
    multas_deudas                numeric default 0,
    alcaldia                     text,
    checklist_legal               jsonb default '{
        "experticia": {"completado": false, "fecha": null},
        "solvencia_municipal": {"completado": false, "fecha": null},
        "planilla_intt": {"completado": false, "fecha": null},
        "notaria": {"completado": false, "fecha": null}
    }'::jsonb,

    -- Venta y cierre (Modulo 5)
    precio_venta_real           numeric,
    fecha_venta                 date,
    ganancia_neta_real          numeric,

    notas                       text
);

create index if not exists idx_veh_unidades_estado on veh_unidades(estado);

-- Migracion aditiva: si ya habias corrido este script antes de que existieran
-- las columnas de contacto, esto las agrega sin afectar filas existentes.
alter table veh_unidades add column if not exists enlace_publicacion text;
alter table veh_unidades add column if not exists telefono_contacto text;

-- ----------------------------------------------------------------------------
-- veh_gastos: bitacora de gastos vivos por unidad activa.
-- ----------------------------------------------------------------------------
create table if not exists veh_gastos (
    id            uuid primary key default gen_random_uuid(),
    unidad_id     uuid not null references veh_unidades(id) on delete cascade,
    created_at    timestamptz not null default now(),
    fecha         date not null default current_date,
    categoria     text not null default 'otro' check (categoria in ('mecanica','latoneria','repuestos','legal','otro')),
    descripcion   text,
    monto         numeric not null,
    proveedor_id  uuid references veh_proveedores(id)
);

create index if not exists idx_veh_gastos_unidad on veh_gastos(unidad_id);

-- ----------------------------------------------------------------------------
-- veh_capital_ledger: historial de movimientos del capital de trabajo.
-- ----------------------------------------------------------------------------
create table if not exists veh_capital_ledger (
    id                     uuid primary key default gen_random_uuid(),
    created_at             timestamptz not null default now(),
    unidad_id              uuid references veh_unidades(id),
    tipo                   text not null check (tipo in ('inversion_compra','inversion_gasto','retorno_capital','ganancia','retiro','ajuste')),
    monto                  numeric not null,
    saldo_capital_after    numeric,
    saldo_ganancias_after  numeric,
    descripcion            text
);

create index if not exists idx_veh_ledger_unidad on veh_capital_ledger(unidad_id);

-- ----------------------------------------------------------------------------
-- RLS: solo usuarios autenticados (misma cuenta admin de Chela Sport).
-- ----------------------------------------------------------------------------
alter table veh_config enable row level security;
alter table veh_unidades enable row level security;
alter table veh_gastos enable row level security;
alter table veh_proveedores enable row level security;
alter table veh_referencias_mercado enable row level security;
alter table veh_capital_ledger enable row level security;

drop policy if exists "veh_auth_all" on veh_config;
create policy "veh_auth_all" on veh_config for all to authenticated using (true) with check (true);

drop policy if exists "veh_auth_all" on veh_unidades;
create policy "veh_auth_all" on veh_unidades for all to authenticated using (true) with check (true);

drop policy if exists "veh_auth_all" on veh_gastos;
create policy "veh_auth_all" on veh_gastos for all to authenticated using (true) with check (true);

drop policy if exists "veh_auth_all" on veh_proveedores;
create policy "veh_auth_all" on veh_proveedores for all to authenticated using (true) with check (true);

drop policy if exists "veh_auth_all" on veh_referencias_mercado;
create policy "veh_auth_all" on veh_referencias_mercado for all to authenticated using (true) with check (true);

drop policy if exists "veh_auth_all" on veh_capital_ledger;
create policy "veh_auth_all" on veh_capital_ledger for all to authenticated using (true) with check (true);
