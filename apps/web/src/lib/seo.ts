// Datos del sitio para metadatos, sitemap y datos estructurados (JSON-LD). Una sola fuente para que la
// página, los buscadores y los asistentes de IA lean lo mismo.

export const SITE = {
  url: "https://lucaa.lat",
  name: "Luca",
  title: "Luca — tus gastos de BCP y Yape, ordenados en tu Google",
  description:
    "Luca convierte los correos de BCP y Yape en movimientos categorizados dentro de una Google Sheet tuya. Gratis, sin anuncios y sin base de datos: tus transacciones nunca salen de tu cuenta de Google.",
  locale: "es_PE",
  lang: "es-PE",
  contact: "gavynenita@gmail.com",
} as const;

export const PUBLIC_PATHS = ["/", "/privacidad", "/terminos"] as const;

// Preguntas visibles en la portada; las mismas alimentan el FAQPage del JSON-LD.
export const FAQ: ReadonlyArray<readonly [string, string]> = [
  [
    "¿Qué es Luca?",
    "Una herramienta gratuita para ordenar tus gastos personales en Perú. Lee las notificaciones de BCP y Yape que ya te llegan al correo y las convierte en movimientos categorizados dentro de una Google Sheet de tu propiedad, con un dashboard web por mes, categoría y comercio.",
  ],
  [
    "¿Luca guarda mis transacciones?",
    "No. Luca no tiene base de datos. Tus movimientos viven en una Sheet de tu Google Drive y los procesa un script que corre en tu propia cuenta de Google. La web lee esa Sheet desde tu navegador con tu sesión.",
  ],
  [
    "¿Qué permisos pide?",
    "La web pide tu correo para identificarte y el permiso drive.file, que solo alcanza a los archivos que creas o eliges con Luca. El permiso para leer los correos de BCP y Yape se lo das a tu propio script, dentro de tu Sheet, nunca a Luca.",
  ],
  [
    "¿Cuánto cuesta?",
    "Nada. Luca es un proyecto personal, gratuito, sin anuncios y sin rastreadores.",
  ],
  [
    "¿Puedo consultar mis gastos desde una IA como Claude o ChatGPT?",
    "Sí, de forma opcional. Luca ofrece un servidor MCP que reenvía las preguntas de tu IA a tu script y devuelve la respuesta sin guardarla. También puedes registrar los yapeos recibidos en el iPhone con un atajo.",
  ],
];

export function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.name,
        description: SITE.description,
        inLanguage: SITE.lang,
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE.url}/#app`,
        name: SITE.name,
        url: SITE.url,
        description: SITE.description,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        inLanguage: SITE.lang,
        areaServed: { "@type": "Country", name: "Perú" },
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "PEN" },
        featureList: [
          "Lectura de notificaciones por correo de BCP y Yape",
          "Movimientos categorizados en una Google Sheet propia",
          "Dashboard por mes, categoría y comercio",
          "Sin base de datos: los datos se quedan en tu Google",
          "Servidor MCP opcional para consultar tus gastos desde una IA",
        ],
        image: `${SITE.url}/icon-512.png`,
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE.url}/#faq`,
        mainEntity: FAQ.map(([q, a]) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };
}

// Para incrustar en <script type="application/ld+json">: escapar "<" evita que el texto cierre la etiqueta.
export function jsonLdScript(): string {
  return JSON.stringify(jsonLd()).replace(/</g, "\\u003c");
}
