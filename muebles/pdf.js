/* Dos documentos con los mismos datos y propósitos distintos:

   - la cotización para el cliente: qué es, cómo se ve, de qué está hecho y
     cuánto vale. Sin cantidades ni costos de material.
   - la hoja de taller: los cortes, las cantidades y la lista de compra. */
window.MQ = window.MQ || {};

MQ.pdf = (function () {
  const M = 16, ANCHO = 210, ALTO = 297;
  const GRIS = [110, 110, 110], NEGRO = [25, 25, 25], LINEA = [205, 205, 205];

  const fecha = (iso) => new Date(iso || Date.now()).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });

  /* Paleta del croquis sobre papel blanco: la de la pantalla es oscura. */
  const TRAZO = {
    trazo: { borde: [35, 33, 31], grosor: 0.55 },
    lapiz: { borde: [60, 56, 52], grosor: 0.38 },
    cota: { borde: [150, 140, 132], grosor: 0.25 },
    punto: { relleno: [176, 134, 66] }
  };
  const FUENTE = { dm: 6.5, rotulo: 8.5, acote: 6, mat: 5.5 };
  const COLOR_TEXTO = { acote: [120, 95, 60], mat: [150, 110, 55], rotulo: NEGRO };

  let logoPdf = null;
  const ALTO_LOGO = 32, ANCHO_LOGO = 84;

  function nuevo() { const { jsPDF } = window.jspdf; return new jsPDF({ unit: "mm", format: "a4" }); }

  /* Encabezado en tres bloques apoyados en la misma línea de base: el logo a
     la izquierda, al centro qué documento es, y a la derecha su número y
     fecha. El nombre de la empresa solo aparece si no está ya en el logo.
     Sin logo la banda se queda compacta, para no regalar papel. */
  function hoja(doc, empresa, titulo, numero) {
    const cx = ANCHO / 2;
    let base = M + 11;

    if (logoPdf) {
      const ratio = logoPdf.w / logoPdf.h;
      let h = ALTO_LOGO, w = h * ratio;
      if (w > ANCHO_LOGO) { w = ANCHO_LOGO; h = w / ratio; }
      const arriba = M - 2;
      doc.addImage(logoPdf.data, "PNG", M, arriba, w, h, "logo", "SLOW");
      base = arriba + h;
    }

    const nombre = empresa.nombre || "Taller";
    if (!logoPdf) {
      doc.setFont("helvetica", "bold").setFontSize(15).setTextColor.apply(doc, NEGRO);
      doc.text(nombre, M, base);
    } else if (!empresa.logoConNombre) {
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor.apply(doc, GRIS);
      doc.text(nombre, cx, base - 13, { align: "center" });
    }

    doc.setFont("helvetica", "bold").setFontSize(13.5).setTextColor.apply(doc, NEGRO);
    doc.text(titulo, cx, base - 6.5, { align: "center" });

    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor.apply(doc, GRIS);
    const datos = [empresa.rut && "RUT " + empresa.rut, empresa.direccion, empresa.telefono, empresa.email].filter(Boolean).join("  ·  ");
    if (datos) doc.text(datos, cx, base, { align: "center" });

    doc.setFontSize(9);
    doc.text("N° " + (numero || "—") + "   ·   " + fecha(), ANCHO - M, base, { align: "right" });

    const raya = base + 4.5;
    doc.setDrawColor.apply(doc, LINEA).setLineWidth(0.3);
    doc.line(M, raya, ANCHO - M, raya);
    return raya + 8;
  }

  function pie(doc) {
    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor.apply(doc, GRIS);
      doc.text("Página " + i + " de " + n, ANCHO - M, ALTO - 8, { align: "right" });
    }
  }

  const salto = (doc, y, alto, emp, titulo, numero) =>
    y + alto > ALTO - 20 ? (doc.addPage(), hoja(doc, emp, titulo, numero)) : y;

  /* ---------- croquis en papel ---------- */
  function dibujarFigura(doc, fig, ox, oy, ancho) {
    const s = ancho / fig.w;
    const X = (v) => ox + v * s, Y = (v) => oy + v * s;
    fig.formas.forEach((f) => {
      const e = TRAZO[f.clase] || {};
      /* el color del material manda sobre el de la clase, igual que en
         pantalla, y un poco más grueso para que el tono se note en papel */
      const borde = f.col || e.borde;
      const grosor = f.col ? e.grosor + 0.15 : e.grosor;
      if (f.t === "rect") {
        if (!borde) return;
        doc.setDrawColor.apply(doc, borde); doc.setLineWidth(grosor);
        doc.rect(X(f.x), Y(f.y), f.w * s, f.h * s, "S");
      } else if (f.t === "poli") {
        if (!borde) return;
        doc.setDrawColor.apply(doc, borde); doc.setLineWidth(grosor);
        const v = f.pts, n = f.cerrado ? v.length : v.length - 1;
        for (let i = 0; i < n; i++) {
          const a = v[i], b = v[(i + 1) % v.length];
          doc.line(X(a.x), Y(a.y), X(b.x), Y(b.y));
        }
      } else if (f.t === "linea") {
        if (!borde) return;
        doc.setDrawColor.apply(doc, borde); doc.setLineWidth(grosor);
        doc.line(X(f.x1), Y(f.y1), X(f.x2), Y(f.y2));
      } else if (f.t === "circulo") {
        doc.setFillColor.apply(doc, e.relleno || GRIS);
        doc.circle(X(f.cx), Y(f.cy), Math.max(0.5, f.r * s), "F");
      } else if (f.t === "texto") {
        doc.setFont("helvetica", "normal").setFontSize(FUENTE[f.clase] || 6.5);
        doc.setTextColor.apply(doc, COLOR_TEXTO[f.clase] || GRIS);
        doc.text(f.s, X(f.x), Y(f.y), { align: f.anclaje === "fin" ? "right" : "center" });
      }
    });
    doc.setLineWidth(0.3);
    return fig.h * s;
  }

  const ANCHO_DIB = 120;

  /* Dibuja las vistas con algo dibujado de una partida. */
  function croquisPartida(doc, p, y, emp, titulo, numero, conMaterial, cat) {
    const vistas = MQ.croquis.conDibujo(p.croquis);
    if (!vistas.length) return y;
    const nombreMat = conMaterial ? (id) => {
      const it = MQ.calc.item(cat, id);
      return it ? MQ.nombreItem(it) : "";
    } : null;
    vistas.forEach((v) => {
      const fig = MQ.croquis.figura(p.croquis, v, { nombreMat });
      const alto = fig.h * (ANCHO_DIB / fig.w);
      y = salto(doc, y, alto + 12, emp, titulo, numero);
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor.apply(doc, GRIS);
      doc.text(v.nombre.toUpperCase(), M, y);
      doc.setFont("helvetica", "normal").setFontSize(7.5);
      doc.text("un cuadro = " + p.croquis.escala + " mm", M + 34, y);
      dibujarFigura(doc, fig, M, y + 3, ANCHO_DIB);
      /* la nomenclatura al costado del dibujo, que es donde sobra papel:
         una muestra del color y el material que le toca */
      if (fig.leyenda && fig.leyenda.length) {
        const lx = M + ANCHO_DIB + 6;
        let ly = y + 6;
        doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor.apply(doc, GRIS);
        doc.text("MATERIALES", lx, ly); ly += 4;
        doc.setFont("helvetica", "normal").setFontSize(7);
        fig.leyenda.forEach((l) => {
          doc.setDrawColor.apply(doc, l.col); doc.setLineWidth(0.9);
          doc.line(lx, ly - 1, lx + 6, ly - 1);
          doc.setTextColor.apply(doc, NEGRO);
          doc.text(doc.splitTextToSize(l.nombre, ANCHO - M - lx - 9)[0], lx + 8, ly);
          ly += 4.2;
        });
        doc.setLineWidth(0.3);
      }
      y += alto + 11;
    });
    return y;
  }

  /* ---------- cotización para el cliente ---------- */
  function cotizacion(quote, cat, empresa) {
    const doc = nuevo();
    const titulo = "COTIZACIÓN";
    let y = hoja(doc, empresa, titulo, quote.numero);
    const T = MQ.calc.totales(quote, cat, empresa);

    const c = quote.cliente || {};
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor.apply(doc, GRIS);
    doc.text("CLIENTE", M, y);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor.apply(doc, NEGRO);
    doc.text(c.nombre || "—", M, y + 5.5);
    doc.setFontSize(8.5).setTextColor.apply(doc, GRIS);
    const cd = [c.rut && "RUT " + c.rut, c.telefono, c.email].filter(Boolean).join("  ·  ");
    if (cd) doc.text(cd, M, y + 10);
    if (c.obra) doc.text("Obra: " + c.obra, M, y + 14);
    y += 22;

    const col = { desc: M, cant: 142, uni: 170, tot: ANCHO - M };
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor.apply(doc, GRIS);
    doc.text("DETALLE", col.desc, y);
    doc.text("CANT.", col.cant, y, { align: "right" });
    doc.text("UNITARIO", col.uni, y, { align: "right" });
    doc.text("TOTAL", col.tot, y, { align: "right" });
    y += 2.5;
    doc.setDrawColor.apply(doc, LINEA).line(M, y, ANCHO - M, y);
    y += 6;

    T.partidas.forEach((x, i) => {
      const p = x.partida;
      y = salto(doc, y, 20, empresa, titulo, quote.numero);
      doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor.apply(doc, NEGRO);
      doc.text(String(i + 1) + ". " + (p.nombre || "Partida"), col.desc, y);
      doc.setFont("helvetica", "normal").setFontSize(9);
      doc.text(String(x.calc.cantidad), col.cant, y, { align: "right" });
      doc.text(MQ.clp(x.calc.unitario), col.uni, y, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(MQ.clp(x.calc.total), col.tot, y, { align: "right" });

      let dy = 4;
      if (p.descripcion) {
        doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor.apply(doc, NEGRO);
        const ls = doc.splitTextToSize(p.descripcion, 118);
        doc.text(ls, col.desc + 4, y + dy);
        dy += ls.length * 3.7;
      }
      /* de qué está hecho, sin cantidades ni precios: es argumento de
         calidad, no la estructura de costos del taller */
      const mats = [];
      MQ.CATEGORIAS.forEach((g) => {
        const nn = [];
        x.calc.lineas.filter((l) => l.cat === g.id).forEach((l) => {
          if (nn.indexOf(l.nombre) < 0) nn.push(l.nombre);
        });
        if (nn.length && g.id !== "mano") mats.push(nn.join(", "));
      });
      if (mats.length) {
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor.apply(doc, GRIS);
        const ls = doc.splitTextToSize(mats.join(". "), 118);
        doc.text(ls, col.desc + 4, y + dy + 0.6);
        dy += ls.length * 3.5 + 1;
      }
      y += dy + 4;
      doc.setDrawColor(235, 235, 235).line(M, y - 2.5, ANCHO - M, y - 2.5);
    });

    y = salto(doc, y, 40, empresa, titulo, quote.numero) + 4;
    const fila = (k, v, bold, size) => {
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(size || 9.5);
      doc.setTextColor.apply(doc, bold ? NEGRO : GRIS);
      doc.text(k, 136, y, { align: "right" });
      doc.setTextColor.apply(doc, NEGRO);
      doc.text(v, ANCHO - M, y, { align: "right" });
      y += 5.5;
    };
    fila("Neto", MQ.clp(T.neto));
    if (T.descuento > 0) fila("Descuento " + T.descPct + "%", "− " + MQ.clp(T.descuento));
    fila("IVA " + T.ivaPct + "%", MQ.clp(T.iva));
    y += 1;
    doc.setDrawColor.apply(doc, LINEA).line(136, y - 4, ANCHO - M, y - 4);
    fila("TOTAL", MQ.clp(T.total), true, 12);

    y += 6;
    const bloque = (t, txt) => {
      if (!txt) return;
      y = salto(doc, y, 24, empresa, titulo, quote.numero);
      doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor.apply(doc, GRIS);
      doc.text(t, M, y); y += 4.5;
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor.apply(doc, NEGRO);
      const ls = doc.splitTextToSize(String(txt), ANCHO - M * 2);
      doc.text(ls, M, y); y += ls.length * 3.8 + 5;
    };
    bloque("NOTAS", quote.notas);
    bloque("CONDICIONES COMERCIALES", empresa.condiciones);
    if (empresa.validez) {
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor.apply(doc, GRIS);
      doc.text("Valores netos en pesos. Cotización válida por " + empresa.validez + " días.", M, y);
    }

    /* croquis, sin las etiquetas de material */
    const conDibujo = (quote.partidas || []).filter((p) => !MQ.croquis.vacio(p.croquis));
    if (conDibujo.length) {
      doc.addPage();
      let yy = hoja(doc, empresa, "CROQUIS", quote.numero);
      conDibujo.forEach((p, i) => {
        yy = salto(doc, yy, 24, empresa, "CROQUIS", quote.numero);
        doc.setFont("helvetica", "bold").setFontSize(10).setTextColor.apply(doc, NEGRO);
        doc.text(String((quote.partidas || []).indexOf(p) + 1) + ". " + (p.nombre || "Partida"), M, yy);
        yy += 6;
        yy = croquisPartida(doc, p, yy, empresa, "CROQUIS", quote.numero, false, cat);
        yy += 4;
      });
    }

    pie(doc);
    return doc;
  }

  /* ---------- hoja de taller ---------- */
  function taller(quote, cat, empresa) {
    const doc = nuevo();
    const titulo = "HOJA DE TALLER";
    let y = hoja(doc, empresa, titulo, quote.numero);
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor.apply(doc, GRIS);
    doc.text("Documento interno: cortes, cantidades y costos. No es para el cliente.", M, y);
    y += 8;

    (quote.partidas || []).forEach((p, i) => {
      const c = MQ.calc.costear(p, cat);
      y = salto(doc, y, 30, empresa, titulo, quote.numero);
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor.apply(doc, NEGRO);
      doc.text(String(i + 1) + ". " + (p.nombre || "Partida") + (c.cantidad > 1 ? "  ·  " + c.cantidad + " unidades" : ""), M, y);
      y += 5;

      doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor.apply(doc, GRIS);
      doc.text("MATERIAL", M, y);
      doc.text("CORTE", 104, y, { align: "right" });
      doc.text("CANTIDAD", 140, y, { align: "right" });
      doc.text("ORIGEN", 160, y, { align: "right" });
      doc.text("COSTO", ANCHO - M, y, { align: "right" });
      y += 2; doc.setDrawColor.apply(doc, LINEA).line(M, y, ANCHO - M, y); y += 4.5;

      c.lineas.forEach((l) => {
        y = salto(doc, y, 8, empresa, titulo, quote.numero);
        doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor.apply(doc, NEGRO);
        /* 50 mm para el nombre: el corte desglosado de un marco ocupa lo suyo */
        doc.text(doc.splitTextToSize(l.nombre, 50)[0], M, y);
        doc.text(MQ.calc.textoCorte(l), 104, y, { align: "right" });
        doc.text(MQ.calc.conUnidad(l.cant, l.unidad), 140, y, { align: "right" });
        doc.setFontSize(7.5).setTextColor.apply(doc, GRIS);
        doc.text(l.origen === "croquis" ? (l.vista || "croquis") : "a mano", 160, y, { align: "right" });
        doc.setFontSize(8.5).setTextColor.apply(doc, NEGRO);
        doc.text(MQ.clp(l.total), ANCHO - M, y, { align: "right" });
        y += 4.4;
      });

      y += 1.5;
      doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor.apply(doc, NEGRO);
      doc.text("Costo directo " + MQ.clp(c.costos.directo) + "   ·   Precio " + MQ.clp(c.unitario) +
        (c.cantidad > 1 ? "   ·   Total " + MQ.clp(c.total) : ""), M, y);
      y += 7;

      y = croquisPartida(doc, p, y, empresa, titulo, quote.numero, true, cat);
      y += 4;
    });

    /* lista de compra */
    const L = MQ.calc.listaCompra(quote, cat);
    y = salto(doc, y, 50, empresa, titulo, quote.numero) + 2;
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor.apply(doc, NEGRO);
    doc.text("Lista de compra", M, y); y += 6;

    let catActual = null;
    L.forEach((g) => {
      y = salto(doc, y, 10, empresa, titulo, quote.numero);
      if (g.cat !== catActual) {
        catActual = g.cat;
        doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor.apply(doc, GRIS);
        doc.text(MQ.categoria(g.cat).nombre.toUpperCase(), M, y);
        y += 4.2;
      }
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor.apply(doc, NEGRO);
      doc.text(doc.splitTextToSize(g.nombre, 78)[0], M + 2, y);
      doc.setFont("helvetica", "bold");
      doc.text(MQ.calc.conUnidad(g.cant, g.unidad), 120, y, { align: "right" });
      doc.setFont("helvetica", "normal").setTextColor.apply(doc, GRIS).setFontSize(7.5);
      /* los cortes pueden ser varios por ítem: se les deja una segunda línea
         antes de recortarlos, porque es con esto que se va al banco */
      let extra = 0;
      if (g.cortes.length) {
        const t = doc.splitTextToSize(g.cortes.map((x) => x.piezas + " de " + x.largo).join(" · "), 60).slice(0, 2);
        doc.text(t, 124, y);
        extra = (t.length - 1) * 3.4;
      }
      doc.setTextColor.apply(doc, NEGRO).setFontSize(9);
      doc.text(MQ.clp(g.total), ANCHO - M, y, { align: "right" });
      y += 4.6 + extra;
    });

    const total = L.reduce((s, g) => s + g.total, 0);
    y += 2;
    doc.setDrawColor.apply(doc, LINEA).line(120, y - 2, ANCHO - M, y - 2);
    doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor.apply(doc, NEGRO);
    doc.text("Costo directo de la cotización", 120, y + 2, { align: "right" });
    doc.text(MQ.clp(total), ANCHO - M, y + 2, { align: "right" });

    pie(doc);
    return doc;
  }

  const nombreArchivo = (base, quote, cliente) =>
    [base, "N" + (quote.numero || 0), (cliente || "").trim().replace(/[^\wáéíóúñÁÉÍÓÚÑ ]/g, "").replace(/\s+/g, "_")]
      .filter(Boolean).join("_") + ".pdf";

  async function conLogo(empresa, armar) {
    logoPdf = await MQ.logoParaPdf(empresa.logo);
    try { return armar(); } finally { logoPdf = null; }
  }

  return {
    async descargarCotizacion(quote, cat, empresa) {
      const doc = await conLogo(empresa, () => cotizacion(quote, cat, empresa));
      doc.save(nombreArchivo("Cotizacion", quote, (quote.cliente || {}).nombre));
    },
    async descargarTaller(quote, cat, empresa) {
      const doc = await conLogo(empresa, () => taller(quote, cat, empresa));
      doc.save(nombreArchivo("Taller", quote, (quote.cliente || {}).nombre));
    },
    /* el PDF como archivo, sin descargarlo: lo necesita el envío por WhatsApp */
    async archivoCotizacion(quote, cat, empresa) {
      const doc = await conLogo(empresa, () => cotizacion(quote, cat, empresa));
      const nombre = nombreArchivo("Cotizacion", quote, (quote.cliente || {}).nombre);
      return { blob: doc.output("blob"), nombre, guardar: () => doc.save(nombre) };
    }
  };
})();
