/* Arma la página con lo que haya en datos.js. */
(function () {
  const S = window.SITIO || {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* ---------- identidad ---------- */
  const nombre = S.nombre || "Taller de muebles";
  document.title = nombre + (S.oficio ? " · " + S.oficio : "");
  $("marcaNombre").textContent = nombre;
  $("marcaOficio").textContent = S.oficio || "";
  if (S.logo) {
    const l = $("marcaLogo");
    l.src = S.logo; l.alt = nombre; l.hidden = false;
  }
  $("pieNombre").textContent = nombre;
  $("titular").textContent = S.titular || nombre;
  $("bajada").textContent = S.bajada || "";
  if (S.zona) { $("zona").textContent = S.zona; $("zona").hidden = false; }

  /* ---------- WhatsApp ----------
     Sin teléfono no se muestran los botones: es preferible a dejar
     enlaces que no llevan a ninguna parte. */
  const tel = String(S.telefono || "").replace(/\D/g, "");
  if (tel) {
    const url = "https://wa.me/" + tel + (S.mensaje ? "?text=" + encodeURIComponent(S.mensaje) : "");
    ["waHero", "waContacto", "waFlota"].forEach((id) => {
      const a = $(id);
      a.href = url; a.target = "_blank"; a.rel = "noopener";
      a.hidden = false;
    });
  }
  if (S.email) {
    const a = $("mailContacto");
    a.href = "mailto:" + S.email + "?subject=" + encodeURIComponent("Consulta por un mueble");
    a.textContent = S.email;
    a.hidden = false;
  }
  /* Sin ningún medio de contacto, la sección queda con el cotizador como
     única acción. El aviso va a la consola: es para quien edita el sitio,
     no para quien lo visita. */
  if (!tel && !S.email) {
    $("cotizaContacto").hidden = false;
    console.info("Sitio: falta el teléfono en datos.js, por eso no aparecen los botones de WhatsApp.");
  }

  /* ---------- trabajos ----------
     Una entrada sin foto, o con una foto que no carga, muestra igual su
     recuadro con el título: la grilla no se descuadra. */
  const trabajos = (S.trabajos || []).filter((t) => t && (t.titulo || t.foto));
  $("galeria").innerHTML = trabajos.map((t, i) => `
    <figure class="pieza${t.foto ? "" : " sin-foto"}" ${t.foto ? `data-i="${i}"` : ""}>
      ${t.foto ? `<img src="${esc(t.foto)}" alt="${esc(t.titulo || "Trabajo")}" loading="lazy">` : `<div class="marco"></div>`}
      <figcaption>
        <span class="pieza-t">${esc(t.titulo || "")}</span>
        ${t.detalle ? `<span class="pieza-d">${esc(t.detalle)}</span>` : ""}
      </figcaption>
    </figure>`).join("");

  /* si el archivo no existe, se cae al recuadro en vez de mostrar el ícono roto */
  $("galeria").querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      const fig = img.closest(".pieza");
      fig.classList.add("sin-foto");
      fig.removeAttribute("data-i");
      img.replaceWith(Object.assign(document.createElement("div"), { className: "marco" }));
    });
  });

  /* ---------- visor de fotos ---------- */
  const visor = $("visor");
  $("galeria").addEventListener("click", (ev) => {
    const fig = ev.target.closest(".pieza[data-i]");
    if (!fig) return;
    const t = trabajos[+fig.dataset.i];
    $("visorImg").src = t.foto;
    $("visorImg").alt = t.titulo || "";
    visor.showModal();
  });
  $("visorCerrar").addEventListener("click", () => visor.close());
  visor.addEventListener("click", (ev) => { if (ev.target === visor) visor.close(); });

  /* ---------- herramientas ---------- */
  const apps = (S.apps || []).filter((a) => a && a.mostrar !== false && a.url);
  $("apps").innerHTML = apps.map((a) => `
    <a class="app" href="${esc(a.url)}" target="_blank" rel="noopener">
      <span class="app-n">${esc(a.nombre || "")}</span>
      <span class="app-t">${esc(a.texto || "")}</span>
      <span class="app-ir">Abrir →</span>
    </a>`).join("");
  if (!apps.length) document.getElementById("herramientas").hidden = true;
})();
