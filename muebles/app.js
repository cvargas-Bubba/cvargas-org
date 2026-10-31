/* Interfaz: partidas con su croquis y sus materiales, hoja de cotización,
   catálogo, historial y datos de la empresa. */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const S = MQ.store;

  let quote = null;
  let partidaId = null;   // partida que se está editando
  let vistaId = null;     // vista del croquis en pantalla
  let croquis = null;     // editor

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
      partidas: [], descuento: 0, notas: ""
    };
  }

  /* ---------- partida y vista en edición ---------- */
  const partida = () => (quote.partidas || []).find((p) => p.id === partidaId) || null;
  function vista() {
    const p = partida();
    if (!p) return null;
    return p.croquis.vistas.find((v) => v.id === vistaId) || p.croquis.vistas[0];
  }
  const guardarBorrador = () => S.saveDraft(quote);

  /* ================= CROQUIS ================= */
  /* solo los materiales que se compran por metro pueden salir del dibujo:
     en los demás la figura no dice cuánto hace falta */
  const itemsLineales = () => (S.catalogo.items || []).filter((i) => MQ.calc.esLineal(i));

  function pintarVistas() {
    const p = partida();
    if (!p) return;
    const v = vista();
    $("crVistas").innerHTML = p.croquis.vistas.map((x) => `
      <button type="button" class="vtab${x.id === v.id ? " on" : ""}" data-vista="${esc(x.id)}">
        ${esc(x.nombre)}${p.croquis.vistas.length > 1 ? `<span class="vtab-x" data-del-vista="${esc(x.id)}" title="Quitar vista">✕</span>` : ""}
      </button>`).join("");
  }

  function pintarBarraMaterial() {
    if (!croquis) return;
    const o = croquis.seleccionado();
    $("crMatBar").hidden = !o;
    if (!o) return;
    const lista = itemsLineales();
    $("crMat").innerHTML = `<option value="">Sin material</option>` + lista.map((i) =>
      `<option value="${esc(i.id)}"${i.id === o.mat ? " selected" : ""}>${esc(MQ.nombreItem(i))}</option>`).join("");
    $("crPiezas").value = MQ.croquis.piezasDe(o);

    const p = partida();
    const mm = MQ.croquis.mmPorUnidad(p.croquis);
    const largo = Math.round(MQ.croquis.largoMm(o, mm));
    const it = o.mat && MQ.calc.item(S.catalogo, o.mat);
    const pz = MQ.croquis.piezasDe(o);
    $("crMatCalc").textContent = it
      ? largo + " mm × " + pz + " = " + MQ.dec(largo / 1000 * pz, 2) + " m · " + MQ.clp(largo / 1000 * pz * it.precio)
      : largo + " mm";
  }

  const AYUDA = {
    sel: "Haz clic en un trazo para seleccionarlo y arrástralo. Doble clic edita el texto de una cota o un rótulo. Con uno seleccionado puedes asignarle material.",
    lapiz: "Dibuja arrastrando, como con un lápiz. No se ajusta a la grilla.",
    linea: "Arrastra para dibujar la línea.",
    rect: "Arrastra para dibujar el rectángulo.",
    rombo: "Arrastra para dibujar el rombo dentro de ese recuadro.",
    poli: "Un clic por cada punto. Doble clic termina; vuelve al primer punto para cerrar.",
    texto: "Haz clic donde quieras el rótulo.",
    cota: "Arrastra de un extremo al otro. La medida se calcula sola, y con doble clic la escribes tú."
  };

  function montarCroquis() {
    croquis = MQ.croquis.montar(
      $("crLienzo"),
      () => ({ croquis: partida().croquis, vista: vista() }),
      () => { guardarBorrador(); pintarBarraMaterial(); pintarLineas(); pintarHoja(); },
      (id) => MQ.nombreCorto(MQ.calc.item(S.catalogo, id))
    );
  }

  /* ================= MATERIALES DE LA PARTIDA ================= */
  function opcionesItem(sel) {
    return MQ.CATEGORIAS.map((c) => {
      const its = (S.catalogo.items || []).filter((i) => i.cat === c.id);
      if (!its.length) return "";
      return `<optgroup label="${esc(c.nombre)}">` + its.map((i) =>
        `<option value="${esc(i.id)}"${i.id === sel ? " selected" : ""}>${esc(MQ.nombreItem(i))}</option>`).join("") + `</optgroup>`;
    }).join("");
  }

  function pintarLineas() {
    const p = partida();
    if (!p) return;
    const c = MQ.calc.costear(p, S.catalogo);
    const delCroquis = c.lineas.filter((l) => l.origen === "croquis");
    const aMano = c.lineas.filter((l) => l.origen !== "croquis");

    $("lineasCroquis").innerHTML = delCroquis.length ? delCroquis.map((l) => `
      <div class="lin lin-ro">
        <span class="lin-n">${esc(l.nombre)}<span class="lin-v">${esc(l.vista)}</span></span>
        <span class="lin-d mono">${l.largo} mm × ${l.piezas}</span>
        <span class="lin-c mono">${esc(MQ.calc.conUnidad(l.cant, l.unidad))}</span>
        <span class="lin-t mono">${MQ.clp(l.total)}</span>
      </div>`).join("") : `<p class="hint lin-vacio">Asigna material a las figuras del croquis y aparecen acá con su largo.</p>`;

    $("croquisResumen").textContent = delCroquis.length
      ? delCroquis.length + (delCroquis.length === 1 ? " pieza" : " piezas") + " · " + MQ.clp(delCroquis.reduce((s, l) => s + l.total, 0))
      : "";

    $("lineas").innerHTML = (p.lineas || []).map((l, i) => {
      const it = MQ.calc.item(S.catalogo, l.itemId);
      const lineal = MQ.calc.esLineal(it);
      const calc = aMano.find((x) => x.id === l.id);
      return `<div class="lin">
        <select class="select" data-campo="itemId" data-i="${i}" aria-label="Material">${opcionesItem(l.itemId)}</select>
        ${lineal
          ? `<div class="unit" data-unit="mm"><input class="input" data-campo="largo" data-i="${i}" inputmode="numeric" value="${esc(l.largo)}" aria-label="Largo"></div>
             <div class="unit" data-unit="pzas"><input class="input" data-campo="piezas" data-i="${i}" inputmode="numeric" value="${esc(l.piezas)}" aria-label="Piezas"></div>`
          : `<div class="unit" data-unit="${esc(it ? (MQ.UNIDADES[it.unidad] || {}).nombre || "" : "")}"><input class="input" data-campo="cant" data-i="${i}" inputmode="decimal" value="${esc(l.cant)}" aria-label="Cantidad"></div>
             <span></span>`}
        <span class="lin-t mono">${calc ? MQ.clp(calc.total) : "$0"}</span>
        <button class="icon" data-del-linea="${i}" title="Quitar" aria-label="Quitar material">✕</button>
      </div>`;
    }).join("") || `<p class="hint lin-vacio">Tornillos, cola, barniz, horas de taller: lo que no se dibuja va acá.</p>`;

    $("partidaPrecio").textContent = MQ.clp(c.unitario);
    $("partidaDesglose").innerHTML = c.porCategoria.map((x) =>
      `<span>${esc(x.nombre)} <b class="mono">${MQ.clp(x.total)}</b></span>`).join("") +
      (c.costos.gastos + c.costos.margen > 0 ? `<span>Gastos y margen <b class="mono">${MQ.clp(c.costos.gastos + c.costos.margen)}</b></span>` : "");
  }

  function leerLineas() {
    const p = partida();
    if (!p) return;
    $("lineas").querySelectorAll("[data-campo]").forEach((el) => {
      const l = p.lineas[+el.dataset.i];
      if (!l) return;
      const campo = el.dataset.campo;
      if (campo === "itemId") l.itemId = el.value;
      else if (campo === "largo") l.largo = Math.min(12000, Math.max(0, Math.round(MQ.num(el.value, 0))));
      else if (campo === "piezas") l.piezas = Math.min(999, Math.max(0, Math.round(MQ.num(el.value, 0))));
      else l.cant = Math.max(0, MQ.num(el.value, 0));
    });
  }

  /* ================= EDITOR DE LA PARTIDA ================= */
  function pintarPartida() {
    const p = partida();
    $("partidaEditor").hidden = !p;
    $("partidaVacia").hidden = !!p;
    $("pPlantilla").hidden = !p;
    $("pBorrar").hidden = !p;
    if (!p) { $("partidaTitulo").textContent = "Partida"; return; }

    $("partidaTitulo").textContent = p.nombre || "Partida sin nombre";
    $("pNombre").value = p.nombre || "";
    $("pDescripcion").value = p.descripcion || "";
    $("pCantidad").value = Math.max(1, p.cantidad || 1);
    $("crEscala").value = p.croquis.escala;
    $("crAcotar").checked = p.croquis.acotar !== false;

    if (!vista() || vistaId !== vista().id) vistaId = p.croquis.vistas[0].id;
    pintarVistas();
    if (croquis) croquis.reiniciar();
    pintarBarraMaterial();
    pintarLineas();
  }

  function seleccionarPartida(id) {
    partidaId = id;
    vistaId = null;
    pintarPartida();
    pintarHoja();
  }

  /* ================= HOJA DE COTIZACIÓN ================= */
  function pintarHoja() {
    const cat = S.catalogo, emp = S.empresa;
    const T = MQ.calc.totales(quote, cat, emp);

    $("brandName").textContent = emp.nombre || "Cotizador";
    $("sheetCompany").innerHTML =
      (emp.logo ? `<img class="sheet-logo" src="${esc(emp.logo)}" alt="${esc(emp.nombre || "Logo")}">` : "") +
      (emp.logo && emp.logoConNombre ? "" : `<div class="sc-n">${esc(emp.nombre || "Mi taller")}</div>`) +
      `<div class="sc-d">${esc([emp.rut && "RUT " + emp.rut, emp.telefono, emp.email].filter(Boolean).join(" · "))}</div>`;
    $("quoteNo").textContent = "N° " + (quote.numero || S.nextNumero());
    $("quoteDate").textContent = fechaCorta(quote.creado);

    const c = quote.cliente;
    $("clientSum").innerHTML = c.nombre
      ? `<strong>${esc(c.nombre)}</strong>${c.obra ? " · " + esc(c.obra) : ""}`
      : `<span class="muted">Sin datos del cliente</span>`;

    $("partidas").innerHTML = T.partidas.length ? T.partidas.map((x, i) => {
      const p = x.partida;
      const dib = MQ.croquis.conDibujo(p.croquis).length;
      return `<li class="item${p.id === partidaId ? " editing" : ""}" data-p="${esc(p.id)}">
        <div class="it-n">
          <div class="it-t">${esc(p.nombre || "Partida " + (i + 1))}</div>
          ${p.descripcion ? `<div class="it-d">${esc(p.descripcion)}</div>` : ""}
          <div class="it-d mono">${x.calc.lineas.length} materiales${dib ? " · " + dib + (dib === 1 ? " vista" : " vistas") : ""}</div>
        </div>
        <div class="it-q mono">${x.calc.cantidad > 1 ? x.calc.cantidad + " × " + MQ.clp(x.calc.unitario) : ""}</div>
        <div class="it-p mono">${MQ.clp(x.calc.total)}</div>
        <div class="it-a">
          <button class="icon" data-act="dup" data-p="${esc(p.id)}" title="Duplicar" aria-label="Duplicar">⧉</button>
          <button class="icon" data-act="del" data-p="${esc(p.id)}" title="Quitar" aria-label="Quitar">✕</button>
        </div>
      </li>`;
    }).join("") : `<li class="empty">Todavía no hay partidas.</li>`;

    const fila = (k, v, cls) => `<div class="${cls || ""}"><span>${esc(k)}</span><b class="mono">${esc(v)}</b></div>`;
    $("totales").innerHTML =
      fila("Neto", MQ.clp(T.neto)) +
      (T.descuento > 0 ? fila("Descuento " + T.descPct + "%", "− " + MQ.clp(T.descuento)) : "") +
      fila("IVA " + T.ivaPct + "%", MQ.clp(T.iva)) +
      fila("Total", MQ.clp(T.total), "grand");

    guardarBorrador();
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

  function volcarHoja() {
    const c = quote.cliente || {};
    $("cNombre").value = c.nombre || ""; $("cRut").value = c.rut || "";
    $("cTelefono").value = c.telefono || ""; $("cEmail").value = c.email || "";
    $("cObra").value = c.obra || "";
    $("qDescuento").value = quote.descuento || 0;
    $("qNotas").value = quote.notas || "";
    $("qEstado").value = quote.estado || "borrador";
  }

  /* ================= RESUMEN DE TEXTO ================= */
  function resumenTexto() {
    const cat = S.catalogo, emp = S.empresa;
    const T = MQ.calc.totales(quote, cat, emp);
    const l = [];
    l.push(emp.nombre || "Taller");
    l.push("Cotización N° " + (quote.numero || S.nextNumero()) + " · " + fechaCorta(quote.creado));
    if (quote.cliente.nombre) l.push("Cliente: " + quote.cliente.nombre);
    if (quote.cliente.obra) l.push("Obra: " + quote.cliente.obra);
    l.push("");
    T.partidas.forEach((x, i) => {
      l.push((i + 1) + ". " + (x.partida.nombre || "Partida"));
      if (x.partida.descripcion) l.push("   " + x.partida.descripcion);
      l.push("   " + (x.calc.cantidad > 1 ? x.calc.cantidad + " × " + MQ.clp(x.calc.unitario) + " = " : "") + MQ.clp(x.calc.total));
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

  /* Normaliza un teléfono chileno al formato internacional que pide wa.me. */
  function telefonoWhats(tel) {
    const d = String(tel || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.startsWith("56")) return d.length >= 11 ? d : "";
    if (d.length === 9 && d.startsWith("9")) return "56" + d;
    if (d.length === 8) return "569" + d;
    if (d.length === 9) return "56" + d;
    return d.length >= 10 ? d : "";
  }

  /* ================= HISTORIAL ================= */
  function pintarHistorial() {
    const q = ($("histSearch").value || "").toLowerCase().trim();
    const f = $("histFilter").value;
    const lista = S.quotes.filter((x) => {
      if (f && x.estado !== f) return false;
      if (!q) return true;
      const c = x.cliente || {};
      return [c.nombre, c.obra, c.rut, String(x.numero)].filter(Boolean).some((s) => String(s).toLowerCase().includes(q));
    });
    $("histList").innerHTML = lista.length ? lista.map((x) => {
      const T = MQ.calc.totales(x, S.catalogo, S.empresa);
      const c = x.cliente || {};
      const n = (x.partidas || []).length;
      return `<article class="hcard">
        <div class="hc-no mono">N° ${x.numero || "—"}</div>
        <div class="hc-m">
          <div class="hc-t">${esc(c.nombre || "Sin cliente")}</div>
          <div class="hc-d">${esc([c.obra, n + (n === 1 ? " partida" : " partidas"), fechaCorta(x.actualizado || x.creado)].filter(Boolean).join(" · "))}</div>
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

  /* ================= CATÁLOGO ================= */
  function pintarCatalogo() {
    const cat = S.catalogo;
    const inp = (val, campo, i, extra) =>
      `<input class="input cell" value="${esc(val)}" data-campo="${campo}" data-i="${i}" ${extra || ""}>`;

    $("tblItems").querySelector("tbody").innerHTML = (cat.items || []).map((it, i) => {
      const esMadera = MQ.categoria(it.cat).escuadria;
      return `<tr>
        <td class="w140"><select class="select cell" data-campo="cat" data-i="${i}">${MQ.CATEGORIAS.map((c) =>
          `<option value="${c.id}"${c.id === it.cat ? " selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select></td>
        <td>${inp(it.nombre, "nombre", i)}</td>
        <td class="w70">${esMadera ? inp(it.esp == null ? "" : it.esp, "esp", i, 'inputmode="decimal"') : ""}</td>
        <td class="w70">${esMadera ? inp(it.anc == null ? "" : it.anc, "anc", i, 'inputmode="decimal"') : ""}</td>
        <td class="w110"><select class="select cell" data-campo="unidad" data-i="${i}">${Object.keys(MQ.UNIDADES).map((u) =>
          `<option value="${u}"${u === it.unidad ? " selected" : ""}>${esc(MQ.UNIDADES[u].largo)}</option>`).join("")}</select></td>
        <td class="w110">${inp(it.precio, "precio", i, 'inputmode="numeric"')}</td>
        <td class="w40"><button class="icon" data-del-item="${i}" title="Quitar" aria-label="Quitar ítem">✕</button></td>
      </tr>`;
    }).join("");

    $("pGastos").value = cat.params.gastos;
    $("pMargen").value = cat.params.margen;
    $("pRedondeo").value = cat.params.redondeo;
    pintarPlantillas();
  }

  function leerCatalogo() {
    const cat = MQ.clone(S.catalogo);
    $("tblItems").querySelectorAll("tbody .cell").forEach((el) => {
      const it = cat.items[+el.dataset.i];
      if (!it) return;
      const campo = el.dataset.campo;
      if (campo === "nombre") it.nombre = el.value.trim();
      else if (campo === "cat" || campo === "unidad") it[campo] = el.value;
      else it[campo] = Math.max(0, MQ.num(el.value, 0));
    });
    cat.params = {
      gastos: Math.max(0, MQ.num($("pGastos").value, 0)),
      margen: Math.max(0, MQ.num($("pMargen").value, 0)),
      redondeo: Math.max(1, MQ.num($("pRedondeo").value, 1))
    };
    cat.items = cat.items.filter((it) => it.nombre);
    return cat;
  }

  function pintarPlantillas() {
    $("listaPlantillas").innerHTML = S.plantillas.length ? S.plantillas.map((t) => `
      <div class="plt">
        <span class="plt-n">${esc(t.nombre || "Sin nombre")}</span>
        <span class="plt-d">${(t.lineas || []).length} materiales · ${MQ.croquis.conDibujo(t.croquis).length} vistas</span>
        <button class="btn btn-ghost btn-sm" data-del-plt="${esc(t.id)}">Quitar</button>
      </div>`).join("") : `<p class="hint">Todavía no hay plantillas. Se guardan desde una partida.</p>`;
  }

  /* ================= EMPRESA ================= */
  function pintarLogo() {
    const src = S.empresa.logo;
    $("eLogoPrev").innerHTML = src ? `<img src="${esc(src)}" alt="Logo de la empresa">` : "";
    $("eLogoDel").hidden = !src;
    $("eLogoNombreBox").hidden = !src;
    $("eLogoConNombre").checked = !!S.empresa.logoConNombre;
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
    if (v === "historial") pintarHistorial();
    if (v === "materiales") pintarCatalogo();
    if (v === "empresa") pintarEmpresa();
    if (v === "cotizar" && croquis && partida()) croquis.pintar();
    window.scrollTo({ top: 0 });
  }

  /* ================= EVENTOS ================= */
  function conectar() {
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => verVista(b.dataset.view)));
    document.querySelectorAll(".subtab").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(".subtab").forEach((x) => x.classList.toggle("on", x === b));
      $("subCroquis").hidden = b.dataset.sub !== "croquis";
      $("subMateriales").hidden = b.dataset.sub !== "materiales";
      if (b.dataset.sub === "croquis" && croquis && partida()) croquis.pintar();
    }));

    /* ---- datos de la partida ---- */
    ["pNombre", "pDescripcion", "pCantidad"].forEach((id) => $(id).addEventListener("input", () => {
      const p = partida();
      if (!p) return;
      p.nombre = $("pNombre").value.trim();
      p.descripcion = $("pDescripcion").value.trim();
      p.cantidad = Math.min(99, Math.max(1, Math.round(MQ.num($("pCantidad").value, 1))));
      $("partidaTitulo").textContent = p.nombre || "Partida sin nombre";
      pintarHoja();
    }));

    $("addPartida").addEventListener("click", () => {
      const p = MQ.nuevaPartida();
      quote.partidas.push(p);
      seleccionarPartida(p.id);
      $("pNombre").focus();
    });

    $("pBorrar").addEventListener("click", () => {
      const p = partida();
      if (!p || !confirm("¿Quitar esta partida de la cotización?")) return;
      quote.partidas = quote.partidas.filter((x) => x.id !== p.id);
      seleccionarPartida(quote.partidas.length ? quote.partidas[0].id : null);
    });

    $("pPlantilla").addEventListener("click", () => {
      const p = partida();
      if (!p) return;
      if (!p.nombre) return MQ.toast("Ponle un nombre a la partida antes de guardarla.");
      S.savePlantilla(p);
      MQ.toast("Plantilla guardada: " + p.nombre);
    });

    $("partidas").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-act]");
      if (b) {
        const p = quote.partidas.find((x) => x.id === b.dataset.p);
        if (!p) return;
        if (b.dataset.act === "dup") {
          const copia = MQ.clone(p);
          copia.id = MQ.uid();
          copia.croquis.vistas.forEach((v) => { v.id = MQ.uid(); v.objetos.forEach((o) => { o.id = MQ.uid(); }); });
          copia.lineas.forEach((l) => { l.id = MQ.uid(); });
          quote.partidas.splice(quote.partidas.indexOf(p) + 1, 0, copia);
          seleccionarPartida(copia.id);
        } else {
          if (!confirm("¿Quitar esta partida?")) return;
          quote.partidas = quote.partidas.filter((x) => x.id !== p.id);
          if (partidaId === p.id) seleccionarPartida(quote.partidas.length ? quote.partidas[0].id : null);
          else pintarHoja();
        }
        return;
      }
      const li = ev.target.closest("[data-p]");
      if (li) seleccionarPartida(li.dataset.p);
    });

    /* ---- vistas del croquis ---- */
    $("crVistas").addEventListener("click", (ev) => {
      const x = ev.target.closest("[data-del-vista]");
      const p = partida();
      if (x) {
        ev.stopPropagation();
        if (p.croquis.vistas.length <= 1) return;
        if (!confirm("¿Quitar esta vista y lo que tenga dibujado?")) return;
        p.croquis.vistas = p.croquis.vistas.filter((v) => v.id !== x.dataset.delVista);
        vistaId = p.croquis.vistas[0].id;
        pintarVistas(); croquis.reiniciar(); pintarLineas(); pintarHoja();
        return;
      }
      const b = ev.target.closest("[data-vista]");
      if (!b) return;
      vistaId = b.dataset.vista;
      pintarVistas(); croquis.reiniciar(); pintarBarraMaterial();
    });

    $("crAddVista").addEventListener("click", () => {
      const p = partida();
      const usadas = p.croquis.vistas.map((v) => v.nombre);
      const sugerida = ["Frente", "Planta", "Lateral", "Corte", "Detalle"].find((n) => usadas.indexOf(n) < 0) || "Vista";
      const nombre = (prompt("Nombre de la vista:", sugerida) || "").trim();
      if (!nombre) return;
      const v = MQ.nuevaVista(nombre);
      p.croquis.vistas.push(v);
      vistaId = v.id;
      pintarVistas(); croquis.reiniciar(); guardarBorrador(); pintarHoja();
    });

    /* ---- herramientas ---- */
    document.querySelectorAll(".tool").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(".tool").forEach((x) => x.classList.toggle("on", x === b));
      croquis.herramienta(b.dataset.tool);
      $("crAyuda").textContent = AYUDA[b.dataset.tool] || "";
      pintarBarraMaterial();
    }));
    $("crEscala").addEventListener("input", () => {
      partida().croquis.escala = Math.max(1, Math.round(MQ.num($("crEscala").value, 100)));
      croquis.pintar(); pintarBarraMaterial(); pintarLineas(); pintarHoja();
    });
    $("crAcotar").addEventListener("change", () => {
      partida().croquis.acotar = $("crAcotar").checked;
      croquis.pintar(); guardarBorrador();
    });
    $("crSnap").addEventListener("change", () => croquis.ajuste($("crSnap").checked));
    $("crUndo").addEventListener("click", () => { if (!croquis.deshacer()) MQ.toast("No hay nada que deshacer."); });
    $("crDel").addEventListener("click", () => { if (!croquis.borrar()) MQ.toast("Selecciona algo del croquis para borrarlo."); });
    $("crClear").addEventListener("click", () => {
      if (MQ.croquis.vistaVacia(vista())) return MQ.toast("Esta vista ya está vacía.");
      if (confirm("¿Borrar todo lo dibujado en esta vista?")) croquis.limpiar();
    });
    $("crMat").addEventListener("change", () => { croquis.asignar($("crMat").value, undefined); pintarBarraMaterial(); });
    $("crPiezas").addEventListener("input", () => { croquis.asignar(undefined, $("crPiezas").value); pintarBarraMaterial(); });

    document.addEventListener("keydown", (ev) => {
      if ($("view-cotizar").hidden || $("subCroquis").hidden || !croquis) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      if ((ev.key === "Enter" || ev.key === "Escape") && croquis.enCadena()) { ev.preventDefault(); croquis.cerrarCadena(); }
      if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); croquis.borrar(); }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") { ev.preventDefault(); croquis.deshacer(); }
    });

    /* ---- materiales de la partida ---- */
    $("addLinea").addEventListener("click", () => {
      const p = partida();
      const it = (S.catalogo.items || [])[0];
      if (!it) return MQ.toast("El catálogo está vacío.");
      p.lineas.push(MQ.nuevaLinea(it.id, it.unidad));
      pintarLineas(); pintarHoja();
    });
    $("lineas").addEventListener("input", () => { leerLineas(); pintarLineas(); pintarHoja(); });
    $("lineas").addEventListener("change", (ev) => {
      leerLineas();
      if (ev.target.dataset.campo === "itemId") pintarLineas();
      pintarHoja();
    });
    $("lineas").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-del-linea]");
      if (!b) return;
      leerLineas();
      partida().lineas.splice(+b.dataset.delLinea, 1);
      pintarLineas(); pintarHoja();
    });

    /* ---- hoja ---- */
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
      if (!quote.partidas.length) return MQ.toast("Agrega al menos una partida antes de guardar.");
      quote = S.saveQuote(quote);
      pintarHoja();
      MQ.toast("Cotización N° " + quote.numero + " guardada");
    });

    $("btnNew").addEventListener("click", () => {
      if (quote.partidas.length && !confirm("¿Empezar una cotización nueva? Lo que no hayas guardado se pierde.")) return;
      quote = nuevaCotizacion();
      seleccionarPartida(null);
      volcarHoja(); pintarHoja();
      MQ.toast("Cotización nueva");
    });

    const conNumero = () => { if (!quote.numero) quote.numero = S.nextNumero(); };
    $("btnPdf").addEventListener("click", async () => {
      leerHoja();
      if (!quote.partidas.length) return MQ.toast("Agrega al menos una partida.");
      conNumero();
      try { await MQ.pdf.descargarCotizacion(quote, S.catalogo, S.empresa); }
      catch (e) { MQ.toast("No se pudo generar el PDF."); console.warn(e); }
    });
    $("btnTaller").addEventListener("click", async () => {
      if (!quote.partidas.length) return MQ.toast("Agrega al menos una partida.");
      conNumero();
      try { await MQ.pdf.descargarTaller(quote, S.catalogo, S.empresa); }
      catch (e) { MQ.toast("No se pudo generar el PDF."); console.warn(e); }
    });

    $("btnShare").addEventListener("click", async () => {
      leerHoja();
      if (!quote.partidas.length) return MQ.toast("Agrega al menos una partida.");
      const txt = resumenTexto();
      try { await navigator.clipboard.writeText(txt); MQ.toast("Resumen copiado al portapapeles"); }
      catch (e) { $("shareText").value = txt; $("shareDlg").showModal(); }
    });
    $("shareClose").addEventListener("click", () => $("shareDlg").close());

    $("btnWhats").addEventListener("click", async () => {
      leerHoja();
      if (!quote.partidas.length) return MQ.toast("Agrega al menos una partida.");
      conNumero();
      const texto = resumenTexto();
      let archivo = null;
      try {
        const pdf = await MQ.pdf.archivoCotizacion(quote, S.catalogo, S.empresa);
        archivo = { pdf, file: new File([pdf.blob], pdf.nombre, { type: "application/pdf" }) };
      } catch (e) { console.warn("pdf", e); }

      if (archivo && navigator.canShare && navigator.canShare({ files: [archivo.file] })) {
        try {
          await navigator.share({ files: [archivo.file], text: texto });
          return MQ.toast("Elige WhatsApp para enviar la cotización con el PDF.");
        } catch (e) {
          if (e && e.name === "AbortError") return;
          console.warn("share", e);
        }
      }
      if (archivo) archivo.pdf.guardar();
      const tel = telefonoWhats(quote.cliente.telefono);
      const t = encodeURIComponent(texto);
      window.open(tel ? `https://wa.me/${tel}?text=${t}` : `https://wa.me/?text=${t}`, "_blank", "noopener");
      MQ.toast(archivo ? "PDF descargado. Adjúntalo en el chat con el clip." : "WhatsApp abierto con el resumen.");
    });

    /* ---- plantillas ---- */
    $("desdePlantilla").addEventListener("click", () => {
      if (!S.plantillas.length) return MQ.toast("Todavía no has guardado ninguna plantilla.");
      $("plantillaLista").innerHTML = S.plantillas.map((t) => `
        <button type="button" class="plt plt-btn" data-usar="${esc(t.id)}">
          <span class="plt-n">${esc(t.nombre || "Sin nombre")}</span>
          <span class="plt-d">${(t.lineas || []).length} materiales · ${MQ.croquis.conDibujo(t.croquis).length} vistas</span>
        </button>`).join("");
      $("plantillaDlg").showModal();
    });
    $("plClose").addEventListener("click", () => $("plantillaDlg").close());
    $("plantillaLista").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-usar]");
      if (!b) return;
      const t = S.plantillas.find((x) => x.id === b.dataset.usar);
      if (!t) return;
      const p = MQ.clone(t);
      p.id = MQ.uid();
      delete p.guardado;
      p.croquis.vistas.forEach((v) => { v.id = MQ.uid(); v.objetos.forEach((o) => { o.id = MQ.uid(); }); });
      (p.lineas || []).forEach((l) => { l.id = MQ.uid(); });
      quote.partidas.push(p);
      $("plantillaDlg").close();
      seleccionarPartida(p.id);
      MQ.toast("Partida agregada desde la plantilla");
    });
    $("listaPlantillas").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-del-plt]");
      if (!b) return;
      if (!confirm("¿Quitar esta plantilla?")) return;
      S.deletePlantilla(b.dataset.delPlt);
      pintarPlantillas();
    });

    /* ---- historial ---- */
    $("histSearch").addEventListener("input", pintarHistorial);
    $("histFilter").addEventListener("change", pintarHistorial);
    $("histList").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-h]");
      if (!b) return;
      const x = S.quotes.find((q) => q.id === b.dataset.id);
      if (!x) return;
      if (b.dataset.h === "open") {
        quote = MQ.clone(x);
        volcarHoja();
        seleccionarPartida(quote.partidas.length ? quote.partidas[0].id : null);
        verVista("cotizar");
        MQ.toast("Cotización N° " + quote.numero + " abierta");
      } else if (b.dataset.h === "dup") {
        quote = MQ.clone(x);
        quote.id = MQ.uid(); quote.numero = 0; quote.estado = "borrador";
        quote.creado = new Date().toISOString();
        delete quote.actualizado;
        quote.partidas.forEach((p) => { p.id = MQ.uid(); });
        volcarHoja();
        seleccionarPartida(quote.partidas.length ? quote.partidas[0].id : null);
        verVista("cotizar");
        MQ.toast("Copia lista para editar");
      } else {
        if (!confirm("¿Eliminar la cotización N° " + (x.numero || "—") + "?")) return;
        S.deleteQuote(x.id);
        pintarHistorial();
        MQ.toast("Cotización eliminada");
      }
    });

    /* ---- catálogo ---- */
    $("tblItems").addEventListener("change", (ev) => {
      S.catalogo = leerCatalogo();
      if (ev.target.dataset.campo === "cat") pintarCatalogo();
    });
    $("tblItems").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-del-item]");
      if (!b) return;
      const cat = leerCatalogo();
      cat.items.splice(+b.dataset.delItem, 1);
      S.catalogo = cat; pintarCatalogo();
    });
    $("addItem").addEventListener("click", () => {
      const cat = leerCatalogo();
      cat.items.push({ id: "i" + MQ.uid(), cat: "insumo", nombre: "Ítem nuevo", unidad: "un", precio: 0 });
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

    /* ---- logo y empresa ---- */
    $("eLogoFile").addEventListener("change", async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      if (!file) return;
      try {
        const logo = await MQ.procesarLogo(file);
        S.saveEmpresa(Object.assign(MQ.clone(S.empresa), { logo }));
        pintarLogo(); MQ.toast("Logo guardado");
      } catch (e) { MQ.toast((e && e.message) || "No se pudo usar esa imagen."); }
    });
    $("eLogoConNombre").addEventListener("change", () => {
      S.saveEmpresa(Object.assign(MQ.clone(S.empresa), { logoConNombre: $("eLogoConNombre").checked }));
      MQ.toast($("eLogoConNombre").checked ? "El nombre no se repetirá junto al logo" : "El nombre vuelve a salir junto al logo");
    });
    $("eLogoDel").addEventListener("click", () => {
      if (!confirm("¿Quitar el logo?")) return;
      S.saveEmpresa(Object.assign(MQ.clone(S.empresa), { logo: "" }));
      pintarLogo(); MQ.toast("Logo quitado");
    });
    $("empresaForm").addEventListener("submit", (ev) => {
      ev.preventDefault();
      S.saveEmpresa({
        logo: S.empresa.logo, logoConNombre: S.empresa.logoConNombre,
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
      if (kind === "catalogo") { pintarBarraMaterial(); pintarLineas(); }
      if (kind === "catalogo" || kind === "empresa") pintarHoja();
      if (kind === "plantillas") pintarPlantillas();
    });
  }

  /* ================= ARRANQUE ================= */
  function iniciar() {
    quote = S.loadDraft() || nuevaCotizacion();
    montarCroquis();
    conectar();
    volcarHoja();
    $("crAyuda").textContent = AYUDA.sel;
    seleccionarPartida(quote.partidas.length ? quote.partidas[0].id : null);
    verVista("cotizar");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
