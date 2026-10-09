import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, CLIENT_MODE, signOut } from "@/auth";
import AppShell from "@/components/AppShell";
import SignOutForm from "@/components/SignOutForm";

// Panel privado: fuera de buscadores aunque alguien enlace a una URL interna.
export const metadata: Metadata = { title: "Panel", robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.error === "RefreshTokenError" || !session.accessToken) {
    // El refresh falló (p. ej. permiso revocado): forzamos re-login.
    return (
      <main className="mx-auto max-w-xl px-4 py-24">
        <p>Tu sesión con Google caducó o el permiso fue revocado.</p>
        <SignOutForm action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
          <button className="btn primary mt-4">Volver a entrar</button>
        </SignOutForm>
      </main>
    );
  }

  const cfg = {
    mode: CLIENT_MODE,
    accessToken: session.accessToken,
    pickerKey: process.env.NEXT_PUBLIC_GOOGLE_PICKER_KEY ?? "",
    appId: process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "",
    templateId: process.env.NEXT_PUBLIC_TEMPLATE_SHEET_ID ?? "",
    templateFolderId: process.env.NEXT_PUBLIC_TEMPLATE_FOLDER_ID ?? "",
    libVersion: process.env.NEXT_PUBLIC_LUCA_LIB_VERSION ?? "",
  };

  return (
    <AppShell
      cfg={cfg}
      user={{ name: session.user.name ?? "", email: session.user.email ?? "", image: session.user.image ?? "" }}
      signOutAction={async () => { "use server"; await signOut({ redirectTo: "/" }); }}
    >
      {children}
    </AppShell>
  );
}
