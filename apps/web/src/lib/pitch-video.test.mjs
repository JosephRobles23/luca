// Tests del video de la portada: capítulos, capítulo activo y formatos de tiempo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PITCH_VIDEO, PITCH_CHAPTERS, capituloActivo, mmss, isoDuration } from "./pitch-video.ts";
import { jsonLd } from "./seo.ts";

test("capítulos en orden, dentro de la duración y con texto", () => {
  PITCH_CHAPTERS.forEach((c, i) => {
    assert.ok(c.label.length > 0);
    assert.ok(c.t > 0 && c.t < PITCH_VIDEO.seconds);
    if (i) assert.ok(c.t > PITCH_CHAPTERS[i - 1].t, "orden creciente");
  });
});

test("capituloActivo: -1 antes del primero, cambia justo en cada inicio y se queda en el último", () => {
  assert.equal(capituloActivo(0), -1);
  assert.equal(capituloActivo(21.9), -1);
  assert.equal(capituloActivo(22), 0);
  assert.equal(capituloActivo(49.99), 0);
  assert.equal(capituloActivo(50), 1);
  assert.equal(capituloActivo(100), 3);
  assert.equal(capituloActivo(141), 4);
});

test("mmss e isoDuration", () => {
  assert.equal(mmss(0), "0:00");
  assert.equal(mmss(68), "1:08");
  assert.equal(mmss(PITCH_VIDEO.seconds), "2:22");
  assert.equal(isoDuration(142), "PT2M22S");
  assert.equal(isoDuration(45), "PT45S");
});

test("el JSON-LD incluye el VideoObject del pitch con su portada absoluta y los capítulos", () => {
  const video = jsonLd()["@graph"].find((n) => n["@type"] === "VideoObject");
  assert.ok(video, "hay VideoObject");
  assert.equal(video.contentUrl, PITCH_VIDEO.src);
  assert.equal(video.thumbnailUrl, "https://lucaa.lat/video/pitch-poster.jpg");
  assert.equal(video.duration, "PT2M22S");
  assert.equal(video.uploadDate, PITCH_VIDEO.uploadDate);
  assert.equal(video.hasPart.length, PITCH_CHAPTERS.length);
  assert.deepEqual(video.hasPart[0], { "@type": "Clip", name: "El viaje de un yapeo", startOffset: 22, endOffset: 50, url: "https://lucaa.lat/#video" });
  assert.equal(video.hasPart.at(-1).endOffset, PITCH_VIDEO.seconds);
});
