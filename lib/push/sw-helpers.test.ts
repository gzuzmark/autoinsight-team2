import { describe, expect, it } from "vitest"
import { payloadANotificacion, urlDeNotificacion } from "@/lib/push/sw-helpers"

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
      data: { url: "/oficina/alertas/1" },
    })
  })

  it("degrades every missing field to a safe default instead of throwing", () => {
    const { titulo, opciones } = payloadANotificacion({})
    expect(titulo).toBe("AutoInsight")
    expect(opciones.body).toBe("")
    expect(opciones.data.url).toBe("/oficina")
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
