# cvargas.org

Un dominio, un repositorio, varias aplicaciones. La raíz es un **índice**: las
tarjetas de cada módulo y el ingreso. Sitio estático, sin framework ni build.

## Estructura

| Carpeta | Dirección | Qué es |
|---|---|---|
| `/` | cvargas.org | el índice de aplicaciones |
| `fierro-y-veta/` | cvargas.org/fierro-y-veta | la página del taller de muebles |
| `muebles/` | cvargas.org/muebles | el cotizador de muebles (privado) |
| `dxf-kml/` | cvargas.org/dxf-kml | conversor de planos DXF a KML |
| `aridos/` | cvargas.org/aridos | prototipo de venta de áridos |
| `marca/` | | el logo, compartido por todo el sitio |

Las rutas distinguen mayúsculas: `cvargas.org/muebles` funciona y
`cvargas.org/Muebles` no. Por eso van en minúscula.

Un módulo nuevo es una carpeta más con su `index.html` y una entrada en la
lista `MODULOS` de [`indice.js`](indice.js). Un solo repositorio, un solo
certificado y un solo despliegue; la contra es que un cambio en cualquier
módulo reconstruye el sitio entero.

`dxf-kml/` y `aridos/` son **copias** de sus repositorios
([conversor-dxf-kml](https://github.com/cvargas-Bubba/conversor-dxf-kml),
[patio-de-aridos](https://github.com/cvargas-Bubba/patio-de-aridos)): son
páginas de un solo archivo y se trajeron tal cual para que vivan en este
dominio. Si se edita el repositorio original, hay que volver a copiar el
`index.html`; lo que manda en cvargas.org es la copia de acá.

## El ingreso

La sesión es de **todo el dominio**: se entra una vez en el índice —o en el
cotizador— y vale para las dos partes. Las aplicaciones marcadas con
`privada: true` en `indice.js` aparecen con candado mientras no haya sesión.

La cuenta y la base de datos están en Firebase, en el proyecto
`fierro-y-veta`. La configuración va escrita en
[`muebles/nube.js`](muebles/nube.js), a la vista: son datos públicos. Lo que
cuida los datos son las reglas de Firestore —cada usuario lee y escribe solo lo
suyo— y la contraseña. Los usuarios se crean a mano en la consola de Firebase,
en Authentication → Users: el registro desde fuera está desactivado.

## La página del taller

**Todo su contenido se edita en [`fierro-y-veta/datos.js`](fierro-y-veta/datos.js)**:
nombre, textos, teléfono, trabajos y herramientas. Lo demás se arma solo.

### Poner el WhatsApp

El teléfono va en formato internacional, sin `+` ni espacios:

```js
telefono: "56912345678",
```

Mientras esté vacío **los botones de WhatsApp no aparecen**, a propósito: es
preferible a publicar un enlace que no lleva a ninguna parte.

### Agregar fotos de trabajos

1. Copia las fotos a `fierro-y-veta/fotos/`.
2. En `datos.js`, escribe el nombre del archivo en la entrada correspondiente:

```js
{ foto: "fotos/meson-cocina.jpg", titulo: "Mesón de cocina", detalle: "Madera maciza de 2\", 2,4 m" },
```

Un trabajo sin foto, o cuya foto no cargue, muestra igual su recuadro con el
título, así que la grilla nunca se ve rota. Conviene que las fotos sean
horizontales y de menos de 1 MB para que la página cargue rápido.

## El logo

`marca/fv-monograma.png` es el monograma con fondo transparente, que es el que
va en los encabezados: el logo completo viene sobre blanco y en un sitio oscuro
se vería como un recuadro.

`marca/logo-fierro-veta.jpg` es el logo entero, para el PDF del cotizador, que
va sobre papel blanco. Se carga una vez en el cotizador, en **Empresa → Logo**,
y queda guardado en ese navegador. Se puede descargar desde
<https://cvargas.org/marca/logo-fierro-veta.jpg>.

## Publicación

GitHub Pages, en el dominio `cvargas.org`. Cada cambio que se sube a `main` se
publica solo en un par de minutos.
