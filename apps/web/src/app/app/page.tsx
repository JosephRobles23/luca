import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import Workspace from "@/components/Workspace";

export default async function AppPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.error === "RefreshTokenError" || !session.accessToken) {
    // El refresh falló (p. ej. permiso revocado): forzamos re-login.
    return (
      <main className="mx-auto max-w-xl px-4 py-24">
        <p>Tu sesión con Google caducó o el permiso fue revocado.</p>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
          <button className="btn primary mt-4">Volver a entrar</button>
        </form>
      </main>
    );
  }

  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_PICKER_KEY ?? "",
    appId: process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "",
    templateId: process.env.NEXT_PUBLIC_TEMPLATE_SHEET_ID ?? "",
  };

  return (
    <Workspace
      accessToken={session.accessToken}
      user={{ name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? "" }}
      cfg={cfg}
      signOutAction={async () => { "use server"; await signOut({ redirectTo: "/" }); }}
    />
  );
}
