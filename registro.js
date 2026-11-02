/* Registro de visitas.

   Anota una línea cada vez que se abre una aplicación, para saber si alguien
   las usa. Lo que se guarda es deliberadamente poco: qué app, cuándo, un
   número al azar que identifica al navegador —no a la persona—, el idioma,
   el tamaño de la pantalla y de dónde venía. Nada de direcciones IP ni de
   huellas del dispositivo.

   Escribe directo a Firestore por su API web, sin cargar el SDK: son unos
   cientos de bytes y así sirve igual en las apps que no usan Firebase para
   nada. Las reglas dejan crear estas líneas a cualquiera y leerlas solo al
   dueño del sitio.

   Si falla —sin internet, con un bloqueador, con el almacenamiento cerrado—
   no pasa nada: el registro es lo último que importa de una página.

   Uso: <script src="/registro.js" data-app="muebles"></script> */
(function () {
  const PROYECTO = "fierro-y-veta";
  const CLAVE = "AIzaSyBbualIEIJmENBMCkb8Ih1PK0ozsv1Ga_o";
  const URL = "https://firestore.googleapis.com/v1/projects/" + PROYECTO +
    "/databases/(default)/documents/visitas?key=" + CLAVE;

  const marca = document.currentScript;
  const app = (marca && marca.dataset.app) || "desconocida";
  const texto = (v, max) => ({ stringValue: String(v == null ? "" : v).slice(0, max || 40) });

  /* un identificador al azar, guardado en este navegador, para distinguir
     diez visitas de una persona de una visita de diez personas */
  function visitante() {
    try {
      let v = localStorage.getItem("cv.visitante");
      if (!v) {
        v = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        localStorage.setItem("cv.visitante", v);
      }
      return v;
    } catch (e) { return "sin-id"; }
  }

  function anotar() {
    const campos = {
      app: texto(app),
      cuando: { timestampValue: new Date().toISOString() },
      visitante: texto(visitante()),
      idioma: texto(navigator.language, 12),
      pantalla: texto(screen.width + "×" + screen.height, 16),
      referencia: texto(document.referrer, 120)
    };
    /* si la app tiene sesión abierta, queda anotado quién era */
    try {
      const u = window.firebase && firebase.apps && firebase.apps.length &&
        firebase.auth && firebase.auth().currentUser;
      if (u && u.email) campos.correo = texto(u.email, 80);
    } catch (e) { /* sin sesión */ }

    try {
      fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: campos }),
        keepalive: true
      }).catch(() => {});
    } catch (e) { /* que no se note */ }
  }

  /* se espera un poco: primero que cargue la página, y además para darle
     tiempo a Firebase a decir si hay sesión, donde lo haya */
  const arrancar = () => setTimeout(anotar, 2500);
  if (document.readyState === "complete") arrancar();
  else window.addEventListener("load", arrancar);
})();
