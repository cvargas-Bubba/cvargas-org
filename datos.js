/* ──────────────────────────────────────────────────────────────────────────
   TODO LO QUE SE EDITA DEL SITIO ESTÁ EN ESTE ARCHIVO.
   No hace falta tocar nada más: cambias acá y la página se actualiza sola.
   ────────────────────────────────────────────────────────────────────────── */
window.SITIO = {

  /* ---------- quién eres ---------- */
  nombre: "Taller Cvargas",            // el nombre que va arriba y en la pestaña
  oficio: "Muebles a medida",          // la línea chica al lado del nombre
  titular: "Muebles a medida, hechos en madera y fierro",
  bajada: "Trabajo cada mueble a la medida del espacio: cocinas, closets, " +
          "libreros y mesones de madera maciza. Cuéntame qué necesitas y lo cotizamos.",

  /* ---------- contacto ----------
     El teléfono va en formato internacional, sin + ni espacios: 56912345678
     Mientras esté vacío, los botones de WhatsApp no aparecen. */
  telefono: "",
  mensaje: "Hola, vi tu página y quiero cotizar un mueble.",
  email: "",                           // opcional, déjalo vacío si no quieres publicarlo
  zona: "",                            // opcional: "Santiago y alrededores"

  /* ---------- trabajos ----------
     Pon las fotos en la carpeta fotos/ y escribe acá el nombre del archivo.
     Mientras no haya foto, se muestra un recuadro con el título igual,
     así la página no se ve rota. */
  trabajos: [
    { foto: "", titulo: "Mesón de cocina", detalle: "Madera maciza de 2\", 2,4 m" },
    { foto: "", titulo: "Closet de dormitorio", detalle: "Puertas corredera y cajonera" },
    { foto: "", titulo: "Librero a medida", detalle: "Melamina y estructura de fierro" },
    { foto: "", titulo: "Mueble de baño", detalle: "Con cubierta de madera" },
    { foto: "", titulo: "Mesa de comedor", detalle: "Tablero macizo y patas de perfil" },
    { foto: "", titulo: "Muebles de cocina", detalle: "Módulos bajos y colgantes" }
  ],

  /* ---------- herramientas ----------
     Cambia `mostrar` a false para sacar alguna de la página. */
  apps: [
    { nombre: "Cotizador de muebles", url: "https://muebles.cvargas.org",
      texto: "Calcula el precio, el despiece y la lista de compra desde las medidas del mueble.",
      mostrar: true },
    { nombre: "Cotizador de vidriería", url: "https://cvargas-bubba.github.io/cotizador-vidrieria/",
      texto: "Ventanas, shower doors, espejos y barandas, con esquema y PDF.",
      mostrar: true },
    { nombre: "Conversor DXF a KML", url: "https://cvargas-bubba.github.io/conversor-dxf-kml/",
      texto: "Pasa planos de AutoCAD a Google Earth.",
      mostrar: true },
    { nombre: "Patio de áridos", url: "https://cvargas-bubba.github.io/patio-de-aridos/",
      texto: "Prototipo de venta de áridos, con vista de cliente y panel del vendedor.",
      mostrar: true },
    { nombre: "Transcriptor", url: "https://cvargas-bubba.github.io/transcriptor/",
      texto: "Graba o sube audio, lo transcribe y lo resume.",
      mostrar: false },
    { nombre: "Cuentas claras", url: "https://cvargas-bubba.github.io/cuentas-claras/",
      texto: "Registra ingresos, gastos y metas de ahorro.",
      mostrar: false }
  ]
};
