/* Cuenta y sincronización.

   Los datos siguen viviendo en este equipo —la app abre y funciona sin
   señal— y además suben a la nube para que otro equipo vea lo mismo. Cada
   registro lleva su fecha de modificación y gana el más reciente: con un
   solo usuario eso basta y evita toda la complicación de los conflictos.

   Si el SDK de Firebase no carga (sin internet, bloqueado por el navegador)
   la app no se cae: queda en modo local, igual que antes de todo esto. */
window.MQ = window.MQ || {};

MQ.nube = (function () {
  /* Configuración pública de la app web. Estos valores van a la vista en el
     código del sitio a propósito: no dan acceso a nada por sí solos. Quien
     cuida los datos son las reglas de Firestore y la contraseña. */
  const CONFIG = {
    apiKey: "AIzaSyBbualIEIJmENBMCkb8Ih1PK0ozsv1Ga_o",
    authDomain: "fierro-y-veta.firebaseapp.com",
    projectId: "fierro-y-veta",
    storageBucket: "fierro-y-veta.firebasestorage.app",
    messagingSenderId: "318972385000",
    appId: "1:318972385000:web:805991a36b77a9ba11db5d"
  };

  /* El dueño del sitio. Lo privado es suyo y de nadie más: no basta con tener
     una cuenta. Está acá, en un solo lugar, para que el índice, el cotizador
     y el panel de visitas apliquen el mismo criterio. */
  const DUENO = "cavargasm.cuentas@gmail.com";

  /* Qué se sincroniza y cómo se guarda. Los "sueltos" son documentos únicos
     —el catálogo, la empresa— y las "listas" son colecciones con un
     documento por registro. El borrador no entra: es el pizarrón de cada
     equipo y cambia con cada tecla. */
  const SUELTOS = ["catalogo", "empresa", "prefs"];
  const LISTAS = { cotizaciones: "quotes", clientes: "clientes", plantillas: "plantillas" };

  let auth = null, db = null, usuario = null, avisar = null;
  const disponible = () => !!(window.firebase && firebase.initializeApp);

  function iniciar(alCambiar) {
    avisar = alCambiar;
    if (!disponible()) { alCambiar(null, "sin-sdk"); return false; }
    try {
      firebase.initializeApp(CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      /* caché en disco: con esto la app lee y escribe sin señal y lo
         pendiente sale solo al reconectar */
      db.enablePersistence({ synchronizeTabs: true }).catch(() => { /* ya abierta en otra pestaña o sin soporte */ });
      auth.onAuthStateChanged((u) => {
        usuario = u || null;
        alCambiar(usuario, null);
      });
      return true;
    } catch (e) {
      alCambiar(null, "sin-sdk");
      return false;
    }
  }

  /* los mensajes de Firebase son en inglés y técnicos: acá se dicen en
     castellano y en términos de lo que hay que hacer */
  function motivo(e) {
    const c = (e && e.code) || "";
    if (/wrong-password|invalid-credential|invalid-login/.test(c)) return "La contraseña no coincide con ese correo.";
    if (/user-not-found/.test(c)) return "No hay ningún usuario con ese correo.";
    if (/invalid-email/.test(c)) return "Ese correo no está bien escrito.";
    if (/too-many-requests/.test(c)) return "Demasiados intentos seguidos. Espera un rato y vuelve a probar.";
    if (/network-request-failed/.test(c)) return "Sin conexión. Puedes seguir trabajando en este equipo.";
    if (/user-disabled/.test(c)) return "Ese usuario está deshabilitado.";
    if (/weak-password/.test(c)) return "La contraseña es muy corta: al menos 6 caracteres.";
    return "No se pudo entrar. " + (c || "");
  }

  const ref = () => db.collection("usuarios").doc(usuario.uid);

  return {
    disponible, iniciar,
    usuario: () => usuario,
    correo: () => (usuario && usuario.email) || "",
    esDueno: () => (((usuario && usuario.email) || "").toLowerCase() === DUENO),
    DUENO,

    async entrar(correo, clave) {
      try {
        await auth.signInWithEmailAndPassword(String(correo).trim(), clave);
        return { ok: true };
      } catch (e) { return { ok: false, error: motivo(e) }; }
    },
    async salir() { if (auth) await auth.signOut(); },
    async recuperar(correo) {
      try {
        await auth.sendPasswordResetEmail(String(correo).trim());
        return { ok: true };
      } catch (e) { return { ok: false, error: motivo(e) }; }
    },

    /* ---------- bajar ----------
       Todo lo que hay en la nube, en la forma que usa el almacén local. */
    async bajar() {
      if (!usuario) return null;
      const out = { sueltos: {}, listas: {} };
      const base = ref();
      const docs = await Promise.all(SUELTOS.map((k) => base.collection("datos").doc(k).get()));
      docs.forEach((d, i) => { if (d.exists) out.sueltos[SUELTOS[i]] = d.data(); });
      const cols = Object.keys(LISTAS);
      const snaps = await Promise.all(cols.map((c) => base.collection(c).get()));
      snaps.forEach((s, i) => {
        out.listas[cols[i]] = [];
        s.forEach((d) => out.listas[cols[i]].push(d.data()));
      });
      return out;
    },

    /* ---------- subir ----------
       `guardar` se llama en cada cambio; si no hay sesión no hace nada, así
       el almacén local no tiene que preguntar. */
    async guardar(tipo, id, datos) {
      if (!usuario || !db) return;
      const cuerpo = Object.assign({}, datos, { actualizado: datos.actualizado || new Date().toISOString() });
      try {
        if (SUELTOS.indexOf(tipo) >= 0) await ref().collection("datos").doc(tipo).set(cuerpo);
        else await ref().collection(tipo).doc(String(id)).set(cuerpo);
      } catch (e) { /* sin señal: Firestore lo deja pendiente y lo manda después */ }
    },

    async borrar(tipo, id) {
      if (!usuario || !db) return;
      try { await ref().collection(tipo).doc(String(id)).delete(); } catch (e) { /* ídem */ }
    },

    SUELTOS, LISTAS
  };
})();
