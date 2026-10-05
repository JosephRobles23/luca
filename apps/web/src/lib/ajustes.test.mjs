// Tests de lectura de Ajustes/Categorías, estado de conexiones, versión, onboarding y fixtures del mock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAjustes, parseCategorias, usdRate, versionStatus, iphoneStatus, mcpStatus, connectionsStatus, isAuthorized, importStatus, DEFAULT_CATEGORIAS } from "./ajustes.ts";
import { currentStep } from "./onboarding.ts";
import { buildFullSheet, buildFreshSheet, buildAuthorizedSheet } from "./fixtures.ts";
import { rowsToTxs } from "./ledger.ts";

const NOW = Date.parse("2026-10-04T15:00:00-05:00");

test("parseAjustes ignora encabezado; usdRate con coma y por defecto", () => {
  const a = parseAjustes([["key", "value"], ["fx.usd_pen", "3,80"], ["", "x"], ["luca.version", "4"]]);
  assert.deepEqual(a, { "fx.usd_pen": "3,80", "luca.version": "4" });
  assert.equal(usdRate(a), 3.8);
  assert.equal(usdRate({}), 3.5);
  assert.equal(usdRate({ "fx.usd_pen": "abc" }), 3.5);
});

test("parseCategorias: con/sin encabezado, vacía → taxonomía por defecto", () => {
  assert.deepEqual(parseCategorias([["nombre"], ["Ocio"], ["Salud"], ["Ocio"]]), ["Ocio", "Salud"]);
  assert.deepEqual(parseCategorias([["Ocio"]]), ["Ocio"]);
  assert.deepEqual(parseCategorias([]), DEFAULT_CATEGORIAS);
});

test("versionStatus", () => {
  assert.equal(versionStatus({ "luca.version": "4" }, "5").outdated, true);
  assert.equal(versionStatus({ "luca.version": "5" }, "5").outdated, false);
  assert.equal(versionStatus({}, "5").outdated, false);
  assert.equal(versionStatus({ "luca.version": "4" }, "").outdated, false);
});

test("iphoneStatus: no configurado / conectado / silencio > 7 días / execUrl cambiada", () => {
  assert.equal(iphoneStatus({}, NOW).connected, false);
  const ok = iphoneStatus({ "conexiones.iphone.device": "iPhone", "conexiones.iphone.lastEventAt": "2026-10-04T10:00:00-05:00", "conexiones.iphone.eventsCount": "12" }, NOW);
  assert.equal(ok.connected, true);
  assert.equal(ok.silent, false);
  assert.equal(ok.eventsCount, 12);
  const silent = iphoneStatus({ "conexiones.iphone": "1", "conexiones.iphone.lastEventAt": "2026-09-20T10:00:00-05:00" }, NOW);
  assert.equal(silent.silent, true);
  assert.equal(silent.silentDays, 14);
  assert.equal(iphoneStatus({ "conexiones.iphone": "1" }, NOW).silent, true); // nunca llegó nada
  // Recién conectado: solo una prueba reciente, sin yapeos todavía → no es "sin señales".
  const fresh = iphoneStatus({ "conexiones.iphone": "1", "conexiones.iphone.device": "iPhone", "conexiones.iphone.lastTestAt": "2026-10-04T14:50:00-05:00" }, NOW);
  assert.equal(fresh.silent, false);
  assert.equal(fresh.silentDays, null);
  const changed = iphoneStatus({ "conexiones.iphone": "1", "conexiones.execUrl": "https://script.google.com/macros/s/B/exec", "conexiones.iphone.execUrl": "https://script.google.com/macros/s/A/exec" }, NOW);
  assert.equal(changed.execUrlChanged, true);
});

test("mcpStatus y connectionsStatus", () => {
  assert.equal(mcpStatus({}).connected, false);
  assert.equal(mcpStatus({ "conexiones.mcp": "1", "conexiones.mcp.callsCount": "3" }).callsCount, 3);
  assert.equal(mcpStatus({}).workerUrl, "https://mcp.lucaa.lat");
  const c = connectionsStatus({ "conexiones.execUrl": "https://script.google.com/macros/s/X/exec" }, NOW);
  assert.equal(c.webAppReady, true);
  assert.equal(connectionsStatus({ "conexiones.execUrl": "" }, NOW).webAppReady, false);
});

test("isAuthorized e importStatus", () => {
  assert.equal(isAuthorized({}, false), false);
  assert.equal(isAuthorized({}, true), true);
  assert.equal(isAuthorized({ "luca.version": "4" }, false), true);
  assert.deepEqual(importStatus({ "import.since": "2026-01-01", "import.status": "running" }), { since: "2026-01-01", status: "running", running: true, done: false });
});

test("onboarding: paso pendiente", () => {
  assert.equal(currentStep({ hasFile: false, authorized: false, connectionsActive: false, connectionsSkipped: false }), 1);
  assert.equal(currentStep({ hasFile: true, authorized: false, connectionsActive: false, connectionsSkipped: false }), 2);
  assert.equal(currentStep({ hasFile: true, authorized: true, connectionsActive: false, connectionsSkipped: false }), 3);
  assert.equal(currentStep({ hasFile: true, authorized: true, connectionsActive: false, connectionsSkipped: true }), null);
  assert.equal(currentStep({ hasFile: true, authorized: true, connectionsActive: true, connectionsSkipped: false }), null);
});

test("fixtures del mock: 40–60 movimientos, 3 meses, PEN/USD, pendientes, transfer_in, internal_transfer", () => {
  const now = new Date("2026-10-28T12:00:00-05:00");
  const full = buildFullSheet(now);
  const txs = rowsToTxs(full.Movimientos);
  assert.ok(txs.length >= 40 && txs.length <= 60, `hay ${txs.length}`);
  assert.equal(new Set(txs.map((t) => t.fecha.slice(0, 7))).size, 3);
  assert.ok(txs.some((t) => t.moneda === "USD" && t.tipoCambio));
  assert.ok(txs.some((t) => t.moneda === "USD" && !t.tipoCambio));
  assert.ok(txs.some((t) => t.tipo === "expense" && !t.categoria));
  assert.ok(txs.some((t) => t.tipo === "transfer_in"));
  assert.ok(txs.some((t) => t.tipo === "internal_transfer"));
  assert.ok(txs.every((t) => t.fecha.slice(0, 10) <= "2026-10-28"));
  assert.equal(new Set(txs.map((t) => t.id)).size, txs.length, "ids únicos");
  const a = parseAjustes(full.Ajustes);
  assert.equal(a["luca.version"], "4");
  assert.ok(iphoneStatus(a, now.getTime()).connected);
  assert.ok(mcpStatus(a).connected);
  assert.equal(full.Comercios[0][0], "clave");
  assert.equal(parseCategorias(full.Categorías).length, DEFAULT_CATEGORIAS.length);
  assert.equal(buildFreshSheet().Movimientos, undefined);
  assert.equal(parseAjustes(buildAuthorizedSheet(now).Ajustes)["conexiones.execUrl"], "");
});
