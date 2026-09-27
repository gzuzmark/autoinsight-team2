import Link from "next/link"
import { Building2, Monitor } from "lucide-react"

// Screen 00 (selector de vista): the tablet's entry point, so it follows the
// floor design rules (D11/D12) like the rest of `/planta` -- readable text
// >= 24px, touch targets >= 88px, no opacity/alpha, no motion effects, no
// muted/gray text (O-D3). It links to the two independent apps: `/oficina`
// (desk view, not floor-rule constrained) and `/planta` (the existing
// tablet floor app, unchanged).
export default function SelectorPage() {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center gap-8 bg-neutral-100 px-6 py-16 text-neutral-900">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-2xl font-black text-indigo-700">AutoInsight</span>
        <h1 className="text-5xl font-black text-neutral-900">¿Cómo vas a trabajar hoy?</h1>
        <p className="max-w-225 text-2xl font-semibold text-neutral-900">
          Elige la vista según dónde estás. Puedes cambiarla después desde el encabezado.
        </p>
      </div>

      <div className="grid w-full max-w-225 grid-cols-1 gap-6 md:grid-cols-2">
        <OpcionVista
          href="/oficina"
          titulo="AutoInsight Oficina"
          descripcion="Análisis completo sentado en tu escritorio: tendencias, Pareto de defectos, causa raíz, garantías y reportes."
          puntos={["Varias plantas y líneas, filtros y períodos", "Gráficos, tablas y comparativas", "Reportes programados y exportación"]}
          etiquetaBoton="Entrar a Oficina"
          Icono={Monitor}
          tono="claro"
        />
        <OpcionVista
          href="/planta"
          titulo="AutoInsight Planta"
          descripcion="Un vistazo de 5 segundos en la tablet del piso, con guantes y reflejos: ¿mi línea está bien o mal?"
          puntos={["Estado por color, forma y palabra", "Botones grandes, sin scroll", "Atendida / No aplica en un toque"]}
          etiquetaBoton="Entrar a Planta"
          Icono={Building2}
          tono="oscuro"
        />
      </div>
    </main>
  )
}

function OpcionVista({
  href,
  titulo,
  descripcion,
  puntos,
  etiquetaBoton,
  Icono,
  tono,
}: {
  href: string
  titulo: string
  descripcion: string
  puntos: string[]
  etiquetaBoton: string
  Icono: typeof Monitor
  tono: "claro" | "oscuro"
}) {
  const esOscuro = tono === "oscuro"
  return (
    <div
      className={
        esOscuro
          ? "flex flex-col gap-5 rounded-2xl border-4 border-neutral-900 bg-neutral-900 p-6"
          : "flex flex-col gap-5 rounded-2xl border-4 border-indigo-700 bg-white p-6"
      }
    >
      <span
        aria-hidden
        className={
          esOscuro
            ? "flex size-14 items-center justify-center rounded-xl bg-amber-500 text-neutral-900"
            : "flex size-14 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"
        }
      >
        <Icono className="size-8" strokeWidth={2.5} />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className={esOscuro ? "text-2xl font-black text-white" : "text-2xl font-black text-neutral-900"}>
          {titulo}
        </h2>
        <p className={esOscuro ? "text-2xl font-semibold text-white" : "text-2xl font-semibold text-neutral-900"}>
          {descripcion}
        </p>
      </div>
      <ul className="flex flex-col gap-1">
        {puntos.map((punto) => (
          <li key={punto} className={esOscuro ? "text-2xl font-semibold text-white" : "text-2xl font-semibold text-neutral-900"}>
            • {punto}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={
          esOscuro
            ? "flex min-h-22 w-full items-center justify-center rounded-2xl bg-amber-500 px-6 text-2xl font-black text-neutral-900"
            : "flex min-h-22 w-full items-center justify-center rounded-2xl bg-indigo-700 px-6 text-2xl font-black text-white"
        }
      >
        {etiquetaBoton}
      </Link>
    </div>
  )
}
