import AgregarMovimiento from "@/components/AgregarMovimiento";
import PageTransition from "@/components/PageTransition";

export const metadata = { title: "Agregar movimiento" };

export default function AgregarPage() {
  return <PageTransition><AgregarMovimiento /></PageTransition>;
}
