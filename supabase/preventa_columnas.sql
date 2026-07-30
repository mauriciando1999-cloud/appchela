-- Ejecutar una sola vez en el SQL Editor de Supabase (proyecto ekvzmfsdshyoeggudksm)
-- Agrega las columnas que usa el flujo de Preventa Escolar (portal_preventa.html -> pago.html -> verificacion.html -> preventa-admin.html)
-- Todas son aditivas / nullable: no afectan filas existentes de `ventas`.

ALTER TABLE ventas ADD COLUMN IF NOT EXISTS tipo_pedido text;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS detalle_pedido jsonb;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS producto_preventa text;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS stock_descontado boolean DEFAULT false;
