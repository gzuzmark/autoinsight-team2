import { describe, expect, it } from "vitest"
import { payloadANotificacion, rutaParaCoincidenciaCliente, urlDeNotificacion } from "@/lib/push/sw-helpers"

describe("payloadANotificacion", () => {
  it("maps a well-formed payload to a title and notification options", () => {
    const { titulo, opciones } = payloadANotificacion({
      title: "Alerta ALTA · Línea 3",
      body: "Torque fuera de rango",
      tag: "alerta-1",
      url: "/oficina/alertas/1",
    })
    expect(titulo).toBe("Alerta ALTA · Línea 3")
    expect(opciones).toEqual({
      body: "Torque fuera de rango",
      tag: "alerta-1",
      renotify: true,
      data: { url: "/oficina/alertas/1" },
    })
  })

  it("degrades every missing field to a safe default instead of throwing", () => {
    const { titulo, opciones } = payloadANotificacion({})
    expect(titulo).toBe("AutoInsight")
    expect(opciones.body).toBe("")
    expect(opciones.data.url).toBe("/oficina")
  })

  it("push fix (b): renotify is always true so a repeat push for the same alert (same tag) re-alerts the user instead of silently replacing the notification", () => {
    const primero = payloadANotificacion({ tag: "alerta-1" })
    const repetido = payloadANotificacion({ tag: "alerta-1" })
    expect(primero.opciones.renotify).toBe(true)
    expect(repetido.opciones.renotify).toBe(true)
    expect(primero.opciones.tag).toBe(repetido.opciones.tag)
  })
})

describe("urlDeNotificacion", () => {
  it("reads the url from a well-formed data object", () => {
    expect(urlDeNotificacion({ url: "/oficina/alertas/1" })).toBe("/oficina/alertas/1")
  })

  it("falls back to the office root for null/undefined/malformed data", () => {
    expect(urlDeNotificacion(null)).toBe("/oficina")
    expect(urlDeNotificacion(undefined)).toBe("/oficina")
    expect(urlDeNotificacion({})).toBe("/oficina")
    expect(urlDeNotificacion({ url: 123 })).toBe("/oficina")
    expect(urlDeNotificacion("not an object")).toBe("/oficina")
  })
})

describe("rutaParaCoincidenciaCliente (G8: ?origen=push must not break client-matching)", () => {
  it("strips a query string so an already-open tab still matches", () => {
    expect(rutaParaCoincidenciaCliente("/oficina/alertas/a1?origen=push")).toBe("/oficina/alertas/a1")
  })

  it("a url with no query string is unchanged", () => {
    expect(rutaParaCoincidenciaCliente("/oficina/alertas/a1")).toBe("/oficina/alertas/a1")
  })
})
