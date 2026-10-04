import Link from "next/link";
import LegalLayout from "@/components/LegalLayout";

export const metadata = { title: "Política de privacidad · Luca" };

export default function Privacidad() {
  return (
    <LegalLayout title="Política de privacidad" updated="4 de octubre de 2026">
      <h2>Quién trata tus datos</h2>
      <p>
        Luca es un proyecto personal, gratuito y sin anuncios. El responsable del tratamiento es su autor, una persona natural, con contacto en
        <a href="mailto:gavynenita@gmail.com"> gavynenita@gmail.com</a>. No hay empresa detrás ni venta de datos: no tenemos nada que vender porque no almacenamos tus transacciones.
      </p>

      <h2>Dónde viven tus datos (la arquitectura, tal cual es)</h2>
      <ul>
        <li><b>Tu hoja de cálculo (Sheet).</b> Tus movimientos, categorías y ajustes se guardan en una Google Sheet de tu propiedad, en tu Google Drive. Luca no tiene base de datos.</li>
        <li><b>Tu script.</b> La Sheet trae una copia de un pequeño script de Apps Script que corre en tu cuenta de Google con tus permisos. Es él quien lee los correos de BCP y Yape (con el permiso que le das tú, a él, en la pantalla de Google) y escribe en tu Sheet. Ese permiso de lectura de Gmail nunca se concede a Luca ni a su web.</li>
        <li><b>Esta web (lucaa.lat).</b> Al entrar con Google pedimos tu correo (para identificarte) y el permiso <code>drive.file</code>, que solo alcanza a los archivos que crees o elijas con Luca. Tu navegador lee y escribe la Sheet directamente contra las APIs de Google con tu sesión. Nuestro servidor únicamente refresca tu token de sesión, que viaja cifrado en una cookie en tu dispositivo; no lo guarda ni ve tus datos.</li>
        <li><b>El servidor MCP (mcp.lucaa.lat), opcional.</b> Si conectas una IA (Claude, ChatGPT…), el servidor reenvía cada consulta a tu script y devuelve la respuesta a tu IA, solo cuando tú se lo pides, sin retener su contenido. Guarda únicamente el vínculo técnico de la conexión (la URL de tu script y un hash del secreto). Sus registros no incluyen tus datos.</li>
        <li><b>El canal iPhone, opcional.</b> Si activas el atajo, tu iPhone envía las notificaciones de Yape directamente a tu script. Nunca pasan por infraestructura de Luca.</li>
        <li><b>Categorización con IA, opcional.</b> Si configuras una clave de un proveedor (Gemini, OpenAI o Anthropic) en tu script, para los comercios que no se resuelven con reglas se envía solo el nombre del comercio y el monto; nunca el correo. La clave se guarda en las propiedades de usuario de tu propio script.</li>
      </ul>

      <h2>Qué no hacemos</h2>
      <ul>
        <li>No almacenamos transacciones, saldos ni correos en ningún servidor nuestro.</li>
        <li>No usamos analítica, rastreadores ni publicidad.</li>
        <li>No compartimos ni vendemos datos a terceros.</li>
        <li>No accedemos a tu Gmail desde la web ni desde el servidor MCP.</li>
      </ul>

      <h2>Tus derechos y cómo ejercerlos</h2>
      <p>
        Como todo está en tu cuenta de Google, los ejerces tú mismo y al instante: borra la Sheet y desaparecen tus datos; revoca el acceso de Luca y del script
        en <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>; desconecta la IA o el iPhone desde el menú Luca de tu Sheet.
        Para cualquier otra consulta escribe al correo de contacto.
      </p>

      <h2>Cambios</h2>
      <p>Si esta política cambia, actualizaremos la fecha de arriba. Los cambios de arquitectura relevantes se documentan públicamente en las decisiones del proyecto.</p>

      <p><Link href="/terminos">Términos de uso</Link> · <Link href="/">Inicio</Link></p>
    </LegalLayout>
  );
}
