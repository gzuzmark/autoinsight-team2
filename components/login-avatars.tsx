"use client"

import { USUARIOS, type Usuario } from "@/lib/mock-data"

export function LoginAvatars({ onSeleccionar }: { onSeleccionar: (u: Usuario) => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-10">
      <div className="text-center">
        <h1 className="text-[40px] font-black tracking-tight text-neutral-900">
          Alertas de calidad
        </h1>
        <p className="mt-2 text-[22px] font-semibold text-neutral-600">
          Toca tu foto para ingresar
        </p>
      </div>

      <ul className="grid grid-cols-3 gap-6">
        {USUARIOS.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => onSeleccionar(u)}
              className="flex w-[280px] items-center gap-5 rounded-2xl border-4 border-neutral-300 bg-white p-5 text-left transition-colors active:border-neutral-900"
            >
              <span
                aria-hidden
                className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-[32px] font-black text-white"
                style={{ backgroundColor: u.color }}
              >
                {u.iniciales}
              </span>
              <span className="text-[24px] font-bold leading-tight text-neutral-900">
                {u.nombre}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
