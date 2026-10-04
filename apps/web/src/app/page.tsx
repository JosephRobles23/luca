import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/app");

  return (
    <main className="mx-auto max-w-2xl px-4 py-24">
      <h1 className="text-5xl font-extrabold tracking-tight">luca<span className="text-accent">.</span></h1>
      <p className="mt-4 text-lg text-muted">
        Tus gastos de BCP y Yape, ordenados y categorizados automáticamente. Viven en <b className="text-text">tu</b> Google Sheet:
        Luca no guarda ninguna transacción, solo las lee desde tu navegador para mostrártelas.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-muted">
        <li>• Lee las notificaciones que ya te llegan al correo y las convierte en movimientos.</li>
        <li>• Dashboard por mes, categoría y comercio.</li>
        <li>• Pregúntale a Claude o ChatGPT por tus gastos (próximamente).</li>
      </ul>
      <form className="mt-10" action={async () => { "use server"; await signIn("google", { redirectTo: "/app" }); }}>
        <button className="btn primary text-base" type="submit">Entrar con Google</button>
      </form>
      <p className="mt-4 text-xs text-muted">
        Permisos que pedimos: tu correo (para identificarte) y acceso solo a los archivos de Drive que crees o elijas con Luca.
        Nunca pedimos acceso a tu Gmail desde esta web.
      </p>
    </main>
  );
}
