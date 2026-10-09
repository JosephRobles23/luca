import { formatStars, getStars, GITHUB_URL } from "@/lib/github";
import { IconGitHub, IconEstrella } from "./icons";

/** Enlace al repo con el contador de estrellas (componente de servidor; sin número si GitHub no responde). */
export default async function GitHubStars() {
  const stars = await getStars();
  return (
    <a className="btn ghost sm gap-1.5" href={GITHUB_URL} target="_blank" rel="noreferrer"
      aria-label={stars === null ? "Código de Luca en GitHub" : `Código de Luca en GitHub, ${stars} estrellas`} title="Ver el código en GitHub">
      <IconGitHub size={16} />
      {stars !== null && <span className="num inline-flex items-center gap-1"><IconEstrella size={13} />{formatStars(stars)}</span>}
    </a>
  );
}
