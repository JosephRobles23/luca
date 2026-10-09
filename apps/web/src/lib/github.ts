/** Repo público de Luca: enlace y contador de estrellas de la cabecera. */
export const GITHUB_REPO = "JosephRobles23/luca";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

/** 950 → "950", 1234 → "1.2k", 12000 → "12k". */
export function formatStars(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k < 10 ? Math.floor(k * 10) / 10 : Math.floor(k)}k`;
}

/** Estrellas del repo, cacheadas 1 h en el servidor (la API sin token permite 60 peticiones/h). null si falla. */
export async function getStars(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const { stargazers_count } = (await res.json()) as { stargazers_count?: unknown };
    return typeof stargazers_count === "number" ? stargazers_count : null;
  } catch {
    return null;
  }
}
