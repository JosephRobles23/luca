import ConectarIphone from "@/components/ConectarIphone";
import { parseStep, SHORTCUT_URL } from "@/lib/iphone-wizard";
import PageTransition from "@/components/PageTransition";

export const metadata = { title: "Conectar iPhone" };

/** Asistente en 5 pasos (ADR-003). `?paso=n` fija el paso inicial (lo usa el QR del paso 2). */
export default async function ConectarIphonePage({ searchParams }: { searchParams: Promise<{ paso?: string | string[] }> }) {
  const { paso } = await searchParams;
  return <PageTransition><ConectarIphone requestedStep={parseStep(paso)} shortcutUrl={process.env.NEXT_PUBLIC_SHORTCUT_URL || SHORTCUT_URL} /></PageTransition>;
}
