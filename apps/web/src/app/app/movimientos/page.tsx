import Movimientos from "@/components/Movimientos";
import PageTransition from "@/components/PageTransition";

export const metadata = { title: "Movimientos" };

export default function MovimientosPage() {
  return <PageTransition><Movimientos /></PageTransition>;
}
