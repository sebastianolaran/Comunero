---
name: Comunero
description: La herramienta con la que una familia o un grupo de amigos usa, paga, alquila y decide sobre la quinta que comparten.
colors:
  ink: "oklch(22% 0 0)"
  ink-soft: "oklch(32% 0 0)"
  muted: "oklch(46% 0 0)"
  faint: "oklch(56% 0 0)"
  paper: "oklch(97% 0 0)"
  surface: "#ffffff"
  inset: "oklch(96% 0 0)"
  sunken: "oklch(98.4% 0 0)"
  line: "oklch(91% 0 0)"
  line-soft: "oklch(94% 0 0)"
  line-strong: "oklch(85% 0 0)"
  line-loud: "oklch(74% 0 0)"
  positive: "oklch(45% 0.13 150)"
  negative: "oklch(50% 0.16 25)"
  flash: "oklch(95% 0.04 150)"
  member-blue: "oklch(56% 0.12 250)"
  member-terracotta: "oklch(56% 0.12 40)"
  member-green: "oklch(56% 0.12 150)"
  member-magenta: "oklch(56% 0.12 320)"
  member-olive: "oklch(56% 0.12 80)"
  member-violet: "oklch(56% 0.12 285)"
  member-red: "oklch(56% 0.12 0)"
  member-lime: "oklch(56% 0.12 115)"
  rental-teal: "oklch(56% 0.12 195)"
typography:
  figure:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.022em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    letterSpacing: "-0.012em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  meta:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  sm: "6px"
  md: "10px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  page-x: "32px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-hover:
    backgroundColor: "{colors.inset}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "oklch(30% 0 0)"
  button-danger:
    backgroundColor: "{colors.negative}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-small:
    padding: "6px 11px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "15px 18px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "18px"
  nav-item:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  segment-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "6px 13px"
  tag:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  vote-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.faint}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  modal:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "24px"
    width: "392px"
---

# Design System: Comunero

## Overview

**Creative North Star: "La mesa de la quinta"**

Comunero es la mesa grande de la quinta donde la familia se sienta a repartir y decidir: un lugar de trabajo prolijo, con todo a la vista, pero de gente que se conoce. La interfaz es neutra como papel y tinta, para que lo que importa (fechas, montos, quién votó) se lea sin ruido; la nota humana la pone el color de cada integrante, que lo identifica en el calendario, en Configuración y en cada reparto.

Es una herramienta de escritorio, densa sin apretar: texto base de 13px, cifras tabulares, tablas y paneles en un ancho de página de 1180px. La tinta casi negra marca la acción principal y el estado activo; el resto se resuelve con grises en escalones finos y bordes de un pixel. El verde y el rojo existen solo para la plata y para lo que no se deshace.

El carácter elegido para los componentes es **cálido y amable**: controles que no intimidan a alguien que no es técnico, con lenguaje llano y reglas explicadas donde actúan. Hoy el sistema implementado es más preciso que cálido (esquinas de 4px, controles compactos); esa distancia es la dirección de trabajo para `extract` y `polish`, no algo que ya esté resuelto.

**Key Characteristics:**
- Neutro de papel y tinta; el color es de las personas, no de la interfaz.
- Plano con bordes finos; las sombras solo para lo que flota.
- Denso y de escritorio, con cifras tabulares.
- Una sola tipografía (Inter) en pocos tamaños.
- Textos en español neutro e impersonal.

## Colors

Una escala de grises acromáticos en OKLCH, con dos acentos semánticos para la plata y una rueda de tonos para identificar a cada integrante.

### Primary
- **Tinta** (ink): el casi negro de la acción principal, el ítem activo de la navegación, el segmento elegido, el foco y el texto de mayor jerarquía.

### Secondary
- **Verde a favor** (positive): montos a tu favor ("te deben"), ingresos, confirmaciones. Nunca decorativo.
- **Rojo en contra** (negative): montos que debés, errores de campo y acciones que no se deshacen (eliminar, salir del bien).
- **Verde destello** (flash): el fondo que parpadea en una tarjeta recién actualizada y se apaga en 1,6s.

### Tertiary
- **Tonos de integrante** (member-*): ocho tonos con la misma luminosidad y croma (56%, 0,12) a lo largo de la rueda: azul, terracota, verde, magenta, oliva, violeta, rojo y lima. Cada integrante tiene el suyo, sin repetir dentro de un bien, y lo conserva en todas las pantallas.
- **Turquesa de alquiler** (rental-teal): reservado para los alquileres a terceros en el calendario, para que no se confundan con ningún integrante.

### Neutral
- **Papel** (paper): el fondo general de la app, detrás de paneles y tablas.
- **Superficie** (surface): blanco puro de tarjetas, paneles, modales, barra lateral y barra superior.
- **Hundido** (inset): fondo de hover en botones, de campos deshabilitados, de notas y de tags sólidos.
- **Casi blanco** (sunken): días fuera del mes en el calendario y hover de filas de tabla.
- **Tinta suave** (ink-soft): texto de botones, navegación y cuerpo secundario.
- **Gris apagado** (muted): metadatos, ayudas, etiquetas de sección y labels de campo.
- **Gris tenue** (faint): lo terciario: tareas hechas, quién se hizo cargo, iconos vacíos.
- **Líneas** (line, line-soft, line-strong, line-loud): cuatro escalones de borde, del separador entre filas (soft) al borde de controles (strong) y al hover de controles (loud).

### Named Rules
**La regla del color con nombre.** El color con tono identifica a una persona o a un alquiler; nunca decora un botón, un fondo o un título. Si un elemento no es de alguien, es gris.

**La regla de la plata.** Verde y rojo solo hablan de plata o de algo irreversible. Un estado "aprobada" o "rechazada" se marca con forma (tag, borde punteado, ícono), no con verde y rojo.

## Typography

**Body Font:** Inter (con system-ui, -apple-system, sans-serif)

**Character:** una sola familia en pesos 400 a 700, con cifras tabulares en toda la app para que los montos y las fechas alineen en columna.

### Hierarchy
- **Figure** (700, 26px, 1.1): la cifra protagonista de una pantalla, como el "te toca" del mes en Movimientos o el neto en Balance.
- **Headline** (600, 18px): el título de cada sección en la barra superior.
- **Title** (600, 17px): títulos de modales y diálogos.
- **Body** (400, 13px, 1.5): todo el texto de trabajo: filas, campos, botones, navegación.
- **Meta** (400, 12px, 1.5): fechas, autores, ayudas bajo un campo, botones chicos.
- **Label** (600, 11px, 0.06em, mayúsculas): encabezados de sección ("PENDIENTES DE APROBACIÓN"), encabezados de tabla, días de la semana y tags.

### Named Rules
**La regla de los seis tamaños.** La escala son los tokens `--fs-label` (11px), `--fs-meta` (12,5px), `--fs-body` (14px), `--fs-subtitle` (16px, títulos de tarjeta), `--fs-title` (19px, sección y modal) y `--fs-figure` (28px). Ninguna hoja usa tamaños en px sueltos. La única excepción es `--fs-display` (32 a 48px, fluido): el nombre del lugar en la ficha pública, la página que abre alguien de afuera desde WhatsApp.

**La regla de las mayúsculas justas.** Solo van en mayúscula los encabezados de tabla y los días de la semana; títulos de sección y etiquetas de estado van en minúscula.

## Layout

Barra lateral fija de 228px (marca, bien actual con su código y navegación) y área principal con barra superior blanca y una vista con scroll propio. El contenido se centra en un ancho máximo de 1180px, con márgenes laterales de 32px y 26px arriba. Las pantallas de detalle usan un `split`: lista o calendario a la izquierda, panel de detalle de 332px a la derecha, con 28px de separación. Configuración usa dos columnas que pasan a una por debajo de 980px.

El ritmo se apoya en 4, 8, 12, 16 y 24px, con 6, 10, 14 y 18px como pasos finos dentro de los componentes.

Escritorio primero: por debajo de 760px la barra lateral se vuelve una franja horizontal con la navegación en scroll, y los márgenes bajan a 16px. Mobile no se rompe, pero no se diseña para él.

## Elevation & Depth

Plano con bordes. La jerarquía sale de superficies blancas con un borde de 1px sobre el fondo papel, no de sombras. Las sombras aparecen solo en lo que flota sobre la página y en el botón principal, que se levanta un pixel.

### Shadow Vocabulary
- **Levante** (`box-shadow: 0 1px 2px oklch(20% 0 0 / 6%)`): solo el botón primario.
- **Flotante** (`box-shadow: 0 14px 30px -12px oklch(20% 0 0 / 26%), 0 2px 6px -3px oklch(20% 0 0 / 12%)`): popovers y tooltips de ayuda.
- **Modal** (`box-shadow: 0 30px 64px -22px oklch(20% 0 0 / 42%), 0 6px 16px -8px oklch(20% 0 0 / 16%)`): modales y diálogos de confirmación, sobre un velo gris al 38% con 2px de desenfoque.

### Named Rules
**La regla del borde antes que la sombra.** Una tarjeta o un panel en reposo nunca lleva sombra; se separa del fondo con su borde. La sombra significa "esto está encima de la página".

## Shapes

Esquinas suaves: 6px en controles (botones, campos, selects, tags, controles segmentados) y 10px en contenedores (tarjetas, paneles, calendario, modales, popovers). La forma de píldora (999px) queda para lo que se elige o filtra en el lugar: filtros, chips de voto y badges. Los bordes son siempre de 1px; el borde punteado significa "provisorio o en contra" (un voto que rechaza, un pago pendiente, una acción de agregar).

## Components

### Buttons
Compactos y directos, con la tinta reservada para la acción principal de cada pantalla.
- **Shape:** esquinas suaves (4px), 8px × 14px de relleno, texto de 13px en peso 500.
- **Default:** fondo blanco, borde fuerte y texto en tinta suave; al pasar el mouse, fondo hundido y borde más marcado.
- **Primary:** fondo de tinta, texto blanco en 600 y la sombra de levante; al pasar el mouse se aclara apenas.
- **Danger:** fondo rojo y texto blanco, solo para eliminar o salir del bien.
- **Variantes:** chico (6px × 11px, 12px), link (subrayado, sin caja), ícono (32px cuadrado), punteado (para "agregar") y transparente.
- **Focus:** contorno de 2px en tinta con 2px de separación, en todos los controles.

### Chips
- **Votos:** píldoras de 11,5px con el nombre de cada integrante y un ícono al final: tilde y borde sólido si votó Sí, cruz y borde punteado si votó No, punto gris si todavía no votó.
- **Filtros (pill):** píldoras blancas con borde; la elegida pasa a tinta con texto blanco.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** blanco sobre el fondo papel.
- **Shadow Strategy:** ninguna en reposo (ver Elevation & Depth).
- **Border:** 1px en el gris de línea; una tarjeta elegible marca el borde al pasar el mouse y pasa a un borde doble de tinta cuando está elegida.
- **Internal Padding:** 15px × 18px en tarjetas, 18px en paneles, 22px × 24px en los paneles de Configuración.

### Inputs / Fields
- **Style:** fondo blanco, borde fuerte de 1px, 4px de radio, 8px × 10px de relleno, texto de 13px. Label de 12px en gris apagado arriba del campo.
- **Focus:** el borde pasa a tinta con un halo de 3px de tinta al 10%.
- **Error / Disabled:** con error, el borde pasa a rojo y el mensaje va debajo; deshabilitado, fondo hundido y texto tenue. Los numéricos se alinean a la derecha.

### Navigation
Barra lateral blanca con la marca "Comunero" (15px, 700), el nombre del bien y su código. Cada sección es un botón de 13px en peso 500, sin ícono; al pasar el mouse toma un fondo gris claro, y la sección activa va en tinta con texto blanco en 600. Las subsecciones (Alquiler) usan un control segmentado con el mismo lenguaje: el segmento activo en tinta.

### Calendario
La pieza propia del producto: una grilla de siete columnas separadas por líneas de 1px, con celdas blancas de al menos 76px de alto, el número del día arriba y debajo los turnos con el color de cada integrante (o turquesa si es un alquiler). El día elegido se marca con un borde interior de 2px en tinta; los días de otros meses quedan en el gris casi blanco.

### Modales
Superficie blanca de 392px de ancho, 24px de relleno, título de 17px y la sombra modal sobre un velo gris desenfocado. Entran con un desplazamiento corto y una leve escala (280ms); el velo aparece en 220ms. Las confirmaciones de algo irreversible usan el botón de peligro y dicen qué se pierde.

### Kit compartido (`client/src/components/ui`)
- **Modal / ModalAcciones:** todo diálogo; 440px, título de sección, Cancelar a la izquierda y la acción a la derecha del mismo ancho.
- **FieldError:** error de campo o formulario, enlazado con `aria-describedby`.
- **Cargando / ErrorCarga / Vacio:** los tres estados de una carga; el error siempre ofrece Reintentar.
- **Filtros:** píldoras para filtrar una lista; el control segmentado queda para alternar modos.
- **ChipsVoto:** quién votó y quién falta, con el color de cada integrante.
- **MemberName:** nombre con su punto de color; se usa donde se nombra a una persona en un reparto o una votación.
- Fechas, plata y "X de N aprobaron" salen de `lib/format.js`.

## Do's and Don'ts

### Do:
- **Do** usar la tinta (ink) solo para la acción principal, el elemento activo y el foco.
- **Do** separar superficies con bordes de 1px de la escala de líneas, no con sombras.
- **Do** usar el tono de cada integrante siempre que se nombre o se muestre a una persona en un contexto de uso o de reparto, y el mismo tono en todas las pantallas.
- **Do** mantener las cifras tabulares y alinear montos a la derecha en tablas y campos numéricos.
- **Do** explicar cada regla con un botón "i" y un tooltip en lenguaje llano, en la misma fila donde actúa.
- **Do** escribir en tono neutro e impersonal (infinitivos, sin vos ni usted) y nombrar la app como "Comunero".
- **Do** respetar `prefers-reduced-motion`: las animaciones se apagan.

### Don't:
- **Don't** usar verde o rojo para estados que no son plata ni acciones irreversibles.
- **Don't** pintar botones, fondos o títulos con los tonos de integrante.
- **Don't** agregar sombras a tarjetas o paneles en reposo.
- **Don't** escribir tamaños de letra en px: usar los tokens `--fs-*`.
- **Don't** escribir "Compartido" en ningún texto de marca.
