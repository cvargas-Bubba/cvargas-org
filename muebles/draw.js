/* Esquema frontal del mueble, a escala y acotado.

   `figura()` devuelve el dibujo como una lista de formas en coordenadas
   abstractas, sin color ni unidades. De ahí salen las dos versiones:
   `svg()` para la pantalla (colores desde styles.css) y el render de pdf.js
   para el papel, que usa su propia paleta clara. Así el dibujo se define
   una sola vez. */
window.MQ = window.MQ || {};

MQ.draw = (function () {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  const W = 420, HV = 320, PAD = 46;
  /* bajo estos tamaños la medida escrita dentro del frente no se lee */
  const MIN_W = 42, MIN_H = 13;

  function figura(m, cat) {
    const t = MQ.tipo(m.tipo);
    const usa = (p) => t.partes.indexOf(p) >= 0;
    const tab = cat.tableros.find((x) => x.id === m.mat.cuerpo) || cat.tableros[0];
    const e = tab.espesor;

    const A = Math.max(1, m.ancho), H = Math.max(1, m.alto);
    const k = Math.min((W - PAD * 2) / A, (HV - PAD * 2) / Math.max(H, 120));
    const w = A * k, h = Math.max(H * k, 8);
    const x0 = (W - w) / 2, y0 = (HV - h) / 2;

    const formas = [];
    const rect = (x, y, rw, rh, clase) => formas.push({ t: "rect", x, y, w: Math.max(0.5, rw), h: Math.max(0.5, rh), clase });
    const linea = (x1, y1, x2, y2, clase) => formas.push({ t: "linea", x1, y1, x2, y2, clase });
    const circulo = (cx, cy, r, clase) => formas.push({ t: "circulo", cx, cy, r, clase });
    const texto = (x, y, s, clase, extra) => formas.push(Object.assign({ t: "texto", x, y, s: String(s), clase, anclaje: "centro" }, extra || {}));
    /* medida real del frente, escrita dentro del frente */
    const medidaFrente = (x, y, rw, rh, mmAncho, mmAlto) => {
      if (rw < MIN_W || rh < MIN_H) return;
      texto(x + rw / 2, y + rh / 2 + 3, Math.round(mmAncho) + " × " + Math.round(mmAlto), "dmf");
    };

    if (m.tipo === "cubierta") {
      const hh = Math.max(h, 16);
      rect(x0, y0, w, hh, "cuerpo");
      texto(W / 2, y0 + hh / 2 + 3, Math.round(A) + " × " + Math.round(m.prof), "dmf");
    } else {
      rect(x0, y0, w, h, "cuerpo");

      const g = MQ.calc.geometria(m, cat);
      const hCaj = g.hCaj * k;
      const zonaCaj = g.zonaCajones * k;
      const hZoc = usa("zocalo") && m.zocalo ? MQ.calc.ALTO_ZOCALO * k : 0;
      const wCol = g.anchoCol * k;

      /* con columna propia los cajones se apilan abajo en la primera columna;
         si no, cruzan todo el ancho por arriba */
      const xCaj = x0 + 2;
      const wCaj = g.colCaj ? wCol - 3 : w - 4;
      const yCaj = g.colCaj ? y0 + h - hZoc - 2 - g.nCaj * hCaj : y0 + 2;
      for (let i = 0; i < g.nCaj; i++) {
        const y = yCaj + i * hCaj;
        rect(xCaj, y, wCaj, hCaj - 3, "frente");
        medidaFrente(xCaj, y, wCaj, hCaj - 3, g.anchoFrenteCajon, g.altoFrenteCajon);
      }

      /* puertas */
      const yPu = y0 + zonaCaj + 2;
      const hPu = h - zonaCaj - hZoc - 4;
      const xPu = x0 + 2 + (g.colCaj ? wCol : 0);
      if (g.nPuertas > 0 && hPu > 6) {
        for (let i = 0; i < g.nPuertas; i++) {
          const x = xPu + i * wCol;
          rect(x, yPu, wCol - 2, hPu, "frente");
          medidaFrente(x, yPu, wCol - 2, hPu, g.anchoPuerta, g.altoPuerta);
          /* tirador: las puertas de un par se abren hacia afuera */
          circulo(x + (i % 2 === 0 ? wCol - 10 : 6), yPu + hPu / 2, 2.6, "tir");
        }
      } else if (usa("entrepanos")) {
        /* sin puertas se ven los entrepaños */
        const n = Math.max(0, Math.round(m.entrepanos));
        const libre = h - zonaCaj - hZoc;
        for (let i = 1; i <= n; i++) {
          rect(x0 + 2, y0 + zonaCaj + (libre * i) / (n + 1), w - 4, Math.max(1.5, e * k), "entrepano");
        }
      }
      if (hZoc > 0) rect(x0 + 2, y0 + h - hZoc, w - 4, hZoc - 2, "zocalo");
      if (usa("barra") && m.barra) {
        /* la barra cruza solo la zona de colgar, no la columna de cajones */
        const y = y0 + zonaCaj + 14;
        linea(xPu + 4, y, x0 + w - 6, y, "barra");
      }
    }

    /* cotas generales */
    const yc = y0 + h + 22;
    linea(x0, yc, x0 + w, yc, "cota");
    texto(W / 2, yc - 6, A + " mm", "dm");
    const xc = x0 - 16;
    linea(xc, y0, xc, y0 + h, "cota");
    texto(xc - 6, y0 + h / 2, H + " mm", "dm", { rot: -90 });
    texto(W - 4, HV - 6, "prof. " + m.prof + " mm", "dm", { anclaje: "fin" });

    return { w: W, h: HV, formas };
  }

  /* ---------- salida para la pantalla ----------
     `formas()` da solo el contenido, para poder actualizar un <svg> que ya
     existe en vez de reemplazarlo: si el elemento se recrea entre dos clics,
     el navegador no llega a emitir el doble clic. */
  function formas(fig) {
    return fig.formas.map((f) => {
      const n = (v) => (+v).toFixed(1);
      if (f.t === "rect") return `<rect x="${n(f.x)}" y="${n(f.y)}" width="${n(f.w)}" height="${n(f.h)}" class="${f.clase}"/>`;
      if (f.t === "linea") return `<line x1="${n(f.x1)}" y1="${n(f.y1)}" x2="${n(f.x2)}" y2="${n(f.y2)}" class="${f.clase}"/>`;
      if (f.t === "circulo") return `<circle cx="${n(f.cx)}" cy="${n(f.cy)}" r="${n(f.r)}" class="${f.clase}"/>`;
      if (f.t === "poli") {
        const pts = f.pts.map((p) => n(p.x) + "," + n(p.y)).join(" ");
        return `<${f.cerrado ? "polygon" : "polyline"} points="${pts}" class="${f.clase}"/>`;
      }
      const cls = f.clase + (f.anclaje === "fin" ? " der" : "");
      const rot = f.rot ? ` transform="rotate(${f.rot} ${n(f.x)} ${n(f.y)})"` : "";
      return `<text x="${n(f.x)}" y="${n(f.y)}" class="${cls}"${rot}>${esc(f.s)}</text>`;
    }).join("");
  }

  function svg(fig, etiqueta) {
    return `<svg viewBox="0 0 ${fig.w} ${fig.h}" role="img" aria-label="${esc(etiqueta || "Esquema frontal del mueble")}">${formas(fig)}</svg>`;
  }

  return { figura, svg, formas, esquema: (m, cat) => svg(figura(m, cat)) };
})();
