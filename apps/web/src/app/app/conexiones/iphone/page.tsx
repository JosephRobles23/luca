import ConectarIphone from "@/components/ConectarIphone";
import { parseStep } from "@/lib/iphone-wizard";

export const metadata = { title: "Conectar iPhone · Luca" };

/** Asistente en 5 pasos (ADR-003). `?paso=n` fija el paso inicial (lo usa el QR del paso 2). */
export default async function ConectarIphonePage({ searchParams }: { searchParams: Promise<{ paso?: string | string[] }> }) {
  const { paso } = await searchParams;
  return <ConectarIphone requestedStep={parseStep(paso)} shortcutUrl={process.env.NEXT_PUBLIC_SHORTCUT_URL ?? ""} />;
}
