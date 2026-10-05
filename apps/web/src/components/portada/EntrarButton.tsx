/** Botón "Entrar con Google": un form con la server action de la página (sin JavaScript de cliente). */
import { GlyphGoogle } from "./glyphs";

export function EntrarButton({ action, label = "Entrar con Google", size = "lg", testId, className = "" }: {
  action: () => Promise<void>;
  label?: string;
  size?: "sm" | "lg";
  /** Solo el botón principal del hero lleva `cta-entrar` (lo usan los e2e; debe ser único). */
  testId?: string;
  className?: string;
}) {
  return (
    <form action={action} className={className}>
      <button className={`btn primary ${size} w-full`} type="submit" data-testid={testId}>
        {size === "lg" && <GlyphGoogle size={17} />}
        {label}
      </button>
    </form>
  );
}
