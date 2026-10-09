// Tests de la copia local de solo lectura (ADR-011): sin secretos, errores de red y copia de la cuenta correcta.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SECRET_AJUSTES, sanitizeData, isNetworkError, usableSnapshot } from "./offline.ts";

const plain = (x) => JSON.parse(JSON.stringify(x));

test("sanitizeData: quita el token del iPhone y las URLs /exec; el resto queda igual", () => {
  const data = { txs: [{ id: "a" }], ajustes: { "fx.usd_pen": "3.7", "conexiones.iphone.token": "s3cr3t", "conexiones.execUrl": "https://script.google.com/x/exec", "conexiones.iphone.execUrl": "https://script.google.com/y/exec", "luca.version": "5" } };
  const out = sanitizeData(data);
  assert.deepEqual(plain(out.ajustes), { "fx.usd_pen": "3.7", "luca.version": "5" });
  assert.deepEqual(plain(out.txs), [{ id: "a" }]);
  assert.equal(data.ajustes["conexiones.iphone.token"], "s3cr3t"); // no muta el original
  assert.ok(SECRET_AJUSTES.includes("conexiones.iphone.token"));
});

test("isNetworkError: TypeError de fetch o navegador sin conexión; no los errores de la API", () => {
  assert.equal(isNetworkError(new TypeError("Failed to fetch"), true), true);
  assert.equal(isNetworkError(new Error("403 forbidden"), false), true);
  assert.equal(isNetworkError(new Error("403 forbidden"), true), false);
});

test("usableSnapshot: solo la copia de la misma cuenta y, si hay hoja elegida, de esa hoja", () => {
  const snap = { email: "ana@example.com", file: { id: "f1", name: "Luca" }, data: {}, savedAt: 1 };
  assert.equal(usableSnapshot(snap, "ana@example.com", "f1"), snap);
  assert.equal(usableSnapshot(snap, "ana@example.com", null), snap);
  assert.equal(usableSnapshot(snap, "otro@example.com", "f1"), null);
  assert.equal(usableSnapshot(snap, "ana@example.com", "f2"), null);
  assert.equal(usableSnapshot(null, "ana@example.com", null), null);
});
