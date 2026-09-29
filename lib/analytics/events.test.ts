import { describe, expect, it } from "vitest"
import {
  eventoAlertaAbierta,
  eventoAlertaMostrada,
  eventoAlertaResuelta,
  eventoLogin,
  eventoNotificacionClick,
  eventoNuevasAlertasVistas,
  eventoOficinaAlertaAbierta,
  eventoOficinaCampanaAbierta,
  eventoOficinaNotificacionClick,
  eventoPushCambiado,
} from "@/lib/analytics/events"

/**
 * G8: pure payload builders -- every event carries `participante` and
 * `vista` (planta/oficina), never touches posthog-js directly (that is
 * lib/analytics/posthog-client.ts's job), so this file is trivially unit
 * testable and cannot silently drop a field.
 */

const BASE = { participante: "P3", vista: "planta" as const }

describe("eventoAlertaMostrada", () => {
  it("builds alerta_mostrada with the base fields plus alert context", () => {
    const evento = eventoAlertaMostrada(BASE, {
      alertaId: "a1",
      severidad: "parar",
      linea: "Línea 3 · Motores",
      posicion: 0,
    })
    expect(evento).toEqual({
      name: "alerta_mostrada",
      properties: {
        participante: "P3",
        vista: "planta",
        alerta_id: "a1",
        severidad: "parar",
        linea: "Línea 3 · Motores",
        posicion: 0,
      },
    })
  })
})

describe("eventoAlertaAbierta", () => {
  it("builds alerta_abierta with ms_desde_mostrada", () => {
    const evento = eventoAlertaAbierta(BASE, { alertaId: "a1", msDesdeMostrada: 4200 })
    expect(evento).toEqual({
      name: "alerta_abierta",
      properties: { participante: "P3", vista: "planta", alerta_id: "a1", ms_desde_mostrada: 4200 },
    })
  })

  it("ms_desde_mostrada can be null (alert never seen via the poll strip)", () => {
    const evento = eventoAlertaAbierta(BASE, { alertaId: "a1", msDesdeMostrada: null })
    expect(evento.properties.ms_desde_mostrada).toBeNull()
  })
})

describe("eventoAlertaResuelta", () => {
  it("builds alerta_atendida for 'atendida'", () => {
    const evento = eventoAlertaResuelta("atendida", BASE, {
      alertaId: "a1",
      msDesdeAbierta: 19100,
      msDesdeMostrada: 23300,
    })
    expect(evento.name).toBe("alerta_atendida")
    expect(evento.properties).toEqual({
      participante: "P3",
      vista: "planta",
      alerta_id: "a1",
      ms_desde_abierta: 19100,
      ms_desde_mostrada: 23300,
    })
  })

  it("builds alerta_no_aplica for 'no_aplica'", () => {
    const evento = eventoAlertaResuelta("no_aplica", BASE, {
      alertaId: "a1",
      msDesdeAbierta: 1000,
      msDesdeMostrada: 2000,
    })
    expect(evento.name).toBe("alerta_no_aplica")
  })
})

describe("eventoNuevasAlertasVistas", () => {
  it("builds nuevas_alertas_vistas with the dismissed count", () => {
    const evento = eventoNuevasAlertasVistas(BASE, { cantidad: 2 })
    expect(evento).toEqual({
      name: "nuevas_alertas_vistas",
      properties: { participante: "P3", vista: "planta", cantidad: 2 },
    })
  })
})

describe("eventoLogin", () => {
  it("builds login with the line", () => {
    const evento = eventoLogin(BASE, { linea: "Línea 3 · Motores" })
    expect(evento).toEqual({
      name: "login",
      properties: { participante: "P3", vista: "planta", linea: "Línea 3 · Motores" },
    })
  })
})

describe("eventoOficinaAlertaAbierta", () => {
  it("builds oficina_alerta_abierta with origen", () => {
    const evento = eventoOficinaAlertaAbierta(
      { participante: "P3", vista: "oficina" },
      { alertaId: "a1", origen: "push" },
    )
    expect(evento).toEqual({
      name: "oficina_alerta_abierta",
      properties: { participante: "P3", vista: "oficina", alerta_id: "a1", origen: "push" },
    })
  })

  it("origen defaults to 'tabla' when not from a push click", () => {
    const evento = eventoOficinaAlertaAbierta({ participante: "P3", vista: "oficina" }, { alertaId: "a1" })
    expect(evento.properties.origen).toBe("tabla")
  })
})

describe("eventoPushCambiado", () => {
  it("builds push_activado when activo is true", () => {
    const evento = eventoPushCambiado({ participante: "P3", vista: "oficina" }, true)
    expect(evento.name).toBe("push_activado")
  })

  it("builds push_desactivado when activo is false", () => {
    const evento = eventoPushCambiado({ participante: "P3", vista: "oficina" }, false)
    expect(evento.name).toBe("push_desactivado")
  })
})

describe("eventoNotificacionClick", () => {
  it("builds notificacion_click with the alert id", () => {
    const evento = eventoNotificacionClick({ participante: "P3", vista: "oficina" }, { alertaId: "a1" })
    expect(evento).toEqual({
      name: "notificacion_click",
      properties: { participante: "P3", vista: "oficina", alerta_id: "a1" },
    })
  })
})

describe("eventoOficinaCampanaAbierta (G9)", () => {
  it("builds oficina_campana_abierta with no extra properties", () => {
    const evento = eventoOficinaCampanaAbierta({ participante: "P3", vista: "oficina" })
    expect(evento).toEqual({
      name: "oficina_campana_abierta",
      properties: { participante: "P3", vista: "oficina" },
    })
  })
})

describe("eventoOficinaNotificacionClick (G9)", () => {
  it("builds oficina_notificacion_click with the alert id and desde='campana'", () => {
    const evento = eventoOficinaNotificacionClick({ participante: "P3", vista: "oficina" }, { alertaId: "a1" })
    expect(evento).toEqual({
      name: "oficina_notificacion_click",
      properties: { participante: "P3", vista: "oficina", alerta_id: "a1", desde: "campana" },
    })
  })
})
