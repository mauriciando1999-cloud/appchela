// vehiculos-common.js - Nucleo compartido del modulo de Arbitraje de Vehiculos
// Requiere que config.js ya haya sido cargado (define _sb, ADMIN_EMAIL).
// Se carga ANTES del script propio de cada pagina vehiculos-*.html.

window.Veh = (function () {

    // ==========================================================
    // AUTENTICACION (reutiliza la misma cuenta admin de Chela Sport)
    // ==========================================================
    async function requireAuth() {
        const { data: { user } } = await _sb.auth.getUser();
        if (!user) {
            window.location.href = 'index.html';
            return null;
        }
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.getElementById('app-content')?.classList.remove('hidden');
        return user;
    }

    function logout() {
        _sb.auth.signOut().then(() => window.location.href = 'index.html');
    }

    // ==========================================================
    // TASA BCV
    // ==========================================================
    let tasaBCV = 0;

    async function fetchBCV() {
        try {
            const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
            const data = await res.json();
            if (data?.promedio) tasaBCV = parseFloat(data.promedio);
        } catch (e) {
            console.warn('No se pudo obtener la tasa BCV.', e);
        }
        document.querySelectorAll('.veh-bcv-val').forEach(el => {
            el.innerText = tasaBCV ? `BCV: ${tasaBCV.toFixed(2)}` : 'BCV: --';
        });
        return tasaBCV;
    }

    // ==========================================================
    // UTILIDADES DE FORMATO Y UI
    // ==========================================================
    function fmtUSD(n) {
        const v = Number(n) || 0;
        return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtBs(n) {
        const v = Number(n) || 0;
        return 'Bs. ' + v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function toast(msg, tipo = 'ok') {
        const colors = {
            ok: 'bg-emerald-600 border-emerald-400',
            error: 'bg-red-600 border-red-400',
            warn: 'bg-amber-600 border-amber-400'
        };
        const el = document.createElement('div');
        el.className = `fixed bottom-24 left-1/2 -translate-x-1/2 ${colors[tipo] || colors.ok} text-white text-xs font-black uppercase tracking-widest px-5 py-3 rounded-full shadow-2xl border z-[200] animate-pulse`;
        el.innerText = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2600);
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==========================================================
    // MODULO 1 - CALCULADORA DE VIABILIDAD (logica pura)
    // ==========================================================
    // Precio Maximo de Compra = Precio Objetivo de Venta
    //                            - Ganancia Deseada
    //                            - Gastos Legales
    //                            - Puesta a Punto
    //                            - Colchon de Imprevistos (holgura% sobre legales+puesta a punto)
    function evaluarViabilidad({ precioOfertado, precioObjetivoVenta, gananciaDeseada, gastosLegales, puestaAPunto, holguraPct }) {
        precioOfertado = Number(precioOfertado) || 0;
        precioObjetivoVenta = Number(precioObjetivoVenta) || 0;
        gananciaDeseada = Number(gananciaDeseada) || 0;
        gastosLegales = Number(gastosLegales) || 0;
        puestaAPunto = Number(puestaAPunto) || 0;
        holguraPct = Number(holguraPct) || 0;

        const colchonImprevistos = (gastosLegales + puestaAPunto) * (holguraPct / 100);
        const precioMaximoCompra = precioObjetivoVenta - gananciaDeseada - gastosLegales - puestaAPunto - colchonImprevistos;
        const diferencia = precioMaximoCompra - precioOfertado; // positivo = colchon extra, negativo = sobra por negociar
        const aprobado = precioOfertado <= precioMaximoCompra;
        const gananciaProyectadaAlPrecioOfertado = precioObjetivoVenta - precioOfertado - gastosLegales - puestaAPunto - colchonImprevistos;

        return {
            colchonImprevistos,
            precioMaximoCompra,
            diferencia,
            aprobado,
            gananciaProyectadaAlPrecioOfertado
        };
    }

    // ==========================================================
    // MODULO 3 - RECALCULO DINAMICO DEL MARGEN
    // ==========================================================
    function calcularCostoTotalUnidad(unidad, gastos) {
        const compra = Number(unidad.precio_compra_real) || 0;
        const multas = Number(unidad.multas_deudas) || 0;
        const sumaGastos = (gastos || []).reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
        return compra + multas + sumaGastos;
    }

    function calcularMargenProyectado(unidad, costoTotal) {
        const objetivo = Number(unidad.precio_objetivo_venta) || 0;
        return objetivo - costoTotal;
    }

    function clasificarRiesgoMargen(margenProyectado, gananciaDeseada) {
        gananciaDeseada = Number(gananciaDeseada) || 0;
        if (gananciaDeseada <= 0) return 'verde';
        if (margenProyectado >= gananciaDeseada) return 'verde';
        if (margenProyectado >= gananciaDeseada * 0.5) return 'amarillo';
        return 'rojo';
    }

    function calcularDiasEnStock(fechaCompra, fechaReferencia) {
        if (!fechaCompra) return null;
        const inicio = new Date(fechaCompra + 'T00:00:00');
        const fin = fechaReferencia ? new Date(fechaReferencia + 'T00:00:00') : new Date();
        const dias = Math.floor((fin - inicio) / (1000 * 60 * 60 * 24));
        return dias >= 0 ? dias : 0;
    }

    // ==========================================================
    // MODULO 5 - SIMULADOR DE PAGO MIXTO
    // ==========================================================
    // partes: [{ tipo: 'efectivo'|'zelle'|'pago_movil', monto, moneda: 'USD'|'BS' }]
    function simularPagoMixto(totalUSD, partes, tasa) {
        totalUSD = Number(totalUSD) || 0;
        tasa = Number(tasa) || 0;
        let sumaUSD = 0;
        const detalle = (partes || []).map(p => {
            const monto = Number(p.monto) || 0;
            const equivUSD = p.moneda === 'BS' ? (tasa > 0 ? monto / tasa : 0) : monto;
            const equivBs = p.moneda === 'BS' ? monto : monto * tasa;
            sumaUSD += equivUSD;
            return { ...p, monto, equivUSD, equivBs };
        });
        const diferencia = totalUSD - sumaUSD;
        return { detalle, sumaUSD, diferencia, cuadra: Math.abs(diferencia) < 0.01 };
    }

    // ==========================================================
    // MODULO 5 - CAPITAL Y REINVERSION
    // ==========================================================
    async function getConfig() {
        let { data } = await _sb.from('veh_config').select('*').eq('id', 1).maybeSingle();
        if (!data) {
            const ins = await _sb.from('veh_config').insert({ id: 1 }).select().single();
            data = ins.data;
        }
        return data;
    }

    // tipo: inversion_compra | inversion_gasto | retorno_capital | ganancia | retiro
    async function aplicarMovimientoCapital({ unidad_id, tipo, monto, descripcion }) {
        const cfg = await getConfig();
        let capital = Number(cfg.capital_disponible);
        let ganancias = Number(cfg.ganancias_acumuladas);
        monto = Number(monto) || 0;

        if (tipo === 'inversion_compra' || tipo === 'inversion_gasto') capital -= monto;
        else if (tipo === 'retorno_capital') capital += monto;
        else if (tipo === 'ganancia') ganancias += monto;
        else if (tipo === 'retiro') ganancias -= monto;

        await _sb.from('veh_config').update({
            capital_disponible: capital,
            ganancias_acumuladas: ganancias,
            updated_at: new Date().toISOString()
        }).eq('id', 1);

        await _sb.from('veh_capital_ledger').insert({
            unidad_id: unidad_id || null,
            tipo, monto, descripcion,
            saldo_capital_after: capital,
            saldo_ganancias_after: ganancias
        });

        return { capital, ganancias };
    }

    // Cierra una unidad vendida: separa capital base de la ganancia obtenida.
    async function registrarVenta(unidad, gastos, { precioVentaReal, fechaVenta, metodoPago }) {
        const costoTotal = calcularCostoTotalUnidad(unidad, gastos);
        const gananciaNeta = Number(precioVentaReal) - costoTotal;

        await _sb.from('veh_unidades').update({
            estado: 'vendida',
            precio_venta_real: precioVentaReal,
            fecha_venta: fechaVenta,
            ganancia_neta_real: gananciaNeta
        }).eq('id', unidad.id);

        await aplicarMovimientoCapital({
            unidad_id: unidad.id, tipo: 'retorno_capital', monto: costoTotal,
            descripcion: `Retorno de capital invertido en ${unidad.marca || ''} ${unidad.modelo || ''}`.trim()
        });
        await aplicarMovimientoCapital({
            unidad_id: unidad.id, tipo: 'ganancia', monto: gananciaNeta,
            descripcion: `Ganancia neta de ${unidad.marca || ''} ${unidad.modelo || ''} (${metodoPago || 'venta'})`.trim()
        });

        return { costoTotal, gananciaNeta };
    }

    return {
        requireAuth, logout,
        fetchBCV, getTasa: () => tasaBCV,
        fmtUSD, fmtBs, toast, escapeHtml,
        evaluarViabilidad,
        calcularCostoTotalUnidad, calcularMargenProyectado, clasificarRiesgoMargen, calcularDiasEnStock,
        simularPagoMixto,
        getConfig, aplicarMovimientoCapital, registrarVenta
    };
})();
