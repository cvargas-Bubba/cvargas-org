/* Serializa una figura —una lista de formas sin color ni unidades— a SVG.

   La misma figura la dibuja el render en PDF de pdf.js, así que el croquis
   se define una sola vez y sale igual en pantalla y en papel. */
window.MQ = window.MQ || {};

MQ.draw = (function () {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const n = (v) => (+v).toFixed(1);

  /* Solo el contenido, para poder actualizar un <svg> que ya existe en vez
     de reemplazarlo: si el elemento se recrea entre dos clics, el navegador
     no llega a emitir el doble clic. */
  function formas(fig) {
    return fig.formas.map((f) => {
      if (f.t === "rect") return `<rect x="${n(f.x)}" y="${n(f.y)}" width="${n(f.w)}" height="${n(f.h)}" class="${f.clase}"/>`;
      if (f.t === "linea") return `<line x1="${n(f.x1)}" y1="${n(f.y1)}" x2="${n(f.x2)}" y2="${n(f.y2)}" class="${f.clase}"/>`;
      if (f.t === "circulo") return `<circle cx="${n(f.cx)}" cy="${n(f.cy)}" r="${n(f.r)}" class="${f.clase}"/>`;
      if (f.t === "poli") {
        const pts = f.pts.map((p) => n(p.x) + "," + n(p.y)).join(" ");
        return `<${f.cerrado ? "polygon" : "polyline"} points="${pts}" class="${f.clase}"/>`;
      }
      const cls = f.clase + (f.anclaje === "fin" ? " der" : "") + (f.anclaje === "inicio" ? " izq" : "");
      const rot = f.rot ? ` transform="rotate(${f.rot} ${n(f.x)} ${n(f.y)})"` : "";
      return `<text x="${n(f.x)}" y="${n(f.y)}" class="${cls}"${rot}>${esc(f.s)}</text>`;
    }).join("");
  }

  const svg = (fig, etiqueta) =>
    `<svg viewBox="0 0 ${fig.w} ${fig.h}" role="img" aria-label="${esc(etiqueta || "Croquis")}">${formas(fig)}</svg>`;

  return { formas, svg };
})();
