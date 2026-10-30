# Sitio del taller — cvargas.org

Página del taller de muebles: trabajos, contacto por WhatsApp y enlaces a las
herramientas. Sitio estático, sin framework ni build.

## Cómo cambiar el contenido

**Todo se edita en [`datos.js`](datos.js)**, que es el único archivo que hace
falta tocar: nombre, textos, teléfono, trabajos y herramientas. Lo demás se
arma solo con eso.

### Poner el WhatsApp

En `datos.js`, el teléfono va en formato internacional, sin `+` ni espacios:

```js
telefono: "56912345678",
```

Mientras esté vacío **los botones de WhatsApp no aparecen**, a propósito: es
preferible a publicar un enlace que no lleva a ninguna parte.

### Agregar fotos de trabajos

1. Copia las fotos a la carpeta `fotos/`.
2. En `datos.js`, escribe el nombre del archivo en la entrada correspondiente:

```js
{ foto: "fotos/meson-cocina.jpg", titulo: "Mesón de cocina", detalle: "Madera maciza de 2\", 2,4 m" },
```

Un trabajo sin foto, o cuya foto no cargue, muestra igual su recuadro con el
título, así que la grilla nunca se ve rota. Conviene que las fotos sean
horizontales y de menos de 1 MB para que la página cargue rápido.

### Sacar una herramienta de la lista

Cambia su `mostrar` a `false`.

## Archivos

| Archivo | Qué contiene |
|---|---|
| `datos.js` | todo el contenido editable |
| `sitio.js` | arma la página con esos datos |
| `index.html` | estructura |
| `estilos.css` | estilos |
| `fotos/` | las imágenes de los trabajos |
| `marca/` | el logo: monograma recortado para la web y logo completo para el PDF |

## El logo

`marca/fv-monograma.png` es el monograma con fondo transparente, que es el que
va en el encabezado: el logo completo viene sobre blanco y en un sitio oscuro
se vería como un recuadro.

`marca/logo-fierro-veta.jpg` es el logo entero, para el PDF del cotizador, que
va sobre papel blanco. Se carga una vez en el cotizador, en **Empresa → Logo**,
y queda guardado en ese navegador. Se puede descargar desde
<https://cvargas.org/marca/logo-fierro-veta.jpg>.

## Publicación

GitHub Pages, en el dominio `cvargas.org`. Cada cambio que se sube a `main` se
publica solo en un par de minutos.
