/* Costeo de la cotización.

   No hay despiece automático: lo que cuesta una partida es la suma de los
   materiales y las horas que uno anota, más gastos generales y margen. */
window.MQ = window.MQ || {};

MQ.calc = (function () {
  const item = (cat, id) => (cat.items || []).find((x) => x.id === id);
  const esLineal = (it) => !!(it && MQ.UNIDADES[it.unidad] && MQ.UNIDADES[it.unidad].lineal);

  /* Cantidad real de una línea, en la unidad del ítem.
     En los lineales sale de los cortes: largo × piezas. */
  function cantidad(l, it) {
    if (esLineal(it)) {
      return (Math.max(0, MQ.num(l.largo, 0)) / 1000) * Math.max(0, Math.round(MQ.num(l.piezas, 0)));
    }
    return Math.max(0, MQ.num(l.cant, 0));
  }

  /* Cómo se cuenta una figura cerrada: por el contorno o por su lado mayor.
     Lo decide la categoría del material —el fierro arma marcos, la madera
     son tablas— y la figura puede decir otra cosa si el caso lo pide, por
     ejemplo un marco de madera. */
  const modoCorte = (o, it) => (o && o.corte) || (MQ.categoria(it && it.cat).corteLargo ? "largo" : "contorno");

  /* ---------- líneas que salen del croquis ----------
     Una figura con material asignado ya trae su medida: el largo lo da el
     dibujo y la escala, así que no hay que escribirlo otra vez. Solo aplica
     a materiales que se compran por metro; para los demás la figura no dice
     cuánto hace falta. */
  function lineasCroquis(p, cat) {
    const cro = p.croquis;
    if (!cro || !Array.isArray(cro.vistas)) return [];
    const mm = MQ.croquis.mmPorUnidad(cro);
    const out = [];
    cro.vistas.forEach((v) => (v.objetos || []).forEach((o) => {
      if (!o.mat) return;
      const it = item(cat, o.mat);
      if (!it || !esLineal(it)) return;
      const modo = modoCorte(o, it);
      const largo = Math.round(MQ.croquis.largoMm(o, mm, modo));
      const piezas = MQ.croquis.piezasDe(o);
      if (largo <= 0) return;
      out.push({
        id: "cro:" + o.id, itemId: it.id, cat: it.cat, origen: "croquis", vista: v.nombre,
        nombre: MQ.nombreItem(it), unidad: it.unidad, lineal: true,
        largo, piezas, nota: "", modo,
        /* los lados por separado: el marco se compra entero pero se corta así */
        cortes: MQ.croquis.ladosMm(o, mm, modo).map((x) => ({ largo: x.largo, piezas: x.piezas * piezas })),
        cant: (largo / 1000) * piezas, precio: it.precio,
        total: (largo / 1000) * piezas * MQ.num(it.precio, 0)
      });
    }));
    return out;
  }

  /* Los cortes de una línea. Los del croquis vienen desglosados por lado;
     una línea escrita a mano es un solo largo repetido. */
  function cortesDe(l) {
    if (l.cortes && l.cortes.length) return l.cortes;
    return l.lineal && l.largo > 0 && l.piezas > 0 ? [{ largo: l.largo, piezas: l.piezas }] : [];
  }

  /* ---------- juntar las repetidas ----------
     Un mueble con doce piezas iguales llena la lista de filas idénticas y
     revisar si está todo considerado se vuelve imposible. Se juntan las que
     son el mismo material y el mismo corte; los cortes se suman por largo,
     así el desglose de un marco sigue cuadrando. */
  function agruparLineas(ls) {
    const out = [];
    (ls || []).forEach((l) => {
      const g = out.find((x) => x.itemId === l.itemId && x.unidad === l.unidad && x.largo === l.largo);
      if (!g) {
        const c = Object.assign({}, l);
        c.cortes = cortesDe(l).map((x) => ({ largo: x.largo, piezas: x.piezas }));
        c.vistas = l.vista ? [l.vista] : [];
        c.juntas = 1;
        out.push(c);
        return;
      }
      g.piezas += l.piezas; g.cant += l.cant; g.total += l.total; g.juntas++;
      cortesDe(l).forEach((x) => {
        const y = g.cortes.find((z) => z.largo === x.largo);
        if (y) y.piezas += x.piezas; else g.cortes.push({ largo: x.largo, piezas: x.piezas });
      });
      if (l.vista && g.vistas.indexOf(l.vista) < 0) g.vistas.push(l.vista);
    });
    out.forEach((g) => g.cortes.sort((a, b) => b.largo - a.largo));
    return out;
  }

  /* Cómo se escribe el corte de una línea. Una figura cerrada se desglosa en
     sus lados, que es como se corta en el banco; si son demasiados distintos
     —un trazo a mano alzada— el total es lo único que sirve. */
  function textoCorte(l) {
    if (!l.lineal) return "—";
    const c = cortesDe(l);
    if (c.length > 1 && c.length <= 3) return c.map((x) => x.piezas + " × " + x.largo).join(" + ") + " mm";
    return l.largo + " mm × " + l.piezas;
  }

  /* ---------- una partida ---------- */
  function costear(p, cat) {
    const aMano = (p.lineas || []).map((l) => {
      const it = item(cat, l.itemId);
      if (!it) return null;
      const cant = cantidad(l, it);
      return {
        id: l.id, itemId: it.id, cat: it.cat,
        nombre: MQ.nombreItem(it),
        unidad: it.unidad, lineal: esLineal(it),
        largo: Math.round(MQ.num(l.largo, 0)), piezas: Math.round(MQ.num(l.piezas, 0)),
        nota: l.nota || "",
        cant, precio: it.precio, total: cant * MQ.num(it.precio, 0), origen: "mano"
      };
    }).filter(Boolean);
    /* las del croquis van primero —son el cuerpo del mueble— y en el orden
       en que se dibujaron, que es como uno las repasa */
    const lineas = lineasCroquis(p, cat).concat(aMano);

    /* el desglose se agrupa por categoría, que es como se mira un costo */
    const porCategoria = MQ.CATEGORIAS.map((c) => ({
      id: c.id, nombre: c.nombre,
      total: lineas.filter((l) => l.cat === c.id).reduce((s, l) => s + l.total, 0)
    })).filter((c) => c.total > 0);

    const p2 = cat.params || {};
    const directo = lineas.reduce((s, l) => s + l.total, 0);
    const gastos = directo * MQ.num(p2.gastos, 0) / 100;
    const margen = (directo + gastos) * MQ.num(p2.margen, 0) / 100;
    const unitario = MQ.redondear(directo + gastos + margen, MQ.num(p2.redondeo, 1));
    const n = Math.max(1, Math.round(MQ.num(p.cantidad, 1)));

    return {
      lineas, porCategoria,
      costos: { directo, gastos, margen },
      unitario, cantidad: n, total: unitario * n
    };
  }

  /* ---------- toda la cotización ---------- */
  function totales(quote, cat, empresa) {
    const partidas = (quote.partidas || []).map((p) => ({ partida: p, calc: costear(p, cat) }));
    const neto = partidas.reduce((s, x) => s + x.calc.total, 0);
    const descPct = MQ.num(quote.descuento, 0);
    const descuento = neto * descPct / 100;
    const afecto = neto - descuento;
    const ivaPct = MQ.num(empresa.iva, 19);
    const iva = afecto * ivaPct / 100;
    return { partidas, neto, descPct, descuento, afecto, ivaPct, iva, total: afecto + iva };
  }

  /* ---------- plata recibida ----------
     Lo abonado contra el total: es lo que uno necesita saber al entregar.
     El saldo nunca baja de cero, aunque el abono se pase. */
  const pagado = (q) => (q.pagos || []).reduce((s, p) => s + Math.max(0, MQ.num(p.monto, 0)), 0);
  function pagos(q, cat, empresa) {
    const total = totales(q, cat, empresa).total;
    const ab = pagado(q);
    return { total, pagado: ab, saldo: Math.max(0, total - ab), pct: total > 0 ? Math.min(100, ab / total * 100) : 0 };
  }

  /* ---------- lista de compra ----------
     Junta las líneas de todas las partidas por ítem, multiplicadas por la
     cantidad de cada partida. Los cortes se conservan para la hoja de taller. */
  function listaCompra(quote, cat) {
    const acum = {};
    (quote.partidas || []).forEach((p) => {
      const c = costear(p, cat);
      c.lineas.forEach((l) => {
        const g = acum[l.itemId] || (acum[l.itemId] = {
          itemId: l.itemId, cat: l.cat, nombre: l.nombre, unidad: l.unidad,
          lineal: l.lineal, cant: 0, total: 0, cortes: []
        });
        g.cant += l.cant * c.cantidad;
        g.total += l.total * c.cantidad;
        cortesDe(l).forEach((x) => {
          const corte = g.cortes.find((y) => y.largo === x.largo);
          if (corte) corte.piezas += x.piezas * c.cantidad;
          else g.cortes.push({ largo: x.largo, piezas: x.piezas * c.cantidad });
        });
      });
    });
    const lista = Object.keys(acum).map((k) => acum[k]);
    lista.forEach((g) => g.cortes.sort((a, b) => b.largo - a.largo));
    /* ordenada como está el catálogo, para que se lea siempre igual */
    const orden = MQ.CATEGORIAS.map((c) => c.id);
    lista.sort((a, b) => orden.indexOf(a.cat) - orden.indexOf(b.cat) || a.nombre.localeCompare(b.nombre));
    return lista;
  }

  /* cómo se escribe una cantidad con su unidad */
  function conUnidad(cant, unidad) {
    const u = MQ.UNIDADES[unidad] || MQ.UNIDADES.un;
    if (unidad === "global") return "—";
    const entero = unidad === "un" || unidad === "plancha";
    return MQ.dec(cant, entero ? 0 : 2) + " " + u.nombre;
  }

  return { costear, totales, listaCompra, lineasCroquis, cantidad, esLineal, item, conUnidad, cortesDe, textoCorte, agruparLineas, modoCorte, pagado, pagos };
})();
