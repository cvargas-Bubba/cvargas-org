/* Catálogo de referencia y tipos de mueble.
   Los precios son netos en pesos chilenos y se pueden editar desde la app:
   lo que se guarda en Materiales reemplaza estos valores por defecto. */
window.MQ = window.MQ || {};

MQ.clone = (o) => JSON.parse(JSON.stringify(o));
MQ.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
MQ.clp = (n) => "$" + Math.round(n || 0).toLocaleString("es-CL");
MQ.num = (v, def) => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : (def || 0); };
MQ.redondear = (n, a) => (a > 0 ? Math.round(n / a) * a : Math.round(n));

/* ---------- catálogo por defecto ---------- */
MQ.DEFAULT_CATALOGO = {
  /* Tableros: precio por plancha entera y formato en mm.
     El costo de cada pieza se prorratea por superficie. */
  tableros: [
    { id: "mel18b", nombre: "Melamina blanca 18 mm", espesor: 18, largo: 2500, ancho: 1830, precio: 38900 },
    { id: "mel18m", nombre: "Melamina madera 18 mm", espesor: 18, largo: 2500, ancho: 1830, precio: 46900 },
    { id: "mel15b", nombre: "Melamina blanca 15 mm", espesor: 15, largo: 2500, ancho: 1830, precio: 34900 },
    { id: "mdf18", nombre: "MDF crudo 18 mm", espesor: 18, largo: 2500, ancho: 1830, precio: 32900 },
    { id: "ter15", nombre: "Terciado 15 mm", espesor: 15, largo: 2440, ancho: 1220, precio: 28900 },
    { id: "tras3", nombre: "Trasera melamina 3 mm", espesor: 3, largo: 2500, ancho: 1830, precio: 12900 },
    /* Macizo: el canto queda a la vista, se lija y se termina, no se tapa */
    { id: "mad50", nombre: "Madera maciza 50 mm", espesor: 50, largo: 2400, ancho: 650, precio: 135000, macizo: true },
    { id: "mad30", nombre: "Madera maciza 30 mm", espesor: 30, largo: 2400, ancho: 650, precio: 89000, macizo: true }
  ],
  /* Madera dimensionada seca y cepillada, por escuadría en pulgadas.
     Precio por metro lineal: se ingresa el largo y la cantidad de piezas. */
  escuadrias: [
    { id: "m1x4", nombre: "Pino seco cepillado", esp: 1, anc: 4, precio: 1290 },
    { id: "m1x6", nombre: "Pino seco cepillado", esp: 1, anc: 6, precio: 1890 },
    { id: "m1x8", nombre: "Pino seco cepillado", esp: 1, anc: 8, precio: 2490 },
    { id: "m2x2", nombre: "Pino seco cepillado", esp: 2, anc: 2, precio: 1490 },
    { id: "m2x4", nombre: "Pino seco cepillado", esp: 2, anc: 4, precio: 2690 },
    { id: "m2x6", nombre: "Pino seco cepillado", esp: 2, anc: 6, precio: 3890 },
    { id: "m2x8", nombre: "Pino seco cepillado", esp: 2, anc: 8, precio: 5190 }
  ],
  /* Perfiles de fierro, también por metro lineal */
  perfiles: [
    { id: "f30", nombre: "Tubo cuadrado 30×30×2 mm", precio: 2690 },
    { id: "f40", nombre: "Tubo cuadrado 40×40×2 mm", precio: 3490 },
    { id: "f5020", nombre: "Tubo rectangular 50×20×2 mm", precio: 3190 },
    { id: "fang", nombre: "Ángulo 40×40×3 mm", precio: 3890 },
    { id: "fplat", nombre: "Pletina 38×3 mm", precio: 2290 }
  ],
  /* Cantos: precio por metro lineal instalado */
  cantos: [
    { id: "fino", nombre: "Canto PVC 0,45 mm", precio: 190 },
    { id: "grueso", nombre: "Canto PVC 2 mm", precio: 560 }
  ],
  /* Herrajes: precio por unidad o juego */
  herrajes: {
    bisagra: { nombre: "Bisagra con amortiguación", precio: 2690, unidad: "un." },
    corredera: { nombre: "Corredera cierre suave (juego)", precio: 9900, unidad: "juego" },
    tirador: { nombre: "Tirador", precio: 1890, unidad: "un." },
    pata: { nombre: "Pata niveladora", precio: 690, unidad: "un." },
    barra: { nombre: "Barra de colgar", precio: 2490, unidad: "m" },
    soporteBarra: { nombre: "Soportes de barra (par)", precio: 1190, unidad: "par" },
    fijaciones: { nombre: "Tornillos, minifix y tarugos", precio: 2500, unidad: "módulo" }
  },
  /* Mano de obra */
  mano: {
    fabricacion: { nombre: "Corte, canteado y perforado", precio: 9500, unidad: "m² de tablero" },
    armado: { nombre: "Armado del módulo", precio: 12000, unidad: "módulo" },
    instalacion: { nombre: "Instalación en obra", precio: 15000, unidad: "módulo" }
  },
  /* Parámetros de cálculo, en porcentaje */
  params: {
    desperdicio: 12,   // recorte y despunte de tablero
    gastos: 8,         // gastos generales sobre el costo directo
    margen: 25,        // utilidad
    redondeo: 100      // el precio unitario se redondea a este múltiplo
  }
};

MQ.DEFAULT_EMPRESA = {
  nombre: "Mi Mueblería",
  logo: "",          // imagen en dataURL, ya reducida por MQ.procesarLogo
  rut: "",
  telefono: "",
  email: "",
  direccion: "",
  iva: 19,
  validez: 15,
  condiciones: "50% de anticipo para iniciar la fabricación, saldo contra entrega.\nPlazo de entrega: 15 días hábiles desde la aprobación.\nLos valores no incluyen modificaciones de instalaciones eléctricas ni sanitarias."
};

/* ---------- tipos de mueble ----------
   Cada tipo define las medidas y partes con que parte el formulario.
   partes limita qué opciones se muestran: el cálculo es el mismo para todos. */
MQ.TIPOS = [
  {
    id: "base", nombre: "Mueble base", descripcion: "Módulo de cocina o baño con zócalo",
    partes: ["puertas", "cajones", "cajonCol", "entrepanos", "trasera", "zocalo", "cubierta"],
    def: { ancho: 900, alto: 850, prof: 580, puertas: 2, cajones: 0, cajonCol: false, entrepanos: 1, trasera: true, zocalo: true, cubierta: false, barra: false }
  },
  {
    id: "colgante", nombre: "Mueble colgante", descripcion: "Módulo mural sobre cubierta",
    partes: ["puertas", "entrepanos", "trasera"],
    def: { ancho: 800, alto: 700, prof: 350, puertas: 2, cajones: 0, entrepanos: 1, trasera: true, zocalo: false, cubierta: false, barra: false }
  },
  {
    id: "closet", nombre: "Closet / armario", descripcion: "Con barra de colgar y cajones",
    partes: ["puertas", "cajones", "cajonCol", "entrepanos", "trasera", "zocalo", "barra"],
    def: { ancho: 1800, alto: 2200, prof: 600, puertas: 2, cajones: 3, cajonCol: true, entrepanos: 3, trasera: true, zocalo: true, cubierta: false, barra: true }
  },
  {
    id: "cajonera", nombre: "Cajonera / velador", descripcion: "Los cajones reparten todo el alto",
    partes: ["cajones", "trasera", "cubierta"],
    def: { ancho: 450, alto: 550, prof: 450, puertas: 0, cajones: 3, entrepanos: 0, trasera: true, zocalo: false, cubierta: false, barra: false }
  },
  {
    id: "librero", nombre: "Librero / estante", descripcion: "Repisas a la vista",
    partes: ["puertas", "entrepanos", "trasera", "zocalo"],
    def: { ancho: 800, alto: 1800, prof: 300, puertas: 0, cajones: 0, entrepanos: 4, trasera: true, zocalo: true, cubierta: false, barra: false }
  },
  {
    id: "cubierta", nombre: "Cubierta / mesón", descripcion: "Solo el tablero horizontal",
    /* el alto no se escribe: es el espesor del tablero que se elija */
    partes: [],
    def: { ancho: 2000, alto: 50, prof: 600, puertas: 0, cajones: 0, entrepanos: 0, trasera: false, zocalo: false, cubierta: false, barra: false }
  }
];

MQ.tipo = (id) => MQ.TIPOS.find((t) => t.id === id) || MQ.TIPOS[0];

/* Materiales con que parte un mueble nuevo */
/* La cubierta tiene material propio: suele ser madera maciza mucho más
   gruesa que los frentes, así que compartirlos daba despieces irreales. */
MQ.DEFAULT_MATERIALES = { cuerpo: "mel18b", frente: "mel18m", trasera: "tras3", cajon: "mel15b", cubierta: "mad50" };

MQ.nuevoMueble = function (tipoId) {
  const t = MQ.tipo(tipoId || "base");
  return Object.assign(
    /* lineales: piezas de madera dimensionada y perfiles de fierro que se
       compran por metro, con su largo y cantidad */
    { id: MQ.uid(), tipo: t.id, nombre: "", cantidad: 1, instalar: true, lineales: [], mat: MQ.clone(MQ.DEFAULT_MATERIALES) },
    MQ.clone(t.def)
  );
};
