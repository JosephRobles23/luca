// Tests de la instalación de la app (ADR-011): qué ofrecer según el navegador.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installMode, isIos } from "./pwa.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";
const MAC_FIREFOX = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0";

test("isIos: iPhone, iPad (también el que se presenta como Mac con pantalla táctil)", () => {
  assert.equal(isIos(IPHONE, 5), true);
  assert.equal(isIos(IPHONE_CHROME, 5), true);
  assert.equal(isIos(IPAD_DESKTOP, 5), true);
  assert.equal(isIos(IPAD_DESKTOP, 0), false); // un Mac de verdad
  assert.equal(isIos(ANDROID, 5), false);
});

test("installMode: instalada > diálogo del navegador > pasos de iOS > sin soporte", () => {
  assert.equal(installMode({ ua: IPHONE, touchPoints: 5, standalone: true, canPrompt: false }), "installed");
  assert.equal(installMode({ ua: ANDROID, touchPoints: 5, standalone: false, canPrompt: true }), "prompt");
  assert.equal(installMode({ ua: IPHONE, touchPoints: 5, standalone: false, canPrompt: false }), "ios");
  assert.equal(installMode({ ua: IPHONE_CHROME, touchPoints: 5, standalone: false, canPrompt: false }), "ios");
  assert.equal(installMode({ ua: MAC_FIREFOX, touchPoints: 0, standalone: false, canPrompt: false }), "unsupported");
});
