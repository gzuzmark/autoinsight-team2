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
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-10">
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tight text-neutral-900">
          Alertas de calidad
        </h1>
        <p className="mt-2 text-2xl font-semibold text-neutral-900">
          Toca tu foto para ingresar
        </p>
      </div>

      <ul className="grid grid-cols-3 gap-6">
        {usuarios.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => onSeleccionar(u)}
              className="flex min-h-24 w-70 items-center gap-5 rounded-2xl border-4 border-neutral-300 bg-white p-5 text-left"
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
