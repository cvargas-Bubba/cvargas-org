/* ──────────────────────────────────────────────────────────────────────────
   LAS APLICACIONES DE cvargas.org SE EDITAN ACÁ.
   Agregar una es agregar una línea a esta lista.

   `privada: true` significa que la tarjeta no existe para nadie más: solo
   aparece cuando entra el dueño del sitio. Sin sesión, o con otra cuenta,
   la página se ve como si esas aplicaciones no estuvieran.
   ────────────────────────────────────────────────────────────────────────── */
const MODULOS = [
  {
    nombre: "Fierro & Veta",
    bajada: "Muebles a pedido",
    texto: "El taller: trabajos, contacto y el cotizador de muebles.",
    url: "fierro-y-veta/"
  },
  {
    nombre: "Cotizador de muebles",
    bajada: "Fierro & Veta",
    texto: "Croquis acotado, materiales con su costo, PDF para el cliente y hoja de taller.",
    url: "muebles/",
    privada: true
  },
  {
    nombre: "Conversor DXF a KML",
    bajada: "Planos al mapa",
    texto: "Pasa planos de AutoCAD a Google Earth.",
    url: "dxf-kml/"
  },
  {
    nombre: "Patio de áridos",
    bajada: "Prototipo",
    texto: "Venta de áridos, con vista de cliente y panel del vendedor.",
    url: "aridos/"
  },
  {
    /* tiene cuenta propia, así que el candado acá solo esconde la puerta:
       adentro igual pide su correo y su contraseña */
    nombre: "Cuentas claras",
    bajada: "Cuenta aparte",
    texto: "Ingresos, gastos y metas de ahorro. Se instala en el teléfono.",
    url: "cuentas/",
    privada: true
  },
  {
    nombre: "Visitas",
    bajada: "Solo tuyo",
    texto: "Quién abre cada aplicación, cuántas veces y desde dónde llegó.",
    url: "visitas/",
    privada: true
  }
];

/* Lo que vive en otro lado y se enlaza nomás. */
const OTRAS = [
  { nombre: "Cotizador de vidriería", url: "https://cvargas-bubba.github.io/cotizador-vidrieria/" },
  { nombre: "Transcriptor", url: "https://cvargas-bubba.github.io/transcriptor/" }
];

/* ────────────────────────── de acá para abajo, el armado ────────────────── */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const hayNube = () => !!(window.MQ && MQ.nube && MQ.nube.disponible());
  const correo = () => (hayNube() ? MQ.nube.correo() : "");
  /* el dueño, no "cualquiera con una cuenta": si mañana entra un cliente,
     la página se le ve igual que a un desconocido */
  const esDueno = () => hayNube() && MQ.nube.esDueno();

  function pintar() {
    const mio = esDueno();
    const lista = MODULOS.filter((m) => !m.privada || mio);
    $("tarjetas").innerHTML = lista.map((m) => `
      <li class="tarjeta">
        <a href="${esc(m.url)}">
          <span class="t-cab">
            <span class="t-n">${esc(m.nombre)}</span>
            ${m.bajada ? `<span class="t-b">${esc(m.bajada)}</span>` : ""}
          </span>
          <span class="t-t">${esc(m.texto)}</span>
          <span class="t-pie">Abrir</span>
        </a>
      </li>`).join("");

    /* si entró alguien que no es el dueño, conviene decírselo: si no, ve la
       misma página de antes y no entiende qué pasó */
    const ajeno = !!correo() && !mio;
    $("nota").hidden = !ajeno;
    $("nota").textContent = ajeno
      ? "Entraste como " + correo() + ". Esta cuenta no tiene aplicaciones acá."
      : "";

    $("otrasSec").hidden = !OTRAS.length;
    $("otras").innerHTML = OTRAS.map((o) =>
      `<li><a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.nombre)}</a></li>`).join("");

    const c = correo();
    $("sesionQuien").hidden = !c;
    $("sesionQuien").textContent = c;
    $("btnSesion").textContent = c ? "Salir" : "Entrar";
    $("btnSesion").hidden = !hayNube();
  }

  const verAcceso = (v) => { $("acceso").hidden = !v; if (v) $("acCorreo").focus(); };
  function aviso(t, ok) {
    const p = $("accesoAviso");
    p.hidden = !t; p.textContent = t || "";
    p.classList.toggle("ok", !!ok);
  }

  function conectar() {
    $("btnSesion").addEventListener("click", async () => {
      if (!correo()) { aviso(""); verAcceso(true); return; }
      if (!confirm("¿Salir de la sesión?")) return;
      await MQ.nube.salir();
    });

    $("acCerrar").addEventListener("click", () => verAcceso(false));

    $("accesoForm").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const correo = $("acCorreo").value.trim(), clave = $("acClave").value;
      if (!correo || !clave) return aviso("Escribe tu correo y tu contraseña.");
      $("acEntrar").disabled = true; aviso("");
      const r = await MQ.nube.entrar(correo, clave);
      $("acEntrar").disabled = false;
      if (!r.ok) return aviso(r.error);
      $("acClave").value = "";
      verAcceso(false);
    });

    $("acOlvide").addEventListener("click", async () => {
      const correo = $("acCorreo").value.trim();
      if (!correo) return aviso("Escribe tu correo y vuelve a tocar acá.");
      const r = await MQ.nube.recuperar(correo);
      aviso(r.ok ? "Te mandamos un correo para cambiar la contraseña." : r.error, r.ok);
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !$("acceso").hidden) verAcceso(false);
    });
  }

  conectar();
  pintar();
  /* la sesión es de todo el dominio: si entraste acá, el cotizador ya te
     conoce y no vuelve a preguntar */
  if (window.MQ && MQ.nube) MQ.nube.iniciar(() => pintar());
})();
