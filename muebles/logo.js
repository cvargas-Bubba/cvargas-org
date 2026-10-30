/* Logo de la empresa: procesar la imagen que se sube y prepararla para el PDF. */
window.MQ = window.MQ || {};

MQ.cargarImagen = (src) => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => fail({ message: "No se pudo leer la imagen. Usa un archivo PNG, JPG o SVG." });
  img.src = src;
});

MQ.leerArchivo = (file) => new Promise((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(r.result);
  r.onerror = () => fail({ message: "No se pudo abrir el archivo." });
  r.readAsDataURL(file);
});

/* Reduce el logo a un tamaño liviano para guardarlo junto a los datos de la
   empresa: el navegador tiene unos 5 MB para todo, cotizaciones incluidas. */
MQ.procesarLogo = async function (file) {
  if (!/^image\/(png|jpe?g|svg\+xml|webp|gif)$/.test(file.type)) throw { message: "Formato no soportado. Usa PNG, JPG, SVG o WebP." };
  if (file.size > 8 * 1024 * 1024) throw { message: "La imagen pesa más de 8 MB. Usa una versión más liviana." };
  const img = await MQ.cargarImagen(await MQ.leerArchivo(file));
  const iw = img.naturalWidth || 600, ih = img.naturalHeight || 300;
  const k = Math.min(1, 720 / iw, 360 / ih);
  const w = Math.max(1, Math.round(iw * k)), h = Math.max(1, Math.round(ih * k));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  let out = cv.toDataURL("image/png");
  /* si el PNG con transparencia pesa demasiado, se aplana sobre blanco */
  if (out.length > 180000) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    out = cv.toDataURL("image/jpeg", 0.88);
  }
  return out;
};

/* Convierte cualquier logo (también SVG) a PNG para jsPDF. Devuelve {data, w, h} o null.
   En el papel el logo mide 50 mm de ancho como mucho, así que 600 px dan unos
   300 ppp: más que eso solo engorda el PDF, que termina yendo por correo. */
MQ.logoParaPdf = async function (src) {
  if (!src) return null;
  try {
    const img = await MQ.cargarImagen(src);
    const iw = img.naturalWidth || 600, ih = img.naturalHeight || 300;
    const k = Math.min(1, 600 / iw);
    const cv = document.createElement("canvas");
    cv.width = Math.round(iw * k); cv.height = Math.round(ih * k);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    return { data: cv.toDataURL("image/png"), w: iw, h: ih };
  } catch (e) {
    return null;
  }
};
