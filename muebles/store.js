/* Persistencia en el navegador. Catálogo, empresa, cotizaciones y borrador
   quedan en localStorage de este equipo: no se comparten entre dispositivos. */
window.MQ = window.MQ || {};

MQ.store = (function () {
  const P = "mq.";
  const LS = {
    get(k) { try { const v = localStorage.getItem(P + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };

  /* ---------- catálogo ----------
     La versión anterior guardaba listas separadas (tableros, escuadrías,
     perfiles, cantos, herrajes). Se convierten a la lista única de ítems
     para no perder los precios que ya estuvieran ajustados. La mano de obra
     no se traslada: antes se cobraba por m² de tablero y ahora por hora, así
     que ese número no significa lo mismo. */
  function convertirViejo(c) {
    const items = [];
    const unidadHerraje = (u) => (u === "m" ? "m" : u === "módulo" ? "global" : "un");
    (c.tableros || []).forEach((t) => items.push({
      id: t.id, cat: "tablero", nombre: t.nombre, unidad: "plancha", precio: t.precio
    }));
    (c.escuadrias || []).forEach((e) => items.push({
      id: e.id, cat: "madera", nombre: e.nombre || "Madera", esp: e.esp, anc: e.anc, unidad: "m", precio: e.precio
    }));
    (c.perfiles || []).forEach((p) => items.push({
      id: p.id, cat: "perfil", nombre: p.nombre, unidad: "m", precio: p.precio
    }));
    (c.cantos || []).forEach((x) => items.push({
      id: x.id, cat: "insumo", nombre: x.nombre, unidad: "m", precio: x.precio
    }));
    Object.keys(c.herrajes || {}).forEach((k) => {
      const h = c.herrajes[k];
      items.push({ id: k, cat: "herraje", nombre: h.nombre, unidad: unidadHerraje(h.unidad), precio: h.precio });
    });
    /* la mano de obra vuelve a los valores de referencia */
    MQ.DEFAULT_CATALOGO.items.filter((x) => x.cat === "mano").forEach((x) => items.push(MQ.clone(x)));
    return items;
  }

  function mergeCatalogo(c) {
    const d = MQ.clone(MQ.DEFAULT_CATALOGO);
    if (!c) return d;
    const out = MQ.clone(d);
    if (Array.isArray(c.items) && c.items.length) out.items = MQ.clone(c.items);
    else if (c.tableros || c.escuadrias || c.herrajes) out.items = convertirViejo(c);
    out.params = Object.assign(out.params, c.params || {});
    delete out.params.desperdicio;   // ya no se usa: se anota lo que se compra
    return out;
  }

  const mergeEmpresa = (e) => Object.assign(MQ.clone(MQ.DEFAULT_EMPRESA), e || {});
  const ordenar = (a) => a.sort((x, y) => (y.numero || 0) - (x.numero || 0) || String(y.actualizado || "").localeCompare(String(x.actualizado || "")));

  /* ---------- cotizaciones ----------
     Las guardadas con el configurador viejo traían `muebles` con sus medidas
     y un croquis para toda la cotización. Se convierten a partidas: lo que
     se puede conservar es el nombre, la cantidad y las piezas de madera y
     perfiles; las medidas pasan a la descripción, que es donde viven ahora. */
  function convertirCotizacion(q) {
    if (!q || q.partidas || !Array.isArray(q.muebles)) return q;
    const medidas = (m) => m.tipo === "cubierta"
      ? m.ancho + " × " + m.prof + " mm"
      : m.ancho + " × " + m.alto + " × " + m.prof + " mm";
    q.partidas = q.muebles.map((m, i) => {
      const p = MQ.nuevaPartida();
      p.nombre = m.nombre || "Mueble " + (i + 1);
      p.descripcion = medidas(m);
      p.cantidad = m.cantidad || 1;
      p.lineas = (m.lineales || []).map((l) => ({
        id: MQ.uid(), itemId: l.matId, cant: 1,
        largo: l.largo || 0, piezas: l.cant || 1, nota: ""
      }));
      return p;
    });
    /* el croquis era uno solo: queda en la primera partida */
    if (q.croquis && q.partidas.length) {
      const v = MQ.nuevaVista("Frente");
      v.objetos = q.croquis.objetos || [];
      q.partidas[0].croquis = { escala: q.croquis.escala || 100, acotar: true, vistas: [v] };
    }
    delete q.muebles; delete q.croquis;
    return q;
  }

  function sanear(q) {
    if (!q) return q;
    convertirCotizacion(q);
    if (!Array.isArray(q.partidas)) q.partidas = [];
    if (!q.cliente) q.cliente = {};
    /* seguimiento: las cotizaciones viejas no traen fechas ni abonos. La
       etapa que ya tenían sigue valiendo, pero sin fecha: no se la vamos a
       inventar. */
    if (!q.hitos || typeof q.hitos !== "object") q.hitos = {};
    if (!Array.isArray(q.pagos)) q.pagos = [];
    if (!q.estado) q.estado = "borrador";
    q.partidas.forEach((p) => {
      if (!Array.isArray(p.lineas)) p.lineas = [];
      if (!p.croquis || !Array.isArray(p.croquis.vistas)) p.croquis = MQ.nuevoCroquis();
      if (!p.croquis.vistas.length) p.croquis.vistas = [MQ.nuevaVista("Frente")];
    });
    return q;
  }

  const S = {
    catalogo: mergeCatalogo(LS.get("catalogo")),
    empresa: mergeEmpresa(LS.get("empresa")),
    quotes: ordenar((LS.get("quotes") || []).map(sanear)),
    listeners: []
  };
  const emit = (kind) => S.listeners.forEach((fn) => fn(kind));
  S.on = (fn) => S.listeners.push(fn);

  S.saveCatalogo = function (c) { S.catalogo = mergeCatalogo(c); LS.set("catalogo", S.catalogo); emit("catalogo"); };
  S.resetCatalogo = function () { S.catalogo = MQ.clone(MQ.DEFAULT_CATALOGO); LS.set("catalogo", S.catalogo); emit("catalogo"); };
  S.saveEmpresa = function (e) { S.empresa = mergeEmpresa(e); LS.set("empresa", S.empresa); emit("empresa"); };

  S.nextNumero = () => S.quotes.reduce((mx, q) => Math.max(mx, q.numero || 0), 0) + 1;

  S.saveQuote = function (q) {
    const body = MQ.clone(q);
    if (!body.numero) body.numero = S.nextNumero();
    body.actualizado = new Date().toISOString();
    const i = S.quotes.findIndex((x) => x.id === body.id);
    if (i >= 0) S.quotes[i] = body; else S.quotes.push(body);
    ordenar(S.quotes); LS.set("quotes", S.quotes); emit("quotes");
    return body;
  };

  S.deleteQuote = function (id) {
    S.quotes = S.quotes.filter((q) => q.id !== id); LS.set("quotes", S.quotes); emit("quotes");
  };

  S.loadDraft = () => sanear(LS.get("draft"));
  S.saveDraft = (q) => LS.set("draft", q);

  /* Lo que quedó a medio hacer la vez anterior. Se guarda aparte porque la
     app parte en blanco: el borrador se pisa apenas uno toca algo, y esto
     tiene que sobrevivir hasta que se decida retomarlo o botarlo. */
  S.loadPendiente = () => sanear(LS.get("pendiente"));
  S.savePendiente = (q) => LS.set("pendiente", q);
  S.clearPendiente = () => LS.set("pendiente", null);

  /* ---------- clientes ----------
     La libreta del taller. La cotización guarda `clienteId` y además una
     copia de los datos: así un trabajo viejo sigue diciendo a qué teléfono
     se llamó entonces, aunque el cliente después se cambie de casa. */
  const normNombre = (s) => String(s || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  const porNombre = (a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");

  S.clientes = (LS.get("clientes") || []).filter((c) => c && c.id).sort(porNombre);
  function escribirClientes() {
    S.clientes.sort(porNombre);
    LS.set("clientes", S.clientes);
    emit("clientes");
  }

  S.cliente = (id) => S.clientes.find((c) => c.id === id) || null;
  S.clientePorNombre = function (n) {
    const k = normNombre(n);
    return k ? S.clientes.find((c) => normNombre(c.nombre) === k) || null : null;
  };

  S.saveCliente = function (c) {
    const ahora = new Date().toISOString();
    const existe = c.id && S.cliente(c.id);
    if (existe) {
      Object.assign(existe, MQ.clone(c), { actualizado: ahora });
      escribirClientes();
      return existe;
    }
    const body = Object.assign({ id: MQ.uid(), creado: ahora }, MQ.clone(c), { actualizado: ahora });
    S.clientes.push(body);
    escribirClientes();
    return body;
  };

  S.deleteCliente = function (id) {
    S.clientes = S.clientes.filter((c) => c.id !== id);
    escribirClientes();
  };

  /* los trabajos de un cliente: por vínculo, y si no por nombre, para que
     las cotizaciones de antes de la libreta también aparezcan */
  S.trabajosDe = function (c) {
    if (!c) return [];
    const k = normNombre(c.nombre);
    return S.quotes.filter((q) => q.clienteId === c.id || (!q.clienteId && k && normNombre((q.cliente || {}).nombre) === k));
  };

  /* ---------- plantillas ----------
     Una partida que se guarda para reusar: el reemplazo de los tipos de
     mueble, pero hecho de lo que uno ya cotizó. */
  S.plantillas = LS.get("plantillas") || [];
  S.savePlantilla = function (p) {
    const t = MQ.clone(p);
    t.id = MQ.uid();
    t.guardado = new Date().toISOString();
    S.plantillas.push(t);
    LS.set("plantillas", S.plantillas); emit("plantillas");
  };
  S.deletePlantilla = function (id) {
    S.plantillas = S.plantillas.filter((t) => t.id !== id);
    LS.set("plantillas", S.plantillas); emit("plantillas");
  };

  return S;
})();
