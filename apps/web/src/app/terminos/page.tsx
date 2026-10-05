import Link from "next/link";
import LegalLayout from "@/components/LegalLayout";

const SECTIONS = [["que-es-luca", "Qué es Luca"], ["lo-que-aceptas-al-usarla", "Lo que aceptas al usarla"], ["lo-que-puedes-esperar-de-nosotros", "Lo que puedes esperar de nosotros"], ["limites-de-responsabilidad", "Límites de responsabilidad"], ["servicios-de-terceros", "Servicios de terceros"], ["contacto-y-cambios", "Contacto y cambios"]] as const;

export const metadata = {
  title: "Términos de uso",
  description: "Condiciones de uso de Luca, una herramienta gratuita y sin anuncios para ordenar tus gastos de BCP y Yape en tu propia cuenta de Google.",
  alternates: { canonical: "/terminos" },
};

export default function Terminos() {
  return (
    <LegalLayout title="Términos de uso" updated="4 de octubre de 2026" sections={SECTIONS}>
      <h2 id="que-es-luca">Qué es Luca</h2>
      <p>
        Luca es una herramienta personal para ordenar gastos a partir de las notificaciones por correo de BCP y Yape, dentro de tu propia cuenta de Google.
        La ofrece su autor, una persona natural (contacto: <a href="mailto:gavynenita@gmail.com">gavynenita@gmail.com</a>), de forma <b>gratuita, sin anuncios y sin fines comerciales</b>.
      </p>

      <h2 id="lo-que-aceptas-al-usarla">Lo que aceptas al usarla</h2>
      <ul>
        <li>Usas Luca con tu propia cuenta de Google y sobre tus propios datos.</li>
        <li>La Sheet y el script son tuyos: eres responsable de con quién los compartes y de los permisos que concedes.</li>
        <li>Luca se ofrece &quot;tal cual&quot;, sin garantía de disponibilidad ni de exactitud. Los parsers de correos pueden fallar o cambiar cuando los bancos cambian sus plantillas; revisa tus movimientos antes de tomar decisiones con ellos.</li>
        <li>No es un servicio financiero ni da asesoría: solo muestra y organiza información que ya tienes.</li>
      </ul>

      <h2 id="lo-que-puedes-esperar-de-nosotros">Lo que puedes esperar de nosotros</h2>
      <ul>
        <li>No almacenamos tus transacciones ni tus correos; la <Link href="/privacidad">política de privacidad</Link> describe literalmente la arquitectura.</li>
        <li>Publicamos versiones nuevas del script agrupadas (como máximo mensuales). Tu copia no se actualiza sola: la web y el menú Luca te avisan y te dicen cómo hacerlo en tres clics.</li>
        <li>Podemos cambiar o descontinuar el servicio. Si eso pasa, tus datos siguen en tu Sheet y tu script sigue funcionando sin la web.</li>
      </ul>

      <h2 id="limites-de-responsabilidad">Límites de responsabilidad</h2>
      <p>
        En la medida que permita la ley, el autor no responde por pérdidas derivadas del uso de Luca, incluidas decisiones tomadas con datos incompletos o mal categorizados,
        interrupciones de servicios de Google o de terceros, o cambios en los correos de los bancos.
      </p>

      <h2 id="servicios-de-terceros">Servicios de terceros</h2>
      <p>
        Luca depende de Google (Drive, Sheets, Apps Script, Gmail con tu permiso), y opcionalmente de Cloudflare (servidor MCP) y de un proveedor de IA que elijas y configures tú.
        Cada uno tiene sus propios términos. El uso de la API de Google en Luca cumple la Política de datos de usuario de los servicios de API de Google, incluidos los requisitos de uso limitado.
      </p>

      <h2 id="contacto-y-cambios">Contacto y cambios</h2>
      <p>Dudas, errores o solicitudes: al correo de contacto. Si estos términos cambian, actualizaremos la fecha de arriba.</p>

      <p><Link href="/privacidad">Política de privacidad</Link> · <Link href="/">Inicio</Link></p>
    </LegalLayout>
  );
}
