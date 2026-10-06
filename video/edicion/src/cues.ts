// Guion de la edición de "Ajustes - Google Chrome 2026-10-05 13-39-30.mp4".
// Tiempos en segundos del video original; rectángulos [x, y, ancho, alto] en píxeles de la grabación (1920×1140).

export type Rect = [number, number, number, number];

// Cámara: en `t` empieza a moverse hacia el encuadre (rect) o al plano completo (null).
// `z` fuerza el zoom; si falta se calcula para que el rect quepa con margen.
export type Shot = {t: number; rect?: Rect; center?: [number, number]; z?: number; dur?: number};

// Resaltado: oscurece el resto, dibuja un borde y una etiqueta junto al rect.
export type Highlight = {from: number; to: number; rect: Rect; label?: string; place?: 'above' | 'below'};

export type Caption = {from: number; to: number; text: string};
export type Chapter = {t: number; n: string; title: string};

export const SRC_W = 1920;
export const SRC_H = 1140;
export const SRC_DURATION = 587.8;
export const OUTRO = 3.2;

export const SHOTS: Shot[] = [
  {t: 0, rect: undefined},
  // 1 · Asistente: copia la plantilla y elígela
  {t: 0.6, center: [1090, 640], z: 1.5, dur: 1.4},
  {t: 26.4, rect: [360, 214, 1185, 735]},
  {t: 33.6},
  // 2 · Panel en lucaa.lat
  {t: 40.6, center: [1090, 440], z: 1.55},
  {t: 47.6, center: [1084, 640], z: 1.45},
  {t: 56.6, center: [1084, 480], z: 1.45},
  {t: 63.0, center: [1084, 700], z: 1.4},
  {t: 75.0},
  // 3 · La hoja: Ajustes, Movimientos, Dashboard y barra lateral
  {t: 76.4, center: [600, 560], z: 1.45},
  {t: 88.4, center: [1000, 600], z: 1.3},
  {t: 103.4, center: [820, 600], z: 1.3},
  {t: 109.6, rect: [315, 160, 1290, 930]},
  {t: 182.2},
  {t: 184.0, center: [1300, 600], z: 1.7},
  {t: 249.4},
  // 4 · ChatGPT → Complementos → servidor MCP
  {t: 262.6, center: [1120, 400], z: 1.6},
  {t: 279.6},
  {t: 283.6, center: [960, 520], z: 1.6},
  {t: 301.9, dur: 0.5},
  {t: 306.6, center: [960, 520], z: 1.6, dur: 0.6},
  {t: 319.4, center: [960, 700], z: 1.5},
  {t: 336.0},
  {t: 342.9, center: [960, 380], z: 1.9, dur: 0.6},
  {t: 348.9, dur: 0.5},
  {t: 350.0, center: [1300, 560], z: 1.7},
  {t: 393.8, dur: 0.5},
  {t: 394.9, center: [960, 380], z: 1.9, dur: 0.6},
  {t: 401.2},
  {t: 411.4, center: [1300, 560], z: 1.7},
  {t: 422.6},
  // 5 · Preguntas a ChatGPT
  {t: 429.0, center: [1172, 560], z: 1.9},
  {t: 449.4},
  {t: 451.4, center: [780, 620], z: 1.4},
  {t: 463.2},
  {t: 468.4, center: [1160, 380], z: 1.7},
  {t: 493.6, center: [1172, 900], z: 1.7},
  {t: 510.2},
  {t: 550.8, center: [1150, 600], z: 1.6},
  {t: 579.6},
];

export const HIGHLIGHTS: Highlight[] = [
  {from: 2.0, to: 8.6, rect: [800, 700, 580, 210], label: 'Paso 1 · Haz tu copia de la plantilla'},
  {from: 14.0, to: 25.2, rect: [792, 838, 590, 180], label: 'Paso 2 · Elige tu copia', place: 'above'},
  {from: 28.4, to: 33.2, rect: [365, 452, 1170, 52], label: 'Tu copia, en tu Drive'},
  {from: 34.4, to: 38.6, rect: [712, 1070, 478, 48], label: 'Hoja conectada', place: 'above'},
  {from: 41.4, to: 44.0, rect: [456, 296, 745, 385], label: 'Gasto del mes, leído de tu Sheet'},
  {from: 78.0, to: 87.4, rect: [30, 300, 1130, 540], label: 'La configuración vive en tu hoja'},
  {from: 90.0, to: 102.6, rect: [1093, 346, 156, 515], label: 'Categoría automática'},
  {from: 117.0, to: 122.2, rect: [371, 400, 686, 368], label: 'El mismo resumen, dentro de tu Sheet'},
  {from: 122.6, to: 127.4, rect: [1075, 400, 458, 368], label: 'En qué se fue'},
  {from: 129.4, to: 134.4, rect: [1165, 262, 233, 52], label: 'Cambia de mes'},
  {from: 139.6, to: 144.2, rect: [960, 677, 573, 336], label: 'Dónde más gastaste', place: 'above'},
  {from: 157.0, to: 165.0, rect: [392, 417, 965, 42], label: 'Busca y filtra tus movimientos'},
  {from: 186.0, to: 199.0, rect: [1565, 403, 305, 297], label: 'Conector para Claude o ChatGPT'},
  {from: 204.0, to: 213.2, rect: [1565, 400, 292, 600], label: 'Estado: movimientos y conexiones'},
  {from: 216.0, to: 237.4, rect: [1565, 400, 292, 525], label: 'Tu API key de IA (opcional)'},
  {from: 238.8, to: 242.8, rect: [1565, 400, 292, 632], label: 'Atajo de iOS para Yape'},
  {from: 287.0, to: 301.4, rect: [645, 385, 630, 45], label: 'Nombre del conector'},
  {from: 303.7, to: 306.3, rect: [1580, 513, 273, 47], label: 'Copia la URL del conector'},
  {from: 307.4, to: 313.0, rect: [645, 552, 630, 48], label: 'URL: mcp.lucaa.lat/mcp'},
  {from: 320.4, to: 330.0, rect: [645, 895, 630, 180], label: 'Acepta y crea el complemento', place: 'above'},
  {from: 344.0, to: 348.6, rect: [680, 408, 560, 58], label: 'Te pide un código de 8 caracteres'},
  {from: 352.4, to: 360.0, rect: [1580, 573, 273, 45], label: 'Generar código de conexión'},
  {from: 378.4, to: 393.4, rect: [1580, 578, 273, 82], label: 'Código de un solo uso (10 min)'},
  {from: 396.0, to: 401.0, rect: [680, 408, 560, 58], label: 'Pega el código y conecta'},
  {from: 412.6, to: 422.0, rect: [1565, 403, 305, 60], label: 'Conector: conectado'},
  {from: 431.0, to: 449.0, rect: [696, 540, 952, 66], label: 'Pregunta en lenguaje natural'},
  {from: 457.0, to: 462.6, rect: [50, 612, 1450, 32], label: 'Comprobado en tu hoja'},
  {from: 471.0, to: 480.6, rect: [690, 250, 935, 62], label: 'S/ 116 en 3 consumos'},
  {from: 481.4, to: 492.4, rect: [690, 328, 250, 92], label: 'Cada consumo, con su fecha'},
  {from: 496.0, to: 509.6, rect: [696, 1050, 952, 60], label: 'Segunda pregunta', place: 'above'},
  {from: 559.0, to: 568.4, rect: [688, 440, 760, 38], label: 'S/ 946.66 en 13 cargos'},
  {from: 569.0, to: 579.2, rect: [688, 548, 500, 215], label: 'El desglose sale de tu propia hoja'},
];

export const CAPTIONS: Caption[] = [
  {from: 149.2, to: 155.4, text: 'Categorías: cuánto va en cada una'},
  {from: 172.2, to: 177.6, text: 'Tendencias de los últimos meses'},
  {from: 263.0, to: 270.0, text: 'ChatGPT → Ajustes → Complementos'},
  {from: 339.4, to: 342.6, text: 'ChatGPT abre el inicio de sesión de Luca'},
  {from: 402.4, to: 410.0, text: 'Luca queda instalado en ChatGPT'},
  {from: 526.0, to: 539.6, text: 'ChatGPT consulta tu hoja a través de MCP'},
  {from: 581.0, to: 587.4, text: 'Los datos nunca salen de tu Google'},
];

export const CHAPTERS: Chapter[] = [
  {t: 0.3, n: '01', title: 'Conecta tu hoja'},
  {t: 40.6, n: '02', title: 'Tu panel en lucaa.lat'},
  {t: 75.8, n: '03', title: 'Luca dentro de tu Sheet'},
  {t: 250.2, n: '04', title: 'Conecta ChatGPT por MCP'},
  {t: 429.2, n: '05', title: 'Pregúntale a tu IA'},
];
