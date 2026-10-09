// Tests del formato del contador de estrellas de GitHub.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatStars, GITHUB_URL } from "./github.ts";

test("formatStars: exacto bajo mil, abreviado con k (sin redondear hacia arriba)", () => {
  assert.equal(formatStars(0), "0");
  assert.equal(formatStars(999), "999");
  assert.equal(formatStars(1000), "1k");
  assert.equal(formatStars(1299), "1.2k");
  assert.equal(formatStars(9999), "9.9k");
  assert.equal(formatStars(12500), "12k");
});

test("GITHUB_URL apunta al repo", () => {
  assert.equal(GITHUB_URL, "https://github.com/JosephRobles23/luca");
});
