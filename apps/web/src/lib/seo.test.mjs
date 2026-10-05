// Tests de los datos estructurados (JSON-LD) y constantes SEO.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SITE, FAQ, PUBLIC_PATHS, jsonLd, jsonLdScript } from "./seo.ts";

test("jsonLd: WebSite, WebApplication gratuita y FAQPage con todas las preguntas", () => {
  const graph = jsonLd()["@graph"];
  assert.deepEqual(graph.map((n) => n["@type"]), ["WebSite", "WebApplication", "FAQPage"]);
  const app = graph[1];
  assert.equal(app.applicationCategory, "FinanceApplication");
  assert.equal(app.offers.price, "0");
  assert.ok(app.url.startsWith("https://"));
  const faq = graph[2].mainEntity;
  assert.equal(faq.length, FAQ.length);
  assert.deepEqual(faq[0], { "@type": "Question", name: FAQ[0][0], acceptedAnswer: { "@type": "Answer", text: FAQ[0][1] } });
});

test("jsonLdScript: JSON válido y sin '<' literal que pueda cerrar el <script>", () => {
  const s = jsonLdScript();
  assert.ok(!s.includes("<"));
  assert.equal(JSON.parse(s)["@context"], "https://schema.org");
});

test("SITE y rutas públicas: sin barra final y sin /app", () => {
  assert.ok(!SITE.url.endsWith("/"));
  assert.ok(!PUBLIC_PATHS.some((p) => p.startsWith("/app")));
});
