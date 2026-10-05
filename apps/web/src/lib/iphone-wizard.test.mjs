// Tests del asistente "Conectar iPhone": pasos, token, detección de la prueba y prompt del atajo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStep, initialStep, isIOS, newToken, maskToken, tokenWrites, disconnectWrites, baselineFrom, detectSignal, IPHONE_KEYS } from "./iphone-wizard.ts";
import { buildShortcutPrompt, eventsUrl } from "./shortcut-prompt.ts";

const EXEC = "https://script.google.com/macros/s/AKfycbxMOCK/exec";

test("eventsUrl añade ?events=1 (o &events=1 si ya hay query)", () => {
  assert.equal(eventsUrl(EXEC), `${EXEC}?events=1`);
  assert.equal(eventsUrl(`${EXEC}?x=1`), `${EXEC}?x=1&events=1`);
  assert.equal(eventsUrl(""), "");
});

test("buildShortcutPrompt inyecta URL de eventos y token, y describe el atajo Probar", () => {
  const p = buildShortcutPrompt({ execUrl: EXEC, token: "abc-123" });
  // Texto exacto = promptIphone_ de GAS (tests/prompt-parity.test.mjs); aquí solo que URL y token van inyectados.
  assert.ok(p.includes("https://script.google.com/macros/s/AKfycbxMOCK/exec?events=1"));
  assert.ok(p.includes("abc-123"));
  assert.match(p, /Luca – Captura Yape/);
  assert.match(p, /modo prueba/);
  assert.doesNotMatch(p, /Probar iPhone/); // un solo atajo
  assert.match(p, /luca_pendientes/);
  assert.match(p, /"schema_version": "1"/);
  assert.doesNotMatch(p, /preguntas de configuración/); // los valores van fijos: no hay preguntas al importar
});

test("parseStep e initialStep", () => {
  assert.equal(parseStep(undefined), 1);
  assert.equal(parseStep("3"), 3);
  assert.equal(parseStep(["4"]), 4);
  assert.equal(parseStep("9"), 1);
  assert.equal(initialStep({}, 1), 1);
  assert.equal(initialStep({ [IPHONE_KEYS.token]: "t" }, 1), 1);
  assert.equal(initialStep({ [IPHONE_KEYS.token]: "t", [IPHONE_KEYS.device]: "iPhone" }, 1), 5);
  assert.equal(initialStep({ [IPHONE_KEYS.token]: "t", [IPHONE_KEYS.device]: "iPhone" }, 3), 3);
});

test("isIOS detecta iPhone/iPad y no Android/desktop", () => {
  assert.equal(isIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"), true);
  assert.equal(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17 Mobile/15E148 Safari/604.1"), true); // iPad "desktop"
  assert.equal(isIOS("Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/120 Mobile"), false);
  assert.equal(isIOS("Mozilla/5.0 (X11; Linux x86_64) Chrome/120"), false);
});

test("newToken es UUID y maskToken oculta el centro", () => {
  assert.match(newToken(), /^[0-9a-f-]{36}$/);
  assert.equal(maskToken("a1b2c3d4-e5f6-4000-8000-0123456789ab"), "a1b2…89ab");
  assert.equal(maskToken("corto"), "••••");
  assert.equal(maskToken(""), "");
});

test("tokenWrites fija token y URL del atajo; disconnectWrites vacía todo el canal", () => {
  assert.deepEqual(tokenWrites("t", EXEC), { "conexiones.iphone.token": "t", "conexiones.iphone.execUrl": EXEC });
  const d = disconnectWrites();
  assert.equal(d["conexiones.iphone.token"], "");
  assert.equal(d["conexiones.iphone.device"], "");
  assert.equal(d["conexiones.iphone"], "");
  assert.ok(Object.values(d).every((v) => v === ""));
});

test("detectSignal: solo señales nuevas y posteriores a la apertura (con tolerancia)", () => {
  const openedAt = Date.parse("2026-10-05T12:00:00-05:00");
  const base = baselineFrom({ [IPHONE_KEYS.lastTestAt]: "2026-09-20T10:00:00-05:00" }, openedAt);
  assert.equal(detectSignal({ [IPHONE_KEYS.lastTestAt]: "2026-09-20T10:00:00-05:00" }, base), null); // sin cambio
  assert.equal(detectSignal({ [IPHONE_KEYS.lastTestAt]: "2026-10-05T11:00:00-05:00" }, base), null); // cambió pero es anterior
  assert.deepEqual(detectSignal({ [IPHONE_KEYS.lastTestAt]: "2026-10-05T11:59:00-05:00", [IPHONE_KEYS.device]: "iPhone de Ana" }, base),
    { kind: "test", at: "2026-10-05T11:59:00-05:00", device: "iPhone de Ana" }); // dentro de la tolerancia de reloj
  assert.deepEqual(detectSignal({ [IPHONE_KEYS.lastEventAt]: "2026-10-05T12:00:30-05:00" }, base),
    { kind: "event", at: "2026-10-05T12:00:30-05:00", device: "" }); // un yapeo real también vale
});
