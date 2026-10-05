// Tests de presentación de Conexiones: pastillas, acción del iPhone y estado del diagrama.
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectionsStatus } from "./ajustes.ts";
import { webAppPill, iphonePill, mcpPill, iphonePending, iphoneAction, flowState } from "./conexiones-ui.ts";

const NOW = Date.parse("2026-10-05T12:00:00-05:00");
const EXEC = "https://script.google.com/macros/s/AKfyc/exec";
const full = {
  "conexiones.execUrl": EXEC,
  "conexiones.iphone.token": "0f1e-aabb",
  "conexiones.iphone.execUrl": EXEC,
  "conexiones.iphone.device": "iPhone",
  "conexiones.iphone.lastEventAt": "2026-10-05T10:00:00-05:00",
  "conexiones.iphone.eventsCount": "3",
  "conexiones.mcp.connectedAt": "2026-10-01T09:00:00-05:00",
  "conexiones.mcp.client": "Claude",
};

test("sin nada: todo apagado, Configurar, sin datos circulando", () => {
  const c = connectionsStatus({}, NOW);
  assert.deepEqual(webAppPill(c), { tone: "off", label: "sin publicar" });
  assert.deepEqual(iphonePill(c, false), { tone: "off", label: "no configurado" });
  assert.deepEqual(mcpPill(c), { tone: "off", label: "no configurada" });
  assert.deepEqual(iphoneAction(c, false), { href: "/app/conexiones/iphone", label: "Configurar", primary: true });
  const f = flowState(c);
  assert.equal(f.count, 0);
  assert.equal(f.iphoneLive || f.mcpLive, false);
});

test("token sin prueba: pendiente y continúa en el paso 3", () => {
  const a = { "conexiones.execUrl": EXEC, "conexiones.iphone.token": "abc" };
  const c = connectionsStatus(a, NOW);
  const p = iphonePending(c, a);
  assert.equal(p, true);
  assert.equal(iphonePill(c, p).tone, "warn");
  assert.equal(iphoneAction(c, p).href, "/app/conexiones/iphone?paso=3");
  assert.equal(flowState(c, p).iphoneLive, false);
});

test("todo conectado: pastillas en ok, Gestionar y ambas ramas vivas", () => {
  const c = connectionsStatus(full, NOW);
  assert.equal(webAppPill(c).label, "publicada");
  assert.deepEqual(iphonePill(c, false), { tone: "ok", label: "conectado" });
  assert.equal(mcpPill(c).label, "conectada");
  assert.equal(iphoneAction(c, false).href, "/app/conexiones/iphone?paso=5");
  const f = flowState(c);
  assert.equal(f.count, 3);
  assert.equal(f.iphoneLive, true);
  assert.equal(f.mcpLive, true);
  assert.match(f.summary, /iPhone conectado/);
});

test("iPhone sin señales: aviso y la rama no se anima", () => {
  const c = connectionsStatus({ ...full, "conexiones.iphone.lastEventAt": "2026-09-01T10:00:00-05:00" }, NOW);
  assert.deepEqual(iphonePill(c, false), { tone: "warn", label: "sin señales" });
  assert.equal(flowState(c).iphoneLive, false);
});

test("sin Web App ninguna rama transporta datos aunque haya telemetría vieja", () => {
  const c = connectionsStatus({ ...full, "conexiones.execUrl": "" }, NOW);
  const f = flowState(c);
  assert.equal(f.script, "off");
  assert.equal(f.mcpLive, false);
});
