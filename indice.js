/* ──────────────────────────────────────────────────────────────────────────
   LAS APLICACIONES DE cvargas.org SE EDITAN ACÁ.
   Agregar una es agregar una línea a esta lista.

   `privada: true` significa que solo se abre con sesión iniciada: mientras no
   la haya se muestra con candado y al tocarla pide entrar.
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
  const dentro = () => hayNube() && !!MQ.nube.usuario();

  function pintar() {
    const sesion = dentro();
    $("tarjetas").innerHTML = MODULOS.map((m) => {
      const cerrada = m.privada && !sesion;
      return `<li class="tarjeta${cerrada ? " cerrada" : ""}">
        <a href="${esc(cerrada ? "#" : m.url)}"${cerrada ? ' data-pide="1"' : ""}>
          <span class="t-cab">
            <span class="t-n">${esc(m.nombre)}</span>
            ${m.bajada ? `<span class="t-b">${esc(m.bajada)}</span>` : ""}
          </span>
          <span class="t-t">${esc(m.texto)}</span>
          <span class="t-pie">${cerrada ? "Requiere entrar" : "Abrir"}</span>
        </a>
      </li>`;
    }).join("");

    const privadas = MODULOS.filter((m) => m.privada).length;
    $("nota").hidden = sesion || !privadas || !hayNube();
    $("nota").textContent = privadas === 1
      ? "Una de las aplicaciones es privada: entra con tu correo para abrirla."
      : "Algunas aplicaciones son privadas: entra con tu correo para abrirlas.";

    $("otrasSec").hidden = !OTRAS.length;
    $("otras").innerHTML = OTRAS.map((o) =>
      `<li><a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.nombre)}</a></li>`).join("");

    const correo = hayNube() ? MQ.nube.correo() : "";
    $("sesionQuien").hidden = !correo;
    $("sesionQuien").textContent = correo;
    $("btnSesion").textContent = correo ? "Salir" : "Entrar";
    $("btnSesion").hidden = !hayNube();
  }

  const verAcceso = (v) => { $("acceso").hidden = !v; if (v) $("acCorreo").focus(); };
  function aviso(t, ok) {
    const p = $("accesoAviso");
    p.hidden = !t; p.textContent = t || "";
    p.classList.toggle("ok", !!ok);
  }

  function conectar() {
    $("tarjetas").addEventListener("click", (ev) => {
      const a = ev.target.closest("[data-pide]");
      if (!a) return;
      ev.preventDefault();
      verAcceso(true);
    });

    $("btnSesion").addEventListener("click", async () => {
      if (!dentro()) { aviso(""); verAcceso(true); return; }
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
