import { describe, expect, it } from "vitest"
import { formatearMensajeEscenario, formatearMensajeTurno } from "@/lib/backoffice/mensajes-turno"

describe("formatearMensajeTurno", () => {
  it("returns null when the shift generated no message-worthy outcome (correo omitido, push omitido)", () => {
    expect(formatearMensajeTurno("omitido", "omitido")).toBeNull()
    expect(formatearMensajeTurno(undefined, undefined)).toBeNull()
  })

  it("reports the email outcome alone when push is omitido", () => {
    expect(formatearMensajeTurno("enviado", "omitido")).toBe("Turno simulado · reporte enviado")
    expect(formatearMensajeTurno("error", "omitido")).toBe("Turno simulado · no se pudo enviar el reporte")
  })

  it("reports the push outcome alone when correo is omitido", () => {
    expect(formatearMensajeTurno("omitido", "enviado")).toBe("Turno simulado · push enviado")
    expect(formatearMensajeTurno("omitido", "sin_suscripciones")).toBe(
      "Turno simulado · sin navegadores suscritos para push",
    )
    expect(formatearMensajeTurno("omitido", "error")).toBe("Turno simulado · no se pudo enviar el push")
  })

  it("combines both outcomes when neither is omitido", () => {
    expect(formatearMensajeTurno("enviado", "enviado")).toBe("Turno simulado · reporte enviado · push enviado")
    expect(formatearMensajeTurno("error", "error")).toBe(
      "Turno simulado · no se pudo enviar el reporte · no se pudo enviar el push",
    )
  })
})

describe("formatearMensajeEscenario", () => {
  it("returns null when push is omitido (the scenario generated no ALTA alert)", () => {
    expect(formatearMensajeEscenario("omitido")).toBeNull()
    expect(formatearMensajeEscenario(undefined)).toBeNull()
  })

  it("reports each non-omitido push outcome", () => {
    expect(formatearMensajeEscenario("enviado")).toBe("push enviado")
    expect(formatearMensajeEscenario("sin_suscripciones")).toBe("sin navegadores suscritos para push")
    expect(formatearMensajeEscenario("error")).toBe("no se pudo enviar el push")
  })
})
