/* Despiece y costeo de un mueble a partir de sus medidas.
   Todas las medidas de entrada y de las piezas están en milímetros. */
window.MQ = window.MQ || {};

MQ.calc = (function () {
  const HOLGURA = 4;        // luz entre frentes sobrepuestos
  const RETIRO_ENTREP = 20; // el entrepaño queda más corto que el fondo
  const ALTO_ZOCALO = 100;
  const ALTO_CAJON_STD = 180;
  const REBAJE_CAJA = 60;   // la caja del cajón es más angosta y baja que el frente

  const tablero = (cat, id) => cat.tableros.find((t) => t.id === id) || cat.tableros[0];
  /* las cotizaciones guardadas antes de separar el material de cubierta
     no traen esa clave: en ellas la cubierta salía del tablero de frentes */
  const matCubierta = (m) => m.mat.cubierta || m.mat.frente;
  const canto = (cat, id) => cat.cantos.find((c) => c.id === id) || cat.cantos[0];

  /* ---------- insumos lineales: madera dimensionada y perfiles ----------
     Se compran por metro, no por plancha: en el mueble se anota la escuadría,
     el largo de cada pieza y cuántas van. */
  /* si el material fue borrado del catálogo se cae al primero de la lista,
     para que el mueble siga costeando en vez de perder la pieza */
  const escuadria = (cat, id) => (cat.escuadrias || []).find((x) => x.id === id) || (cat.escuadrias || [])[0];
  const perfil = (cat, id) => (cat.perfiles || []).find((x) => x.id === id) || (cat.perfiles || [])[0];
  const insumo = (cat, l) => (l.clase === "perfil" ? perfil(cat, l.matId) : escuadria(cat, l.matId));
  /* la escuadría se nombra como se pide en barraca: 2×4" */
  const nombreEscuadria = (e) => (e ? e.esp + "×" + e.anc + '"' + (e.nombre ? " " + e.nombre : "") : "");
  const nombreLineal = (cat, l) => {
    const it = insumo(cat, l);
    if (!it) return "";
    return l.clase === "perfil" ? it.nombre : nombreEscuadria(it);
  };
  /* Si el mueble lleva madera, la cubierta se arma con ella y no se cobra
     tablero: el usuario fabrica el tablero, no lo compra. */
  const hayMadera = (m) => (m.lineales || []).some((l) => l.clase === "madera" && l.largo > 0 && l.cant > 0);

  /* precio por m² prorrateado desde la plancha entera */
  function precioM2(cat, id) {
    const t = tablero(cat, id);
    const area = (t.largo / 1000) * (t.ancho / 1000);
    return area > 0 ? t.precio / area : 0;
  }

  /* Alto de cada cajón: en una cajonera reparten el alto interior,
     en el resto de los muebles usan una altura estándar. */
  function altoCajon(m, e) {
    if (!m.cajones) return 0;
    if (m.tipo === "cajonera") return Math.max(80, (m.alto - 2 * e) / m.cajones);
    return ALTO_CAJON_STD;
  }

  /* Reparto del frente: cuántas columnas hay, cuánto mide cada una y hasta
     dónde llegan las puertas. Lo usan el despiece, los herrajes y el esquema.
     Con cajones en columna propia esa columna no lleva puerta y las puertas
     van de piso a techo; si no, los cajones cruzan todo el ancho y las puertas
     se acortan. */
  function geometria(m, cat) {
    const t = MQ.tipo(m.tipo);
    const usa = (parte) => t.partes.indexOf(parte) >= 0;
    const e = tablero(cat, m.mat.cuerpo).espesor;
    const nCaj = usa("cajones") ? Math.max(0, Math.round(m.cajones)) : 0;
    const nPuertas = usa("puertas") ? Math.max(0, Math.round(m.puertas)) : 0;
    const hCaj = altoCajon(m, e);
    const colCaj = usa("cajonCol") && !!m.cajonCol && nCaj > 0 && nPuertas > 0;
    const cols = Math.max(1, nPuertas + (colCaj ? 1 : 0));
    const anchoCol = Math.max(1, m.ancho) / cols;
    const zonaCajones = colCaj ? 0 : nCaj * hCaj;
    const anchoCaj = colCaj ? anchoCol : Math.max(1, m.ancho);
    return {
      e, nCaj, nPuertas, hCaj, colCaj, cols, anchoCol, zonaCajones, anchoCaj,
      altoPuerta: Math.max(1, m.alto) - zonaCajones - HOLGURA,
      /* medidas de corte de los frentes, para acotarlos en el esquema */
      anchoPuerta: anchoCol - HOLGURA,
      anchoFrenteCajon: anchoCaj - HOLGURA,
      altoFrenteCajon: hCaj - HOLGURA
    };
  }

  /* ---------- despiece ---------- */
  function piezas(m, cat) {
    const e = tablero(cat, m.mat.cuerpo).espesor;
    const A = Math.max(1, m.ancho), H = Math.max(1, m.alto), P = Math.max(1, m.prof);
    const t = MQ.tipo(m.tipo);
    const usa = (parte) => t.partes.indexOf(parte) >= 0;
    const out = [];
    /* cant: unidades · largo/ancho: mm · cl/ca: cuántos bordes se cantean a lo largo y a lo ancho */
    const add = (nombre, cant, largo, ancho, mat, cantoId, cl, ca) => {
      if (cant <= 0 || largo <= 0 || ancho <= 0) return;
      /* un tablero macizo lleva el canto a la vista: se lija y se termina,
         no se le pega tapacanto */
      const canteable = cantoId && !tablero(cat, mat).macizo;
      out.push({
        nombre, cant: Math.round(cant), largo: Math.round(largo), ancho: Math.round(ancho),
        mat, canto: canteable ? cantoId : null, cl: canteable ? (cl || 0) : 0, ca: canteable ? (ca || 0) : 0
      });
    };

    const cubiertaDeMadera = hayMadera(m);

    if (m.tipo === "cubierta") {
      /* armada con madera propia: el despiece son las piezas lineales */
      if (!cubiertaDeMadera) add("Cubierta", 1, A, P, matCubierta(m), "grueso", 1, 2);
      return out;
    }

    const { nCaj, hCaj, nPuertas, anchoCol, anchoCaj, colCaj, altoPuerta } = geometria(m, cat);

    /* caja */
    add("Costado", 2, H, P, m.mat.cuerpo, "fino", 1, 0);
    add("Piso y techo", 2, A - 2 * e, P, m.mat.cuerpo, "fino", 1, 0);
    if (usa("entrepanos")) add("Entrepaño", Math.max(0, Math.round(m.entrepanos)), A - 2 * e, P - RETIRO_ENTREP, m.mat.cuerpo, "fino", 1, 0);
    if (usa("trasera") && m.trasera) add("Trasera", 1, H, A, m.mat.trasera, null, 0, 0);
    if (usa("zocalo") && m.zocalo) add("Zócalo", 1, A, ALTO_ZOCALO, m.mat.cuerpo, "fino", 1, 0);
    if (usa("cubierta") && m.cubierta && !cubiertaDeMadera) add("Cubierta", 1, A, P + 20, matCubierta(m), "grueso", 1, 2);

    /* los cajones en columna propia necesitan un separador vertical */
    if (colCaj) add("Separador vertical", 1, H - 2 * e, P, m.mat.cuerpo, "fino", 1, 0);

    /* frentes */
    if (nPuertas > 0 && altoPuerta > 50) {
      add("Puerta", nPuertas, altoPuerta, anchoCol - HOLGURA, m.mat.frente, "grueso", 2, 2);
    }
    if (nCaj > 0) {
      const interior = anchoCaj - 2 * e - 30;
      add("Frente de cajón", nCaj, anchoCaj - HOLGURA, hCaj - HOLGURA, m.mat.frente, "grueso", 2, 2);
      add("Costado de cajón", nCaj * 2, P - REBAJE_CAJA, hCaj - REBAJE_CAJA, m.mat.cajon, "fino", 1, 0);
      add("Frente y fondo de cajón", nCaj * 2, interior, hCaj - REBAJE_CAJA, m.mat.cajon, "fino", 1, 0);
      add("Piso de cajón", nCaj, interior, P - REBAJE_CAJA, m.mat.trasera, null, 0, 0);
    }
    return out;
  }

  /* ---------- herrajes ---------- */
  function herrajes(m, cat) {
    const t = MQ.tipo(m.tipo);
    const usa = (parte) => t.partes.indexOf(parte) >= 0;
    const { e, nCaj, nPuertas, altoPuerta } = geometria(m, cat);
    const out = [];
    const add = (key, cant) => {
      const h = cat.herrajes[key];
      if (!h || cant <= 0) return;
      out.push({ key, nombre: h.nombre, unidad: h.unidad, cant: Math.round(cant * 100) / 100, precio: h.precio, total: cant * h.precio });
    };
    if (m.tipo === "cubierta") return out;

    const porPuerta = altoPuerta > 1600 ? 4 : altoPuerta > 1000 ? 3 : 2;
    add("bisagra", nPuertas * porPuerta);
    add("corredera", nCaj);
    add("tirador", nPuertas + nCaj);
    if (usa("zocalo") && m.zocalo) add("pata", 4);
    if (usa("barra") && m.barra) {
      add("barra", Math.max(0, (m.ancho - 2 * e) / 1000));
      add("soporteBarra", 1);
    }
    add("fijaciones", 1);
    return out;
  }

  /* ---------- costeo de un mueble (precio unitario, sin IVA) ---------- */
  function costear(m, cat) {
    const p = cat.params;
    const pz = piezas(m, cat);
    const hz = herrajes(m, cat);

    const porTablero = {};  // id de tablero -> { m2, piezas[] }
    const porCanto = {};    // id de canto -> metros lineales
    let m2Proceso = 0;

    pz.forEach((x) => {
      const m2 = (x.largo / 1000) * (x.ancho / 1000) * x.cant;
      const g = porTablero[x.mat] || (porTablero[x.mat] = { m2: 0, piezas: 0 });
      g.m2 += m2; g.piezas += x.cant;
      if (tablero(cat, x.mat).espesor >= 9) m2Proceso += m2;
      if (x.canto) {
        const ml = ((x.cl * x.largo + x.ca * x.ancho) / 1000) * x.cant;
        porCanto[x.canto] = (porCanto[x.canto] || 0) + ml;
      }
    });

    const desp = 1 + MQ.num(p.desperdicio, 0) / 100;
    const detTableros = Object.keys(porTablero).map((id) => {
      const t = tablero(cat, id), g = porTablero[id];
      const areaPlancha = (t.largo / 1000) * (t.ancho / 1000);
      return {
        id, nombre: t.nombre, m2: g.m2, piezas: g.piezas,
        m2ConDesperdicio: g.m2 * desp,
        planchas: areaPlancha > 0 ? (g.m2 * desp) / areaPlancha : 0,
        total: g.m2 * desp * precioM2(cat, id)
      };
    });
    const detCantos = Object.keys(porCanto).map((id) => {
      const c = canto(cat, id);
      return { id, nombre: c.nombre, ml: porCanto[id], precio: c.precio, total: porCanto[id] * c.precio };
    });

    /* Piezas de madera y perfiles: metros por el precio del metro */
    const detLineales = (m.lineales || []).map((l) => {
      const it = insumo(cat, l);
      if (!it) return null;
      const cant = Math.max(0, Math.round(l.cant || 0));
      const largo = Math.max(0, Math.round(l.largo || 0));
      const metros = (largo / 1000) * cant;
      return {
        clase: l.clase, id: it.id, nombre: nombreLineal(cat, l),
        largo, cant, metros, precio: it.precio, total: metros * it.precio
      };
    }).filter(Boolean);

    /* Una cubierta armada con madera no deja tablero que procesar, pero sí una
       superficie que cepillar, encolar y lijar: si no entrara acá, la mano de
       obra del mesón quedaría en solo el armado. */
    const t = MQ.tipo(m.tipo);
    const llevaCubierta = m.tipo === "cubierta" || (t.partes.indexOf("cubierta") >= 0 && m.cubierta);
    if (hayMadera(m) && llevaCubierta) {
      m2Proceso += (Math.max(1, m.ancho) / 1000) * (Math.max(1, m.prof) / 1000);
    }

    const mano = [];
    const mo = cat.mano;
    if (m2Proceso > 0 && mo.fabricacion) mano.push({ nombre: mo.fabricacion.nombre, detalle: m2Proceso.toFixed(2) + " m²", total: m2Proceso * mo.fabricacion.precio });
    if (mo.armado) mano.push({ nombre: mo.armado.nombre, detalle: "1 módulo", total: mo.armado.precio });
    if (m.instalar && mo.instalacion) mano.push({ nombre: mo.instalacion.nombre, detalle: "1 módulo", total: mo.instalacion.precio });

    const suma = (a) => a.reduce((s, x) => s + x.total, 0);
    const cTableros = suma(detTableros), cCantos = suma(detCantos), cHerrajes = suma(hz), cMano = suma(mano);
    const cLineales = suma(detLineales);
    const directo = cTableros + cCantos + cHerrajes + cMano + cLineales;
    const gastos = directo * MQ.num(p.gastos, 0) / 100;
    const margen = (directo + gastos) * MQ.num(p.margen, 0) / 100;
    const unitario = MQ.redondear(directo + gastos + margen, MQ.num(p.redondeo, 1));

    return {
      piezas: pz, herrajes: hz, mano, tableros: detTableros, cantos: detCantos,
      lineales: detLineales, cubiertaDeMadera: hayMadera(m) && llevaCubierta,
      m2Proceso,
      costos: { tableros: cTableros, cantos: cCantos, lineales: cLineales, herrajes: cHerrajes, mano: cMano, directo, gastos, margen },
      unitario,
      total: unitario * Math.max(1, Math.round(m.cantidad || 1))
    };
  }

  /* ---------- totales de la cotización ---------- */
  function totales(quote, cat, empresa) {
    const lineas = (quote.muebles || []).map((m) => {
      const c = costear(m, cat);
      return { mueble: m, calc: c };
    });
    const neto = lineas.reduce((s, l) => s + l.calc.total, 0);
    const descPct = MQ.num(quote.descuento, 0);
    const descuento = neto * descPct / 100;
    const afecto = neto - descuento;
    const ivaPct = MQ.num(empresa.iva, 19);
    const iva = afecto * ivaPct / 100;
    return { lineas, neto, descPct, descuento, afecto, ivaPct, iva, total: afecto + iva };
  }

  /* ---------- lista de compra consolidada de toda la cotización ---------- */
  function listaCompra(quote, cat) {
    const tabs = {}, cants = {}, herr = {}, lins = {};
    (quote.muebles || []).forEach((m) => {
      const n = Math.max(1, Math.round(m.cantidad || 1));
      const c = costear(m, cat);
      c.tableros.forEach((t) => {
        const g = tabs[t.id] || (tabs[t.id] = { nombre: t.nombre, m2: 0, planchas: 0 });
        g.m2 += t.m2ConDesperdicio * n; g.planchas += t.planchas * n;
      });
      c.cantos.forEach((x) => {
        const g = cants[x.id] || (cants[x.id] = { nombre: x.nombre, ml: 0 });
        g.ml += x.ml * n;
      });
      c.herrajes.forEach((h) => {
        const g = herr[h.key] || (herr[h.key] = { nombre: h.nombre, unidad: h.unidad, cant: 0 });
        g.cant += h.cant * n;
      });
      c.lineales.forEach((l) => {
        const k = l.clase + ":" + l.id;
        const g = lins[k] || (lins[k] = { clase: l.clase, id: l.id, nombre: l.nombre, metros: 0, piezas: 0 });
        g.metros += l.metros * n; g.piezas += l.cant * n;
      });
    });
    const lineales = Object.keys(lins).map((k) => lins[k]);
    return {
      tableros: Object.keys(tabs).map((id) => Object.assign({ id, planchasEnteras: Math.ceil(tabs[id].planchas - 0.001) }, tabs[id])),
      cantos: Object.keys(cants).map((id) => Object.assign({ id }, cants[id])),
      herrajes: Object.keys(herr).map((k) => Object.assign({ key: k }, herr[k])),
      maderas: lineales.filter((l) => l.clase === "madera"),
      perfiles: lineales.filter((l) => l.clase === "perfil")
    };
  }

  return {
    piezas, herrajes, costear, totales, listaCompra, precioM2, geometria,
    matCubierta, tablero, hayMadera, nombreEscuadria, nombreLineal, ALTO_ZOCALO
  };
})();
