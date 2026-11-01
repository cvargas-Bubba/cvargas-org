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

  const fechaCorta = (iso) => new Date(iso || Date.now()).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });

  function nuevaCotizacion() {
    return {
      id: MQ.uid(), numero: 0, estado: "borrador", creado: new Date().toISOString(),
      clienteId: "",
      cliente: { nombre: "", rut: "", telefono: "", email: "", obra: "" },
      partidas: [], descuento: 0, notas: "",
      hitos: {}, pagos: []
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
    /* sin partida abierta no hay croquis que leer: el editor consulta la
       partida en curso y reventaría */
    if (!croquis || !partida()) { $("crMatBar").hidden = true; return; }
    const os = croquis.seleccionados();
    $("crMatBar").hidden = !os.length;
    if (!os.length) return;
    const o = os[0];
    const varias = os.length > 1;
    /* con varias elegidas el material y las piezas solo se muestran si
       coinciden; si no, los campos parten en blanco y lo que se elija vale
       para todas */
    const mixto = !os.every((x) => (x.mat || "") === (o.mat || ""));
    const mismoMat = mixto ? "" : (o.mat || "");
    const mismasPz = os.every((x) => MQ.croquis.piezasDe(x) === MQ.croquis.piezasDe(o));

    $("crMatTitulo").textContent = varias ? "Material de las " + os.length + " figuras" : "Material de la figura";
    const lista = itemsLineales();
    $("crMat").innerHTML = (mixto ? `<option value="=" selected>Varios materiales</option>` : "") +
      `<option value=""${!mixto && !mismoMat ? " selected" : ""}>Sin material</option>` +
      lista.map((i) => `<option value="${esc(i.id)}"${i.id === mismoMat ? " selected" : ""}>${esc(MQ.nombreItem(i))}</option>`).join("");
    /* mientras se escribe acá no se le reescribe el valor: el cursor saltaría
       al final en cada tecla */
    if (document.activeElement !== $("crPiezas")) $("crPiezas").value = mismasPz ? MQ.croquis.piezasDe(o) : "";

    const mm = MQ.croquis.mmPorUnidad(partida().croquis);
    const it = mismoMat && MQ.calc.item(S.catalogo, mismoMat);
    const metros = os.reduce((s, x) => s + MQ.croquis.largoMm(x, mm) / 1000 * MQ.croquis.piezasDe(x), 0);
    let q;
    if (varias) {
      q = os.length + " figuras · " + MQ.dec(metros, 2) + " m";
    } else {
      /* en una figura cerrada el largo es la suma de los lados: conviene decirlo,
         porque el número no coincide con ninguna de las medidas que se ven */
      const largo = Math.round(MQ.croquis.largoMm(o, mm));
      q = (MQ.croquis.cerrada(o) ? "contorno " : "") + largo + " mm × " + MQ.croquis.piezasDe(o)
        + " = " + MQ.dec(metros, 2) + " m";
    }
    $("crMatCalc").textContent = it ? q + " · " + MQ.clp(metros * it.precio) : q;
  }

  /* Nomenclatura: qué material es cada color del croquis. Reemplaza al
     nombre escrito sobre cada figura, que con unas pocas piezas tapaba el
     dibujo. Se arma del croquis completo, no de la vista, para que una
     pieza tenga el mismo color en el frente y en la planta. */
  function pintarLeyenda() {
    const p = partida();
    if (!p) { $("crLeyenda").hidden = true; return; }
    const mats = MQ.croquis.materiales(p.croquis);
    $("crLeyenda").hidden = !mats.length;
    if (!mats.length) return;
    const mm = MQ.croquis.mmPorUnidad(p.croquis);
    $("crLeyenda").innerHTML = mats.map((id, i) => {
      const it = MQ.calc.item(S.catalogo, id);
      let m = 0;
      (p.croquis.vistas || []).forEach((v) => (v.objetos || []).forEach((o) => {
        if (o.mat === id) m += MQ.croquis.largoMm(o, mm) / 1000 * MQ.croquis.piezasDe(o);
      }));
      return `<button type="button" class="ley" data-mat="${esc(id)}" title="Seleccionar todo lo de este material">
        <span class="ley-c" style="background:${MQ.rgb(MQ.colorMat(i))}"></span>
        <span class="ley-n">${esc(it ? MQ.nombreItem(it) : "Material")}</span>
        <b class="mono">${MQ.dec(m, 2)} m</b>
      </button>`;
    }).join("");
  }

  const AYUDA = {
    sel: "Haz clic en un trazo para seleccionarlo y arrástralo. Para varios a la vez, arrastra un recuadro sobre ellos o súmalos con Ctrl o Shift: el material se asigna a todos juntos. Doble clic te deja escribir la medida exacta, o el texto de una cota o un rótulo. Duplicar (Ctrl+D) repite lo seleccionado con su material; Ctrl+C y Ctrl+V lo llevan a otra vista.",
    lapiz: "Dibuja arrastrando, como con un lápiz. No se ajusta a la grilla.",
    linea: "Arrastra para dibujar la línea.",
    rect: "Arrastra para dibujar el rectángulo.",
    rombo: "Arrastra para dibujar el rombo dentro de ese recuadro.",
    poli: "Un clic por cada punto. Doble clic termina; vuelve al primer punto para cerrar.",
    texto: "Haz clic donde quieras el rótulo.",
    cota: "Arrastra de un extremo al otro. La medida se calcula sola, y con doble clic la escribes tú."
  };

  /* Dibujar en el panel de la izquierda queda chico: a pantalla completa la
     grilla crece y se puede trabajar el croquis con detalle. */
  function pleno(v) {
    const on = v === undefined ? !$("subCroquis").classList.contains("croquis-pleno") : !!v;
    $("subCroquis").classList.toggle("croquis-pleno", on);
    $("crPleno").textContent = on ? "Salir de pantalla completa" : "Pantalla completa";
    $("crPleno").setAttribute("aria-pressed", on ? "true" : "false");
    document.body.style.overflow = on ? "hidden" : "";
    /* a pantalla completa el dibujo se encuadra para que se vea grande */
    if (croquis && partida()) croquis.encuadre(on);
  }

  function montarCroquis() {
    croquis = MQ.croquis.montar(
      $("crLienzo"),
      () => ({ croquis: partida().croquis, vista: vista() }),
      () => { guardarBorrador(); pintarBarraMaterial(); pintarLeyenda(); pintarLineas(); pintarHoja(); },
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

  /* Solo los números: se llama en cada tecla mientras se escribe un largo o
     una cantidad, así que no puede rehacer los campos. Rehacerlos reemplaza
     el input que uno está usando y el cursor se va: parecía que la casilla
     se desactivaba sola al primer dígito. */
  function refrescarTotales() {
    const p = partida();
    if (!p) return;
    const c = MQ.calc.costear(p, S.catalogo);
    const aMano = c.lineas.filter((l) => l.origen !== "croquis");
    $("lineas").querySelectorAll(".lin").forEach((fila, i) => {
      const l = (p.lineas || [])[i];
      const calc = l && aMano.find((x) => x.id === l.id);
      const t = fila.querySelector(".lin-t");
      if (t) t.textContent = calc ? MQ.clp(calc.total) : "$0";
    });
    pintarResumenPartida(c);
  }

  function pintarResumenPartida(c) {
    $("partidaPrecio").textContent = MQ.clp(c.unitario);
    $("partidaDesglose").innerHTML = c.porCategoria.map((x) =>
      `<span>${esc(x.nombre)} <b class="mono">${MQ.clp(x.total)}</b></span>`).join("") +
      (c.costos.gastos + c.costos.margen > 0 ? `<span>Gastos y margen <b class="mono">${MQ.clp(c.costos.gastos + c.costos.margen)}</b></span>` : "");
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
        <span class="lin-d mono">${esc(MQ.calc.textoCorte(l))}</span>
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

    pintarResumenPartida(c);
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
    pintarLeyenda();
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

    /* el saldo cuelga del total: si cambia el precio, cambia lo que falta */
    pintarPlata();
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
  }

  function volcarHoja() {
    /* al abrir, retomar o empezar otra, el aviso de arranque ya no aplica */
    $("avisoInicio").hidden = true;
    volcarCliente();
    $("qDescuento").value = quote.descuento || 0;
    $("qNotas").value = quote.notas || "";
    pintarSeguimiento();
  }

  /* una cotización tiene algo que perder si ya hay partidas o un cliente */
  const hayTrabajo = (q) => {
    const x = q || quote;
    return !!((x.partidas || []).length || ((x.cliente || {}).nombre || "").trim());
  };

  function empezarNueva(cli) {
    quote = nuevaCotizacion();
    if (cli) {
      quote.clienteId = cli.id;
      CAMPOS_CLIENTE.forEach((k) => { quote.cliente[k] = cli[k] || ""; });
    }
    seleccionarPartida(null);
    volcarHoja(); pintarHoja();
    verVista("cotizar");
  }

  function nuevaParaCliente(c) {
    if (hayTrabajo() && !confirm("¿Empezar una cotización para " + (c.nombre || "este cliente") + "? Lo que no hayas guardado se pierde.")) return;
    empezarNueva(c);
    MQ.toast("Cotización nueva para " + (c.nombre || "el cliente"));
  }

  /* ================= CLIENTES =================
     La cotización guarda el vínculo y además una copia de los datos. El
     vínculo sirve para juntar los trabajos de un cliente; la copia, para que
     un trabajo viejo siga diciendo a quién se le hizo. */
  const CAMPOS_CLIENTE = ["nombre", "rut", "telefono", "email"];

  function pintarPickCliente() {
    const sel = quote.clienteId || "";
    $("cPick").innerHTML = `<option value="">— Cliente nuevo —</option>` + S.clientes.map((c) =>
      `<option value="${esc(c.id)}"${c.id === sel ? " selected" : ""}>${esc(c.nombre || "Sin nombre")}</option>`).join("");
    const c = quote.clienteId && S.cliente(quote.clienteId);
    const n = c ? S.trabajosDe(c).length : 0;
    $("cEstado").textContent = c
      ? "Guardado en la libreta" + (n ? " · " + n + (n === 1 ? " trabajo" : " trabajos") : "")
      : ($("cNombre").value.trim() ? "Se guardará en la libreta al salir del campo." : "");
  }

  /* Al salir de un campo del cliente: si está vinculado se actualiza su
     ficha, y si no, se busca por nombre antes de crear otra, para no llenar
     la libreta del mismo cliente escrito dos veces. */
  function sincronizarCliente() {
    const d = quote.cliente || {};
    const datos = {};
    CAMPOS_CLIENTE.forEach((k) => { datos[k] = d[k] || ""; });
    if (quote.clienteId && S.cliente(quote.clienteId)) {
      S.saveCliente(Object.assign({ id: quote.clienteId }, datos));
    } else if ((datos.nombre || "").trim().length >= 2) {
      const ya = S.clientePorNombre(datos.nombre);
      const g = S.saveCliente(ya ? Object.assign({ id: ya.id }, datos) : datos);
      quote.clienteId = g.id;
      persistir(false);
    }
    pintarPickCliente();
  }

  function usarCliente(id) {
    const c = S.cliente(id);
    quote.clienteId = c ? c.id : "";
    if (c) CAMPOS_CLIENTE.forEach((k) => { quote.cliente[k] = c[k] || ""; });
    else CAMPOS_CLIENTE.forEach((k) => { quote.cliente[k] = ""; });
    /* la obra es de este trabajo, no del cliente: se deja como está */
    volcarCliente();
    persistir(false);
    pintarHoja();
  }

  function volcarCliente() {
    const c = quote.cliente || {};
    $("cNombre").value = c.nombre || ""; $("cRut").value = c.rut || "";
    $("cTelefono").value = c.telefono || ""; $("cEmail").value = c.email || "";
    $("cObra").value = c.obra || "";
    pintarPickCliente();
  }

  function pintarClientes() {
    const q = ($("cliSearch").value || "").toLowerCase().trim();
    const lista = S.clientes.filter((c) => !q ||
      [c.nombre, c.telefono, c.email, c.rut].filter(Boolean).some((s) => String(s).toLowerCase().includes(q)));
    const inp = (c, campo, ph) =>
      `<input class="input cell" value="${esc(c[campo] || "")}" data-cli="${esc(c.id)}" data-campo="${campo}"${ph ? ` placeholder="${esc(ph)}"` : ""}>`;

    $("tblClientes").querySelector("tbody").innerHTML = lista.map((c) => {
      const t = S.trabajosDe(c);
      const deuda = t.reduce((s, x) => s + MQ.calc.pagos(x, S.catalogo, S.empresa).saldo, 0);
      const activos = t.filter((x) => ["borrador", "rechazada"].indexOf(x.estado) < 0);
      return `<tr>
        <td>${inp(c, "nombre")}</td>
        <td class="w140">${inp(c, "rut")}</td>
        <td class="w140">${inp(c, "telefono")}</td>
        <td>${inp(c, "email")}</td>
        <td>${inp(c, "notas", "Preferencias, referencias…")}</td>
        <td class="w140 mono cli-t">${t.length || "—"}${deuda > 0 && activos.length ? `<span class="hc-saldo">debe ${MQ.clp(deuda)}</span>` : ""}</td>
        <td class="cli-a">
          <button class="btn btn-ghost btn-sm" data-cli-act="cotizar" data-cli="${esc(c.id)}">Cotizar</button>
          <button class="btn btn-ghost btn-sm" data-cli-act="ver" data-cli="${esc(c.id)}"${t.length ? "" : " disabled"}>Trabajos</button>
          <button class="icon" data-cli-act="del" data-cli="${esc(c.id)}" title="Eliminar" aria-label="Eliminar">✕</button>
        </td>
      </tr>`;
    }).join("");
    $("cliVacio").hidden = !!lista.length;
    if (!lista.length && q) $("cliVacio").textContent = "Ningún cliente coincide con la búsqueda.";
    else $("cliVacio").textContent = "Todavía no hay clientes. Se agregan solos al escribir el nombre en una cotización.";
  }

  /* ================= SEGUIMIENTO DEL TRABAJO =================
     De la cotización a la entrega: cada etapa guarda su fecha y los abonos
     dicen cuánto falta por cobrar. Marcar una etapa guarda la cotización en
     el historial, porque desde que el cliente la aceptó esto ya no es un
     borrador sino un trabajo que hay que poder encontrar después. */
  function pintarSeguimiento() {
    const est = quote.estado || "borrador";
    const idx = MQ.etapaIndice(est);
    const rech = est === "rechazada";
    const hitos = quote.hitos || (quote.hitos = {});

    $("etapas").innerHTML = MQ.ETAPAS.map((e, i) => {
      /* una etapa con fecha sigue estando hecha aunque el trabajo se haya
         rechazado después: pasó, y el historial tiene que decirlo */
      const hecha = (!rech && idx >= i) || !!hitos[e.id];
      const actual = !rech && idx === i;
      const f = hitos[e.id] || "";
      return `<li class="etapa${hecha ? " hecha" : ""}${actual ? " actual" : ""}">
        <button type="button" class="etapa-b" data-etapa="${esc(e.id)}" title="${esc(e.pie)}">
          <span class="etapa-n">${i + 1}</span>
          <span class="etapa-t">${esc(e.corto)}</span>
        </button>
        ${hecha && e.id !== "borrador"
          ? `<input class="input etapa-f" type="date" value="${esc(f)}" data-fecha="${esc(e.id)}" aria-label="Fecha de ${esc(e.corto)}">`
          : `<span class="etapa-f vacia">${esc(e.pie)}</span>`}
      </li>`;
    }).join("");

    $("segRechazo").textContent = rech ? "Retomar el trabajo" : "Marcar rechazada";

    /* ---- abonos ---- */
    $("listaPagos").innerHTML = (quote.pagos || []).map((p, i) => `
      <div class="pago">
        <input class="input" type="date" value="${esc(p.fecha || "")}" data-pago="fecha" data-i="${i}" aria-label="Fecha del abono">
        <div class="unit" data-unit="$"><input class="input" inputmode="numeric" value="${esc(p.monto || 0)}" data-pago="monto" data-i="${i}" aria-label="Monto"></div>
        <input class="input" value="${esc(p.medio || "")}" placeholder="Transferencia, efectivo…" data-pago="medio" data-i="${i}" aria-label="Medio de pago">
        <button class="icon" data-del-pago="${i}" title="Quitar" aria-label="Quitar abono">✕</button>
      </div>`).join("") || `<p class="hint lin-vacio">Sin abonos todavía.</p>`;

    pintarPlata();
  }

  /* Solo los números: se llama en cada tecla y no puede rehacer los campos,
     que es como se pierde el cursor mientras uno escribe. */
  function pintarPlata() {
    const pg = MQ.calc.pagos(quote, S.catalogo, S.empresa);
    $("pagoTotales").innerHTML =
      `<div><span>Abonado</span><b class="mono">${MQ.clp(pg.pagado)}</b></div>` +
      `<div class="${pg.saldo > 0 ? "debe" : "pagado"}"><span>${pg.saldo > 0 ? "Saldo por cobrar" : "Pagado al día"}</span><b class="mono">${MQ.clp(pg.saldo)}</b></div>`;
    const e = MQ.etapa(quote.estado || "borrador");
    const f = (quote.hitos || {})[quote.estado];
    $("segResumen").textContent = e.nombre + (f ? " · " + MQ.fechaDia(f) : "");
  }

  /* Marcar una etapa deja fecha en ella y en las anteriores que no la tengan:
     si uno registra la entrega de un trabajo que nunca marcó como aceptado,
     el camino igual queda completo. */
  function marcarEtapa(id) {
    const i = MQ.etapaIndice(id);
    if (i < 0) return;
    const hoy = MQ.hoy();
    /* volver atrás borra lo que no había pasado todavía, para que la etapa y
       las fechas cuenten lo mismo; se avisa, porque son datos escritos */
    const post = MQ.ETAPAS.slice(i + 1).filter((e) => quote.hitos[e.id]);
    if (post.length) {
      if (!confirm("Volver a «" + MQ.etapa(id).nombre + "» borra la fecha de " +
        post.map((e) => e.corto.toLowerCase()).join(" y ") + ". ¿Seguir?")) return;
      post.forEach((e) => { delete quote.hitos[e.id]; });
    }
    quote.estado = id;
    if (id !== "borrador") quote.hitos[id] = quote.hitos[id] || hoy;
    MQ.ETAPAS.slice(1, i).forEach((e) => { quote.hitos[e.id] = quote.hitos[e.id] || hoy; });
    delete quote.hitos.rechazada;
    guardarTrabajo(id !== "borrador");
  }

  /* Desde que deja de ser borrador, el trabajo vive en el historial: cada
     cambio de etapa o de abono se guarda ahí, no solo en el borrador. */
  function persistir(aHistorial) {
    if (aHistorial || quote.numero) {
      const g = S.saveQuote(quote);
      quote.numero = g.numero; quote.actualizado = g.actualizado;
    }
    guardarBorrador();
  }
  function guardarTrabajo(aHistorial) { persistir(aHistorial); pintarSeguimiento(); }

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
      if (f === "saldo") {
        /* lo que importa cobrar: trabajos en marcha o entregados que deben */
        const pg = MQ.calc.pagos(x, S.catalogo, S.empresa);
        if (pg.saldo <= 0 || ["borrador", "rechazada"].indexOf(x.estado) >= 0) return false;
      } else if (f && x.estado !== f) return false;
      if (!q) return true;
      const c = x.cliente || {};
      return [c.nombre, c.obra, c.rut, String(x.numero)].filter(Boolean).some((s) => String(s).toLowerCase().includes(q));
    });
    $("histList").innerHTML = lista.length ? lista.map((x) => {
      const pg = MQ.calc.pagos(x, S.catalogo, S.empresa);
      const c = x.cliente || {};
      const n = (x.partidas || []).length;
      const h = x.hitos || {};
      const est = x.estado || "borrador";
      /* la línea de abajo cuenta la historia del trabajo, no solo su fecha */
      const paso = MQ.ETAPAS.filter((e) => h[e.id]).map((e) => e.corto + " " + MQ.fechaDia(h[e.id]));
      if (h.rechazada) paso.push("Rechazada " + MQ.fechaDia(h.rechazada));
      const saldo = pg.saldo > 0 && est !== "borrador" && est !== "rechazada";
      return `<article class="hcard">
        <div class="hc-no mono">N° ${x.numero || "—"}</div>
        <div class="hc-m">
          <div class="hc-t">${esc(c.nombre || "Sin cliente")}</div>
          <div class="hc-d">${esc([c.obra, n + (n === 1 ? " partida" : " partidas"), fechaCorta(x.actualizado || x.creado)].filter(Boolean).join(" · "))}</div>
          ${paso.length ? `<div class="hc-paso mono">${esc(paso.join("  ›  "))}</div>` : ""}
        </div>
        <div class="hc-p mono">${MQ.clp(pg.total)}
          ${saldo ? `<span class="hc-saldo">debe ${MQ.clp(pg.saldo)}</span>` : (pg.pagado > 0 ? `<span class="hc-saldo ok">pagado</span>` : "")}
        </div>
        <span class="pill" data-estado="${esc(est)}">${esc(MQ.etapa(est).corto)}</span>
        <div class="hc-a">
          <button class="btn btn-sm" data-h="open" data-id="${esc(x.id)}">Abrir</button>
          <button class="btn btn-ghost btn-sm" data-h="dup" data-id="${esc(x.id)}">Duplicar</button>
          <button class="btn btn-ghost btn-sm" data-h="del" data-id="${esc(x.id)}">Eliminar</button>
        </div>
      </article>`;
    }).join("") : `<p class="hint">No hay cotizaciones que coincidan.</p>`;
  }

  /* ================= CATÁLOGO ================= */
  /* El catálogo se mantiene ordenado por categoría y, dentro de ella, por
     nombre: así la lista de la tabla y la de los desplegables al cotizar son
     la misma, y un ítem nuevo cae donde corresponde en vez de al final. */
  const ORDEN_CAT = MQ.CATEGORIAS.map((c) => c.id);
  const ordenarItems = (items) => items.slice().sort((a, b) =>
    ORDEN_CAT.indexOf(a.cat) - ORDEN_CAT.indexOf(b.cat) ||
    MQ.nombreItem(a).localeCompare(MQ.nombreItem(b), "es", { numeric: true }));

  function pintarCatalogo() {
    const cat = S.catalogo;
    /* el almacén queda en el mismo orden que la tabla: las filas se
       direccionan por índice y las dos listas no pueden separarse */
    cat.items = ordenarItems(cat.items || []);
    const inp = (val, campo, i, extra) =>
      `<input class="input cell" value="${esc(val)}" data-campo="${campo}" data-i="${i}" ${extra || ""}>`;

    let grupo = null;
    $("tblItems").querySelector("tbody").innerHTML = cat.items.map((it, i) => {
      const esMadera = MQ.categoria(it.cat).escuadria;
      let cabecera = "";
      if (it.cat !== grupo) {
        grupo = it.cat;
        cabecera = `<tr class="grupo"><td colspan="7">${esc(MQ.categoria(grupo).nombre)}</td></tr>`;
      }
      return cabecera + `<tr>
        <td class="w140"><select class="select cell" data-campo="cat" data-i="${i}">${MQ.CATEGORIAS.map((c) =>
          `<option value="${c.id}"${c.id === it.cat ? " selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select></td>
        <td>${inp(it.nombre, "nombre", i)}</td>
        <td class="w70">${esMadera ? inp(it.esp == null ? "" : it.esp, "esp", i, 'inputmode="decimal"') : ""}</td>
        <td class="w70">${esMadera ? inp(it.anc == null ? "" : it.anc, "anc", i, 'inputmode="decimal"') : ""}</td>
        <td class="w110"><select class="select cell" data-campo="unidad" data-i="${i}">${Object.keys(MQ.UNIDADES).map((u) =>
          `<option value="${u}"${u === it.unidad ? " selected" : ""}>${esc(MQ.UNIDADES[u].largo)}</option>`).join("")}</select></td>
        <td class="w110">${inp(it.precio, "precio", i, 'inputmode="numeric"')}</td>
        <td class="w70 it-acc">
          <button class="icon" data-dup-item="${i}" title="Duplicar para modificarlo" aria-label="Duplicar ítem">⧉</button>
          <button class="icon" data-del-item="${i}" title="Quitar" aria-label="Quitar ítem">✕</button>
        </td>
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
      /* un material sin nombre no se puede elegir ni leer en la hoja de
         taller: si se borra, se queda con el que tenía. Para sacarlo está
         el botón de quitar. */
      if (campo === "nombre") it.nombre = el.value.trim() || it.nombre;
      else if (campo === "cat" || campo === "unidad") it[campo] = el.value;
      else it[campo] = Math.max(0, MQ.num(el.value, 0));
    });
    cat.params = {
      gastos: Math.max(0, MQ.num($("pGastos").value, 0)),
      margen: Math.max(0, MQ.num($("pMargen").value, 0)),
      redondeo: Math.max(1, MQ.num($("pRedondeo").value, 1))
    };
    cat.items = ordenarItems(cat.items);
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
    pleno(false);
    document.querySelectorAll(".view").forEach((el) => { el.hidden = el.id !== "view-" + v; });
    document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
    if (v === "historial") pintarHistorial();
    if (v === "clientes") pintarClientes();
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
      if (b.dataset.sub !== "croquis") pleno(false);
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
    $("crPleno").addEventListener("click", () => pleno());
    window.addEventListener("resize", () => {
      if ($("subCroquis").classList.contains("croquis-pleno") && croquis && partida()) croquis.encuadre(true);
    });
    $("crMedida").addEventListener("click", () => {
      if (!croquis.editarSeleccion()) MQ.toast("Selecciona una figura del croquis.");
    });
    $("crCopiar").addEventListener("click", () => {
      const n = croquis.duplicar();
      if (!n) return MQ.toast("Selecciona lo que quieras duplicar.");
      MQ.toast(n === 1 ? "Figura duplicada" : n + " figuras duplicadas");
      pintarBarraMaterial();
    });
    $("crUndo").addEventListener("click", () => { if (!croquis.deshacer()) MQ.toast("No hay nada que deshacer."); });
    $("crDel").addEventListener("click", () => { if (!croquis.borrar()) MQ.toast("Selecciona algo del croquis para borrarlo."); });
    $("crClear").addEventListener("click", () => {
      if (MQ.croquis.vistaVacia(vista())) return MQ.toast("Esta vista ya está vacía.");
      if (confirm("¿Borrar todo lo dibujado en esta vista?")) croquis.limpiar();
    });
    $("crLeyenda").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-mat]");
      if (!b) return;
      const n = croquis.seleccionarMat(b.dataset.mat);
      pintarBarraMaterial();
      if (!n) MQ.toast("En esta vista no hay nada de ese material.");
    });
    $("crMat").addEventListener("change", () => {
      if ($("crMat").value === "=") return;   // "varios materiales": no toca nada
      croquis.asignar($("crMat").value, undefined); pintarBarraMaterial();
    });
    $("crPiezas").addEventListener("input", () => { croquis.asignar(undefined, $("crPiezas").value); pintarBarraMaterial(); });

    document.addEventListener("keydown", (ev) => {
      if ($("view-cotizar").hidden || $("subCroquis").hidden || !croquis) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      if ((ev.key === "Enter" || ev.key === "Escape") && croquis.enCadena()) { ev.preventDefault(); croquis.cerrarCadena(); return; }
      if (ev.key === "Escape" && $("subCroquis").classList.contains("croquis-pleno")) { ev.preventDefault(); pleno(false); return; }
      if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); croquis.borrar(); }
      if (!(ev.ctrlKey || ev.metaKey)) return;
      const k = ev.key.toLowerCase();
      if (k === "z") { ev.preventDefault(); croquis.deshacer(); }
      if (k === "c") {
        const n = croquis.copiar();
        if (!n) return;
        ev.preventDefault();
        MQ.toast(n === 1 ? "Figura copiada" : n + " figuras copiadas");
      }
      if (k === "v") {
        const n = croquis.pegar();
        if (!n) return;
        ev.preventDefault(); pintarBarraMaterial();
        MQ.toast(n === 1 ? "Figura pegada" : n + " figuras pegadas");
      }
      if (k === "d") {
        const n = croquis.duplicar();
        ev.preventDefault();
        if (n) pintarBarraMaterial();
        MQ.toast(n ? (n === 1 ? "Figura duplicada" : n + " figuras duplicadas") : "Selecciona lo que quieras duplicar.");
      }
    });

    /* ---- materiales de la partida ---- */
    $("addLinea").addEventListener("click", () => {
      const p = partida();
      const it = (S.catalogo.items || [])[0];
      if (!it) return MQ.toast("El catálogo está vacío.");
      p.lineas.push(MQ.nuevaLinea(it.id, it.unidad));
      pintarLineas(); pintarHoja();
    });
    $("lineas").addEventListener("input", () => { leerLineas(); refrescarTotales(); pintarHoja(); });
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
    ["cNombre", "cRut", "cTelefono", "cEmail", "cObra", "qDescuento", "qNotas"].forEach((id) => {
      $(id).addEventListener("input", () => { leerHoja(); pintarHoja(); });
      $(id).addEventListener("change", () => { leerHoja(); pintarHoja(); });
    });

    /* ---- cliente ---- */
    ["cNombre", "cRut", "cTelefono", "cEmail"].forEach((id) => {
      /* al salir del campo, no en cada tecla: si no, un nombre a medio
         escribir entraría a la libreta como cliente nuevo */
      $(id).addEventListener("change", () => { leerHoja(); sincronizarCliente(); });
    });
    $("cNombre").addEventListener("input", pintarPickCliente);
    $("cPick").addEventListener("change", () => usarCliente($("cPick").value));
    $("cNuevo").addEventListener("click", () => {
      quote.clienteId = "";
      CAMPOS_CLIENTE.forEach((k) => { quote.cliente[k] = ""; });
      quote.cliente.obra = "";
      volcarCliente(); pintarHoja();
      $("cNombre").focus();
    });

    $("cliSearch").addEventListener("input", pintarClientes);
    $("addCliente").addEventListener("click", () => {
      const c = S.saveCliente({ nombre: "" });
      $("cliSearch").value = "";
      pintarClientes();
      const f = document.querySelector(`[data-cli="${c.id}"][data-campo="nombre"]`);
      if (f) f.focus();
    });
    $("tblClientes").addEventListener("change", (ev) => {
      const t = ev.target;
      if (!t.dataset.cli || !t.dataset.campo) return;
      const c = S.cliente(t.dataset.cli);
      if (!c) return;
      const datos = { id: c.id }; datos[t.dataset.campo] = t.value;
      S.saveCliente(datos);
      /* si es el cliente de la cotización abierta, que no quede desfasada */
      if (quote.clienteId === c.id && CAMPOS_CLIENTE.indexOf(t.dataset.campo) >= 0) {
        quote.cliente[t.dataset.campo] = t.value;
        volcarCliente(); persistir(false); pintarHoja();
      }
      pintarClientes();
    });
    $("tblClientes").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-cli-act]");
      if (!b) return;
      const c = S.cliente(b.dataset.cli);
      if (!c) return;
      if (b.dataset.cliAct === "cotizar") {
        nuevaParaCliente(c);
      } else if (b.dataset.cliAct === "ver") {
        $("histSearch").value = c.nombre || "";
        $("histFilter").value = "";
        verVista("historial");
      } else {
        const n = S.trabajosDe(c).length;
        if (!confirm("¿Eliminar a " + (c.nombre || "este cliente") + " de la libreta?" +
          (n ? "\nSus " + n + " cotizaciones se mantienen." : ""))) return;
        S.deleteCliente(c.id);
        if (quote.clienteId === c.id) { quote.clienteId = ""; persistir(false); volcarCliente(); }
        pintarClientes();
      }
    });

    /* ---- seguimiento ---- */
    $("etapas").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-etapa]");
      if (!b) return;
      leerHoja();
      marcarEtapa(b.dataset.etapa);
      MQ.toast(MQ.etapa(b.dataset.etapa).nombre + (quote.numero ? " · N° " + quote.numero : ""));
    });
    $("etapas").addEventListener("change", (ev) => {
      const i = ev.target.dataset.fecha;
      if (!i) return;
      quote.hitos[i] = ev.target.value;
      guardarTrabajo(false);
    });
    $("segRechazo").addEventListener("click", () => {
      leerHoja();
      if (quote.estado === "rechazada") {
        /* se vuelve a la última etapa con fecha: donde quedó el trabajo */
        const con = MQ.ETAPAS.filter((e) => quote.hitos[e.id]);
        quote.estado = con.length ? con[con.length - 1].id : "borrador";
        delete quote.hitos.rechazada;
      } else {
        quote.estado = "rechazada";
        quote.hitos.rechazada = quote.hitos.rechazada || MQ.hoy();
      }
      guardarTrabajo(true);
    });

    $("addPago").addEventListener("click", () => {
      leerHoja();
      const pg = MQ.calc.pagos(quote, S.catalogo, S.empresa);
      const p = MQ.nuevoPago();
      /* el primer abono suele ser el saldo entero o la mitad: se propone el
         saldo, que es el número que uno tiene a mano al cobrar */
      p.monto = Math.round(pg.saldo);
      quote.pagos.push(p);
      guardarTrabajo(false);
    });
    $("listaPagos").addEventListener("input", (ev) => {
      const c = ev.target.dataset.pago;
      if (!c) return;
      const p = quote.pagos[+ev.target.dataset.i];
      if (!p) return;
      p[c] = c === "monto" ? Math.max(0, MQ.num(ev.target.value, 0)) : ev.target.value;
      /* solo los números: rehacer los campos acá dejaría el cursor afuera */
      pintarPlata(); persistir(false);
    });
    $("listaPagos").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-del-pago]");
      if (!b) return;
      quote.pagos.splice(+b.dataset.delPago, 1);
      guardarTrabajo(false);
    });

    $("btnSave").addEventListener("click", () => {
      leerHoja();
      if (!quote.partidas.length) return MQ.toast("Agrega al menos una partida antes de guardar.");
      quote = S.saveQuote(quote);
      pintarHoja();
      MQ.toast("Cotización N° " + quote.numero + " guardada");
    });

    $("btnNew").addEventListener("click", () => {
      if (hayTrabajo() && !confirm("¿Empezar una cotización nueva? Lo que no hayas guardado se pierde.")) return;
      empezarNueva(null);
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
        /* la copia parte de cero: el seguimiento es del trabajo original */
        quote.hitos = {}; quote.pagos = [];
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

    /* ---- catálogo ----
       Se guarda al salir de cada campo, no con un botón: así un material
       recién creado ya está en los desplegables de la cotización —que es
       para lo que uno lo crea— sin tener que acordarse de guardar. */
    const guardarCatalogo = (cat) => {
      S.saveCatalogo(cat || leerCatalogo());
      pintarCatalogo();
    };
    $("tblItems").addEventListener("change", () => guardarCatalogo());
    ["pGastos", "pMargen", "pRedondeo"].forEach((id) =>
      $(id).addEventListener("change", () => guardarCatalogo()));
    $("tblItems").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-del-item], [data-dup-item]");
      if (!b) return;
      const cat = leerCatalogo();
      if (b.dataset.dupItem != null) {
        /* la copia queda junto al original y con el mismo precio: se duplica
           para cambiarle una medida o un detalle, no para partir de cero */
        const o = cat.items[+b.dataset.dupItem];
        if (!o) return;
        const copia = MQ.clone(o);
        copia.id = "i" + MQ.uid();
        copia.nombre = o.nombre + " (copia)";
        cat.items.splice(+b.dataset.dupItem + 1, 0, copia);
        guardarCatalogo(cat);
        const f = $("tblItems").querySelector(`[data-campo="nombre"][data-i="${S.catalogo.items.findIndex((x) => x.id === copia.id)}"]`);
        if (f) { f.focus(); f.select(); }
        MQ.toast("Copia creada: cámbiale lo que corresponda");
        return;
      }
      const it = cat.items[+b.dataset.delItem];
      if (it && !confirm("¿Quitar «" + MQ.nombreItem(it) + "» del catálogo?")) return;
      cat.items.splice(+b.dataset.delItem, 1);
      guardarCatalogo(cat);
    });
    $("addItem").addEventListener("click", () => {
      const cat = leerCatalogo();
      const nuevo = { id: "i" + MQ.uid(), cat: "insumo", nombre: "Ítem nuevo", unidad: "un", precio: 0 };
      cat.items.push(nuevo);
      guardarCatalogo(cat);
      const f = $("tblItems").querySelector(`[data-campo="nombre"][data-i="${S.catalogo.items.findIndex((x) => x.id === nuevo.id)}"]`);
      if (f) { f.focus(); f.select(); }
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
      if (kind === "clientes" && !$("view-clientes").hidden) pintarClientes();
      if (kind === "quotes" && !$("view-historial").hidden) pintarHistorial();
    });
  }

  /* ================= ARRANQUE =================
     La app parte en blanco, lista para cotizar. Lo que quedó a medio hacer
     no se pierde: se guarda aparte y se ofrece retomarlo, igual que abrir
     una de las guardadas. */
  function pintarAviso(pendiente) {
    const hay = pendiente && hayTrabajo(pendiente);
    const guardadas = S.quotes.length;
    if (!hay && !guardadas) { $("avisoInicio").hidden = true; return; }

    if (hay) {
      const c = (pendiente.cliente || {}).nombre;
      const n = (pendiente.partidas || []).length;
      $("avisoTexto").textContent = "Quedó una cotización a medio hacer" +
        (c ? " de " + c : "") + (n ? " · " + n + (n === 1 ? " partida" : " partidas") : "") + ".";
    } else {
      $("avisoTexto").textContent = "Tienes " + guardadas + (guardadas === 1 ? " cotización guardada" : " cotizaciones guardadas") + ".";
    }
    $("avisoRetomar").hidden = !hay;
    $("avisoAbrir").hidden = !guardadas;
    $("avisoCerrar").textContent = hay ? "Descartarla" : "Entendido";
    $("avisoInicio").hidden = false;
  }

  function iniciar() {
    /* lo del cierre anterior se pone a salvo antes de que la hoja en blanco
       pise el borrador, que se reescribe apenas se pinta */
    const previo = S.loadDraft();
    if (previo && hayTrabajo(previo)) S.savePendiente(previo);
    const pendiente = S.loadPendiente();

    quote = nuevaCotizacion();
    montarCroquis();
    conectar();
    volcarHoja();
    $("crAyuda").textContent = AYUDA.sel;
    seleccionarPartida(null);
    verVista("cotizar");
    pintarAviso(pendiente);

    $("avisoRetomar").addEventListener("click", () => {
      const p = S.loadPendiente();
      if (!p) return;
      quote = p;
      S.clearPendiente();
      $("avisoInicio").hidden = true;
      volcarHoja();
      seleccionarPartida(quote.partidas.length ? quote.partidas[0].id : null);
      MQ.toast("Retomando lo que estaba a medio hacer");
    });
    $("avisoAbrir").addEventListener("click", () => { $("avisoInicio").hidden = true; verVista("historial"); });
    $("avisoCerrar").addEventListener("click", () => { S.clearPendiente(); $("avisoInicio").hidden = true; });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
