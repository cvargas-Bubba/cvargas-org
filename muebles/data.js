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
  m: { nombre: "m", largo: "metro", lineal: true, compra: "tira", compras: "tiras" },
  m2: { nombre: "m²", largo: "metro cuadrado", compra: "plancha", compras: "planchas", superficie: true },
  un: { nombre: "un.", largo: "unidad" },
  plancha: { nombre: "plancha", largo: "plancha" },
  hora: { nombre: "hora", largo: "hora" },
  global: { nombre: "global", largo: "monto fijo" }
};

/* ---------- lo que rinde una compra ----------
   La madera no se compra por metro sino en tiras de 3,2 m, y el fierro en
   tiras de 6 m; un tablero se compra por plancha pero entra al mueble por
   metro cuadrado. `rinde` dice cuánto de la unidad del ítem entrega una
   compra, así el precio que uno anota es el de la tira o la plancha —el que
   le cobran— y el metro sale de ahí. Sin `rinde`, el precio es por unidad,
   como antes. */
MQ.rinde = function (it) {
  if (!it) return 1;
  const u = MQ.UNIDADES[it.unidad] || {};
  if (u.superficie && MQ.num(it.plAncho, 0) > 0 && MQ.num(it.plLargo, 0) > 0) {
    return (MQ.num(it.plAncho, 0) / 1000) * (MQ.num(it.plLargo, 0) / 1000);
  }
  const r = MQ.num(it.rinde, 0);
  return r > 0 ? r : 1;
};
/* el precio de una unidad: del metro, del metro cuadrado, de la hora */
MQ.precioUnidad = (it) => MQ.num(it && it.precio, 0) / MQ.rinde(it);
/* cuánto se pierde en cortes y despuntes, en tanto por uno */
MQ.perdidaDe = (it) => Math.max(0, MQ.num(it && it.perdida, 0)) / 100;

/* `corteLargo`: en una figura cerrada, este material se cuenta por el lado
   mayor y no por el contorno. Un rectángulo de 1000 × 300 es un marco de
   fierro —2,6 m de perfil— pero es una tabla de 1 m de largo: el 300 es el
   ancho de la madera, no otro corte. */
MQ.CATEGORIAS = [
  { id: "madera", nombre: "Madera dimensionada", escuadria: true, corteLargo: true },
  { id: "perfil", nombre: "Perfiles de fierro" },
  { id: "tablero", nombre: "Tableros" },
  { id: "herraje", nombre: "Herrajes" },
  { id: "insumo", nombre: "Insumos y terminación" },
  { id: "mano", nombre: "Mano de obra" }
];
MQ.categoria = (id) => MQ.CATEGORIAS.find((c) => c.id === id) || MQ.CATEGORIAS[0];
MQ.CORTES = { contorno: "Contorno: los lados", largo: "Largo: el lado mayor" };

/* ---------- catálogo por defecto ----------
   Valores de referencia: hay que reemplazarlos por los propios.
   En la madera, esp y anc van en pulgadas y arman el nombre: 2×4". */
MQ.DEFAULT_CATALOGO = {
  items: [
    { id: "m1x4", cat: "madera", nombre: "Pino seco cepillado", esp: 1, anc: 4, unidad: "m", rinde: 3.2, precio: 4130 },
    { id: "m1x6", cat: "madera", nombre: "Pino seco cepillado", esp: 1, anc: 6, unidad: "m", rinde: 3.2, precio: 6050 },
    { id: "m1x8", cat: "madera", nombre: "Pino seco cepillado", esp: 1, anc: 8, unidad: "m", rinde: 3.2, precio: 7970 },
    { id: "m2x2", cat: "madera", nombre: "Pino seco cepillado", esp: 2, anc: 2, unidad: "m", rinde: 3.2, precio: 4770 },
    { id: "m2x4", cat: "madera", nombre: "Pino seco cepillado", esp: 2, anc: 4, unidad: "m", rinde: 3.2, precio: 8610 },
    { id: "m2x6", cat: "madera", nombre: "Pino seco cepillado", esp: 2, anc: 6, unidad: "m", rinde: 3.2, precio: 12450 },
    { id: "m2x8", cat: "madera", nombre: "Pino seco cepillado", esp: 2, anc: 8, unidad: "m", rinde: 3.2, precio: 16610 },

    { id: "f30", cat: "perfil", nombre: "Tubo cuadrado 30×30×2 mm", unidad: "m", rinde: 6, precio: 16140 },
    { id: "f40", cat: "perfil", nombre: "Tubo cuadrado 40×40×2 mm", unidad: "m", rinde: 6, precio: 20940 },
    { id: "f5020", cat: "perfil", nombre: "Tubo rectangular 50×20×2 mm", unidad: "m", rinde: 6, precio: 19140 },
    { id: "fang", cat: "perfil", nombre: "Ángulo 40×40×3 mm", unidad: "m", rinde: 6, precio: 23340 },
    { id: "fplat", cat: "perfil", nombre: "Pletina 38×3 mm", unidad: "m", rinde: 6, precio: 13740 },

    { id: "mel18b", cat: "tablero", nombre: "Melamina blanca 18 mm", unidad: "m2", plAncho: 1520, plLargo: 2440, perdida: 10, precio: 38900 },
    { id: "mel18m", cat: "tablero", nombre: "Melamina madera 18 mm", unidad: "m2", plAncho: 1520, plLargo: 2440, perdida: 10, precio: 46900 },
    { id: "mel15b", cat: "tablero", nombre: "Melamina blanca 15 mm", unidad: "m2", plAncho: 1520, plLargo: 2440, perdida: 10, precio: 34900 },
    { id: "mdf18", cat: "tablero", nombre: "MDF crudo 18 mm", unidad: "m2", plAncho: 1520, plLargo: 2440, perdida: 10, precio: 32900 },
    { id: "ter15", cat: "tablero", nombre: "Terciado 15 mm", unidad: "m2", plAncho: 1520, plLargo: 2440, perdida: 10, precio: 28900 },
    { id: "tras3", cat: "tablero", nombre: "Trasera melamina 3 mm", unidad: "m2", plAncho: 1520, plLargo: 2440, perdida: 10, precio: 12900 },

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

/* ---------- colores de los materiales ----------
   Escribir el nombre sobre cada trazo tapaba el dibujo apenas había unas
   pocas piezas. El color identifica el material y la nomenclatura dice cuál
   es cada uno, que es como se lee un plano. Son tonos medios a propósito:
   tienen que leerse sobre la pantalla oscura y sobre el papel blanco. */
MQ.COLORES_MAT = [
  [232, 144, 58], [79, 163, 227], [95, 190, 125], [216, 107, 107],
  [180, 139, 214], [205, 181, 60], [73, 194, 194], [201, 138, 98]
];
MQ.colorMat = (i) => MQ.COLORES_MAT[((i % MQ.COLORES_MAT.length) + MQ.COLORES_MAT.length) % MQ.COLORES_MAT.length];
MQ.rgb = (c) => "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";

/* ---------- etapas del trabajo ----------
   El camino que recorre un trabajo, de la cotización a la entrega. Cada
   etapa guarda su fecha en `hitos`, así el historial dice no solo en qué
   quedó cada trabajo sino cuándo pasó cada cosa. "Rechazada" no es parte
   del camino: es salirse de él, y por eso va aparte. */
MQ.ETAPAS = [
  { id: "borrador", nombre: "Borrador", corto: "Borrador", pie: "La estás armando" },
  { id: "enviada", nombre: "Enviada al cliente", corto: "Enviada", pie: "El cliente ya la tiene" },
  { id: "aceptada", nombre: "Aceptada", corto: "Aceptada", pie: "El cliente la aprobó" },
  { id: "taller", nombre: "En taller", corto: "En taller", pie: "Abonada y en fabricación" },
  { id: "entregada", nombre: "Entregada", corto: "Entregada", pie: "Trabajo entregado" }
];
MQ.RECHAZADA = { id: "rechazada", nombre: "Rechazada", corto: "Rechazada", pie: "El cliente no siguió" };
MQ.etapa = (id) => MQ.ETAPAS.find((e) => e.id === id) || (id === "rechazada" ? MQ.RECHAZADA : MQ.ETAPAS[0]);
MQ.etapaIndice = (id) => MQ.ETAPAS.findIndex((e) => e.id === id);

/* fecha de hoy como YYYY-MM-DD, en hora local: estas fechas son del taller,
   no instantes, y en UTC el trabajo entregado de tarde cambia de día */
MQ.hoy = function () {
  const d = new Date();
  const dd = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + dd(d.getMonth() + 1) + "-" + dd(d.getDate());
};
MQ.fechaDia = (f) => {
  if (!f) return "";
  const p = String(f).slice(0, 10).split("-");
  return p.length === 3 ? p[2] + "-" + p[1] + "-" + p[0] : String(f);
};

MQ.nuevoPago = () => ({ id: MQ.uid(), fecha: MQ.hoy(), monto: 0, medio: "" });

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
