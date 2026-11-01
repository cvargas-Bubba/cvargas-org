/* Croquis de una partida: una o más vistas (frente, planta, lateral) sobre
   la misma grilla, dibujadas con líneas, rectángulos, rombos, polilíneas,
   trazo a mano alzada, texto y cotas.

   Se guarda como vectores, no como imagen: pesa unos pocos KB, se puede
   seguir editando y `figura()` devuelve la misma estructura que dibuja el
   render en PDF, así que sale nítido en papel. */
window.MQ = window.MQ || {};

MQ.croquis = (function () {
  const W = 1200, H = 800;   // unidades del lienzo (el ancho puede crecer)
  const MAX_W = 2600;        // hasta acá, para que la grilla no se vuelva polvo
  const CELDA = 20;          // lado de un cuadro de la grilla
  const PASO_MM = 10;        // el dibujo se ajusta de a un centímetro real
  const MIN = 6;             // trazos más cortos que esto se descartan
  const CERCA = 12;          // para cerrar una polilínea sobre su primer punto
  const TOLERANCIA = 10;     // cuánto se puede errar el clic sobre un trazo
  const DOBLE = 500;         // ventana del doble clic, como la de Windows
  const PASO_LAPIZ = 4;      // separación mínima entre puntos a mano alzada
  /* bajo estos tamaños la medida escrita dentro de la figura no se lee */
  const MIN_W = 42, MIN_H = 13;

  const mmPorUnidad = (c) => MQ.num(c.escala, 100) / CELDA;
  /* El ajuste se calcula en milímetros y no en cuadros de la grilla: así la
     medida que va quedando sube de a 10 mm sea cual sea la escala. */
  const ajustar = (v, paso) => (paso ? Math.round((Math.round(v / paso) * paso) * 100) / 100 : Math.round(v));
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
    if (o.t === "poli" || o.t === "lapiz") return o.pts.map((p) => ({ x: p.x, y: p.y }));
    if (o.t === "texto") return [{ x: o.x, y: o.y }];
    return [{ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }];
  }
  const cerrada = (o) => o.t === "rect" || o.t === "rombo" || (o.t === "poli" && o.cerrado);

  /* ---------- largo de una figura, en mm ----------
     Es lo que permite que el croquis entregue la cantidad de material: un
     trazo asignado a una escuadría es una pieza de ese largo. En las figuras
     cerradas se recorre todo el contorno, porque el marco de un mueble lleva
     material en los cuatro lados: 1000 × 500 son 3 metros de perfil. */
  function largoMm(o, mm) {
    if (!o) return 0;
    if (o.t === "texto") return 0;
    const v = vertices(o);
    let d = 0;
    const n = cerrada(o) ? v.length : v.length - 1;
    for (let i = 0; i < n; i++) {
      const a = v[i], b = v[(i + 1) % v.length];
      d += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return d * mm;
  }
  const piezasDe = (o) => Math.max(1, Math.round(MQ.num(o && o.piezas, 1)));

  /* ---------- los cortes de una figura ----------
     Para comprar basta el total, pero en el banco se corta pieza por pieza:
     un marco de 1000 × 500 son dos de 1000 y dos de 500. Del trazo a mano
     alzada no sale ningún corte útil, así que va entero. */
  function ladosMm(o, mm) {
    const out = [];
    if (!o || o.t === "texto") return out;
    if (o.t === "lapiz") {
      const l = Math.round(largoMm(o, mm));
      return l > 0 ? [{ largo: l, piezas: 1 }] : out;
    }
    const sumar = (v) => {
      const l = Math.round(v);
      if (l <= 0) return;
      const y = out.find((x) => x.largo === l);
      if (y) y.piezas += 1; else out.push({ largo: l, piezas: 1 });
    };
    const v = vertices(o);
    const n = cerrada(o) ? v.length : v.length - 1;
    for (let i = 0; i < n; i++) {
      const a = v[i], b = v[(i + 1) % v.length];
      sumar(Math.hypot(b.x - a.x, b.y - a.y) * mm);
    }
    out.sort((a, b) => b.largo - a.largo);
    return out;
  }

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

  /* Ancho del lienzo. Crece para acompañar la forma de la pantalla —en
     pantalla completa sobra ancho y falta alto— y, una vez que se dibujó
     algo allá a la derecha, se queda grande: así el dibujo nunca queda
     fuera del cuadro al volver al panel angosto ni al pasar al PDF. */
  function anchoDe(vista, pedido) {
    let max = Math.max(W, Math.min(MAX_W, MQ.num(pedido, W)));
    (vista && vista.objetos || []).forEach((o) => {
      const b = caja(o);
      if (b.x2 + 40 > max) max = b.x2 + 40;
    });
    return Math.min(MAX_W, Math.ceil(max / CELDA) * CELDA);
  }

  function distanciaASegmento(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (!l2) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  /* distancia al contorno, no al interior: un rectángulo se agarra del borde,
     para poder dibujar dentro de él sin seleccionarlo */
  function distancia(o, x, y) {
    if (o.t === "texto") {
      const c = caja(o);
      return Math.hypot(Math.max(c.x1 - x, 0, x - c.x2), Math.max(c.y1 - y, 0, y - c.y2));
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

  /* del último al primero, para que gane el que se dibujó encima */
  function objetoEn(objetos, x, y) {
    for (let i = (objetos || []).length - 1; i >= 0; i--) {
      if (distancia(objetos[i], x, y) < TOLERANCIA) return objetos[i];
    }
    return null;
  }

  function mover(o, dx, dy) {
    if (o.t === "rect" || o.t === "rombo" || o.t === "texto") { o.x += dx; o.y += dy; }
    else if (o.t === "poli" || o.t === "lapiz") o.pts.forEach((p) => { p.x += dx; p.y += dy; });
    else { o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy; }
  }

  /* Lo que muestra una cota: la etiqueta escrita a mano si la hay, y si no la
     medida que sale de su largo y de la escala. Un número suelto se completa
     con la unidad; cualquier otro texto se respeta tal cual. */
  function etiquetaCota(o, mm) {
    const e = (o.etiqueta || "").trim();
    if (!e) return Math.round(largo(o) * mm) + " mm";
    return /^[\d.,]+$/.test(e) ? e + " mm" : e;
  }

  /* ---------- medida escrita a mano ----------
     Dibujar a ojo no llega a 1012 mm. Escribiendo el número la figura se
     estira desde su esquina superior izquierda, o desde su primer punto, de
     manera que lo que ya estaba apoyado ahí no se mueve. */
  function medidaDe(o, mm) {
    if (o.t === "rect" || o.t === "rombo") return Math.round(Math.abs(o.w) * mm) + " × " + Math.round(Math.abs(o.h) * mm);
    return String(Math.round(largoMm(o, mm)));
  }

  const numerosDe = (s) => (String(s).match(/\d+(?:[.,]\d+)?/g) || [])
    .map((x) => parseFloat(x.replace(",", "."))).filter((v) => v > 0);

  function aplicarMedida(o, nums, mm) {
    if (!nums.length) return false;
    if (o.t === "rect" || o.t === "rombo") {
      const x = Math.min(o.x, o.x + o.w), y = Math.min(o.y, o.y + o.h);
      const an = nums[0] / mm;
      const al = (nums.length > 1 ? nums[1] / mm : Math.abs(o.h));
      o.x = x; o.y = y;
      o.w = Math.min(an, MAX_W - x); o.h = Math.min(al, H - y);
      return true;
    }
    const actual = largoMm(o, mm);
    if (actual <= 0) return false;
    const k = nums[0] / actual;
    if (o.t === "poli" || o.t === "lapiz") {
      const a = { x: o.pts[0].x, y: o.pts[0].y };
      o.pts.forEach((p) => { p.x = a.x + (p.x - a.x) * k; p.y = a.y + (p.y - a.y) * k; });
    } else {
      o.x2 = o.x1 + (o.x2 - o.x1) * k;
      o.y2 = o.y1 + (o.y2 - o.y1) * k;
    }
    return true;
  }

  /* ---------- dibujo ---------- */
  function figura(croquis, vista, opciones) {
    const op = opciones || {};
    const formas = [];
    const linea = (x1, y1, x2, y2, clase) => formas.push({ t: "linea", x1, y1, x2, y2, clase });
    const texto = (x, y, s, clase) => formas.push({ t: "texto", x, y, s: String(s), clase, anclaje: "centro" });
    const poli = (pts, cerrado, clase) => formas.push({ t: "poli", pts, cerrado: !!cerrado, clase });

    const an = anchoDe(vista, op.w);
    if (op.grilla) {
      for (let x = CELDA; x < an; x += CELDA) linea(x, 0, x, H, "grid");
      for (let y = CELDA; y < H; y += CELDA) linea(0, y, an, y, "grid");
    }

    const mm = mmPorUnidad(croquis);
    const acotar = croquis.acotar !== false;
    /* medida de la figura, escrita dentro, sin tener que dibujar la cota */
    const acote = (o) => {
      if (!acotar) return;
      /* cuántas piezas iguales van, que es lo único del material que vale la
         pena escribir sobre la figura: el resto lo dice el color */
      const p = piezasDe(o);
      const rep = o.mat && p > 1 ? "  ·  " + p + " pzas" : "";
      if (o.t === "rect" || o.t === "rombo") {
        const an = Math.abs(o.w), al = Math.abs(o.h);
        if (an < MIN_W || al < MIN_H) return;
        texto(o.x + o.w / 2, o.y + o.h / 2 + 3, Math.round(an * mm) + " × " + Math.round(al * mm) + rep, "acote");
      } else if (o.t === "linea") {
        const l = largo(o);
        if (l < MIN_W) return;
        texto((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2 - 6, Math.round(l * mm) + " mm" + rep, "acote");
      }
    };

    /* El material se dice con el color del trazo y se explica en la
       nomenclatura. El color se reparte por orden de aparición en todo el
       croquis, no en la vista, para que una pieza sea del mismo color en el
       frente y en la planta. */
    const mats = op.nombreMat ? materiales(croquis) : [];
    const colorDe = (o) => {
      const i = o.mat ? mats.indexOf(o.mat) : -1;
      return i >= 0 ? MQ.colorMat(i) : null;
    };
    const pintado = (f, o) => { const c = colorDe(o); if (c) f.col = c; formas.push(f); return f; };

    (vista.objetos || []).forEach((o) => {
      if (o.t === "rect") {
        pintado({ t: "rect", x: Math.min(o.x, o.x + o.w), y: Math.min(o.y, o.y + o.h), w: Math.abs(o.w), h: Math.abs(o.h), clase: "trazo" }, o);
        acote(o);
      } else if (o.t === "rombo") {
        pintado({ t: "poli", pts: vertices(o), cerrado: true, clase: "trazo" }, o); acote(o);
      } else if (o.t === "poli") {
        pintado({ t: "poli", pts: vertices(o), cerrado: !!o.cerrado, clase: "trazo" }, o);
      } else if (o.t === "lapiz") {
        pintado({ t: "poli", pts: vertices(o), cerrado: false, clase: "lapiz" }, o);
      } else if (o.t === "texto") {
        texto(o.x, o.y, o.s, "rotulo");
      } else if (o.t === "cota") {
        linea(o.x1, o.y1, o.x2, o.y2, "cota");
        const d = largo(o) || 1;
        const nx = -(o.y2 - o.y1) / d * 5, ny = (o.x2 - o.x1) / d * 5;
        linea(o.x1 - nx, o.y1 - ny, o.x1 + nx, o.y1 + ny, "cota");
        linea(o.x2 - nx, o.y2 - ny, o.x2 + nx, o.y2 + ny, "cota");
        texto((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2 - 7, etiquetaCota(o, mm), "dm");
      } else {
        pintado({ t: "linea", x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2, clase: "trazo" }, o);
        acote(o);
      }
    });

    (op.previas || []).forEach((f) => formas.push(f));

    const marco = (id, clase) => {
      const o = id && (vista.objetos || []).find((x) => x.id === id);
      if (!o) return;
      const b = caja(o), m = 8;
      formas.push({ t: "rect", x: b.x1 - m, y: b.y1 - m, w: b.x2 - b.x1 + m * 2, h: b.y2 - b.y1 + m * 2, clase });
    };
    /* `sel` puede traer varias figuras: cada una lleva su marco */
    const sels = op.sel == null ? [] : [].concat(op.sel);
    if (op.hover && sels.indexOf(op.hover) < 0) marco(op.hover, "hover");
    sels.forEach((id) => marco(id, "sel"));

    /* la nomenclatura: qué material es cada color, en el orden del dibujo */
    const leyenda = mats.map((id, i) => ({ mat: id, col: MQ.colorMat(i), nombre: op.nombreMat(id) || "Material" }));

    return { w: an, h: H, formas, leyenda };
  }

  /* los materiales usados en todo el croquis, en orden de aparición */
  function materiales(croquis) {
    const out = [];
    (((croquis || {}).vistas) || []).forEach((v) => (v.objetos || []).forEach((o) => {
      if (o.mat && out.indexOf(o.mat) < 0) out.push(o.mat);
    }));
    return out;
  }

  const vistaVacia = (v) => !v || !(v.objetos || []).length;
  const vacio = (c) => !c || !(c.vistas || []).some((v) => !vistaVacia(v));
  /* las vistas con algo dibujado, que son las que salen en el PDF */
  const conDibujo = (c) => ((c && c.vistas) || []).filter((v) => !vistaVacia(v));

  /* ---------- editor ----------
     `leer()` entrega { croquis, vista } con la vista que se está editando. */
  function montar(cont, leer, alCambiar, nombreMat) {
    let herramienta = "sel";
    let libre = false;      // sin ajuste a la grilla
    let sel = [];           // puede haber varias figuras seleccionadas
    let hover = null;
    let trazando = null;    // mientras se arrastra una figura
    let arrastre = null;    // mientras se mueve la selección
    let banda = null;       // recuadro de selección por arrastre
    let cadena = null;      // puntos de la polilínea en curso
    let mano = null;        // puntos del trazo a mano alzada en curso
    let cursor = null;
    let porta = null;       // lo copiado, para pegarlo acá o en otra vista
    let anterior = null, ultimoDoble = 0;
    const historia = [];

    const objetos = () => leer().vista.objetos;
    const elegidos = () => objetos().filter((o) => sel.indexOf(o.id) >= 0);
    const esDibujo = () => herramienta !== "sel";
    const guardar = () => {
      historia.push(JSON.stringify(objetos()));
      if (historia.length > 30) historia.shift();
    };

    /* Formas en curso. Mientras se arrastra se muestra la medida en vivo:
       es lo que permite estirar hasta el valor que uno quiere en lugar de
       dibujar a ojo y corregir después. Se muestra siempre, aunque el
       acotado automático esté apagado, porque acá es una ayuda para medir
       y no una anotación del dibujo. */
    function previas() {
      const f = [];
      const mm = mmPorUnidad(leer().croquis);
      const medida = (x, y, s) => f.push({ t: "texto", x, y, s, clase: "previa-dm", anclaje: "centro" });

      if (trazando) {
        const t = trazando;
        const an = Math.abs(t.x2 - t.x1), al = Math.abs(t.y2 - t.y1);
        const x = Math.min(t.x1, t.x2), y = Math.min(t.y1, t.y2);
        if (herramienta === "rect" || herramienta === "rombo") {
          if (herramienta === "rect") f.push({ t: "rect", x, y, w: an, h: al, clase: "previa" });
          else f.push({ t: "poli", pts: vertices({ t: "rombo", x, y, w: an, h: al }), cerrado: true, clase: "previa" });
          medida(x + an / 2, y + al / 2 + 4, Math.round(an * mm) + " × " + Math.round(al * mm) + " mm");
        } else {
          f.push({ t: "linea", x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2, clase: "previa" });
          const l = Math.hypot(t.x2 - t.x1, t.y2 - t.y1);
          medida((t.x1 + t.x2) / 2, (t.y1 + t.y2) / 2 - 9, Math.round(l * mm) + " mm");
        }
      }
      if (banda) {
        f.push({
          t: "rect", clase: "banda",
          x: Math.min(banda.x1, banda.x2), y: Math.min(banda.y1, banda.y2),
          w: Math.abs(banda.x2 - banda.x1), h: Math.abs(banda.y2 - banda.y1)
        });
      }
      if (mano && mano.length > 1) f.push({ t: "poli", pts: mano, cerrado: false, clase: "lapiz" });
      if (cadena && cadena.length) {
        const pts = cursor ? cadena.concat([cursor]) : cadena.slice();
        if (pts.length > 1) f.push({ t: "poli", pts, cerrado: false, clase: "previa" });
        f.push({ t: "circulo", cx: cadena[0].x, cy: cadena[0].y, r: 5, clase: "punto" });
        /* del multipunto se mide el tramo que se está tirando */
        if (cursor) {
          const u = cadena[cadena.length - 1];
          const l = Math.hypot(cursor.x - u.x, cursor.y - u.y);
          if (l > 2) medida((u.x + cursor.x) / 2, (u.y + cursor.y) / 2 - 9, Math.round(l * mm) + " mm");
        }
      }
      return f;
    }

    /* ---------- encuadre ----------
       A pantalla completa no se muestra todo el lienzo sino una ventana
       puesta sobre el dibujo: de nada sirve ganar espacio si el mueble se ve
       igual de chico. La ventana se guarda como centro y ancho, y el alto
       sale de la forma del contenedor, así que aguanta que cambie la
       ventana del navegador sin deformar nada. */
    const MARGEN = 40;     // aire alrededor del dibujo, en unidades
    const MIN_VENTANA = 400;
    let vp = null;

    const razon = () => {
      const b = cont.getBoundingClientRect();
      return b.height > 0 ? b.width / b.height : W / H;
    };
    const ventana = () => {
      if (!vp) return null;
      const alto = vp.w / razon();
      return { x: vp.cx - vp.w / 2, y: vp.cy - alto / 2, w: vp.w, h: alto };
    };

    function contenido(vista) {
      const os = (vista && vista.objetos) || [];
      if (!os.length) return null;
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      os.forEach((o) => {
        const b = caja(o);
        x1 = Math.min(x1, b.x1); y1 = Math.min(y1, b.y1);
        x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2);
      });
      return { x1, y1, x2, y2 };
    }

    function encuadrar() {
      const b = contenido(leer().vista);
      const r = razon();
      if (!b) { vp = { cx: W / 2, cy: H / 2, w: W }; return; }
      const an = b.x2 - b.x1 + MARGEN * 2, al = b.y2 - b.y1 + MARGEN * 2;
      vp = { cx: (b.x1 + b.x2) / 2, cy: (b.y1 + b.y2) / 2, w: Math.max(MIN_VENTANA, an, al * r) };
    }

    /* si el dibujo se salió de la ventana, se vuelve a encuadrar: lo que se
       acaba de dibujar tiene que verse */
    function cabe() {
      const v = ventana(), b = contenido(leer().vista);
      if (!v || !b) return;
      if (b.x1 < v.x || b.y1 < v.y || b.x2 > v.x + v.w || b.y2 > v.y + v.h) encuadrar();
    }

    /* El <svg> se crea una sola vez y después solo cambia su contenido */
    let lienzo = null, ancho = W;
    function pintar() {
      const c = leer();
      if (vp && !arrastre && !trazando && !mano && !cadena) cabe();
      const v = ventana();
      ancho = anchoDe(c.vista, v ? Math.ceil(v.x + v.w) : W);
      const fig = figura(c.croquis, c.vista, { grilla: true, w: ancho, sel, hover, nombreMat, previas: previas() });
      if (!lienzo || !cont.contains(lienzo)) {
        cont.innerHTML = MQ.draw.svg(fig, "Croquis");
        lienzo = cont.querySelector("svg");
      } else {
        lienzo.innerHTML = MQ.draw.formas(fig);
      }
      /* el <svg> sobrevive entre repintados: el viewBox se pone acá, sea la
         ventana del encuadre o el lienzo entero */
      const d1 = (x) => Math.round(x * 10) / 10;
      lienzo.setAttribute("viewBox", v
        ? [d1(v.x), d1(v.y), d1(v.w), d1(v.h)].join(" ")
        : "0 0 " + fig.w + " " + fig.h);
      cont.classList.toggle("modo-dibujo", esDibujo());
      cont.classList.toggle("sobre", !esDibujo() && !!hover);
      cont.classList.toggle("moviendo", !!arrastre);
    }

    function punto(ev, sinAjuste) {
      const svg = lienzo || cont.querySelector("svg");
      const p = svg.createSVGPoint();
      p.x = ev.clientX; p.y = ev.clientY;
      const m = svg.getScreenCTM();
      const q = m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
      const paso = sinAjuste || libre ? 0 : PASO_MM / mmPorUnidad(leer().croquis);
      return { x: dentro(ajustar(q.x, paso), ancho), y: dentro(ajustar(q.y, paso), H) };
    }

    /* La cota es una anotación: se le escribe el texto. Cualquier otra figura
       es el mueble mismo, así que lo que se escribe es su medida y la figura
       se estira hasta ahí. */
    function editar(objs) {
      const lista = [].concat(objs);
      const o = lista[0];
      if (!o) return;
      const c = leer();
      const mm = mmPorUnidad(c.croquis);
      if (lista.length > 1) {
        /* con varias elegidas no se edita texto: se les da la misma medida */
        const figs = lista.filter((x) => x.t !== "texto" && x.t !== "cota");
        if (!figs.length) return;
        const caja = figs[0].t === "rect" || figs[0].t === "rombo";
        const v = prompt("Medida en mm para las " + figs.length + " figuras"
          + (caja ? ", ancho × alto:" : ":"), medidaDe(figs[0], mm));
        if (v === null) return;
        const nums = numerosDe(v);
        if (!nums.length) return;
        guardar();
        figs.forEach((x) => aplicarMedida(x, nums, mm));
        pintar(); alCambiar();
        return;
      }
      if (o.t === "cota") {
        const actual = (o.etiqueta || "").trim() || String(Math.round(largo(o) * mm));
        const v = prompt("Medida de la cota.\nDéjalo vacío para que vuelva a calcularse sola.", actual);
        if (v === null) return;
        guardar(); o.etiqueta = v.trim();
        sel = [];
      } else if (o.t === "texto") {
        const v = prompt("Texto del rótulo:", o.s);
        if (v === null) return;
        guardar();
        if (!v.trim()) c.vista.objetos = c.vista.objetos.filter((x) => x.id !== o.id);
        else o.s = v.trim();
        sel = [];
      } else {
        const caja = o.t === "rect" || o.t === "rombo";
        const v = prompt(caja ? "Medida en mm, ancho × alto:" : "Largo en mm:", medidaDe(o, mm));
        if (v === null) return;
        const nums = numerosDe(v);
        if (!nums.length) return;
        guardar(); aplicarMedida(o, nums, mm);
      }
      pintar(); alCambiar();
    }

    /* La copia cae corrida un cuadro, para que se vea que son dos y se pueda
       agarrar la de arriba; queda seleccionada, lista para arrastrar a su
       lugar o para asignarle otro material. */
    function clonar(lista) {
      guardar();
      const nuevos = lista.map((o) => {
        const c = JSON.parse(JSON.stringify(o));
        c.id = MQ.uid();
        mover(c, CELDA, CELDA);
        return c;
      });
      nuevos.forEach((o) => objetos().push(o));
      sel = nuevos.map((o) => o.id);
      hover = null;
      pintar(); alCambiar();
      return nuevos.length;
    }

    function terminarCadena() {
      const pts = (cadena || []).filter((p, i, a) => i === 0 || p.x !== a[i - 1].x || p.y !== a[i - 1].y);
      cadena = null; cursor = null;
      if (pts.length > 1) {
        guardar();
        const cerrar = pts.length > 2 && Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y) < CERCA;
        if (cerrar) pts.pop();
        objetos().push({ id: MQ.uid(), t: "poli", pts, cerrado: cerrar });
        alCambiar();
      }
      pintar();
    }

    cont.addEventListener("pointerdown", (ev) => {
      const p = punto(ev);
      cont.setPointerCapture(ev.pointerId);

      const ahora = Date.now();
      const doble = anterior && ahora - anterior.t < DOBLE && Math.hypot(p.x - anterior.x, p.y - anterior.y) < 15;
      anterior = { t: ahora, x: p.x, y: p.y };
      if (doble) ultimoDoble = ahora;

      if (herramienta === "sel") {
        const o = objetoEn(objetos(), p.x, p.y);
        if (doble && o) { editar(sel.length > 1 && sel.indexOf(o.id) >= 0 ? elegidos() : o); return; }
        const sumar = ev.shiftKey || ev.ctrlKey || ev.metaKey;
        if (o) {
          if (sumar) {
            const i = sel.indexOf(o.id);
            if (i >= 0) sel.splice(i, 1); else sel.push(o.id);
          } else if (sel.indexOf(o.id) < 0) {
            sel = [o.id];
          }
          /* se arrastra todo lo elegido: así un marco entero se mueve junto */
          if (sel.indexOf(o.id) >= 0) { guardar(); arrastre = { x: p.x, y: p.y }; }
        } else if (sumar) {
          /* con la tecla puesta, el clic al aire no deshace lo elegido */
        } else {
          sel = [];
          banda = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
        }
        pintar(); alCambiar();
        return;
      }
      if (herramienta === "lapiz") {
        /* a mano alzada el ajuste a la grilla estorba */
        mano = [punto(ev, true)];
        pintar();
        return;
      }
      if (herramienta === "texto") {
        const s = (prompt("Texto del rótulo:") || "").trim();
        if (s) { guardar(); objetos().push({ id: MQ.uid(), t: "texto", x: p.x, y: p.y, s }); alCambiar(); }
        pintar();
        return;
      }
      if (herramienta === "poli") {
        if (doble && cadena) { terminarCadena(); return; }
        cadena = cadena || [];
        const primero = cadena[0];
        cadena.push(p);
        if (primero && cadena.length > 2 && Math.hypot(p.x - primero.x, p.y - primero.y) < CERCA) terminarCadena();
        else pintar();
        return;
      }
      trazando = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    });

    cont.addEventListener("pointermove", (ev) => {
      if (arrastre) {
        const p = punto(ev);
        const dx = p.x - arrastre.x, dy = p.y - arrastre.y;
        if (dx || dy) elegidos().forEach((o) => mover(o, dx, dy));
        arrastre.x = p.x; arrastre.y = p.y;
        pintar();
        return;
      }
      if (banda) {
        const p = punto(ev, true);
        banda.x2 = p.x; banda.y2 = p.y;
        pintar();
        return;
      }
      if (mano) {
        const p = punto(ev, true);
        const u = mano[mano.length - 1];
        if (Math.hypot(p.x - u.x, p.y - u.y) >= PASO_LAPIZ) { mano.push(p); pintar(); }
        return;
      }
      const p = punto(ev);
      if (trazando) { trazando.x2 = p.x; trazando.y2 = p.y; pintar(); return; }
      if (cadena) { cursor = p; pintar(); return; }
      if (herramienta === "sel") {
        const o = objetoEn(objetos(), p.x, p.y);
        const id = o ? o.id : null;
        if (id !== hover) { hover = id; pintar(); }
      }
    });

    cont.addEventListener("pointerleave", () => { if (hover) { hover = null; pintar(); } });

    /* el evento nativo, por si el doble clic llegó más lento que la ventana */
    cont.addEventListener("dblclick", (ev) => {
      if (Date.now() - ultimoDoble < 700) return;
      if (herramienta === "poli") { if (cadena) terminarCadena(); return; }
      if (herramienta !== "sel") return;
      const p = punto(ev);
      const o = objetoEn(objetos(), p.x, p.y);
      if (o) { ultimoDoble = Date.now(); editar(sel.length > 1 && sel.indexOf(o.id) >= 0 ? elegidos() : o); }
    });

    function soltar() {
      if (arrastre) { arrastre = null; pintar(); alCambiar(); return; }
      if (banda) {
        const b = banda; banda = null;
        const r = {
          x1: Math.min(b.x1, b.x2), y1: Math.min(b.y1, b.y2),
          x2: Math.max(b.x1, b.x2), y2: Math.max(b.y1, b.y2)
        };
        /* basta con tocar el recuadro: encerrar entero un marco grande
           obligaría a barrer toda la pantalla */
        if (r.x2 - r.x1 > MIN || r.y2 - r.y1 > MIN) {
          sel = objetos().filter((o) => {
            const c = caja(o);
            return c.x1 <= r.x2 && c.x2 >= r.x1 && c.y1 <= r.y2 && c.y2 >= r.y1;
          }).map((o) => o.id);
        }
        pintar(); alCambiar();
        return;
      }
      if (mano) {
        const pts = mano; mano = null;
        if (pts.length > 2) { guardar(); objetos().push({ id: MQ.uid(), t: "lapiz", pts }); alCambiar(); }
        pintar();
        return;
      }
      if (!trazando) return;
      const t = trazando; trazando = null;
      const caj = herramienta === "rect" || herramienta === "rombo";
      const chico = caj
        ? Math.abs(t.x2 - t.x1) < MIN || Math.abs(t.y2 - t.y1) < MIN
        : Math.hypot(t.x2 - t.x1, t.y2 - t.y1) < MIN;
      if (!chico) {
        guardar();
        if (caj) {
          objetos().push({
            id: MQ.uid(), t: herramienta,
            x: Math.min(t.x1, t.x2), y: Math.min(t.y1, t.y2),
            w: Math.abs(t.x2 - t.x1), h: Math.abs(t.y2 - t.y1)
          });
        } else {
          objetos().push({ id: MQ.uid(), t: herramienta === "cota" ? "cota" : "linea", x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2 });
        }
        alCambiar();
      }
      pintar();
    }
    cont.addEventListener("pointerup", soltar);
    cont.addEventListener("pointercancel", soltar);

    return {
      pintar,
      /* al cambiar de vista o de partida se limpia lo que estaba en curso */
      reiniciar() {
        cadena = null; mano = null; trazando = null; sel = []; hover = null; historia.length = 0;
        if (vp) encuadrar();
        pintar();
      },
      /* a pantalla completa la ventana se pone sobre el dibujo, para que el
         mueble se vea grande; al salir se vuelve a ver el lienzo entero */
      encuadre(on) { if (on) encuadrar(); else vp = null; pintar(); },
      /* ---- material de lo seleccionado ----
         Los rótulos quedan fuera: no son material de nada. */
      seleccionados() { return elegidos().filter((o) => o.t !== "texto"); },
      seleccionado() { return this.seleccionados()[0] || null; },
      asignar(mat, piezas) {
        const os = this.seleccionados();
        if (!os.length) return false;
        guardar();
        os.forEach((o) => {
          if (mat !== undefined) { if (mat) o.mat = mat; else delete o.mat; }
          if (piezas !== undefined) o.piezas = Math.max(1, Math.round(MQ.num(piezas, 1)));
        });
        pintar(); alCambiar();
        return true;
      },
      /* ---- copiar y pegar ----
         Un mueble repite piezas: las patas, los travesaños, los frentes de
         los cajones. Copiar se lleva también el material y las piezas
         asignadas, que es lo que ahorra el trabajo de verdad. */
      copiar() {
        const os = elegidos();
        if (!os.length) return 0;
        porta = os.map((o) => JSON.parse(JSON.stringify(o)));
        return porta.length;
      },
      pegar() { return porta && porta.length ? clonar(porta) : 0; },
      duplicar() {
        const os = elegidos();
        return os.length ? clonar(os) : 0;
      },
      hayCopia: () => !!(porta && porta.length),
      /* desde la nomenclatura: marcar todo lo que es de ese material */
      seleccionarMat(id) {
        sel = objetos().filter((o) => o.mat === id).map((o) => o.id);
        hover = null; pintar(); alCambiar();
        return sel.length;
      },
      herramienta(h) { if (cadena) terminarCadena(); herramienta = h; sel = []; hover = null; pintar(); },
      ajuste(v) { libre = !v; },
      enCadena: () => !!cadena,
      cerrarCadena() { if (cadena) terminarCadena(); },
      editarSeleccion() {
        const os = elegidos();
        if (!os.length) return false;
        editar(os.length > 1 ? os : os[0]);
        return true;
      },
      borrar() {
        if (!sel.length) return false;
        guardar();
        const c = leer();
        c.vista.objetos = c.vista.objetos.filter((o) => sel.indexOf(o.id) < 0);
        sel = []; hover = null; pintar(); alCambiar();
        return true;
      },
      deshacer() {
        if (!historia.length) return false;
        leer().vista.objetos = JSON.parse(historia.pop());
        sel = []; hover = null; cadena = null; pintar(); alCambiar();
        return true;
      },
      limpiar() {
        guardar();
        leer().vista.objetos = [];
        sel = []; hover = null; cadena = null; pintar(); alCambiar();
      }
    };
  }

  return { figura, montar, vacio, vistaVacia, conDibujo, mmPorUnidad, largoMm, ladosMm, piezasDe, cerrada, materiales, W, H, CELDA };
})();
