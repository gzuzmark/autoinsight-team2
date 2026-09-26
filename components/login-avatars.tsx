"use client"

import type { UsuarioLogin } from "@/lib/domain/floor-repository"

export function LoginAvatars({
  usuarios,
  onSeleccionar,
}: {
  usuarios: UsuarioLogin[]
  onSeleccionar: (u: UsuarioLogin) => void
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4 py-10 kiosk:min-h-full kiosk:gap-10 kiosk:px-10 kiosk:py-0">
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tight text-neutral-900">
          Alertas de calidad
        </h1>
        <p className="mt-2 text-2xl font-semibold text-neutral-900">
          Toca tu foto para ingresar
        </p>
      </div>

      {/* E1/D27: 1 column on phones, 2 from md, 3 from lg -- independent of
          the kiosk no-scroll variant, so a wide-but-short screen (e.g. a
          laptop at 1512x790) still gets 3 columns. */}
      <ul className="grid w-full max-w-225 grid-cols-1 gap-4 md:grid-cols-2 kiosk:grid-cols-3 kiosk:gap-6">
        {usuarios.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => onSeleccionar(u)}
              className="flex min-h-24 w-full items-center gap-5 rounded-2xl border-4 border-neutral-300 bg-white p-5 text-left"
            >
              <span
                aria-hidden
                className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-3xl font-black text-white"
                style={{ backgroundColor: u.color }}
              >
                {u.iniciales}
              </span>
              <span className="text-2xl font-bold leading-tight text-neutral-900">
                {u.nombre}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
