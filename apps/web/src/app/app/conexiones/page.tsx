import Conexiones from "@/components/Conexiones";
import PageTransition from "@/components/PageTransition";

export const metadata = { title: "Conexiones" };

export default function ConexionesPage() {
  return <PageTransition><Conexiones /></PageTransition>;
}
