# Cotizador de Muebles

Cotizador de muebles a medida: se ingresan las medidas y el mueble se cotiza solo,
con despiece y lista de compra. Funciona en el navegador, sin servidor ni instalación.

👉 **https://muebles.cvargas.org**

## Qué hace

- **Cotiza por medidas.** Eliges el tipo de mueble (base, colgante, closet, cajonera,
  librero, cubierta), pones ancho, alto y profundidad y defines puertas, cajones,
  entrepaños, zócalo y barra de colgar. El precio se arma desde el despiece real.
- **Calcula el despiece.** Cada pieza con su medida de corte, el tablero que le
  corresponde y en qué bordes lleva canto.
- **Lista de compra.** Planchas, metros de canto y herrajes de toda la cotización,
  con el porcentaje de desperdicio aplicado.
- **Catálogo editable.** Tableros, cantos, herrajes, mano de obra, desperdicio,
  gastos generales y margen se editan en la app y quedan guardados. Los
  tableros marcados como **macizos** no llevan tapacanto: el canto queda a la
  vista, se lija y se termina.
- **Cubiertas de madera.** La cubierta tiene tablero propio, aparte del de los
  frentes, porque suele ser mucho más gruesa. En un mesón el alto no se
  escribe: es el espesor del tablero que elijas.
- **Madera dimensionada y perfiles de fierro.** Si el tablero lo armas tú, en
  cada mueble anotas las piezas que vas a ocupar: escuadría, largo y cuántas
  van. Se cobran por metro lineal según la escuadría, y en cuanto hay una
  pieza de madera **la cubierta deja de cobrarse como tablero**, porque la
  estás fabricando, no comprando. La superficie sí sigue sumando mano de
  obra: hay que cepillarla, encolarla y lijarla.
- **Envío por WhatsApp.** En el celular entrega el PDF a la hoja de compartir
  del sistema, así que llega **adjunto** al chat. En el navegador de
  escritorio esa API no acepta archivos: ahí descarga el PDF y abre el chat
  con el resumen para que lo adjuntes con el clip.
- **PDF de cotización y de despiece**, con tu logo, los datos de tu empresa y
  tus condiciones comerciales.
- **Logo propio.** Se sube en Empresa (PNG, JPG, SVG o WebP), se reduce solo
  para no ocupar espacio de más y aparece en la hoja de cotización y en el
  encabezado de cada página de los PDF.
- **Hoja de esquemas.** El PDF de la cotización termina con el dibujo de cada
  mueble, acotado y con la medida de corte escrita en cada puerta y cajón.
- **Croquis.** Un dibujo propio por cotización, hecho con líneas, rectángulos,
  rombos, figuras de varios puntos, rótulos y cotas sobre una grilla con
  ajuste automático. Las cotas calculan solas su medida a partir de la escala
  de la grilla, y con doble clic puedes escribir la tuya cuando necesites la
  medida real en vez de la del dibujo; si la borras, vuelve a calcularse sola.
  Se guarda como vectores, no como imagen, así que pesa unos pocos KB y sale
  nítido en el PDF.
- **Historial** de cotizaciones, para reabrir, duplicar y seguir su estado.

## Cómo calcula el precio

```
costo directo = tableros + cantos + herrajes + mano de obra
precio neto   = (costo directo + gastos generales) + margen
total         = (neto − descuento) + IVA
```

- Los tableros se cargan a precio de plancha entera y cada pieza paga su
  superficie prorrateada, más el porcentaje de desperdicio.
- Las planchas de la lista de compra se redondean hacia arriba. **No es una
  optimización de corte**: es superficie más desperdicio, así que en muebles
  grandes conviene revisar el nesting antes de comprar.
- Los precios que vienen cargados son de referencia. Hay que reemplazarlos por los
  tuyos en **Materiales** antes de cotizarle a un cliente.

## Dónde quedan los datos

Todo se guarda en el `localStorage` del navegador que usas: cotizaciones, catálogo
y datos de la empresa. No hay servidor, no se comparte entre equipos y si borras
los datos del sitio se pierde. Para respaldar algo, descarga el PDF.

## Desarrollo

No hay build ni dependencias que instalar. Basta con abrir `index.html`, o servir
la carpeta:

```bash
python -m http.server 8000
```

| Archivo | Qué contiene |
|---|---|
| `data.js` | catálogo de referencia, tipos de mueble y utilidades |
| `calc.js` | despiece, herrajes y costeo |
| `draw.js` | esquema frontal del mueble, como lista de formas |
| `croquis.js` | editor de croquis y su figura para el PDF |
| `logo.js` | carga del logo, reducción y conversión para jsPDF |
| `store.js` | persistencia en `localStorage` |
| `pdf.js` | PDF de cotización y de despiece (jsPDF) |
| `app.js` | interfaz y eventos |
| `styles.css` | estilos |

Convención del proyecto: JavaScript sin framework, todo bajo el namespace global
`MQ`, textos y formatos en es-CL y precios netos en pesos chilenos.
