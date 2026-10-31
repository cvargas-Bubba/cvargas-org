/* Catálogo y estructuras base.

   El catálogo es una sola lista de ítems. Cada ítem trae su unidad y su
   precio, y eso es todo lo que el cálculo necesita saber: no hay fórmulas
   por tipo de mueble, porque cada mueble se arma distinto.

   Los precios son netos en pesos chilenos y se editan desde la app. */
window.MQ = window.MQ || {};

MQ.clone = (o) => JSON.parse(JSON.stringify(o));
MQ.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
MQ.clp = (n) => "$" + Math.round(n || 0).toLocaleString("es-CL");
MQ.num = (v, def) => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : (def || 0); };
MQ.redondear = (n, a) => (a > 0 ? Math.round(n / a) * a : Math.round(n));
/* los decimales se muestran con coma, como se escriben acá */
MQ.dec = (n, d) => (Math.round(n * Math.pow(10, d == null ? 2 : d)) / Math.pow(10, d == null ? 2 : d))
  .toFixed(d == null ? 2 : d).replace(".", ",").replace(/,?0+$/, "");

/* ---------- unidades ----------
   `lineal` marca las que se cargan como largo × número de piezas: en vez de
   calcular los metros a mano, se anota el corte tal como se va a pedir. */
MQ.UNIDADES = {
  m: { nombre: "m", largo: "metro", lineal: true },
  m2: { nombre: "m²", largo: "metro cuadrado" },
  un: { nombre: "un.", largo: "unidad" },
  plancha: { nombre: "plancha", largo: "plancha" },
  hora: { nombre: "hora", largo: "hora" },
  global: { nombre: "global", largo: "monto fijo" }
};

MQ.CATEGORIAS = [
  { id: "madera", nombre: "Madera dimensionada", escuadria: true },
  { id: "perfil", nombre: "Perfiles de fierro" },
  { id: "tablero", nombre: "Tableros" },
  { id: "herraje", nombre: "Herrajes" },
  { id: "insumo", nombre: "Insumos y terminación" },
  { id: "mano", nombre: "Mano de obra" }
];
MQ.categoria = (id) => MQ.CATEGORIAS.find((c) => c.id === id) || MQ.CATEGORIAS[0];

/* ---------- catálogo por defecto ----------
   Valores de referencia: hay que reemplazarlos por los propios.
   En la madera, esp y anc van en pulgadas y arman el nombre: 2×4". */
MQ.DEFAULT_CATALOGO = {
  items: [
    { id: "m1x4", cat: "madera", nombre: "Pino seco cepillado", esp: 1, anc: 4, unidad: "m", precio: 1290 },
    { id: "m1x6", cat: "madera", nombre: "Pino seco cepillado", esp: 1, anc: 6, unidad: "m", precio: 1890 },
    { id: "m1x8", cat: "madera", nombre: "Pino seco cepillado", esp: 1, anc: 8, unidad: "m", precio: 2490 },
    { id: "m2x2", cat: "madera", nombre: "Pino seco cepillado", esp: 2, anc: 2, unidad: "m", precio: 1490 },
    { id: "m2x4", cat: "madera", nombre: "Pino seco cepillado", esp: 2, anc: 4, unidad: "m", precio: 2690 },
    { id: "m2x6", cat: "madera", nombre: "Pino seco cepillado", esp: 2, anc: 6, unidad: "m", precio: 3890 },
    { id: "m2x8", cat: "madera", nombre: "Pino seco cepillado", esp: 2, anc: 8, unidad: "m", precio: 5190 },

    { id: "f30", cat: "perfil", nombre: "Tubo cuadrado 30×30×2 mm", unidad: "m", precio: 2690 },
    { id: "f40", cat: "perfil", nombre: "Tubo cuadrado 40×40×2 mm", unidad: "m", precio: 3490 },
    { id: "f5020", cat: "perfil", nombre: "Tubo rectangular 50×20×2 mm", unidad: "m", precio: 3190 },
    { id: "fang", cat: "perfil", nombre: "Ángulo 40×40×3 mm", unidad: "m", precio: 3890 },
    { id: "fplat", cat: "perfil", nombre: "Pletina 38×3 mm", unidad: "m", precio: 2290 },

    { id: "mel18b", cat: "tablero", nombre: "Melamina blanca 18 mm", unidad: "plancha", precio: 38900 },
    { id: "mel18m", cat: "tablero", nombre: "Melamina madera 18 mm", unidad: "plancha", precio: 46900 },
    { id: "mel15b", cat: "tablero", nombre: "Melamina blanca 15 mm", unidad: "plancha", precio: 34900 },
    { id: "mdf18", cat: "tablero", nombre: "MDF crudo 18 mm", unidad: "plancha", precio: 32900 },
    { id: "ter15", cat: "tablero", nombre: "Terciado 15 mm", unidad: "plancha", precio: 28900 },
    { id: "tras3", cat: "tablero", nombre: "Trasera melamina 3 mm", unidad: "plancha", precio: 12900 },

    { id: "bisagra", cat: "herraje", nombre: "Bisagra con amortiguación", unidad: "un", precio: 2690 },
    { id: "corredera", cat: "herraje", nombre: "Corredera cierre suave (juego)", unidad: "un", precio: 9900 },
    { id: "tirador", cat: "herraje", nombre: "Tirador", unidad: "un", precio: 1890 },
    { id: "pata", cat: "herraje", nombre: "Pata niveladora", unidad: "un", precio: 690 },
    { id: "barra", cat: "herraje", nombre: "Barra de colgar", unidad: "m", precio: 2490 },
    { id: "soporte", cat: "herraje", nombre: "Soportes de barra (par)", unidad: "un", precio: 1190 },

    { id: "tornillos", cat: "insumo", nombre: "Tornillos y fijaciones", unidad: "global", precio: 2500 },
    { id: "cola", cat: "insumo", nombre: "Cola de carpintero", unidad: "un", precio: 4900 },
    { id: "lija", cat: "insumo", nombre: "Lija", unidad: "un", precio: 890 },
    { id: "barniz", cat: "insumo", nombre: "Barniz o aceite", unidad: "un", precio: 18900 },
    { id: "canto", cat: "insumo", nombre: "Tapacanto PVC 2 mm", unidad: "m", precio: 560 },
    { id: "pintura", cat: "insumo", nombre: "Pintura o antióxido para fierro", unidad: "un", precio: 12900 },

    { id: "taller", cat: "mano", nombre: "Hora de taller", unidad: "hora", precio: 12000 },
    { id: "instalacion", cat: "mano", nombre: "Hora de instalación", unidad: "hora", precio: 15000 }
  ],
  /* Porcentajes sobre el costo directo */
  params: {
    gastos: 8,       // gastos generales
    margen: 25,      // utilidad
    redondeo: 100    // el precio de cada partida se redondea a este múltiplo
  }
};

MQ.DEFAULT_EMPRESA = {
  nombre: "Fierro & Veta",
  logo: "",
  logoConNombre: false,   // el logo ya trae el nombre: no se escribe al lado
  rut: "",
  telefono: "",
  email: "",
  direccion: "",
  iva: 19,
  validez: 15,
  condiciones: "50% de anticipo para iniciar la fabricación, saldo contra entrega.\nPlazo de entrega: 15 días hábiles desde la aprobación.\nLos valores no incluyen modificaciones de instalaciones eléctricas ni sanitarias."
};

/* nombre con que se muestra un ítem: la madera lleva su escuadría adelante */
MQ.nombreItem = function (it) {
  if (!it) return "";
  const esc = MQ.categoria(it.cat).escuadria && it.esp && it.anc ? it.esp + "×" + it.anc + '" ' : "";
  return esc + (it.nombre || "");
};

/* ---------- croquis ----------
   Cada partida tiene el suyo, con una o más vistas sobre la misma lámina. */
/* nombre corto, para la etiqueta sobre la figura en el croquis: en la madera
   basta la escuadría, y el resto se recorta para no tapar el dibujo */
MQ.nombreCorto = function (it) {
  if (!it) return "";
  if (MQ.categoria(it.cat).escuadria && it.esp && it.anc) return it.esp + "×" + it.anc + '"';
  const n = it.nombre || "";
  return n.length > 20 ? n.slice(0, 19) + "…" : n;
};

MQ.nuevaVista = (nombre) => ({ id: MQ.uid(), nombre: nombre || "Frente", objetos: [] });
MQ.nuevoCroquis = () => ({ escala: 100, acotar: true, vistas: [MQ.nuevaVista("Frente")] });

/* ---------- partida ----------
   Un mueble o trabajo de la cotización: su descripción, su croquis y los
   materiales y horas que entran en fabricarlo. */
MQ.nuevaPartida = () => ({
  id: MQ.uid(),
  nombre: "",
  descripcion: "",
  cantidad: 1,
  lineas: [],
  croquis: MQ.nuevoCroquis()
});

/* una línea de material: el ítem del catálogo y cuánto va.
   En los ítems lineales se anota el largo de corte y el número de piezas. */
MQ.nuevaLinea = (itemId, unidad) => ({
  id: MQ.uid(), itemId,
  cant: 1,
  largo: MQ.UNIDADES[unidad] && MQ.UNIDADES[unidad].lineal ? 2000 : 0,
  piezas: 1,
  nota: ""
});
