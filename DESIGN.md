---
version: beta
name: Luca-design
description: Panel de gastos personales (BCP + Yape) sobre el Google del usuario. Interfaz moderna y operable — barra lateral en escritorio, barra inferior en móvil, lienzo crema con tarjetas de radio 16 y líneas finas, un único color de acción (el naranja de Luca), importes en Geist Mono tabular y animaciones cortas que explican lo que pasa (gráficos que se dibujan, cifras que suben, confirmaciones). Tema claro crema + naranja; tema oscuro negro + naranja, la identidad que ya tenía la web. Referencia visual — docs/html/preview-diseno-moderno.html.
colors:
  primary: "#d9623b"          # marca, mes actual, progreso, foco, texto grande
  primary-2: "#d9623b"        # realce (en oscuro sube a #f08a5d)
  primary-strong: "#bf5230"   # fondo del botón principal (blanco encima = 4.7:1)
  primary-active: "#a8472a"
  primary-soft: "#fbe6dc"     # avisos, pastillas de acento
  on-primary: "#ffffff"
  ink: "#1d1a17"
  body: "#57524b"
  muted: "#716a60"            # 4.7:1 sobre canvas
  line: "#e6ddd1"
  line-soft: "#efe8de"
  line-strong: "#d3c8b8"
  canvas: "#f4efe8"
  card: "#fffdf9"
  raised: "#ffffff"           # botones secundarios, segmentos activos
  strong: "#ebe4d9"           # pistas de barras, chips neutros, contadores
  sunken: "#efe9e0"           # filas dentro de tarjetas, ítems hover
  selected-bg: "#1d1a17"      # chips/filtros elegidos
  selected-fg: "#f4efe8"
  nav-on-bg: "#fffdf9"        # ítem activo de la barra lateral
  nav-on-fg: "#1d1a17"
  success: "#1a7a59"          # 4.6:1 sobre canvas
  success-soft: "#dcefe5"
  warning: "#92600f"          # 4.7:1 sobre canvas
  error: "#cf2d56"
  cat-peach: "#dfa88f"
  cat-mint: "#9fc9a2"
  cat-blue: "#9fbbe0"
  cat-lavender: "#c0a8dd"
  cat-gold: "#c08532"
  cat-rose: "#e3a3b4"
  cat-sand: "#d8c08f"
  cat-teal: "#8ec5c0"
  cat-none: "#cfc6b8"         # "Sin categoría"
colors-dark:                  # identidad de la web: negro + naranja
  primary: "#d9623b"          # 4.9:1 sobre card
  primary-2: "#f08a5d"        # realces: ítem activo, marca de ritmo
  primary-strong: "#bf5230"
  primary-active: "#a8472a"
  primary-soft: "#2e1710"
  ink: "#ede7dd"
  body: "#c4bdb3"
  muted: "#8b857c"            # 4.9:1 sobre card
  line: "#272727"
  line-soft: "#1d1d1d"
  line-strong: "#333333"
  canvas: "#0b0b0b"
  card: "#171717"
  raised: "#1f1f1f"
  strong: "#242424"
  sunken: "#111111"
  selected-bg: "#d9623b"      # chips elegidos en naranja con texto canvas (5.4:1)
  selected-fg: "#0b0b0b"
  nav-on-bg: "#2e1710"
  nav-on-fg: "#f08a5d"
  success: "#6fbf8a"
  success-soft: "#13241a"
  warning: "#e2b25a"
  error: "#ef6b8a"
  cat-none: "#3d3d3d"
typography:
  display-hero: { fontFamily: "Geist, system-ui, sans-serif", fontSize: "clamp(40px, 7.2vw, 76px)", fontWeight: 500, lineHeight: 1, letterSpacing: -0.045em }
  display-lg: { fontFamily: "Geist", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 500, lineHeight: 1.08, letterSpacing: -0.03em }
  page-title: { fontFamily: "Geist", fontSize: "clamp(24px, 3vw, 30px)", fontWeight: 500, letterSpacing: -0.03em }
  card-title: { fontFamily: "Geist", fontSize: 15px, fontWeight: 600, letterSpacing: -0.1px }
  body-md: { fontFamily: "Geist", fontSize: 15px, fontWeight: 400, lineHeight: 1.5 }
  body-sm: { fontFamily: "Geist", fontSize: 14px, fontWeight: 400, lineHeight: 1.5 }
  caption: { fontFamily: "Geist", fontSize: 12.5px, fontWeight: 400 }
  eyebrow: { fontFamily: "Geist", fontSize: 11px, fontWeight: 600, letterSpacing: 0.88px, textTransform: uppercase }
  amount-hero: { fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: "clamp(38px, 5.6vw, 56px)", fontWeight: 500, letterSpacing: -0.04em, fontVariantNumeric: tabular-nums }
  amount-md: { fontFamily: "Geist Mono", fontSize: 17px, fontWeight: 500, fontVariantNumeric: tabular-nums }
  amount: { fontFamily: "Geist Mono", fontSize: 14.5px, fontWeight: 500, fontVariantNumeric: tabular-nums }
  tag: { fontFamily: "Geist Mono", fontSize: 10px, fontWeight: 500, letterSpacing: 0.4px, textTransform: uppercase }
  button: { fontFamily: "Geist", fontSize: 14px, fontWeight: 500, lineHeight: 1 }
rounded: { xs: 4px, sm: 8px, md: 10px, lg: 16px, xl: 22px, pill: 9999px }
spacing: { xxs: 4px, xs: 8px, sm: 12px, base: 16px, md: 20px, lg: 24px, xl: 32px, xxl: 48px, section: 88px }
motion:
  fast: 150ms                 # hover, color, chips
  base: 220ms                 # aparición de tarjetas, despliegues
  slow: 600ms                 # dibujo de gráficos, conteo de cifras
  stagger: 40ms               # retraso entre tarjetas hermanas
  ease-out: "cubic-bezier(.2, .7, .2, 1)"
  ease-spring: "cubic-bezier(.34, 1.4, .64, 1)"   # solo confirmaciones (check, chip elegido)
components:
  sidebar: { width: 236px, background: "{colors.canvas}", borderRight: "1px solid {colors.line}", sticky: true }
  tabbar: { height: 64px, background: "card 92% + blur(14px)", items: 5, center: "Agregar destacado" }
  topbar: { search: "42px, radius 12", actions: "Actualizar, Agregar" }
  button-primary: { backgroundColor: "{colors.primary-strong}", textColor: "{colors.on-primary}", rounded: "{rounded.md}", height: 40px }
  button-secondary: { backgroundColor: "{colors.raised}", border: "1px solid {colors.line-strong}", rounded: "{rounded.md}" }
  button-ghost: { backgroundColor: transparent, textColor: "{colors.body}", hover: "{colors.strong}" }
  card: { backgroundColor: "{colors.card}", border: "1px solid {colors.line}", rounded: "{rounded.lg}", padding: 20px }
  chip: { height: 30px, rounded: "{rounded.pill}", border: "1px solid {colors.line}", selected: "{colors.selected-bg} / {colors.selected-fg}" }
  segmented: { background: "{colors.strong}", active: "{colors.raised} + sombra 1px", rounded: 11px }
  notice: { backgroundColor: "{colors.primary-soft}", border: "1px solid primary 30%", rounded: 14px, dismissible: true }
  tag: { typography: "{typography.tag}", backgroundColor: "{colors.strong}", textColor: "{colors.muted}", rounded: "{rounded.xs}" }
  avatar-tx: { size: 36px, rounded: 10px, background: "color de la categoría", text: "#1d1a17 sobre pastel; body sobre neutro" }
  input: { backgroundColor: "{colors.card}", border: "1px solid {colors.line}", rounded: 12px, focus: "borde primary + halo 3px primary 18%" }
---

## Overview

Luca es una herramienta que se abre varias veces al día: se escanea y se opera. La interfaz prioriza
responder tres preguntas sin hacer scroll — cuánto gasté este mes, cómo voy respecto al mes anterior y qué
necesita mi atención (por categorizar, avisos). Todo lo demás está a un toque.

**Rasgos clave**
- Barra lateral fija en escritorio (≥ 1024px) y barra inferior de 5 ítems en móvil, con **Agregar** al centro.
- Lienzo `canvas`, tarjetas `card` radio 16 con línea `line`. Sin sombras salvo `halo` en elementos flotantes
  (menús, botón central de la barra inferior, captura de la portada).
- Un solo color de acción: el naranja de Luca. En oscuro, además marca lo elegido y lo activo.
- Títulos Geist 500 con tracking negativo; nunca 700+ en display.
- Importes en Geist Mono tabular; la moneda como prefijo en `muted`; equivalencia en soles debajo de los USD.
- Movimiento con propósito: cada animación explica un cambio de estado. Todas respetan `prefers-reduced-motion`.

## Colors

- **Primary** `#d9623b` — marca, barra del mes actual, progreso, anillo de foco, "Te queda" negativo.
  No es fondo de botón con texto blanco (3.65:1): para eso `primary-strong` `#bf5230` (4.7:1).
- **Selected** — chips y filtros elegidos: tinta en claro, naranja en oscuro.
- **Neutrales** — `ink` títulos e importes; `body` texto corrido; `muted` etiquetas, fechas, moneda.
- **Categorías** — pasteles `cat-*` asignados de forma estable: las categorías por defecto tienen color fijo
  (ver `apps/web/src/lib/categorias.ts`); las personalizadas reciben uno por hash del nombre. "Sin categoría"
  usa `cat-none`. Solo en avatares, barras apiladas, leyendas y chips de categoría.
- **Semánticos** — `success` (guardado, conectado, menos gasto que el mes anterior), `warning` (pendiente,
  sin señales), `error` (fallo). Gastar no es un error: los gastos van en `ink` con "−".

## Typography

Geist para todo; Geist Mono para cifras, etiquetas de origen y código. Escala en el front matter. Las
etiquetas de sección usan `eyebrow`; los títulos de tarjeta `card-title` (15px, 600).

## Layout

- **Panel**: barra lateral 236px · contenido máx. 1180px con padding 32px (escritorio) / 16px (móvil, +110px
  abajo por la barra inferior).
- **Resumen**: topbar (buscador + acciones) → saludo con frescura del escaneo + selector de mes ‹ › →
  configuración plegable → aviso de versión → banda de indicadores (gasto 1.55fr + Ingresos · Te queda · Yape)
  → rejilla de 12 columnas sin huecos: ritmo del mes (8) + perfil de gasto (4) · en qué se fue + comercios
  principales + por categorizar (4 + 4 + 4) · últimos 6 meses (5) + movimientos del mes (7, alto máx. con scroll).
  Referencia: `docs/html/maqueta-resumen-v2.html`.
- **Movimientos**: título + "N en tu Sheet" + CSV → banda de totales de lo filtrado (gastos con barras por día ·
  ingresos · recibido por Yape · por categorizar, que filtra) → buscador + chips de tipo + "Más filtros" (mes,
  fuente, categoría) + "Filtrando por" con "Limpiar todo" → lista con orden (recientes / mayor monto), agrupada
  por día, búsqueda resaltada, detalle desplegable por fila y "Mostrar más" de 40 en 40.
  Referencia: `docs/html/maqueta-movimientos-v2.html`.
- **Agregar**: formulario centrado máx. 560px; el monto es el protagonista (amount-hero editable).
- **Conexiones / Ajustes**: columna máx. 760px de tarjetas con estado en pastilla.
- **Portada**: hero centrado → captura del panel → camino de los datos → mosaico de funciones → preguntas →
  bloque final → pie. CTA fijo abajo en móvil.

## Elevation & Depth

Nivel 0 `canvas` · nivel 1 `card` con `line` · nivel 1b `sunken` dentro de una tarjeta · nivel 2 flotantes
(menú de usuario, barra inferior, botón central) con `halo` y desenfoque de fondo.

## Shapes

`sm` 8px botones pequeños · `md` 10px botones e inputs · 12px buscador y filas · `lg` 16px tarjetas ·
`xl` 22px marcos grandes (captura de la portada, bloque final) · `pill` chips y pastillas.

## Components

- **Barra lateral**: logo · Resumen, Movimientos (contador de pendientes), Agregar, Conexiones, Ajustes ·
  espacio · Abrir mi Sheet ↗ · tarjeta de usuario que abre un menú (tema, abrir Sheet, salir).
- **Barra inferior (móvil)**: Resumen · Movimientos · **Agregar** (botón naranja elevado) · Conexiones · Ajustes.
- **Topbar**: buscador (Enter → `/app/movimientos?q=`; tecla `/` lo enfoca) · Actualizar · Agregar.
- **Selector de mes**: ‹ mes › ; tocar el mes abre la lista completa; ← → con teclado.
- **Gasto del mes** (banda de indicadores): eyebrow · cifra `amount-hero` que cuenta hasta su valor · delta vs
  el mes anterior **al mismo día** en pastilla (`success` si baja, `primary-soft` si sube) · **barra de ritmo**:
  relleno = gasto / gasto del mes anterior; marca = día de hoy / días del mes · Ingresos / Te queda / Yape
  recibido, cada uno con su minicurva de 6 meses.
- **Gráficos** (ECharts en SVG, `components/charts/EChart.tsx`): leen los tokens del tema en cada dibujo y se
  redibujan al cambiar de tema. Series de comparación `--chart-1/2/3` (naranja de Luca · azul · aguamarina,
  validadas para daltonismo en claro y oscuro); categorías con sus pasteles `cat-*`. Una sola escala por gráfico
  (nunca dos ejes Y). Tooltip en tarjeta del tema; leyendas `.legend-chip` que ocultan series (apagada = tachada).
- **Ritmo del mes**: acumulado del mes contra el anterior (punteado) y proyección a fin de mes sin el gasto fijo
  (punteado tenue), sobre barras de gasto diario sin Vivienda con fines de semana más intensos; ambos comparten
  puntero. Debajo: promedio diario, proyección y día más caro.
- **Perfil de gasto**: radar por categoría (sin Vivienda) de este mes, el anterior y el promedio de 3 meses, en
  S/ o % del mes; siempre queda al menos una serie visible.
- **En qué se fue**: dona + lista; tocar una categoría filtra los movimientos del mes (chip para quitarlo).
- **Por categorizar**: cada pendiente en `sunken` con chips de las 4 categorías más usadas + "Otra…"
  (lista completa) y, si existe, la sugerencia por comercio o persona ya categorizados. Al elegir: chip con
  rebote, check que se dibuja, "Guardado en tu Sheet", y la fila sale con colapso de altura.
- **Configuración plegable**: anillo de progreso n/3 + checklist; desaparece al completar u omitir.
- **Fila de movimiento**: avatar con inicial sobre el color de su categoría · comercio o persona · categoría y
  etiqueta de origen · importe (y ≈ soles si es USD). Transferencias propias atenuadas con "no cuenta como gasto".
- **Estados**: vacío con una frase y una acción; carga con esqueletos que respiran (no spinners).

## Motion

| Qué | Cómo | Duración |
|---|---|---|
| Cambio de página | `ViewTransition` de React: crossfade + 8px de desplazamiento | 220ms |
| Tarjetas al cargar | aparecen subiendo 8px, escalonadas por `--i` (solo primera carga) | 220ms + 40ms·i |
| Gráficos (anillo, barras apiladas, barras de meses, ritmo) | se dibujan desde 0 (`stroke-dashoffset`, `scaleX/Y`) | 600ms |
| Cifras principales | cuentan desde 0 hasta su valor (`useCountUp`) | 600ms |
| Chip elegido / guardado | rebote corto + check SVG que se dibuja | 150ms / 300ms |
| Fila resuelta | colapso de altura + desvanecido | 220ms |
| Despliegues (detalle, configuración, filtros) | `grid-template-rows: 0fr → 1fr` | 220ms |
| Portada · camino de los datos | un punto naranja recorre Correo → script → Sheet → navegador en bucle lento | 4s |
| Hover | color/borde; botones bajan 1px al pulsar | 150ms |

Con `prefers-reduced-motion: reduce` todo aparece en su estado final sin animar.

## Do's and Don'ts

**Do**
- Usar el naranja solo para acción principal, mes actual, progreso, marca y (en oscuro) lo elegido.
- Alinear importes con `tabular-nums` y mostrar la moneda original.
- Confirmar cada escritura en la Sheet en el mismo lugar donde se hizo (además del toast).
- Mantener `data-testid` existentes al rehacer componentes (los usan los e2e).

**Don't**
- No usar pesos 700+ en títulos, degradados ni sombras en tarjetas.
- No pintar botones con `primary` y texto blanco: usar `primary-strong`.
- No usar los pasteles de categoría para estados o acciones, ni rojo para gastos.
- No animar en cada visita lo que ya se vio; no bloquear la interacción esperando una animación.

## Responsive Behavior

- < 640px: buscador en su propia línea; trío del gasto en columna; barra inferior + padding inferior 110px.
- 640–1023px: sin barra lateral, con barra inferior; rejillas a 2 columnas donde quepan.
- ≥ 1024px: barra lateral; Resumen en rejilla 1.5fr / 1fr.
- Objetivos táctiles ≥ 40px. Nada provoca scroll horizontal del body.

## Agent Prompt Guide

"Interfaz de Luca (ver docs/html/preview-diseno-moderno.html). Claro: lienzo #f4efe8, tarjetas #fffdf9
radio 16 con borde 1px #e6ddd1, sin sombras. Oscuro: #0b0b0b / #171717, borde #272727, tinta #ede7dd.
Geist 500 tracking negativo en títulos; importes Geist Mono tabular. Botón principal #bf5230 texto blanco
radio 10; #d9623b para marca, mes actual y progreso. Chips elegidos: tinta en claro, naranja en oscuro.
Categorías con pasteles. Animaciones cortas con propósito, respetando prefers-reduced-motion." Los tokens de
código viven en `apps/web/src/app/globals.css`.
