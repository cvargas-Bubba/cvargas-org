# Cotizador de muebles

Herramienta interna del taller: se dibuja el croquis del mueble, se le asigna
material a cada trazo y de ahí sale el costo y la cotización. Funciona en el
navegador, sin servidor ni instalación.

👉 **https://cvargas.org/muebles/**

## Cómo funciona

Una cotización se arma por **partidas**: cada una es un mueble o trabajo, con
su croquis, sus materiales y su precio.

**El croquis da las medidas.** Se dibuja sobre una grilla con escala conocida
(un cuadro = tantos mm). A cada figura se le puede asignar un material y un
número de piezas iguales: el largo sale del dibujo, así que no hay que
escribirlo otra vez. Si se mueve el trazo, la cantidad se actualiza sola.

Cada partida puede tener varias **vistas** —frente, planta, lateral— en la
misma lámina.

**Lo que no se dibuja se agrega a mano**: tornillos, cola, barniz, horas de
taller. Cada ítem del catálogo trae su unidad, y eso define cómo se carga.

```
costo directo = materiales + horas
precio        = (costo directo + gastos generales) + margen
total         = (neto − descuento) + IVA
```

## Dos documentos, un propósito distinto cada uno

| | Para quién | Qué lleva |
|---|---|---|
| **Cotización** | El cliente | Qué es, el croquis, de qué está hecho y cuánto vale. Sin cantidades ni costos de material |
| **Hoja de taller** | El taller | Los cortes, las cantidades, los costos y la lista de compra |

Los materiales aparecen en la cotización solo como argumento de calidad: se
nombran, no se cuantifican ni se les pone precio.

## Plantillas

Una partida que ya se cotizó se puede guardar como plantilla, con su croquis y
sus materiales, para partir de ahí la próxima vez y ajustar cantidades.

## Dónde quedan los datos

En el `localStorage` del navegador que se use: cotizaciones, catálogo,
plantillas y logo. No hay servidor, no se comparte entre equipos y si se borran
los datos del sitio se pierde. Para respaldar algo, descargar el PDF.

## Archivos

| Archivo | Qué contiene |
|---|---|
| `data.js` | catálogo de referencia, unidades y estructuras base |
| `croquis.js` | editor del croquis y la figura para el PDF |
| `calc.js` | costeo de partidas y lista de compra |
| `draw.js` | serializa una figura a SVG |
| `store.js` | persistencia en `localStorage` |
| `logo.js` | carga y reducción del logo |
| `pdf.js` | cotización y hoja de taller (jsPDF) |
| `app.js` | interfaz |

JavaScript sin framework, todo bajo el namespace global `MQ`, textos en es-CL y
precios netos en pesos chilenos.
