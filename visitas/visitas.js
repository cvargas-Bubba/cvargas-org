/* Panel de visitas. Lee la colección que escriben las apps y la resume.
   Las reglas de Firestore solo dejan leerla al dueño del sitio, así que
   entrar acá con otra cuenta no muestra nada: no es una pantalla escondida,
   es un permiso de verdad. */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const NOMBRES = {
    indice: "Índice", "fierro-y-veta": "Fierro & Veta", muebles: "Cotizador",
    "dxf-kml": "DXF a KML", aridos: "Patio de áridos", cuentas: "Cuentas claras"
  };
  const nombre = (a) => NOMBRES[a] || a;

  const dia = (d) => d.toISOString().slice(0, 10);
  const diaCorto = (s) => s.slice(8, 10) + "-" + s.slice(5, 7);
  const hora = (d) => d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  /* de dónde vino: el dominio pelado, que es lo único que se mira */
  function origen(ref) {
    if (!ref) return "directo";
    try {
      const h = new URL(ref).hostname.replace(/^www\./, "");
      return h === location.hostname ? "del sitio" : h;
    } catch (e) { return "—"; }
  }

  async function cargar() {
    const dias = +$("dias").value;
    $("estado").hidden = false;
    $("estado").textContent = "Leyendo…";
    try {
      let q = firebase.firestore().collection("visitas").orderBy("cuando", "desc").limit(2000);
      if (dias) {
        const desde = new Date(Date.now() - dias * 86400000);
        q = firebase.firestore().collection("visitas").where("cuando", ">=", desde).orderBy("cuando", "desc").limit(2000);
      }
      const s = await q.get();
      const filas = [];
      s.forEach((d) => {
        const v = d.data();
        const t = v.cuando && v.cuando.toDate ? v.cuando.toDate() : new Date(v.cuando);
        filas.push({ app: v.app || "?", t, visitante: v.visitante || "", correo: v.correo || "", ref: v.referencia || "", pantalla: v.pantalla || "" });
      });
      pintar(filas);
      $("estado").hidden = true;
    } catch (e) {
      $("estado").hidden = false;
      $("estado").textContent = /permission/i.test(String(e && e.message))
        ? "Esta cuenta no puede leer el registro."
        : "No se pudo leer el registro. " + (e && e.message ? e.message : "");
    }
  }

  function pintar(filas) {
    $("panel").hidden = false;

    /* una tarjeta por app: cuántas aperturas y cuántos navegadores distintos,
       que es lo que distingue "la miraron" de "la usan" */
    const porApp = {};
    filas.forEach((f) => {
      const a = porApp[f.app] || (porApp[f.app] = { visitas: 0, gente: {}, ultima: null });
      a.visitas++;
      if (f.visitante) a.gente[f.visitante] = 1;
      if (!a.ultima || f.t > a.ultima) a.ultima = f.t;
    });
    const apps = Object.keys(porApp).sort((x, y) => porApp[y].visitas - porApp[x].visitas);
    $("resumen").innerHTML = apps.length ? apps.map((a) => {
      const x = porApp[a], n = Object.keys(x.gente).length;
      return `<li class="tarj">
        <span class="tarj-n">${esc(nombre(a))}</span>
        <span class="tarj-v mono">${x.visitas}</span>
        <span class="tarj-d">${x.visitas === 1 ? "apertura" : "aperturas"} · ${n} ${n === 1 ? "navegador" : "navegadores"}</span>
        <span class="tarj-u">última ${esc(hora(x.ultima))}</span>
      </li>`;
    }).join("") : `<li class="tarj vacio">Todavía no hay visitas registradas.</li>`;

    /* por día, apilado por app */
    const dias = {};
    filas.forEach((f) => {
      const k = dia(f.t);
      (dias[k] = dias[k] || {})[f.app] = ((dias[k] || {})[f.app] || 0) + 1;
    });
    const claves = Object.keys(dias).sort();
    const maximo = claves.reduce((m, k) => Math.max(m, Object.keys(dias[k]).reduce((s, a) => s + dias[k][a], 0)), 0) || 1;
    $("barras").innerHTML = claves.length ? claves.map((k) => {
      const total = Object.keys(dias[k]).reduce((s, a) => s + dias[k][a], 0);
      return `<div class="barra" title="${esc(k)}: ${total}">
        <div class="barra-t" style="height:${Math.round(total / maximo * 100)}%"></div>
        <span class="barra-n mono">${total}</span>
        <span class="barra-f">${esc(diaCorto(k))}</span>
      </div>`;
    }).join("") : `<p class="vacio">Sin datos en este período.</p>`;

    $("detalle").querySelector("tbody").innerHTML = filas.slice(0, 200).map((f) => `
      <tr>
        <td class="mono">${esc(hora(f.t))}</td>
        <td>${esc(nombre(f.app))}</td>
        <td class="mono chico">${esc(f.visitante.slice(0, 8))}</td>
        <td>${f.correo ? esc(f.correo) : `<span class="anon">anónimo</span>`}</td>
        <td>${esc(origen(f.ref))}</td>
        <td class="mono chico">${esc(f.pantalla)}</td>
      </tr>`).join("");
  }

  /* ---------- sesión ---------- */
  const verAcceso = (v) => { $("acceso").hidden = !v; if (v) $("acCorreo").focus(); };
  function aviso(t, ok) {
    const p = $("accesoAviso");
    p.hidden = !t; p.textContent = t || "";
    p.classList.toggle("ok", !!ok);
  }

  function conectar() {
    $("accesoForm").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const correo = $("acCorreo").value.trim(), clave = $("acClave").value;
      if (!correo || !clave) return aviso("Escribe tu correo y tu contraseña.");
      $("acEntrar").disabled = true; aviso("");
      const r = await MQ.nube.entrar(correo, clave);
      $("acEntrar").disabled = false;
      if (!r.ok) return aviso(r.error);
      $("acClave").value = "";
    });
    $("acOlvide").addEventListener("click", async () => {
      const correo = $("acCorreo").value.trim();
      if (!correo) return aviso("Escribe tu correo y vuelve a tocar acá.");
      const r = await MQ.nube.recuperar(correo);
      aviso(r.ok ? "Te mandamos un correo para cambiar la contraseña." : r.error, r.ok);
    });
    $("btnSesion").addEventListener("click", async () => {
      if (MQ.nube.usuario()) {
        if (!confirm("¿Salir de la sesión?")) return;
        await MQ.nube.salir();
        return;
      }
      verAcceso(true);
    });
    $("recargar").addEventListener("click", cargar);
    $("dias").addEventListener("change", cargar);
  }

  conectar();
  MQ.nube.iniciar((u, err) => {
    if (err) { $("estado").textContent = "No se pudo conectar con la nube."; return; }
    $("sesionQuien").hidden = !u;
    $("sesionQuien").textContent = u ? u.email : "";
    $("btnSesion").textContent = u ? "Salir" : "Entrar";
    if (!u) {
      $("panel").hidden = true;
      $("estado").hidden = false;
      $("estado").textContent = "Entra con tu cuenta para ver el registro.";
      verAcceso(true);
      return;
    }
    /* el registro es del dueño; además las reglas no se lo darían a nadie más */
    if (!MQ.nube.esDueno()) {
      $("panel").hidden = true;
      $("estado").hidden = false;
      $("estado").textContent = "Esta cuenta no puede ver el registro.";
      verAcceso(true);
      aviso("La cuenta " + u.email + " no tiene acceso.");
      MQ.nube.salir();
      return;
    }
    verAcceso(false);
    cargar();
  });
})();
