-- ============================================================================
-- Catalogo del sitio "Chela" (chela-web/) - Ejecutar una sola vez en el
-- SQL Editor de Supabase (proyecto ekvzmfsdshyoeggudksm).
-- Tabla separada de `productos` (esa es el inventario con stock del POS;
-- esta es el catalogo publico de "ropa por encargo", sin stock).
-- Idempotente: seguro de re-ejecutar.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists chela_web_productos (
    id            uuid primary key default gen_random_uuid(),
    created_at    timestamptz not null default now(),
    slug          text unique not null,
    nombre        text not null,
    descripcion   text,
    precio_desde  numeric not null default 0,
    tallas        text[] not null default '{}',
    imagen        text,              -- nombre de archivo en assets/productos/ o URL externa
    icono         text default 'fa-shirt',  -- clase Font Awesome usada como respaldo si no hay foto
    orden         int not null default 0,
    activo        boolean not null default true,
    genero        text not null default 'unisex' check (genero in ('hombre', 'mujer', 'unisex'))
);

create index if not exists idx_chela_web_productos_orden on chela_web_productos(orden);

-- Migracion aditiva: si ya habias corrido este script antes de que existiera "genero".
alter table chela_web_productos add column if not exists genero text not null default 'unisex';
alter table chela_web_productos drop constraint if exists chela_web_productos_genero_check;
alter table chela_web_productos add constraint chela_web_productos_genero_check check (genero in ('hombre', 'mujer', 'unisex'));

-- Migracion aditiva: "seccion" separa el catalogo de Marketplace del de Corporativo
-- (cada uno se administra y se muestra por separado); "categoria" es el filtro
-- de tipo de producto (Disfraces, Vestidos, Chaquetas, etc.), editable desde
-- admin.html en la tabla chela_web_categorias de abajo.
alter table chela_web_productos add column if not exists seccion text not null default 'marketplace';
alter table chela_web_productos drop constraint if exists chela_web_productos_seccion_check;
alter table chela_web_productos add constraint chela_web_productos_seccion_check check (seccion in ('marketplace', 'corporativo'));
alter table chela_web_productos add column if not exists categoria text;

create index if not exists idx_chela_web_productos_seccion on chela_web_productos(seccion);

-- Semilla: los 6 productos iniciales del catalogo (no se duplican si ya existen).
-- La "imagen" apunta por ahora a un marcador de posicion (placehold.co) con la
-- paleta del sitio -- reemplazalo por la URL real cuando tengas la foto (ver
-- admin.html > Subir foto, o pega aqui la URL de Supabase Storage / externa).
insert into chela_web_productos (slug, nombre, descripcion, precio_desde, tallas, imagen, icono, orden, genero)
values
    ('chaqueta-personalizada', 'Chaqueta Personalizada', 'Chaqueta deportiva o universitaria, con el diseño, colores y bordado que elijas.', 30, ARRAY['4','6','8','10','12','14','16','S','M','L'], 'https://placehold.co/900x1200/EFEBE1/57534A?text=Chaqueta+Personalizada', 'fa-vest', 1, 'unisex'),
    ('franela-personalizada', 'Franela / Camiseta a la Medida', 'Franelas deportivas o casuales con estampado, serigrafía o bordado de tu marca o equipo.', 20, ARRAY['4','6','8','10','12','14','16','S','M','L','XL'], 'https://placehold.co/900x1200/EFEBE1/57534A?text=Franela+a+la+Medida', 'fa-shirt', 2, 'unisex'),
    ('conjunto-deportivo', 'Conjunto Deportivo (Mono)', 'Mono deportivo completo, ideal para equipos, academias o uso institucional.', 20, ARRAY['4','6','8','10','12','14','16','S','M','L'], 'https://placehold.co/900x1200/EFEBE1/57534A?text=Conjunto+Deportivo', 'fa-person-running', 3, 'unisex'),
    ('uniforme-escolar', 'Uniforme Escolar Completo', 'Chemise, pantalón/falda y accesorios institucionales confeccionados por encargo.', 38, ARRAY['4','6','8','10','12','14','16'], 'https://placehold.co/900x1200/EFEBE1/57534A?text=Uniforme+Escolar', 'fa-graduation-cap', 4, 'unisex'),
    ('polo-corporativo', 'Camisa / Polo Corporativo', 'Uniforme para tu equipo de trabajo con el logo de tu empresa bordado o estampado.', 22, ARRAY['S','M','L','XL','XXL'], 'https://placehold.co/900x1200/EFEBE1/57534A?text=Polo+Corporativo', 'fa-briefcase', 5, 'unisex'),
    ('gorra-personalizada', 'Gorra Personalizada', 'Gorras con el logo de tu marca, equipo o empresa. Ideal para complementar cualquier uniforme.', 8, ARRAY['Única'], 'https://placehold.co/900x1200/EFEBE1/57534A?text=Gorra+Personalizada', 'fa-hat-cowboy', 6, 'unisex')
on conflict (slug) do nothing;

-- Si ya habias corrido este script antes (los productos ya existian sin "imagen"
-- real), esto actualiza el marcador de posicion sin tocar nada mas del producto.
update chela_web_productos set imagen = 'https://placehold.co/900x1200/EFEBE1/57534A?text=Chaqueta+Personalizada' where slug = 'chaqueta-personalizada' and (imagen is null or imagen = '' or imagen = 'chaqueta-personalizada.jpg');
update chela_web_productos set imagen = 'https://placehold.co/900x1200/EFEBE1/57534A?text=Franela+a+la+Medida' where slug = 'franela-personalizada' and (imagen is null or imagen = '' or imagen = 'franela-personalizada.jpg');
update chela_web_productos set imagen = 'https://placehold.co/900x1200/EFEBE1/57534A?text=Conjunto+Deportivo' where slug = 'conjunto-deportivo' and (imagen is null or imagen = '' or imagen = 'conjunto-deportivo.jpg');
update chela_web_productos set imagen = 'https://placehold.co/900x1200/EFEBE1/57534A?text=Uniforme+Escolar' where slug = 'uniforme-escolar' and (imagen is null or imagen = '' or imagen = 'uniforme-escolar.jpg');
update chela_web_productos set imagen = 'https://placehold.co/900x1200/EFEBE1/57534A?text=Polo+Corporativo' where slug = 'polo-corporativo' and (imagen is null or imagen = '' or imagen = 'polo-corporativo.jpg');
update chela_web_productos set imagen = 'https://placehold.co/900x1200/EFEBE1/57534A?text=Gorra+Personalizada' where slug = 'gorra-personalizada' and (imagen is null or imagen = '' or imagen = 'gorra-personalizada.jpg');

-- ----------------------------------------------------------------------------
-- RLS: catalogo publico de lectura (lo ve cualquier visitante sin login);
-- solo la cuenta admin autenticada (misma de Chela Sport) puede escribir.
-- ----------------------------------------------------------------------------
alter table chela_web_productos enable row level security;

drop policy if exists "chela_web_lectura_publica" on chela_web_productos;
create policy "chela_web_lectura_publica" on chela_web_productos for select to anon, authenticated using (true);

drop policy if exists "chela_web_escritura_admin" on chela_web_productos;
create policy "chela_web_escritura_admin" on chela_web_productos for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Categorias de producto, por seccion (Marketplace / Corporativo). Cada seccion
-- tiene su propia lista, editable desde admin.html ("etc" = admin puede agregar
-- las que hagan falta sin tocar codigo).
-- ----------------------------------------------------------------------------
create table if not exists chela_web_categorias (
    id      uuid primary key default gen_random_uuid(),
    seccion text not null check (seccion in ('marketplace', 'corporativo')),
    nombre  text not null,
    orden   int not null default 0
);

create unique index if not exists idx_chela_web_categorias_unicas on chela_web_categorias(seccion, nombre);

insert into chela_web_categorias (seccion, nombre, orden) values
    ('marketplace', 'Disfraces', 1),
    ('marketplace', 'Para Ella', 2),
    ('marketplace', 'Para Él', 3),
    ('marketplace', 'Vestidos', 4),
    ('marketplace', 'Suéteres', 5),
    ('marketplace', 'Chaquetas', 6),
    ('corporativo', 'Camisas', 1),
    ('corporativo', 'Polos', 2),
    ('corporativo', 'Chaquetas', 3),
    ('corporativo', 'Gorras', 4)
on conflict (seccion, nombre) do nothing;

alter table chela_web_categorias enable row level security;

drop policy if exists "chela_web_categorias_lectura" on chela_web_categorias;
create policy "chela_web_categorias_lectura" on chela_web_categorias for select to anon, authenticated using (true);

drop policy if exists "chela_web_categorias_escritura" on chela_web_categorias;
create policy "chela_web_categorias_escritura" on chela_web_categorias for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Imagenes generales del sitio (logo, paneles Para Ella/Para Él, modulos de la
-- portada, bloques editoriales). Cada "clave" identifica un espacio de foto en
-- el HTML (ver data-img-slot en cada pagina); puede tener VARIAS fotos, y el
-- sitio las rota automaticamente. Administradas desde admin.html.
-- ----------------------------------------------------------------------------
create table if not exists chela_web_imagenes (
    id          uuid primary key default gen_random_uuid(),
    clave       text not null,
    url         text not null,
    orden       int not null default 0,
    created_at  timestamptz not null default now()
);

create index if not exists idx_chela_web_imagenes_clave on chela_web_imagenes(clave, orden);

alter table chela_web_imagenes enable row level security;

drop policy if exists "chela_web_imagenes_lectura" on chela_web_imagenes;
create policy "chela_web_imagenes_lectura" on chela_web_imagenes for select to anon, authenticated using (true);

drop policy if exists "chela_web_imagenes_escritura" on chela_web_imagenes;
create policy "chela_web_imagenes_escritura" on chela_web_imagenes for all to authenticated using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Storage: bucket publico para las fotos de producto subidas desde admin.html.
-- El navegador redimensiona/comprime cada foto antes de subirla (ver admin.js),
-- asi que el gasto de almacenamiento se mantiene minimo sin importar el tamaño
-- original de la imagen.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chela-productos', 'chela-productos', true)
on conflict (id) do nothing;

drop policy if exists "chela_productos_storage_lectura" on storage.objects;
create policy "chela_productos_storage_lectura" on storage.objects
for select to anon, authenticated
using (bucket_id = 'chela-productos');

drop policy if exists "chela_productos_storage_escritura" on storage.objects;
create policy "chela_productos_storage_escritura" on storage.objects
for all to authenticated
using (bucket_id = 'chela-productos')
with check (bucket_id = 'chela-productos');
