import type { Resolucion, Tablero, UsuarioLogin } from "@/lib/domain/floor-repository"

/**
 * Typed fetch module (T9, D3/D22: no TanStack Query -- manual refresh only).
 * Client-side only: never imports "server-only", never reads env vars, never
 * knows a PIN once entered (it only relays it once, over the wire, to
 * `/api/sesion`).
 */

export type LoginResult = { ok: true } | { ok: false; status: number; message: string }

/** E4: carries the HTTP status alongside the message, so a caller (the
 * polling tick, in particular) can tell a 401 (expired/invalid session --
 * "return to login cleanly") apart from any other failure (transient
 * network/server error -- keep showing the last good tablero). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
      return (body as { error: string }).error
    }
  } catch {
    // fall through to the generic message
  }
  return fallback
}

async function getJson<T>(url: string, fallbackError: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new ApiError(res.status, await readErrorMessage(res, fallbackError))
  return res.json() as Promise<T>
}

async function postJson<T>(url: string, body: unknown, fallbackError: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(res.status, await readErrorMessage(res, fallbackError))
  return res.json() as Promise<T>
}

export const api = {
  usuarios(): Promise<UsuarioLogin[]> {
    return getJson<UsuarioLogin[]>("/api/usuarios", "No se pudo cargar la lista de personas.")
  },

  async login(usuarioId: string, pin: string): Promise<LoginResult> {
    const res = await fetch("/api/sesion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ usuarioId, pin }),
    })
    if (res.status === 204) return { ok: true }
    const message = await readErrorMessage(res, "No se pudo iniciar sesión.")
    return { ok: false, status: res.status, message }
  },

  async logout(): Promise<void> {
    await fetch("/api/sesion", { method: "DELETE" })
  },

  tablero(): Promise<Tablero> {
    return getJson<Tablero>("/api/tablero", "No se pudo cargar el tablero.")
  },

  resolver(alertaId: string, resolucion: Resolucion): Promise<Tablero> {
    return postJson<Tablero>(
      `/api/alertas/${encodeURIComponent(alertaId)}/resolver`,
      { resolucion },
      "No se pudo actualizar la alerta.",
    )
  },
}
