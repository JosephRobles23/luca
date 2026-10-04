/**
 * Factoría que elige la implementación de `GoogleClient`.
 * Los componentes solo conocen la interfaz; `LUCA_MOCK=1` cambia la implementación aquí, no en la UI.
 */
import { GoogleRealClient } from "./google.ts";
import { GoogleMockClient } from "./google.mock.ts";
import type { GoogleClient } from "./google-types.ts";

export * from "./google-types.ts";

export type ClientConfig = {
  mode: "google" | "mock";
  accessToken: string;
  pickerKey: string;
  appId: string;
};

export function getGoogleClient(cfg: ClientConfig): GoogleClient {
  if (cfg.mode === "mock") return new GoogleMockClient();
  return new GoogleRealClient(cfg.accessToken, { apiKey: cfg.pickerKey, appId: cfg.appId });
}
