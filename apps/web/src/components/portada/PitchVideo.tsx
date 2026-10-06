"use client";

/**
 * Sección "En 2 minutos": el pitch animado (video/film.js) en un reproductor con portada propia. El reproductor
 * entra con el scroll (se endereza desde una inclinación 3D), lo recorre un borde de luz y el botón late; los
 * capítulos saltan a cada escena y marcan la que suena. El MP4 vive en R2 y solo se descarga al darle play.
 * Sin JavaScript quedan los controles nativos y los capítulos abren el MP4 en ese segundo (#t=).
 */
import { useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { PITCH_CHAPTERS, PITCH_VIDEO, capituloActivo, mmss } from "@/lib/pitch-video";
import { SectionHead } from "./DataPath";
import s from "./portada.module.css";

const noop = () => () => {};

export function PitchVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const [playing, setPlaying] = useState(false);
  const [on, setOn] = useState(-1);

  const play = (t?: number) => {
    const v = video.current;
    if (!v) return;
    setPlaying(true);
    if (t != null) {
      if (v.readyState > 0) v.currentTime = t;
      else v.addEventListener("loadedmetadata", () => { v.currentTime = t; }, { once: true });
      v.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    void v.play().catch(() => setPlaying(false));
  };

  return (
    <section id="video" aria-labelledby="video-h" className="scroll-mt-24 pt-20 sm:pt-[88px]">
      <div className="grid justify-items-center text-center [&>div]:justify-items-center">
        <SectionHead eyebrow="En 2 minutos" id="video-h" title="Mira cómo funciona, de principio a fin.">
          Un yapeo que llega al iPhone, tu Sheet como base de datos, la web que solo la muestra y tu IA respondiendo. Sin servidores de por medio.
        </SectionHead>
      </div>

      <div className={`${s.cineStage} mt-9`}>
        <div className={s.cine} data-playing={playing}>
          <div className={s.cineFrame}>
            <video
              ref={video}
              src={PITCH_VIDEO.src}
              poster={PITCH_VIDEO.poster}
              preload="none"
              playsInline
              controls={!hydrated || playing}
              aria-label={`${PITCH_VIDEO.name}, ${mmss(PITCH_VIDEO.seconds)}`}
              onTimeUpdate={(e) => setOn(capituloActivo(e.currentTarget.currentTime))}
              onEnded={() => setOn(-1)}
            />
            <button type="button" className={s.cinePlay} hidden={!hydrated} onClick={() => play()} aria-label={`Reproducir: ${PITCH_VIDEO.name}`}>
              <span className={s.cineBtn} aria-hidden>
                <svg viewBox="0 0 24 24"><path d="M7 4.5v15L19.5 12z" /></svg>
              </span>
              <span className={s.cineMeta}><span>Pitch</span><b>Tus finanzas, en tu Google</b></span>
              <span className={s.cineDur}>{mmss(PITCH_VIDEO.seconds)}</span>
            </button>
          </div>
        </div>
      </div>

      <ol className={`${s.chapters} mt-7`} aria-label="Capítulos del video">
        {PITCH_CHAPTERS.map((c, i) => (
          <li key={c.t} style={{ "--i": i } as CSSProperties}>
            <a
              href={`${PITCH_VIDEO.src}#t=${c.t}`}
              data-on={on === i}
              aria-current={on === i ? "true" : undefined}
              onClick={(e) => { e.preventDefault(); play(c.t); }}
            >
              <span className={s.chapterT}>{mmss(c.t)}</span>{c.label}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
