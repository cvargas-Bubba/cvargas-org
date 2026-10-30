/* Croquis de la cotización: un dibujo acotado, hecho con líneas, rectángulos,
   rombos, polilíneas, texto y cotas sobre una grilla.

   Se guarda como vectores (listas de puntos), no como imagen: ocupa unos pocos
   KB en lugar de cientos, se puede seguir editando y sale nítido en el PDF,
   porque `figura()` devuelve la misma estructura que MQ.draw y la dibuja el
   mismo render de pdf.js. */
window.MQ = window.MQ || {};

MQ.croquis = (function () {
  const W = 1200, H = 800;   // unidades del lienzo
  const CELDA = 20;          // lado de un cuadro de la grilla
  const PASO = CELDA / 2;    // a esto se ajustan los puntos
  const MIN = 6;             // trazos más cortos que esto se descartan
  const CERCA = 12;          // para cerrar una polilínea sobre su primer punto
  const TOLERANCIA = 10;     // cuánto se puede errar el clic sobre un trazo
  const DOBLE = 500;         // ventana del doble clic, como la de Windows

  const nuevo = () => ({ escala: 100, objetos: [] });
  /* milímetros que mide una unidad del lienzo */
  const mmPorUnidad = (c) => MQ.num(c.escala, 100) / CELDA;

  const ajustar = (v, libre) => (libre ? Math.round(v) : Math.round(v / PASO) * PASO);
  const dentro = (v, max) => Math.max(0, Math.min(max, v));
  const largo = (o) => Math.hypot(o.x2 - o.x1, o.y2 - o.y1);

  /* ---------- geometría común ----------
     Casi todo se reduce a una lista de vértices: así el dibujo, el clic, el
     movimiento y el marco de selección tratan igual a todas las figuras. */
  function vertices(o) {
    if (o.t === "rect") return [{ x: o.x, y: o.y }, { x: o.x + o.w, y: o.y }, { x: o.x + o.w, y: o.y + o.h }, { x: o.x, y: o.y + o.h }];
    if (o.t === "rombo") {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      return [{ x: cx, y: o.y }, { x: o.x + o.w, y: cy }, { x: cx, y: o.y + o.h }, { x: o.x, y: cy }];
    }
    if (o.t === "poli") return o.pts.map((p) => ({ x: p.x, y: p.y }));
    if (o.t === "texto") return [{ x: o.x, y: o.y }];
    return [{ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }];
  }
  const cerrada = (o) => o.t === "rect" || o.t === "rombo" || (o.t === "poli" && o.cerrado);

  function caja(o) {
    if (o.t === "texto") {
      const an = Math.max(24, o.s.length * 7);
      return { x1: o.x - an / 2, y1: o.y - 16, x2: o.x + an / 2, y2: o.y + 6 };
    }
    const v = vertices(o);
    return {
      x1: Math.min.apply(null, v.map((p) => p.x)), y1: Math.min.apply(null, v.map((p) => p.y)),
      x2: Math.max.apply(null, v.map((p) => p.x)), y2: Math.max.apply(null, v.map((p) => p.y))
    };
  }

  function distanciaASegmento(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (!l2) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  /* distancia al contorno de la figura, no a su interior: un rectángulo se
     agarra del borde, para poder dibujar dentro de él sin seleccionarlo */
  function distancia(o, x, y) {
    if (o.t === "texto") {
      const c = caja(o);
      const dx = Math.max(c.x1 - x, 0, x - c.x2), dy = Math.max(c.y1 - y, 0, y - c.y2);
      return Math.hypot(dx, dy);
    }
    const v = vertices(o);
    let d = Infinity;
    const n = cerrada(o) ? v.length : v.length - 1;
    for (let i = 0; i < n; i++) {
      const a = v[i], b = v[(i + 1) % v.length];
      d = Math.min(d, distanciaASegmento(x, y, a.x, a.y, b.x, b.y));
    }
    return d;
  }

  /* El objeto que está bajo el punto, probando del último al primero para que
     gane el que se dibujó encima. */
  function objetoEn(c, x, y) {
    for (let i = (c.objetos || []).length - 1; i >= 0; i--) {
      if (distancia(c.objetos[i], x, y) < TOLERANCIA) return c.objetos[i];
    }
    return null;
  }

  function mover(o, dx, dy) {
    if (o.t === "rect" || o.t === "rombo" || o.t === "texto") { o.x += dx; o.y += dy; }
    else if (o.t === "poli") o.pts.forEach((p) => { p.x += dx; p.y += dy; });
    else { o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy; }
  }

  /* Lo que muestra una cota: la etiqueta escrita a mano si la hay, y si no la
     medida que sale de su largo y de la escala de la grilla. Un número suelto
     se completa con la unidad; cualquier otro texto se respeta tal cual. */
  function etiquetaCota(o, mm) {
    const e = (o.etiqueta || "").trim();
    if (!e) return Math.round(largo(o) * mm) + " mm";
    return /^[\d.,]+$/.test(e) ? e + " mm" : e;
  }

  /* ---------- dibujo ---------- */
  /* Devuelve {w, h, formas} igual que MQ.draw.figura, para que lo pinten tanto
     el SVG de la pantalla como el render en PDF. */
  function figura(c, opciones) {
    const op = opciones || {};
    const formas = [];
    const linea = (x1, y1, x2, y2, clase) => formas.push({ t: "linea", x1, y1, x2, y2, clase });
    const texto = (x, y, s, clase) => formas.push({ t: "texto", x, y, s: String(s), clase, anclaje: "centro" });
    const poli = (pts, cerrado, clase) => formas.push({ t: "poli", pts, cerrado: !!cerrado, clase });

    if (op.grilla) {
      for (let x = CELDA; x < W; x += CELDA) linea(x, 0, x, H, "grid");
      for (let y = CELDA; y < H; y += CELDA) linea(0, y, W, y, "grid");
    }

    const mm = mmPorUnidad(c);
    (c.objetos || []).forEach((o) => {
      if (o.t === "rect") {
        formas.push({ t: "rect", x: Math.min(o.x, o.x + o.w), y: Math.min(o.y, o.y + o.h), w: Math.abs(o.w), h: Math.abs(o.h), clase: "trazo" });
      } else if (o.t === "rombo" || o.t === "poli") {
        poli(vertices(o), cerrada(o), "trazo");
      } else if (o.t === "texto") {
        texto(o.x, o.y, o.s, "rotulo");
      } else if (o.t === "cota") {
        linea(o.x1, o.y1, o.x2, o.y2, "cota");
        /* topes en los extremos, perpendiculares a la cota */
        const d = largo(o) || 1;
        const nx = -(o.y2 - o.y1) / d * 5, ny = (o.x2 - o.x1) / d * 5;
        linea(o.x1 - nx, o.y1 - ny, o.x1 + nx, o.y1 + ny, "cota");
        linea(o.x2 - nx, o.y2 - ny, o.x2 + nx, o.y2 + ny, "cota");
        texto((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2 - 7, etiquetaCota(o, mm), "dm");
      } else {
        linea(o.x1, o.y1, o.x2, o.y2, "trazo");
      }
    });

    (op.previas || []).forEach((f) => formas.push(f));

    const marco = (id, clase) => {
      const o = id && (c.objetos || []).find((x) => x.id === id);
      if (!o) return;
      const b = caja(o), m = 8;
      formas.push({ t: "rect", x: b.x1 - m, y: b.y1 - m, w: b.x2 - b.x1 + m * 2, h: b.y2 - b.y1 + m * 2, clase });
    };
    if (op.hover && op.hover !== op.sel) marco(op.hover, "hover");
    marco(op.sel, "sel");

    return { w: W, h: H, formas };
  }

  const vacio = (c) => !c || !(c.objetos || []).length;

  /* ---------- editor ---------- */
  /* Monta el editor sobre `cont`. `leer()` entrega el croquis en edición y
     `alCambiar()` avisa para guardar. */
  function montar(cont, leer, alCambiar) {
    let herramienta = "sel";
    let libre = false;      // sin ajuste a la grilla
    let sel = null;         // id del objeto seleccionado
    let hover = null;       // id del objeto bajo el cursor
    let trazando = null;    // {x1, y1, x2, y2} mientras se arrastra
    let arrastre = null;    // {id, x, y} mientras se mueve un objeto
    let cadena = null;      // puntos de la polilínea en curso
    let cursor = null;      // posición del cursor, para la línea elástica
    let anterior = null;    // clic previo, para reconocer el doble clic
    let ultimoDoble = 0;    // para no atender dos veces el mismo doble clic
    const historia = [];

    const esDibujo = () => herramienta !== "sel";
    const guardar = () => {
      historia.push(JSON.stringify(leer().objetos));
      if (historia.length > 30) historia.shift();
    };

    function previas() {
      const f = [];
      if (trazando) {
        const t = trazando;
        if (herramienta === "rect") {
          f.push({ t: "rect", x: Math.min(t.x1, t.x2), y: Math.min(t.y1, t.y2), w: Math.abs(t.x2 - t.x1), h: Math.abs(t.y2 - t.y1), clase: "previa" });
        } else if (herramienta === "rombo") {
          f.push({ t: "poli", pts: vertices({ t: "rombo", x: Math.min(t.x1, t.x2), y: Math.min(t.y1, t.y2), w: Math.abs(t.x2 - t.x1), h: Math.abs(t.y2 - t.y1) }), cerrado: true, clase: "previa" });
        } else {
          f.push({ t: "linea", x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2, clase: "previa" });
        }
      }
      if (cadena && cadena.length) {
        const pts = cursor ? cadena.concat([cursor]) : cadena.slice();
        if (pts.length > 1) f.push({ t: "poli", pts, cerrado: false, clase: "previa" });
        f.push({ t: "circulo", cx: cadena[0].x, cy: cadena[0].y, r: 5, clase: "punto" });
      }
      return f;
    }

    /* El <svg> se crea una sola vez y después solo cambia su contenido */
    let lienzo = null;
    function pintar() {
      const fig = figura(leer(), { grilla: true, sel, hover, previas: previas() });
      if (!lienzo) {
        cont.innerHTML = MQ.draw.svg(fig, "Croquis de la cotización");
        lienzo = cont.querySelector("svg");
      } else {
        lienzo.innerHTML = MQ.draw.formas(fig);
      }
      cont.classList.toggle("modo-dibujo", esDibujo());
      cont.classList.toggle("sobre", !esDibujo() && !!hover);
      cont.classList.toggle("moviendo", !!arrastre);
    }

    /* punto del evento en coordenadas del lienzo */
    function punto(ev) {
      const svg = lienzo || cont.querySelector("svg");
      const p = svg.createSVGPoint();
      p.x = ev.clientX; p.y = ev.clientY;
      const m = svg.getScreenCTM();
      const q = m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
      return { x: dentro(ajustar(q.x, libre), W), y: dentro(ajustar(q.y, libre), H) };
    }

    /* ---- edición del texto de un objeto ---- */
    function editarTexto(o) {
      const c = leer();
      if (o.t === "cota") {
        const actual = (o.etiqueta || "").trim() || String(Math.round(largo(o) * mmPorUnidad(c)));
        const v = prompt("Medida de la cota.\nDéjalo vacío para que vuelva a calcularse sola.", actual);
        if (v === null) return;
        guardar();
        o.etiqueta = v.trim();
      } else if (o.t === "texto") {
        const v = prompt("Texto del rótulo:", o.s);
        if (v === null) return;
        guardar();
        if (!v.trim()) c.objetos = c.objetos.filter((x) => x.id !== o.id);
        else o.s = v.trim();
      } else return;
      sel = null; pintar(); alCambiar();
    }

    function terminarCadena() {
      const pts = (cadena || []).filter((p, i, a) => i === 0 || p.x !== a[i - 1].x || p.y !== a[i - 1].y);
      cadena = null; cursor = null;
      if (pts.length > 1) {
        guardar();
        const cerrar = pts.length > 2 && Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y) < CERCA;
        if (cerrar) pts.pop();
        leer().objetos.push({ id: MQ.uid(), t: "poli", pts, cerrado: cerrar });
        alCambiar();
      }
      pintar();
    }

    cont.addEventListener("pointerdown", (ev) => {
      const c = leer(), p = punto(ev);
      cont.setPointerCapture(ev.pointerId);

      /* Doble clic medido por tiempo y distancia, en vez del evento dblclick:
         así funciona igual con el dedo, donde ese evento no es confiable. */
      const ahora = Date.now();
      const doble = anterior && ahora - anterior.t < DOBLE && Math.hypot(p.x - anterior.x, p.y - anterior.y) < 15;
      anterior = { t: ahora, x: p.x, y: p.y };
      if (doble) ultimoDoble = ahora;

      if (herramienta === "sel") {
        const o = objetoEn(c, p.x, p.y);
        if (doble && o) { editarTexto(o); return; }
        sel = o ? o.id : null;
        if (o) { guardar(); arrastre = { id: o.id, x: p.x, y: p.y }; }
        pintar(); alCambiar();
        return;
      }
      if (herramienta === "texto") {
        const s = (prompt("Texto del rótulo:") || "").trim();
        if (s) {
          guardar();
          c.objetos.push({ id: MQ.uid(), t: "texto", x: p.x, y: p.y, s });
          alCambiar();
        }
        pintar();
        return;
      }
      if (herramienta === "poli") {
        if (doble && cadena) { terminarCadena(); return; }
        cadena = cadena || [];
        const primero = cadena[0];
        cadena.push(p);
        /* volver sobre el primer punto cierra la figura */
        if (primero && cadena.length > 2 && Math.hypot(p.x - primero.x, p.y - primero.y) < CERCA) terminarCadena();
        else pintar();
        return;
      }
      trazando = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    });

    cont.addEventListener("pointermove", (ev) => {
      if (arrastre) {
        const c = leer(), p = punto(ev);
        const o = c.objetos.find((x) => x.id === arrastre.id);
        if (o) { mover(o, p.x - arrastre.x, p.y - arrastre.y); arrastre.x = p.x; arrastre.y = p.y; }
        pintar();
        return;
      }
      const p = punto(ev);
      if (trazando) { trazando.x2 = p.x; trazando.y2 = p.y; pintar(); return; }
      if (cadena) { cursor = p; pintar(); return; }
      if (herramienta === "sel") {
        /* resaltar lo que hay debajo, para saber dónde hacer clic */
        const o = objetoEn(leer(), p.x, p.y);
        const id = o ? o.id : null;
        if (id !== hover) { hover = id; pintar(); }
      }
    });

    cont.addEventListener("pointerleave", () => { if (hover) { hover = null; pintar(); } });

    /* Segunda vía: el evento nativo, por si el doble clic llegó más lento que
       la ventana de arriba. Se ignora si ese doble clic ya se atendió. */
    cont.addEventListener("dblclick", (ev) => {
      if (Date.now() - ultimoDoble < 700) return;
      if (herramienta === "poli") { if (cadena) terminarCadena(); return; }
      if (herramienta !== "sel") return;
      const p = punto(ev);
      const o = objetoEn(leer(), p.x, p.y);
      if (o) { ultimoDoble = Date.now(); editarTexto(o); }
    });

    function soltar() {
      if (arrastre) { arrastre = null; pintar(); alCambiar(); return; }
      if (!trazando) return;
      const t = trazando; trazando = null;
      const c = leer();
      const caj = herramienta === "rect" || herramienta === "rombo";
      const chico = caj
        ? Math.abs(t.x2 - t.x1) < MIN || Math.abs(t.y2 - t.y1) < MIN
        : Math.hypot(t.x2 - t.x1, t.y2 - t.y1) < MIN;
      if (!chico) {
        guardar();
        if (caj) {
          c.objetos.push({
            id: MQ.uid(), t: herramienta,
            x: Math.min(t.x1, t.x2), y: Math.min(t.y1, t.y2),
            w: Math.abs(t.x2 - t.x1), h: Math.abs(t.y2 - t.y1)
          });
        } else {
          c.objetos.push({ id: MQ.uid(), t: herramienta === "cota" ? "cota" : "linea", x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2 });
        }
        alCambiar();
      }
      pintar();
    }
    cont.addEventListener("pointerup", soltar);
    cont.addEventListener("pointercancel", soltar);

    return {
      pintar,
      herramienta(h) {
        if (cadena) terminarCadena();
        herramienta = h; sel = null; hover = null; pintar();
      },
      ajuste(v) { libre = !v; },
      enCadena: () => !!cadena,
      cerrarCadena() { if (cadena) terminarCadena(); },
      editarSeleccion() {
        const o = sel && leer().objetos.find((x) => x.id === sel);
        if (!o || (o.t !== "cota" && o.t !== "texto")) return false;
        editarTexto(o);
        return true;
      },
      borrar() {
        const c = leer();
        if (!sel) return false;
        guardar();
        c.objetos = c.objetos.filter((o) => o.id !== sel);
        sel = null; hover = null; pintar(); alCambiar();
        return true;
      },
      deshacer() {
        if (!historia.length) return false;
        leer().objetos = JSON.parse(historia.pop());
        sel = null; hover = null; cadena = null; pintar(); alCambiar();
        return true;
      },
      limpiar() {
        guardar();
        leer().objetos = [];
        sel = null; hover = null; cadena = null; pintar(); alCambiar();
      }
    };
  }

  return { nuevo, figura, montar, vacio, mmPorUnidad, W, H, CELDA };
})();
