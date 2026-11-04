/* ──────────────────────────────────────────────────────────────────────────
   TODO LO QUE SE EDITA DEL SITIO ESTÁ EN ESTE ARCHIVO.
   No hace falta tocar nada más: cambias acá y la página se actualiza sola.
   ────────────────────────────────────────────────────────────────────────── */
window.SITIO = {

  /* ---------- quién eres ---------- */
  nombre: "Fierro & Veta",             // el nombre que va arriba y en la pestaña
  oficio: "Muebles a pedido",          // la línea chica al lado del nombre
  logo: "../marca/fv-monograma.png",      // deja "" si prefieres solo el nombre escrito
  titular: "Muebles a pedido, en madera y fierro",
  bajada: "Cada mueble se hace a la medida del espacio: cocinas, closets, " +
          "libreros y mesones de madera maciza, con estructura de fierro cuando " +
          "el trabajo lo pide. Cuéntame qué necesitas y lo cotizamos.",

  /* ---------- contacto ----------
     El teléfono va en formato internacional, sin + ni espacios: 56912345678
     Mientras esté vacío, los botones de WhatsApp no aparecen. */
  telefono: "56993304609",
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
     Esta es la página del taller: acá va lo que le sirve a un cliente. El
     resto de las aplicaciones vive en el índice, en cvargas.org.
     Cambia `mostrar` a false para sacar alguna de la página. */
  apps: [
    { nombre: "Cotizador de muebles", url: "../muebles/",
      texto: "Calcula el precio, el despiece y la lista de compra desde las medidas del mueble.",
      mostrar: false }   // privado: pide cuenta, así que un cliente no puede usarlo
  ]
};
