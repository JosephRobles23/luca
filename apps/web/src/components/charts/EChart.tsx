"use client";

/**
 * Gráfico de ECharts (SVG) que sigue el tema de Luca: lee los tokens de globals.css en cada dibujo y redibuja al
 * cambiar `data-theme` o el tema del sistema, y al cambiar de tamaño. Solo registra los gráficos que usa el Resumen.
 * `build` debe ser estable (useCallback) para no redibujar en cada render.
 */
import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, RadarChart } from "echarts/charts";
import { GridComponent, MarkPointComponent, RadarComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

echarts.use([BarChart, LineChart, PieChart, RadarChart, GridComponent, MarkPointComponent, RadarComponent, TooltipComponent, SVGRenderer]);

/** Opciones de ECharts como objeto literal (sus tipos estrictos no aportan aquí y obligan a castear cada campo). */
export type ChartOption = Record<string, unknown>;
export type ChartTheme = {
  ink: string; body: string; muted: string; card: string; strong: string; grid: string; axis: string;
  s1: string; s2: string; s3: string; primary2: string; font: string; mono: string;
  /** Sin animaciones (prefers-reduced-motion). */
  still: boolean;
  /** Color resuelto de una variable CSS (p. ej. los pasteles de categoría). */
  cssVar: (name: string) => string;
};

function readTheme(): ChartTheme {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    ink: v("--ink"), body: v("--body"), muted: v("--muted"), card: v("--card"), strong: v("--strong"),
    grid: v("--chart-grid"), axis: v("--chart-axis"), s1: v("--chart-1"), s2: v("--chart-2"), s3: v("--chart-3"), primary2: v("--primary-2"),
    font: getComputedStyle(document.body).fontFamily || "system-ui, sans-serif",
    mono: `${v("--font-geist-mono") || ""}, ui-monospace, monospace`.replace(/^, /, ""),
    still: matchMedia("(prefers-reduced-motion: reduce)").matches,
    cssVar: v,
  };
}

/** Tooltip común: tarjeta del tema con borde fino y radio 10. */
export function tooltipBase(T: ChartTheme) {
  return {
    backgroundColor: T.card, borderColor: T.axis, borderWidth: 1, padding: [8, 10],
    textStyle: { color: T.ink, fontFamily: T.font, fontSize: 12 },
    extraCssText: "border-radius:10px;box-shadow:0 8px 24px rgb(0 0 0 / .12);",
  };
}

/** Color con transparencia a partir de un hex de 6 dígitos (para degradados de área). */
export const alpha = (hex: string, a: number) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex + Math.round(a * 255).toString(16).padStart(2, "0") : hex);

type Props = {
  build: (t: ChartTheme) => ChartOption;
  className?: string;
  ariaLabel: string;
  /** Gráficos con el mismo grupo comparten puntero y tooltip (p. ej. acumulado + diario). */
  group?: string;
  onClick?: (p: { name: string; dataIndex: number; seriesName?: string }) => void;
  testId?: string;
};

export default function EChart({ build, className, ariaLabel, group, onClick, testId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [themeKey, setThemeKey] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const c = echarts.init(el, null, { renderer: "svg" });
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el);
    const bump = () => setThemeKey((k) => k + 1);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", bump);
    return () => { ro.disconnect(); mo.disconnect(); mq.removeEventListener("change", bump); c.dispose(); chart.current = null; };
  }, []);

  useEffect(() => {
    chart.current?.setOption(build(readTheme()) as echarts.EChartsCoreOption, true);
    // El contenedor ya describe el gráfico (aria-label); el <svg> interno no debe contar como otra imagen.
    ref.current?.querySelector("svg")?.setAttribute("aria-hidden", "true");
  }, [build, themeKey]);

  useEffect(() => {
    const c = chart.current;
    if (!c || !group) return;
    c.group = group;
    echarts.connect(group);
  }, [group]);

  useEffect(() => {
    const c = chart.current;
    if (!c || !onClick) return;
    const h = (p: unknown) => onClick(p as { name: string; dataIndex: number; seriesName?: string });
    c.on("click", h);
    return () => { if (!c.isDisposed()) c.off("click", h); };
  }, [onClick]);

  return <div ref={ref} className={className} role="img" aria-label={ariaLabel} data-testid={testId} />;
}
