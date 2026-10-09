import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import GitHubStars from "@/components/GitHubStars";
import ThemeToggle from "@/components/ThemeToggle";
import { DataPath, SectionHead } from "@/components/portada/DataPath";
import { EntrarButton } from "@/components/portada/EntrarButton";
import { Faq } from "@/components/portada/Faq";
import { Features } from "@/components/portada/Features";
import { PanelShot } from "@/components/portada/PanelShot";
import { SheetSection } from "@/components/portada/SheetSection";
import { YapeSection } from "@/components/portada/YapeSection";
import s from "@/components/portada/portada.module.css";
import { FAQ, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/app");

  const entrar = async () => { "use server"; await signIn("google", { redirectTo: "/app" }); };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript() }} />
      <a href="#top" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">Saltar al contenido</a>

      <header className={s.nav}>
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-4 sm:px-7">
          <Link href="/" className="inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.3px] text-ink no-underline">
            <Image src="/icon-192.png" alt="" width={30} height={30} className="rounded-lg border border-line" priority />
            <span>luca<b className="text-primary">.</b></span>
          </Link>
          <nav aria-label="Portada" className="flex items-center gap-1">
            <a className={s.navLink} href="#camino">Cómo funciona</a>
            <a className={s.navLink} href="#que-hace">Qué hace</a>
            <a className={s.navLink} href="#en-tu-sheet">Tu Sheet</a>
            <a className={s.navLink} href="#faq">Preguntas</a>
            <GitHubStars />
            <ThemeToggle />
            <EntrarButton action={entrar} label="Entrar" size="sm" className="ml-1" />
          </nav>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1120px] px-4 sm:px-7">
        <section className={`${s.stagger} grid grid-cols-[minmax(0,1fr)] justify-items-center gap-5 pb-10 pt-12 text-center sm:pt-16`} aria-labelledby="hero-h">
          <a className={s.badge} href="#que-hace"><span className="truncate"><b>Nuevo:</b> pregúntale a tu IA por tus gastos</span> <span className={s.badgeTag}>MCP</span></a>
          <h1 id="hero-h" className={s.h1}>Tus gastos de BCP y Yape, ordenados en <em>tu</em> Google.</h1>
          <p className={s.lede}>
            Luca convierte los correos que ya te llegan en movimientos categorizados dentro de una Sheet tuya. Sin copiar a mano y sin entregarle
            tus datos a nadie: no guardamos ninguna transacción, tu navegador la lee de tu Drive.
          </p>
          <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
            <EntrarButton action={entrar} testId="cta-entrar" />
            <a className="btn lg" href="#camino">Ver cómo funciona</a>
          </div>
          <ul className={s.trust} aria-label="Lo que puedes esperar">
            <li>Gratis</li><li>Sin base de datos</li><li>Sin anuncios ni rastreadores</li><li>Nunca pide tu Gmail</li>
          </ul>
          <PanelShot />
        </section>

        <DataPath />
        <Features />
        <YapeSection />
        <SheetSection />

        <section id="faq" aria-labelledby="faq-h" className="scroll-mt-24 pt-20 sm:pt-[88px]">
          <SectionHead eyebrow="Preguntas frecuentes" id="faq-h" title="Antes de entrar." />
          <Faq items={FAQ} />
        </section>

        <section className={`${s.final} mt-20 sm:mt-[88px]`} aria-labelledby="final-h">
          <svg className={s.finalArt} viewBox="0 0 200 200" aria-hidden>
            {[90, 66, 42].map((r, n) => (
              <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="var(--primary)" strokeOpacity={0.25 + n * 0.25} strokeWidth="1.5" strokeDasharray="4 7" />
            ))}
            <circle cx="100" cy="100" r="9" fill="var(--primary)" />
          </svg>
          <h2 id="final-h" className="max-w-[20ch] text-[clamp(26px,3.6vw,38px)] font-medium leading-[1.1] tracking-[-0.03em]">Empieza con el último mes de tus correos.</h2>
          <p className={s.finalSub}>En un par de minutos tienes tu Sheet creada y tus gastos del último mes ordenados por categoría.</p>
          <EntrarButton action={entrar} />
          <p className={`${s.finalSub} max-w-[60ch] text-xs`}>
            Permisos: tu correo (para identificarte) y solo los archivos de Drive que crees o elijas con Luca. Nunca pedimos tu Gmail desde esta web.
          </p>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-3 px-4 pb-28 pt-8 text-[13px] text-muted sm:px-7 min-[720px]:pb-10">
        <span>Luca · lucaa.lat · proyecto personal, gratuito y sin anuncios</span>
        <span><Link className="underline underline-offset-2" href="/privacidad">Política de privacidad</Link> · <Link className="underline underline-offset-2" href="/terminos">Términos de uso</Link></span>
      </footer>

      <div className={s.mobileCta}><EntrarButton action={entrar} /></div>
    </>
  );
}
