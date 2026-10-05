import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { FAQ, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/app");

  const entrar = async () => { "use server"; await signIn("google", { redirectTo: "/app" }); };

  return (
    <main className="mx-auto max-w-4xl px-4 py-16 sm:py-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript() }} />
      <header className="flex items-center justify-between">
        <div className="text-lg font-extrabold tracking-tight">luca<span className="text-accent">.</span></div>
        <form action={entrar}><button className="btn" type="submit">Entrar</button></form>
      </header>

      <section className="mt-16 max-w-2xl">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Tus gastos de BCP y Yape, ordenados. En <span className="text-accent">tu</span> Google.</h1>
        <p className="mt-5 text-lg text-muted">
          Luca lee las notificaciones que ya te llegan al correo y las convierte en movimientos categorizados dentro de una hoja de cálculo
          de tu propiedad. No guardamos ninguna transacción: tu navegador la lee de tu Drive para mostrártela.
        </p>
        <form className="mt-8" action={entrar}>
          <button className="btn primary text-base" type="submit" data-testid="cta-entrar">Entrar con Google</button>
        </form>
        <p className="mt-3 text-xs text-muted">Gratis, sin anuncios ni rastreadores. Permisos: tu correo (para identificarte) y solo los archivos de Drive que crees o elijas con Luca. Nunca pedimos tu Gmail desde esta web.</p>
      </section>

      <section className="mt-20" aria-labelledby="como">
        <h2 id="como" className="label">Cómo funciona</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            ["1 · Tu Sheet", "Creas una copia de la plantilla de Luca en tu Drive. Ahí vivirán tus movimientos, categorías y ajustes. Es tuya: la abres, la editas y la borras cuando quieras."],
            ["2 · Autorizas tu script", "Dentro de la Sheet, el menú Luca te pide permiso para leer los correos de BCP y Yape. Ese permiso se lo das a tu propio script de Google, no a nosotros. Importa tu último mes y sigue solo, cada 15 minutos."],
            ["3 · Miras y corriges", "Dashboard por mes, categoría y comercio. Recategorizas, marcas transferencias y agregas lo que no llegó por correo. Opcional: yapeos del iPhone y preguntas desde tu IA."],
          ].map(([t, d]) => (
            <li key={t} className="card"><h3 className="font-bold">{t}</h3><p className="mt-2 text-sm text-muted">{d}</p></li>
          ))}
        </ol>
      </section>

      <section className="mt-16 card" aria-labelledby="priv">
        <h2 id="priv" className="label">Privacidad, literal</h2>
        <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
          <li>• Tus datos viven y se procesan en tu cuenta de Google. Luca no tiene base de datos.</li>
          <li>• El script que lee tu correo es una copia tuya, en tu Drive, con tus permisos.</li>
          <li>• La web lee tu Sheet desde tu navegador con tu sesión; nuestro servidor solo refresca el token.</li>
          <li>• Si conectas una IA, el servidor MCP transita las respuestas a petición tuya y no las retiene.</li>
          <li>• Los yapeos del iPhone van de tu teléfono a tu script: nunca pasan por Luca.</li>
          <li>• Si usas la categorización con IA, solo viaja el nombre del comercio y el monto; nunca el correo.</li>
        </ul>
        <p className="mt-4 text-sm"><Link className="underline" href="/privacidad">Política de privacidad</Link> · <Link className="underline" href="/terminos">Términos de uso</Link></p>
      </section>

      <section className="mt-16" aria-labelledby="faq">
        <h2 id="faq" className="label">Preguntas frecuentes</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {FAQ.map(([q, a]) => (
            <div key={q} className="card"><dt className="font-bold">{q}</dt><dd className="mt-2 text-sm text-muted">{a}</dd></div>
          ))}
        </dl>
      </section>

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>Luca · lucaa.lat · proyecto personal, gratuito y sin anuncios</span>
        <span><Link className="underline" href="/privacidad">Privacidad</Link> · <Link className="underline" href="/terminos">Términos</Link></span>
      </footer>
    </main>
  );
}
