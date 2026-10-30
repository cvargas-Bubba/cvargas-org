/* Interfaz: configurador de muebles, hoja de cotización, historial,
   materiales y datos de la empresa. */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const S = MQ.store;

  let quote = null;      // cotización en edición
  let actual = null;     // mueble en el configurador
  let editando = null;   // id del mueble que se está editando, o null
  let croquis = null;    // editor de croquis, montado al arrancar

  MQ.toast = function (msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(MQ.toast._t);
    MQ.toast._t = setTimeout(() => { t.hidden = true; }, 3200);
  };

  const ESTADOS = { borrador: "Borrador", enviada: "Enviada", aceptada: "Aceptada", rechazada: "Rechazada" };
  const fechaCorta = (iso) => new Date(iso || Date.now()).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });

  function nuevaCotizacion() {
    return {
      id: MQ.uid(), numero: 0, estado: "borrador", creado: new Date().toISOString(),
      cliente: { nombre: "", rut: "", telefono: "", email: "", obra: "" },
      muebles: [], descuento: 0, notas: "", croquis: MQ.croquis.nuevo()
    };
  }

  /* ---------- descripción corta de un mueble ---------- */
  function descripcion(m) {
    const t = MQ.tipo(m.tipo);
    const usa = (p) => t.partes.indexOf(p) >= 0;
    const partes = [];
    if (usa("puertas") && m.puertas) partes.push(m.puertas + (m.puertas === 1 ? " puerta" : " puertas"));
    if (usa("cajones") && m.cajones) partes.push(m.cajones + (m.cajones === 1 ? " cajón" : " cajones") + (usa("cajonCol") && m.cajonCol ? " en columna" : ""));
    if (usa("entrepanos") && m.entrepanos) partes.push(m.entrepanos + (m.entrepanos === 1 ? " entrepaño" : " entrepaños"));
    if (usa("barra") && m.barra) partes.push("barra");
    if (usa("zocalo") && m.zocalo) partes.push("zócalo");
    if (usa("cubierta") && m.cubierta) partes.push("cubierta");
    if (m.instalar) partes.push("instalado");
    return partes.join(" · ");
  }
  const medidas = (m) => m.tipo === "cubierta"
    ? m.ancho + " × " + m.prof + " mm"
    : m.ancho + " × " + m.alto + " × " + m.prof + " mm";

  /* ================= CONFIGURADOR ================= */
  function pintarTipos() {
    $("tipos").innerHTML = MQ.TIPOS.map((t) => `
      <button type="button" class="tipo${actual && actual.tipo === t.id ? " on" : ""}" data-tipo="${t.id}">
        <span class="tipo-n">${esc(t.nombre)}</span>
        <span class="tipo-d">${esc(t.descripcion)}</span>
      </button>`).join("");
  }

  function pintarSelectsMaterial() {
    const cat = S.catalogo;
    const opts = (sel) => cat.tableros.map((t) => `<option value="${esc(t.id)}"${t.id === sel ? " selected" : ""}>${esc(t.nombre)}</option>`).join("");
    $("fMatCuerpo").innerHTML = opts(actual.mat.cuerpo);
    $("fMatFrente").innerHTML = opts(actual.mat.frente);
    $("fMatTrasera").innerHTML = opts(actual.mat.trasera);
    $("fMatCajon").innerHTML = opts(actual.mat.cajon);
    $("fMatCubierta").innerHTML = opts(MQ.calc.matCubierta(actual));
  }

  /* El mueble manda: el formulario muestra solo lo que el tipo usa */
  function volcarFormulario() {
    const t = MQ.tipo(actual.tipo);
    $("fNombre").value = actual.nombre || "";
    $("fAncho").value = actual.ancho;
    $("fAlto").value = actual.alto;
    $("fProf").value = actual.prof;
    $("fPuertas").value = actual.puertas;
    $("fCajones").value = actual.cajones;
    $("fEntrepanos").value = actual.entrepanos;
    $("fCajonCol").checked = !!actual.cajonCol;
    $("fTrasera").checked = !!actual.trasera;
    $("fZocalo").checked = !!actual.zocalo;
    $("fCubierta").checked = !!actual.cubierta;
    $("fBarra").checked = !!actual.barra;
    $("fInstalar").checked = !!actual.instalar;
    $("fCantidad").value = Math.max(1, actual.cantidad || 1);

    document.querySelectorAll("[data-parte]").forEach((el) => {
      const p = el.getAttribute("data-parte");
      if (p === "alto") el.hidden = actual.tipo === "cubierta";
      else if (p === "frente") el.hidden = actual.tipo === "cubierta";
      /* el tablero de cubierta se elige en el mesón y en los muebles que la llevan */
      else if (p === "matcubierta") el.hidden = actual.tipo !== "cubierta" && t.partes.indexOf("cubierta") < 0;
      else el.hidden = t.partes.indexOf(p) < 0;
    });
    $("fMatCuerpo").closest(".field").hidden = actual.tipo === "cubierta";
    pintarSelectsMaterial();
    if (!actual.lineales) actual.lineales = [];
    pintarLineales();
  }

  function leerFormulario() {
    const t = MQ.tipo(actual.tipo);
    const usa = (p) => t.partes.indexOf(p) >= 0;
    const ent = (v, min, max) => Math.min(max, Math.max(min, Math.round(MQ.num(v, min))));
    actual.nombre = $("fNombre").value.trim();
    actual.ancho = ent($("fAncho").value, 50, 6000);
    actual.prof = ent($("fProf").value, 50, 1200);
    actual.mat = {
      cuerpo: $("fMatCuerpo").value, frente: $("fMatFrente").value,
      trasera: $("fMatTrasera").value, cajon: $("fMatCajon").value,
      cubierta: $("fMatCubierta").value
    };
    /* en un mesón el alto no se escribe: es el espesor del tablero elegido */
    actual.alto = actual.tipo === "cubierta"
      ? MQ.calc.tablero(S.catalogo, actual.mat.cubierta).espesor
      : ent($("fAlto").value, 50, 3000);
    actual.puertas = usa("puertas") ? ent($("fPuertas").value, 0, 8) : 0;
    actual.cajones = usa("cajones") ? ent($("fCajones").value, 0, 10) : 0;
    actual.entrepanos = usa("entrepanos") ? ent($("fEntrepanos").value, 0, 12) : 0;
    actual.cajonCol = usa("cajonCol") && $("fCajonCol").checked;
    actual.trasera = usa("trasera") && $("fTrasera").checked;
    actual.zocalo = usa("zocalo") && $("fZocalo").checked;
    actual.cubierta = usa("cubierta") && $("fCubierta").checked;
    actual.barra = usa("barra") && $("fBarra").checked;
    actual.instalar = $("fInstalar").checked;
    actual.cantidad = ent($("fCantidad").value, 1, 99);
    leerLineales();
  }

  function pintarConfigurador() {
    const cat = S.catalogo;
    const c = MQ.calc.costear(actual, cat);
    $("esquema").innerHTML = MQ.draw.esquema(actual, cat);
    $("precioUnit").textContent = MQ.clp(c.unitario);

    const piezasTotal = c.piezas.reduce((s, p) => s + p.cant, 0);
    const m2 = c.tableros.reduce((s, t) => s + t.m2, 0);
    const ml = c.cantos.reduce((s, x) => s + x.ml, 0);
    $("resumenPiezas").innerHTML = [
      ["Piezas", piezasTotal],
      ["Tablero", m2.toFixed(2) + " m²"],
      ["Canto", ml.toFixed(1) + " m"]
    ].map(([k, v]) => `<div><dt>${k}</dt><dd class="mono">${esc(v)}</dd></div>`).join("");

    const d = c.costos;
    $("desglose").innerHTML = [
      ["Tableros", d.tableros], ["Madera y perfiles", d.lineales], ["Cantos", d.cantos],
      ["Herrajes", d.herrajes], ["Mano de obra", d.mano], ["Gastos y margen", d.gastos + d.margen]
    ].filter(([, v]) => v > 0).map(([k, v]) => `<span>${k} <b class="mono">${MQ.clp(v)}</b></span>`).join("");

    /* el total de cada fila se actualiza sin rehacerla, para no perder el
       foco mientras se escribe el largo o la cantidad */
    c.lineales.forEach((l, i) => {
      const el = $("lineales").querySelector(`[data-m="${i}"]`);
      if (el) el.textContent = l.metros.toFixed(2).replace(".", ",") + " m · " + MQ.clp(l.total);
    });
    $("linAyuda").textContent = c.cubiertaDeMadera
      ? "La cubierta se arma con estas piezas: no se cobra tablero."
      : "Piezas que compras por metro: escuadría, largo de cada pieza y cuántas van.";
    $("linAyuda").classList.toggle("aviso", !!c.cubiertaDeMadera);

    $("addItem").textContent = editando ? "Guardar cambios" : "Agregar a la cotización";
    $("cancelEdit").hidden = !editando;
  }

  /* ---------- madera y perfiles ---------- */
  function opcionesLineal(clase, sel) {
    const lista = clase === "perfil" ? (S.catalogo.perfiles || []) : (S.catalogo.escuadrias || []);
    return lista.map((x) => {
      const n = clase === "perfil" ? x.nombre : MQ.calc.nombreEscuadria(x);
      return `<option value="${esc(x.id)}"${x.id === sel ? " selected" : ""}>${esc(n)}</option>`;
    }).join("");
  }

  function pintarLineales() {
    const ls = actual.lineales || [];
    $("lineales").innerHTML = ls.length ? ls.map((l, i) => `
      <div class="lineal">
        <span class="lineal-k">${l.clase === "perfil" ? "Perfil" : "Madera"}</span>
        <select class="select" data-campo="matId" data-i="${i}" aria-label="Material">${opcionesLineal(l.clase, l.matId)}</select>
        <div class="unit" data-unit="mm"><input class="input" data-campo="largo" data-i="${i}" inputmode="numeric" value="${esc(l.largo)}" aria-label="Largo de cada pieza"></div>
        <div class="unit" data-unit="pzas"><input class="input" data-campo="cant" data-i="${i}" inputmode="numeric" value="${esc(l.cant)}" aria-label="Cantidad de piezas"></div>
        <span class="lineal-m mono" data-m="${i}"></span>
        <button class="icon" data-del-lineal="${i}" title="Quitar pieza" aria-label="Quitar pieza">✕</button>
      </div>`).join("") : `<p class="hint lineal-vacio">Todavía no hay piezas de madera ni perfiles.</p>`;
  }

  function leerLineales() {
    const ls = actual.lineales || [];
    $("lineales").querySelectorAll("[data-campo]").forEach((el) => {
      const l = ls[+el.dataset.i];
      if (!l) return;
      if (el.dataset.campo === "matId") l.matId = el.value;
      else if (el.dataset.campo === "largo") l.largo = Math.min(12000, Math.max(0, Math.round(MQ.num(el.value, 0))));
      else l.cant = Math.min(999, Math.max(0, Math.round(MQ.num(el.value, 0))));
    });
  }

  function agregarLineal(clase) {
    const lista = clase === "perfil" ? (S.catalogo.perfiles || []) : (S.catalogo.escuadrias || []);
    if (!lista.length) return MQ.toast("Primero agrega " + (clase === "perfil" ? "un perfil" : "una escuadría") + " en Materiales.");
    actual.lineales = actual.lineales || [];
    actual.lineales.push({ id: MQ.uid(), clase, matId: lista[0].id, largo: actual.ancho, cant: 1 });
    pintarLineales(); pintarConfigurador();
  }

  function refrescarConfig() { leerFormulario(); pintarConfigurador(); }

  function elegirTipo(id) {
    const cantidad = actual ? actual.cantidad : 1;
    const nombre = actual ? actual.nombre : "";
    actual = MQ.nuevoMueble(id);
    actual.cantidad = cantidad; actual.nombre = nombre;
    pintarTipos(); volcarFormulario(); pintarConfigurador();
  }

  /* ================= HOJA DE COTIZACIÓN ================= */
  function pintarHoja() {
    const cat = S.catalogo, emp = S.empresa;
    const T = MQ.calc.totales(quote, cat, emp);

    $("brandName").textContent = emp.nombre || "Mi Mueblería";
    $("sheetCompany").innerHTML =
      (emp.logo ? `<img class="sheet-logo" src="${esc(emp.logo)}" alt="${esc(emp.nombre || "Logo")}">` : "") +
      `<div class="sc-n">${esc(emp.nombre || "Mi Mueblería")}</div>` +
      `<div class="sc-d">${esc([emp.rut && "RUT " + emp.rut, emp.telefono, emp.email].filter(Boolean).join(" · "))}</div>`;
    $("quoteNo").textContent = "N° " + (quote.numero || S.nextNumero());
    $("quoteDate").textContent = fechaCorta(quote.creado);

    const c = quote.cliente;
    $("clientSum").innerHTML = c.nombre
      ? `<strong>${esc(c.nombre)}</strong>${c.obra ? " · " + esc(c.obra) : ""}`
      : `<span class="muted">Sin datos del cliente</span>`;

    $("items").innerHTML = T.lineas.length ? T.lineas.map((l, i) => {
      const m = l.mueble, d = descripcion(m);
      return `<li class="item${editando === m.id ? " editing" : ""}">
        <div class="it-n">
          <div class="it-t">${esc(m.nombre || MQ.tipo(m.tipo).nombre)}</div>
          <div class="it-d mono">${esc(medidas(m))}</div>
          ${d ? `<div class="it-d">${esc(d)}</div>` : ""}
        </div>
        <div class="it-q mono">${m.cantidad > 1 ? m.cantidad + " × " + MQ.clp(l.calc.unitario) : ""}</div>
        <div class="it-p mono">${MQ.clp(l.calc.total)}</div>
        <div class="it-a">
          <button class="icon" data-act="edit" data-i="${i}" title="Editar" aria-label="Editar">✎</button>
          <button class="icon" data-act="dup" data-i="${i}" title="Duplicar" aria-label="Duplicar">⧉</button>
          <button class="icon" data-act="del" data-i="${i}" title="Quitar" aria-label="Quitar">✕</button>
        </div>
      </li>`;
    }).join("") : `<li class="empty">Todavía no hay muebles. Configura uno a la izquierda y agrégalo.</li>`;

    const fila = (k, v, cls) => `<div class="${cls || ""}"><span>${esc(k)}</span><b class="mono">${esc(v)}</b></div>`;
    $("totales").innerHTML =
      fila("Neto", MQ.clp(T.neto)) +
      (T.descuento > 0 ? fila("Descuento " + T.descPct + "%", "− " + MQ.clp(T.descuento)) : "") +
      fila("IVA " + T.ivaPct + "%", MQ.clp(T.iva)) +
      fila("Total", MQ.clp(T.total), "grand");

    $("mbCount").textContent = quote.muebles.length + (quote.muebles.length === 1 ? " mueble" : " muebles");
    $("mbTotal").textContent = MQ.clp(T.total);
    $("mobileBar").hidden = quote.muebles.length === 0;

    S.saveDraft(quote);
  }

  function leerHoja() {
    quote.cliente = {
      nombre: $("cNombre").value.trim(), rut: $("cRut").value.trim(),
      telefono: $("cTelefono").value.trim(), email: $("cEmail").value.trim(),
      obra: $("cObra").value.trim()
    };
    quote.descuento = Math.min(90, Math.max(0, MQ.num($("qDescuento").value, 0)));
    quote.notas = $("qNotas").value;
    quote.estado = $("qEstado").value;
  }

  /* una cotización guardada con una versión anterior no trae croquis */
  function volcarCroquis() {
    if (!quote.croquis) quote.croquis = MQ.croquis.nuevo();
    if (!quote.croquis.objetos) quote.croquis.objetos = [];
    $("crEscala").value = quote.croquis.escala;
    if (croquis) croquis.pintar();
  }

  function volcarHoja() {
    const c = quote.cliente || {};
    $("cNombre").value = c.nombre || ""; $("cRut").value = c.rut || "";
    $("cTelefono").value = c.telefono || ""; $("cEmail").value = c.email || "";
    $("cObra").value = c.obra || "";
    $("qDescuento").value = quote.descuento || 0;
    $("qNotas").value = quote.notas || "";
    $("qEstado").value = quote.estado || "borrador";
    volcarCroquis();
  }

  /* ================= DESPIECE ================= */
  function pintarDespiece() {
    const cat = S.catalogo;
    const nom = (id) => (cat.tableros.find((t) => t.id === id) || {}).nombre || id;
    if (!quote.muebles.length) {
      $("despieceBody").innerHTML = `<p class="hint">Agrega al menos un mueble para ver el despiece.</p>`;
      return;
    }
    const bloques = quote.muebles.map((m, i) => {
      const c = MQ.calc.costear(m, cat);
      const n = Math.max(1, m.cantidad || 1);
      const filas = c.piezas.map((p) => `<tr>
        <td>${esc(p.nombre)}</td>
        <td class="mono num">${p.cant * n}</td>
        <td class="mono num">${p.largo}</td>
        <td class="mono num">${p.ancho}</td>
        <td class="small">${esc(nom(p.mat))}</td>
        <td class="small">${p.canto ? esc([p.cl ? p.cl + "× largo" : "", p.ca ? p.ca + "× ancho" : ""].filter(Boolean).join(" + ")) : "—"}</td>
      </tr>`).join("");
      const lin = c.lineales.map((l) => `<tr>
        <td>${esc(l.nombre)}</td>
        <td class="mono num">${l.cant * n}</td>
        <td class="mono num">${l.largo}</td>
        <td class="small">${l.clase === "perfil" ? "Perfil de fierro" : "Madera dimensionada"}</td>
        <td class="mono num">${(l.metros * n).toFixed(2).replace(".", ",")} m</td>
      </tr>`).join("");

      return `<h3 class="desp-h">${i + 1}. ${esc(m.nombre || MQ.tipo(m.tipo).nombre)}
          <span class="mono">${esc(medidas(m))}${n > 1 ? " · " + n + " un." : ""}</span></h3>
        ${filas ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>
          <th>Pieza</th><th class="num">Cant.</th><th class="num">Largo</th><th class="num">Ancho</th><th>Tablero</th><th>Cantos</th>
        </tr></thead><tbody>${filas}</tbody></table></div>` : ""}
        ${lin ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>
          <th>Madera y perfiles</th><th class="num">Piezas</th><th class="num">Largo</th><th>Tipo</th><th class="num">Total</th>
        </tr></thead><tbody>${lin}</tbody></table></div>` : ""}
        ${c.cubiertaDeMadera ? `<p class="hint">La cubierta se arma con estas piezas: no lleva tablero.</p>` : ""}`;
    }).join("");

    const L = MQ.calc.listaCompra(quote, cat);
    const compra = [
      ...L.tableros.map((t) => [t.nombre, t.planchasEnteras + (t.planchasEnteras === 1 ? " plancha" : " planchas"), t.m2.toFixed(2) + " m²"]),
      ...L.maderas.map((l) => [l.nombre, Math.ceil(l.metros) + " m", l.piezas + (l.piezas === 1 ? " pieza" : " piezas")]),
      ...L.perfiles.map((l) => [l.nombre, Math.ceil(l.metros) + " m", l.piezas + (l.piezas === 1 ? " pieza" : " piezas")]),
      ...L.cantos.map((c) => [c.nombre, Math.ceil(c.ml) + " m", ""]),
      ...L.herrajes.map((h) => [h.nombre, Math.ceil(h.cant) + " " + h.unidad, ""])
    ].map(([a, b, d]) => `<tr><td>${esc(a)}</td><td class="mono num">${esc(b)}</td><td class="small num">${esc(d)}</td></tr>`).join("");

    $("despieceBody").innerHTML = bloques +
      `<h3 class="desp-h">Lista de compra <span class="mono">con ${cat.params.desperdicio}% de desperdicio</span></h3>
       <div class="tbl-wrap"><table class="tbl"><tbody>${compra}</tbody></table></div>
       <p class="hint">Las planchas se calculan por superficie más desperdicio y se redondean hacia arriba: no es un plano de optimización de corte.</p>`;
  }

  /* ================= RESUMEN DE TEXTO ================= */
  function resumenTexto() {
    const cat = S.catalogo, emp = S.empresa;
    const T = MQ.calc.totales(quote, cat, emp);
    const l = [];
    l.push(emp.nombre || "Mueblería");
    l.push("Cotización N° " + (quote.numero || S.nextNumero()) + " · " + fechaCorta(quote.creado));
    if (quote.cliente.nombre) l.push("Cliente: " + quote.cliente.nombre);
    if (quote.cliente.obra) l.push("Obra: " + quote.cliente.obra);
    l.push("");
    T.lineas.forEach((x, i) => {
      const m = x.mueble, d = descripcion(m);
      l.push((i + 1) + ". " + (m.nombre || MQ.tipo(m.tipo).nombre) + " — " + medidas(m));
      if (d) l.push("   " + d);
      l.push("   " + (m.cantidad > 1 ? m.cantidad + " × " + MQ.clp(x.calc.unitario) + " = " : "") + MQ.clp(x.calc.total));
    });
    l.push("");
    l.push("Neto: " + MQ.clp(T.neto));
    if (T.descuento > 0) l.push("Descuento " + T.descPct + "%: -" + MQ.clp(T.descuento));
    l.push("IVA " + T.ivaPct + "%: " + MQ.clp(T.iva));
    l.push("TOTAL: " + MQ.clp(T.total));
    if (quote.notas) { l.push(""); l.push(quote.notas); }
    if (emp.validez) { l.push(""); l.push("Válida por " + emp.validez + " días."); }
    return l.join("\n");
  }

  /* ---------- WhatsApp ----------
     Normaliza un teléfono chileno al formato internacional que pide wa.me.
     Devuelve "" si no parece un número utilizable, y en ese caso WhatsApp
     abre sin destinatario para que elijas el contacto a mano. */
  function telefonoWhats(tel) {
    const d = String(tel || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.startsWith("56")) return d.length >= 11 ? d : "";
    if (d.length === 9 && d.startsWith("9")) return "56" + d;   // celular
    if (d.length === 8) return "569" + d;                       // sin el 9
    if (d.length === 9) return "56" + d;                        // fijo con código
    return d.length >= 10 ? d : "";
  }

  /* ================= HISTORIAL ================= */
  function pintarHistorial() {
    const q = ($("histSearch").value || "").toLowerCase().trim();
    const f = $("histFilter").value;
    const cat = S.catalogo, emp = S.empresa;
    const lista = S.quotes.filter((x) => {
      if (f && x.estado !== f) return false;
      if (!q) return true;
      const c = x.cliente || {};
      return [c.nombre, c.obra, c.rut, "n° " + x.numero, String(x.numero)]
        .filter(Boolean).some((s) => String(s).toLowerCase().includes(q));
    });
    $("histList").innerHTML = lista.length ? lista.map((x) => {
      const T = MQ.calc.totales(x, cat, emp);
      const c = x.cliente || {};
      return `<article class="hcard">
        <div class="hc-no mono">N° ${x.numero || "—"}</div>
        <div class="hc-m">
          <div class="hc-t">${esc(c.nombre || "Sin cliente")}</div>
          <div class="hc-d">${esc([c.obra, (x.muebles || []).length + ((x.muebles || []).length === 1 ? " mueble" : " muebles"), fechaCorta(x.actualizado || x.creado)].filter(Boolean).join(" · "))}</div>
        </div>
        <div class="hc-p mono">${MQ.clp(T.total)}</div>
        <span class="pill" data-estado="${esc(x.estado || "borrador")}">${esc(ESTADOS[x.estado] || "Borrador")}</span>
        <div class="hc-a">
          <button class="btn btn-sm" data-h="open" data-id="${esc(x.id)}">Abrir</button>
          <button class="btn btn-ghost btn-sm" data-h="dup" data-id="${esc(x.id)}">Duplicar</button>
          <button class="btn btn-ghost btn-sm" data-h="del" data-id="${esc(x.id)}">Eliminar</button>
        </div>
      </article>`;
    }).join("") : `<p class="hint">No hay cotizaciones que coincidan.</p>`;
  }

  /* ================= MATERIALES ================= */
  function pintarCatalogo() {
    const cat = S.catalogo;
    const inp = (val, campo, idx, extra) =>
      `<input class="input cell" value="${esc(val)}" data-campo="${campo}" data-i="${idx}" ${extra || ""}>`;

    $("tblTableros").querySelector("tbody").innerHTML = cat.tableros.map((t, i) => `<tr>
      <td>${inp(t.nombre, "nombre", i)}</td>
      <td class="w70">${inp(t.espesor, "espesor", i, 'inputmode="numeric"')}</td>
      <td class="w80">${inp(t.largo, "largo", i, 'inputmode="numeric"')}</td>
      <td class="w80">${inp(t.ancho, "ancho", i, 'inputmode="numeric"')}</td>
      <td class="w110">${inp(t.precio, "precio", i, 'inputmode="numeric"')}</td>
      <td class="mono small num">${MQ.clp(MQ.calc.precioM2(cat, t.id))}</td>
      <td class="w40"><input type="checkbox" class="cell-check" data-macizo="${i}"${t.macizo ? " checked" : ""} aria-label="Canto a la vista, sin tapacanto"></td>
      <td class="w40"><button class="icon" data-del-tab="${i}" title="Quitar tablero" aria-label="Quitar tablero">✕</button></td>
    </tr>`).join("");

    $("tblEscuadrias").querySelector("tbody").innerHTML = (cat.escuadrias || []).map((e, i) => `<tr>
      <td>${inp(e.nombre, "nombre", i)}</td>
      <td class="w70"><div class="unit" data-unit="&quot;">${inp(e.esp, "esp", i, 'inputmode="decimal"')}</div></td>
      <td class="w70"><div class="unit" data-unit="&quot;">${inp(e.anc, "anc", i, 'inputmode="decimal"')}</div></td>
      <td class="w110">${inp(e.precio, "precio", i, 'inputmode="numeric"')}</td>
      <td class="w40"><button class="icon" data-del-esc="${i}" title="Quitar escuadría" aria-label="Quitar escuadría">✕</button></td>
    </tr>`).join("");

    $("tblPerfiles").querySelector("tbody").innerHTML = (cat.perfiles || []).map((p, i) => `<tr>
      <td>${inp(p.nombre, "nombre", i)}</td>
      <td class="w110">${inp(p.precio, "precio", i, 'inputmode="numeric"')}</td>
      <td class="w40"><button class="icon" data-del-per="${i}" title="Quitar perfil" aria-label="Quitar perfil">✕</button></td>
    </tr>`).join("");

    $("tblCantos").querySelector("tbody").innerHTML = cat.cantos.map((c, i) => `<tr>
      <td>${inp(c.nombre, "nombre", i)}</td>
      <td class="w110">${inp(c.precio, "precio", i, 'inputmode="numeric"')}</td>
    </tr>`).join("");

    $("tblHerrajes").querySelector("tbody").innerHTML = Object.keys(cat.herrajes).map((k) => {
      const h = cat.herrajes[k];
      return `<tr><td>${esc(h.nombre)}</td><td class="small">${esc(h.unidad)}</td>
        <td class="w110"><input class="input cell" value="${esc(h.precio)}" data-herraje="${esc(k)}" inputmode="numeric"></td></tr>`;
    }).join("");

    $("tblMano").querySelector("tbody").innerHTML = Object.keys(cat.mano).map((k) => {
      const h = cat.mano[k];
      return `<tr><td>${esc(h.nombre)}</td><td class="small">${esc(h.unidad)}</td>
        <td class="w110"><input class="input cell" value="${esc(h.precio)}" data-mano="${esc(k)}" inputmode="numeric"></td></tr>`;
    }).join("");

    $("pDesperdicio").value = cat.params.desperdicio;
    $("pGastos").value = cat.params.gastos;
    $("pMargen").value = cat.params.margen;
    $("pRedondeo").value = cat.params.redondeo;
  }

  function leerCatalogo() {
    const cat = MQ.clone(S.catalogo);
    const tbody = (id) => $(id).querySelectorAll("tbody .cell");
    tbody("tblTableros").forEach((el) => {
      const i = +el.dataset.i, campo = el.dataset.campo;
      if (!cat.tableros[i]) return;
      cat.tableros[i][campo] = campo === "nombre" ? el.value.trim() : Math.max(0, MQ.num(el.value, 0));
    });
    tbody("tblCantos").forEach((el) => {
      const i = +el.dataset.i, campo = el.dataset.campo;
      if (!cat.cantos[i]) return;
      cat.cantos[i][campo] = campo === "nombre" ? el.value.trim() : Math.max(0, MQ.num(el.value, 0));
    });
    tbody("tblEscuadrias").forEach((el) => {
      const i = +el.dataset.i, campo = el.dataset.campo;
      if (!cat.escuadrias[i]) return;
      cat.escuadrias[i][campo] = campo === "nombre" ? el.value.trim() : Math.max(0, MQ.num(el.value, 0));
    });
    tbody("tblPerfiles").forEach((el) => {
      const i = +el.dataset.i, campo = el.dataset.campo;
      if (!cat.perfiles[i]) return;
      cat.perfiles[i][campo] = campo === "nombre" ? el.value.trim() : Math.max(0, MQ.num(el.value, 0));
    });
    $("tblTableros").querySelectorAll("[data-macizo]").forEach((el) => {
      const t = cat.tableros[+el.dataset.macizo];
      if (t) t.macizo = el.checked;
    });
    $("tblHerrajes").querySelectorAll("[data-herraje]").forEach((el) => {
      cat.herrajes[el.dataset.herraje].precio = Math.max(0, MQ.num(el.value, 0));
    });
    $("tblMano").querySelectorAll("[data-mano]").forEach((el) => {
      cat.mano[el.dataset.mano].precio = Math.max(0, MQ.num(el.value, 0));
    });
    cat.params = {
      desperdicio: Math.max(0, MQ.num($("pDesperdicio").value, 0)),
      gastos: Math.max(0, MQ.num($("pGastos").value, 0)),
      margen: Math.max(0, MQ.num($("pMargen").value, 0)),
      redondeo: Math.max(1, MQ.num($("pRedondeo").value, 1))
    };
    cat.tableros = cat.tableros.filter((t) => t.nombre);
    /* una escuadría se identifica por sus pulgadas, el nombre es opcional */
    cat.escuadrias = cat.escuadrias.filter((e) => e.anc > 0 && e.esp > 0);
    cat.perfiles = cat.perfiles.filter((p) => p.nombre);
    return cat;
  }

  /* ================= EMPRESA ================= */
  /* El logo se guarda al elegirlo, sin esperar al botón del formulario:
     así el recuadro de arriba muestra siempre lo que quedó guardado. */
  function pintarLogo() {
    const src = S.empresa.logo;
    $("eLogoPrev").innerHTML = src ? `<img src="${esc(src)}" alt="Logo de la empresa">` : "";
    $("eLogoDel").hidden = !src;
  }

  function pintarEmpresa() {
    const e = S.empresa;
    pintarLogo();
    $("eNombre").value = e.nombre || ""; $("eRut").value = e.rut || "";
    $("eTelefono").value = e.telefono || ""; $("eEmail").value = e.email || "";
    $("eDireccion").value = e.direccion || ""; $("eIva").value = e.iva;
    $("eValidez").value = e.validez; $("eCondiciones").value = e.condiciones || "";
  }

  /* ================= NAVEGACIÓN ================= */
  function verVista(v) {
    document.querySelectorAll(".view").forEach((el) => { el.hidden = el.id !== "view-" + v; });
    document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
    if (v === "croquis") volcarCroquis();
    if (v === "historial") pintarHistorial();
    if (v === "materiales") pintarCatalogo();
    if (v === "empresa") pintarEmpresa();
    $("mobileBar").hidden = v !== "cotizar" || !quote.muebles.length;
    window.scrollTo({ top: 0 });
  }

  /* ================= EVENTOS ================= */
  function conectar() {
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => verVista(b.dataset.view)));

    $("tipos").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-tipo]");
      if (b) elegirTipo(b.dataset.tipo);
    });

    ["fNombre", "fAncho", "fAlto", "fProf", "fPuertas", "fCajones", "fEntrepanos",
     "fCajonCol", "fTrasera", "fZocalo", "fCubierta", "fBarra", "fInstalar", "fCantidad",
     "fMatCuerpo", "fMatFrente", "fMatTrasera", "fMatCajon", "fMatCubierta"].forEach((id) => {
      $(id).addEventListener("input", refrescarConfig);
      $(id).addEventListener("change", refrescarConfig);
    });

    /* madera y perfiles del mueble */
    document.querySelectorAll("[data-add-lineal]").forEach((b) =>
      b.addEventListener("click", () => agregarLineal(b.dataset.addLineal)));
    $("lineales").addEventListener("input", refrescarConfig);
    $("lineales").addEventListener("change", refrescarConfig);
    $("lineales").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-del-lineal]");
      if (!b) return;
      leerLineales();
      actual.lineales.splice(+b.dataset.delLineal, 1);
      pintarLineales(); pintarConfigurador();
    });

    $("qtyMinus").addEventListener("click", () => { $("fCantidad").value = Math.max(1, MQ.num($("fCantidad").value, 1) - 1); refrescarConfig(); });
    $("qtyPlus").addEventListener("click", () => { $("fCantidad").value = Math.min(99, MQ.num($("fCantidad").value, 1) + 1); refrescarConfig(); });

    $("addItem").addEventListener("click", () => {
      leerFormulario();
      const m = MQ.clone(actual);
      if (editando) {
        const i = quote.muebles.findIndex((x) => x.id === editando);
        if (i >= 0) quote.muebles[i] = m;
        editando = null;
        MQ.toast("Mueble actualizado");
      } else {
        m.id = MQ.uid();
        quote.muebles.push(m);
        MQ.toast("Mueble agregado a la cotización");
      }
      actual = MQ.nuevoMueble(m.tipo);
      pintarTipos(); volcarFormulario(); pintarConfigurador(); pintarHoja();
    });

    $("cancelEdit").addEventListener("click", () => {
      editando = null;
      actual = MQ.nuevoMueble(actual.tipo);
      pintarTipos(); volcarFormulario(); pintarConfigurador(); pintarHoja();
    });

    $("items").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-act]");
      if (!b) return;
      const i = +b.dataset.i, m = quote.muebles[i];
      if (!m) return;
      if (b.dataset.act === "del") {
        quote.muebles.splice(i, 1);
        if (editando === m.id) editando = null;
      } else if (b.dataset.act === "dup") {
        const copia = MQ.clone(m); copia.id = MQ.uid();
        quote.muebles.splice(i + 1, 0, copia);
      } else {
        actual = MQ.clone(m);
        editando = m.id;
        pintarTipos(); volcarFormulario(); pintarConfigurador();
        document.querySelector(".panel").scrollIntoView({ behavior: "smooth", block: "start" });
      }
      pintarConfigurador(); pintarHoja();
    });

    $("clientEdit").addEventListener("click", () => {
      const f = $("clientForm");
      f.hidden = !f.hidden;
      $("clientEdit").setAttribute("aria-expanded", String(!f.hidden));
    });

    ["cNombre", "cRut", "cTelefono", "cEmail", "cObra", "qDescuento", "qNotas", "qEstado"].forEach((id) => {
      $(id).addEventListener("input", () => { leerHoja(); pintarHoja(); });
      $(id).addEventListener("change", () => { leerHoja(); pintarHoja(); });
    });

    $("btnSave").addEventListener("click", () => {
      leerHoja();
      if (!quote.muebles.length) return MQ.toast("Agrega al menos un mueble antes de guardar.");
      quote = S.saveQuote(quote);
      pintarHoja();
      MQ.toast("Cotización N° " + quote.numero + " guardada");
    });

    $("btnNew").addEventListener("click", () => {
      if (quote.muebles.length && !confirm("¿Empezar una cotización nueva? Lo que no hayas guardado se pierde.")) return;
      quote = nuevaCotizacion(); editando = null;
      volcarHoja(); pintarHoja();
      MQ.toast("Cotización nueva");
    });

    $("btnPdf").addEventListener("click", async () => {
      leerHoja();
      if (!quote.muebles.length) return MQ.toast("Agrega al menos un mueble.");
      if (!quote.numero) quote.numero = S.nextNumero();
      try { await MQ.pdf.descargarCotizacion(quote, S.catalogo, S.empresa); }
      catch (e) { MQ.toast("No se pudo generar el PDF."); console.warn(e); }
    });

    $("btnDespiece").addEventListener("click", () => { pintarDespiece(); $("despieceDlg").showModal(); });
    $("despClose").addEventListener("click", () => $("despieceDlg").close());
    $("despPdf").addEventListener("click", async () => {
      if (!quote.muebles.length) return MQ.toast("Agrega al menos un mueble.");
      if (!quote.numero) quote.numero = S.nextNumero();
      try { await MQ.pdf.descargarDespiece(quote, S.catalogo, S.empresa); }
      catch (e) { MQ.toast("No se pudo generar el PDF."); console.warn(e); }
    });

    $("btnShare").addEventListener("click", async () => {
      leerHoja();
      if (!quote.muebles.length) return MQ.toast("Agrega al menos un mueble.");
      const txt = resumenTexto();
      try {
        await navigator.clipboard.writeText(txt);
        MQ.toast("Resumen copiado al portapapeles");
      } catch (e) {
        $("shareText").value = txt;
        $("shareDlg").showModal();
      }
    });
    $("shareClose").addEventListener("click", () => $("shareDlg").close());

    /* Enviar por WhatsApp.
       En el celular el PDF se entrega a la hoja de compartir del sistema y
       llega adjunto. En el navegador de escritorio esa API no acepta
       archivos, así que se descarga el PDF y se abre el chat con el texto
       para adjuntarlo a mano. */
    function abrirChat(texto) {
      const tel = telefonoWhats(quote.cliente.telefono);
      const t = encodeURIComponent(texto);
      window.open(tel ? `https://wa.me/${tel}?text=${t}` : `https://wa.me/?text=${t}`, "_blank", "noopener");
      return tel;
    }

    $("btnWhats").addEventListener("click", async () => {
      leerHoja();
      if (!quote.muebles.length) return MQ.toast("Agrega al menos un mueble.");
      if (!quote.numero) quote.numero = S.nextNumero();
      const texto = resumenTexto();

      let archivo = null;
      try {
        const pdf = await MQ.pdf.archivoCotizacion(quote, S.catalogo, S.empresa);
        archivo = { pdf, file: new File([pdf.blob], pdf.nombre, { type: "application/pdf" }) };
      } catch (e) {
        console.warn("pdf", e);
      }

      if (archivo && navigator.canShare && navigator.canShare({ files: [archivo.file] })) {
        try {
          await navigator.share({ files: [archivo.file], text: texto });
          return MQ.toast("Elige WhatsApp para enviar la cotización con el PDF.");
        } catch (e) {
          /* el usuario canceló: no hay nada que avisar ni que reintentar */
          if (e && e.name === "AbortError") return;
          console.warn("share", e);
        }
      }

      if (archivo) archivo.pdf.guardar();
      const tel = abrirChat(texto);
      MQ.toast(archivo
        ? "PDF descargado. Adjúntalo en el chat con el clip."
        : tel ? "WhatsApp abierto con el resumen." : "Elige el contacto en WhatsApp.");
    });

    $("mbGo").addEventListener("click", () => document.querySelector(".quote-col").scrollIntoView({ behavior: "smooth" }));

    /* croquis */
    croquis = MQ.croquis.montar($("crLienzo"), () => quote.croquis, () => S.saveDraft(quote));
    const AYUDA = {
      sel: "Haz clic en un trazo para seleccionarlo y arrástralo para moverlo. Doble clic edita el texto de una cota o de un rótulo.",
      linea: "Arrastra para dibujar la línea.",
      rect: "Arrastra para dibujar el rectángulo.",
      rombo: "Arrastra para dibujar el rombo dentro de ese recuadro.",
      poli: "Un clic por cada punto. Doble clic termina la figura; vuelve al primer punto para cerrarla.",
      texto: "Haz clic donde quieras poner el rótulo.",
      cota: "Arrastra de un extremo al otro. La medida se calcula sola, y con doble clic puedes escribirla tú."
    };
    document.querySelectorAll(".tool").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(".tool").forEach((x) => x.classList.toggle("on", x === b));
      croquis.herramienta(b.dataset.tool);
      $("crAyuda").textContent = AYUDA[b.dataset.tool] || "";
    }));
    $("crAyuda").textContent = AYUDA.sel;
    $("crEdit").addEventListener("click", () => {
      if (!croquis.editarSeleccion()) MQ.toast("Selecciona una cota o un rótulo para editar su texto.");
    });
    $("crEscala").addEventListener("input", () => {
      quote.croquis.escala = Math.max(1, Math.round(MQ.num($("crEscala").value, 100)));
      croquis.pintar(); S.saveDraft(quote);
    });
    $("crSnap").addEventListener("change", () => croquis.ajuste($("crSnap").checked));
    $("crUndo").addEventListener("click", () => { if (!croquis.deshacer()) MQ.toast("No hay nada que deshacer."); });
    $("crDel").addEventListener("click", () => { if (!croquis.borrar()) MQ.toast("Selecciona algo del croquis para borrarlo."); });
    $("crClear").addEventListener("click", () => {
      if (MQ.croquis.vacio(quote.croquis)) return MQ.toast("El croquis ya está vacío.");
      if (confirm("¿Borrar todo el croquis? Se puede deshacer una vez.")) croquis.limpiar();
    });
    document.addEventListener("keydown", (ev) => {
      if ($("view-croquis").hidden) return;
      const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName);
      if (!enCampo && (ev.key === "Enter" || ev.key === "Escape") && croquis.enCadena()) { ev.preventDefault(); croquis.cerrarCadena(); }
      if (!enCampo && (ev.key === "Delete" || ev.key === "Backspace")) { ev.preventDefault(); croquis.borrar(); }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") { ev.preventDefault(); croquis.deshacer(); }
    });

    /* historial */
    $("histSearch").addEventListener("input", pintarHistorial);
    $("histFilter").addEventListener("change", pintarHistorial);
    $("histList").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-h]");
      if (!b) return;
      const x = S.quotes.find((q) => q.id === b.dataset.id);
      if (!x) return;
      if (b.dataset.h === "open") {
        quote = MQ.clone(x); editando = null;
        volcarHoja(); pintarHoja(); verVista("cotizar");
        MQ.toast("Cotización N° " + quote.numero + " abierta");
      } else if (b.dataset.h === "dup") {
        quote = MQ.clone(x);
        quote.id = MQ.uid(); quote.numero = 0; quote.estado = "borrador";
        quote.creado = new Date().toISOString();
        delete quote.actualizado;
        quote.muebles = (quote.muebles || []).map((m) => Object.assign(MQ.clone(m), { id: MQ.uid() }));
        editando = null;
        volcarHoja(); pintarHoja(); verVista("cotizar");
        MQ.toast("Copia lista para editar");
      } else if (b.dataset.h === "del") {
        if (!confirm("¿Eliminar la cotización N° " + (x.numero || "—") + "?")) return;
        S.deleteQuote(x.id);
        pintarHistorial();
        MQ.toast("Cotización eliminada");
      }
    });

    /* materiales */
    $("tblTableros").addEventListener("input", () => {
      /* el $/m² se recalcula al tipear */
      S.catalogo = leerCatalogo();
      $("tblTableros").querySelectorAll("tbody tr").forEach((tr, i) => {
        const t = S.catalogo.tableros[i];
        const celda = tr.querySelector("td.mono");
        if (t && celda) celda.textContent = MQ.clp(MQ.calc.precioM2(S.catalogo, t.id));
      });
    });
    $("tblTableros").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-del-tab]");
      if (!b) return;
      const cat = leerCatalogo();
      if (cat.tableros.length <= 1) return MQ.toast("Debe quedar al menos un tablero.");
      cat.tableros.splice(+b.dataset.delTab, 1);
      S.catalogo = cat; pintarCatalogo();
    });
    $("addTablero").addEventListener("click", () => {
      const cat = leerCatalogo();
      cat.tableros.push({ id: "t" + MQ.uid(), nombre: "Tablero nuevo", espesor: 18, largo: 2500, ancho: 1830, precio: 0 });
      S.catalogo = cat; pintarCatalogo();
    });

    /* madera dimensionada y perfiles */
    $("tblEscuadrias").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-del-esc]");
      if (!b) return;
      const cat = leerCatalogo();
      cat.escuadrias.splice(+b.dataset.delEsc, 1);
      S.catalogo = cat; pintarCatalogo();
    });
    $("addEscuadria").addEventListener("click", () => {
      const cat = leerCatalogo();
      cat.escuadrias.push({ id: "e" + MQ.uid(), nombre: "", esp: 2, anc: 4, precio: 0 });
      S.catalogo = cat; pintarCatalogo();
    });
    $("tblPerfiles").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-del-per]");
      if (!b) return;
      const cat = leerCatalogo();
      cat.perfiles.splice(+b.dataset.delPer, 1);
      S.catalogo = cat; pintarCatalogo();
    });
    $("addPerfil").addEventListener("click", () => {
      const cat = leerCatalogo();
      cat.perfiles.push({ id: "p" + MQ.uid(), nombre: "Perfil nuevo", precio: 0 });
      S.catalogo = cat; pintarCatalogo();
    });
    $("catSave").addEventListener("click", () => {
      S.saveCatalogo(leerCatalogo());
      pintarCatalogo();
      MQ.toast("Materiales y precios guardados");
    });
    $("catReset").addEventListener("click", () => {
      if (!confirm("¿Volver a los precios de referencia? Se pierden tus valores.")) return;
      S.resetCatalogo(); pintarCatalogo();
      MQ.toast("Valores de referencia restaurados");
    });

    /* logo */
    $("eLogoFile").addEventListener("change", async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = "";   // para poder volver a elegir el mismo archivo
      if (!file) return;
      try {
        const logo = await MQ.procesarLogo(file);
        S.saveEmpresa(Object.assign(MQ.clone(S.empresa), { logo }));
        pintarLogo();
        MQ.toast("Logo guardado");
      } catch (e) {
        MQ.toast((e && e.message) || "No se pudo usar esa imagen.");
      }
    });
    $("eLogoDel").addEventListener("click", () => {
      if (!confirm("¿Quitar el logo de la empresa?")) return;
      S.saveEmpresa(Object.assign(MQ.clone(S.empresa), { logo: "" }));
      pintarLogo();
      MQ.toast("Logo quitado");
    });

    /* empresa */
    $("empresaForm").addEventListener("submit", (ev) => {
      ev.preventDefault();
      S.saveEmpresa({
        logo: S.empresa.logo,   // el formulario no lo trae: se guarda aparte
        nombre: $("eNombre").value.trim(), rut: $("eRut").value.trim(),
        telefono: $("eTelefono").value.trim(), email: $("eEmail").value.trim(),
        direccion: $("eDireccion").value.trim(),
        iva: Math.max(0, MQ.num($("eIva").value, 19)),
        validez: Math.max(0, Math.round(MQ.num($("eValidez").value, 15))),
        condiciones: $("eCondiciones").value
      });
      MQ.toast("Datos de la empresa guardados");
    });

    S.on((kind) => {
      if (kind === "catalogo") {
        /* los materiales de un mueble pueden haber desaparecido del catálogo */
        const ids = S.catalogo.tableros.map((t) => t.id);
        Object.keys(actual.mat).forEach((k) => { if (ids.indexOf(actual.mat[k]) < 0) actual.mat[k] = ids[0]; });
        pintarSelectsMaterial(); pintarConfigurador();
      }
      if (kind === "catalogo" || kind === "empresa") pintarHoja();
    });
  }

  /* ================= ARRANQUE ================= */
  function iniciar() {
    quote = S.loadDraft() || nuevaCotizacion();
    if (!quote.muebles) quote.muebles = [];
    if (!quote.cliente) quote.cliente = {};
    actual = MQ.nuevoMueble("base");
    pintarTipos(); volcarFormulario();
    volcarHoja();
    conectar();
    volcarCroquis();
    pintarConfigurador(); pintarHoja();
    verVista("cotizar");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
