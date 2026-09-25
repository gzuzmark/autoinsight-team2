import { describe, expect, it } from "vitest"
import { ordenarAlertas, type Alerta } from "@/lib/mock-data"
import {
  activeAlerts,
  attendAlert,
  changesSinceLastVisit,
  dismissAlert,
  mergeShiftAlerts,
  sortAlerts,
} from "./alerts"

function makeAlert(overrides: Partial<Alerta>): Alerta {
  return {
    id: "id",
    severidad: "ok",
    titulo: "titulo",
    estacion: "estacion",
    timestamp: 0,
    estado: "nueva",
    ...overrides,
  }
}

/** Recursively freezes an object so any accidental mutation throws in strict-mode test code. */
function deepFreeze<T>(value: T): T {
  Object.getOwnPropertyNames(value as object).forEach((key) => {
    const child = (value as Record<string, unknown>)[key]
    if (child && (typeof child === "object" || typeof child === "function") && !Object.isFrozen(child)) {
      deepFreeze(child)
    }
  })
  return Object.freeze(value)
}

describe("sortAlerts", () => {
  it("orders by severity rank: parar > atencion > ok", () => {
    const parar = deepFreeze(makeAlert({ id: "p", severidad: "parar", timestamp: 100 }))
    const atencion = deepFreeze(makeAlert({ id: "a", severidad: "atencion", timestamp: 100 }))
    const ok = deepFreeze(makeAlert({ id: "o", severidad: "ok", timestamp: 100 }))
    const input = deepFreeze([ok, atencion, parar])

    const result = sortAlerts(input)

    expect(result.map((a) => a.id)).toEqual(["p", "a", "o"])
  })

  it("breaks ties within the same severity by newest timestamp first", () => {
    const older = deepFreeze(makeAlert({ id: "older", severidad: "parar", timestamp: 10 }))
    const newer = deepFreeze(makeAlert({ id: "newer", severidad: "parar", timestamp: 20 }))
    const input = deepFreeze([older, newer])

    const result = sortAlerts(input)

    expect(result.map((a) => a.id)).toEqual(["newer", "older"])
  })

  it("is stable for exact severity+timestamp ties, preserving input order", () => {
    const first = deepFreeze(makeAlert({ id: "first", severidad: "ok", timestamp: 5 }))
    const second = deepFreeze(makeAlert({ id: "second", severidad: "ok", timestamp: 5 }))
    const third = deepFreeze(makeAlert({ id: "third", severidad: "ok", timestamp: 5 }))
    const input = deepFreeze([first, second, third])

    const result = sortAlerts(input)

    expect(result.map((a) => a.id)).toEqual(["first", "second", "third"])
  })

  it("does not mutate the input array or its elements", () => {
    const a1 = deepFreeze(makeAlert({ id: "a1", severidad: "ok", timestamp: 1 }))
    const a2 = deepFreeze(makeAlert({ id: "a2", severidad: "parar", timestamp: 2 }))
    const input = deepFreeze([a1, a2])
    const inputSnapshot = JSON.parse(JSON.stringify(input))

    const result = sortAlerts(input)

    expect(input).toEqual(inputSnapshot)
    expect(result).not.toBe(input)
  })
})

describe("activeAlerts", () => {
  it("keeps only alerts with estado 'nueva', sorted", () => {
    const nueva1 = makeAlert({ id: "n1", severidad: "ok", estado: "nueva", timestamp: 1 })
    const atendida = makeAlert({ id: "at", severidad: "parar", estado: "atendida", timestamp: 5 })
    const nueva2 = makeAlert({ id: "n2", severidad: "parar", estado: "nueva", timestamp: 3 })
    const input = deepFreeze([nueva1, atendida, nueva2])

    const result = activeAlerts(input)

    expect(result.map((a) => a.id)).toEqual(["n2", "n1"])
  })

  it("returns an empty array when nothing is active", () => {
    const input = deepFreeze([makeAlert({ id: "at", estado: "atendida" })])

    expect(activeAlerts(input)).toEqual([])
  })

  it("excludes alerts with estado 'no_aplica'", () => {
    const input = deepFreeze([makeAlert({ id: "na", estado: "no_aplica" })])

    expect(activeAlerts(input)).toEqual([])
  })
})

describe("attendAlert", () => {
  it("sets estado to 'atendida' for the matching id", () => {
    const target = makeAlert({ id: "target", estado: "nueva" })
    const other = makeAlert({ id: "other", estado: "nueva" })
    const input = deepFreeze([target, other])

    const result = attendAlert(input, "target")

    expect(result.find((a) => a.id === "target")?.estado).toBe("atendida")
    expect(result.find((a) => a.id === "other")?.estado).toBe("nueva")
  })

  it("does not mutate the input array or its elements", () => {
    const target = deepFreeze(makeAlert({ id: "target", estado: "nueva" }))
    const input = deepFreeze([target])

    attendAlert(input, "target")

    expect(input[0].estado).toBe("nueva")
  })

  it("returns the SAME array reference for an unknown id (no-op)", () => {
    const input = deepFreeze([makeAlert({ id: "known", estado: "nueva" })])

    const result = attendAlert(input, "unknown")

    expect(result).toBe(input)
  })

  it("returns the SAME array reference when the alert is already attended (no-op)", () => {
    const input = deepFreeze([makeAlert({ id: "target", estado: "atendida" })])

    const result = attendAlert(input, "target")

    expect(result).toBe(input)
  })
})

describe("dismissAlert", () => {
  it("sets estado to 'no_aplica' for the matching id", () => {
    const target = makeAlert({ id: "target", estado: "nueva" })
    const other = makeAlert({ id: "other", estado: "nueva" })
    const input = deepFreeze([target, other])

    const result = dismissAlert(input, "target")

    expect(result.find((a) => a.id === "target")?.estado).toBe("no_aplica")
    expect(result.find((a) => a.id === "other")?.estado).toBe("nueva")
  })

  it("does not mutate the input array or its elements", () => {
    const target = deepFreeze(makeAlert({ id: "target", estado: "nueva" }))
    const input = deepFreeze([target])

    dismissAlert(input, "target")

    expect(input[0].estado).toBe("nueva")
  })

  it("returns the SAME array reference for an unknown id (no-op)", () => {
    const input = deepFreeze([makeAlert({ id: "known", estado: "nueva" })])

    const result = dismissAlert(input, "unknown")

    expect(result).toBe(input)
  })

  it("returns the SAME array reference when the alert is already 'no_aplica' (no-op)", () => {
    const input = deepFreeze([makeAlert({ id: "target", estado: "no_aplica" })])

    const result = dismissAlert(input, "target")

    expect(result).toBe(input)
  })
})

describe("changesSinceLastVisit", () => {
  it("returns [] when seenIds is undefined (first visit)", () => {
    const input = deepFreeze([makeAlert({ id: "n1", estado: "nueva" })])

    expect(changesSinceLastVisit(input, undefined)).toEqual([])
  })

  it("returns [] when there are no new active alerts since last visit", () => {
    const input = deepFreeze([makeAlert({ id: "n1", estado: "nueva" })])

    expect(changesSinceLastVisit(input, ["n1"])).toEqual([])
  })

  it("returns only active alerts whose id is not in seenIds, sorted", () => {
    const seen = makeAlert({ id: "seen", severidad: "ok", estado: "nueva", timestamp: 1 })
    const newParar = makeAlert({ id: "new-parar", severidad: "parar", estado: "nueva", timestamp: 2 })
    const newOk = makeAlert({ id: "new-ok", severidad: "ok", estado: "nueva", timestamp: 3 })
    const input = deepFreeze([seen, newParar, newOk])

    const result = changesSinceLastVisit(input, ["seen"])

    expect(result.map((a) => a.id)).toEqual(["new-parar", "new-ok"])
  })

  it("excludes attended alerts even if their id is unseen", () => {
    const attended = makeAlert({ id: "attended-unseen", estado: "atendida" })
    const input = deepFreeze([attended])

    expect(changesSinceLastVisit(input, [])).toEqual([])
  })
})

describe("mergeShiftAlerts", () => {
  it("stamps incoming alerts not already present with 'now' and includes them in 'added'", () => {
    const existing = makeAlert({ id: "e1", severidad: "ok", timestamp: 1 })
    const incoming = makeAlert({ id: "new1", severidad: "parar", timestamp: 999 })
    const input = deepFreeze([existing])
    const now = 42

    const { alerts, added } = mergeShiftAlerts(input, [incoming], now)

    const addedAlert = alerts.find((a) => a.id === "new1")
    expect(addedAlert?.timestamp).toBe(now)
    expect(added).toHaveLength(1)
    expect(added[0].id).toBe("new1")
    expect(added[0].timestamp).toBe(now)
  })

  it("dedupes incoming alerts whose id is already present", () => {
    const existing = makeAlert({ id: "dup", severidad: "ok", timestamp: 1 })
    const incoming = makeAlert({ id: "dup", severidad: "parar", timestamp: 999 })
    const input = deepFreeze([existing])

    const { alerts, added } = mergeShiftAlerts(input, [incoming], 100)

    expect(alerts).toHaveLength(1)
    expect(alerts[0].timestamp).toBe(1)
    expect(added).toEqual([])
  })

  it("returns the result sorted", () => {
    const existing = makeAlert({ id: "e1", severidad: "ok", timestamp: 1 })
    const incoming = makeAlert({ id: "new1", severidad: "parar", timestamp: 0 })
    const input = deepFreeze([existing])

    const { alerts } = mergeShiftAlerts(input, [incoming], 500)

    expect(alerts.map((a) => a.id)).toEqual(["new1", "e1"])
  })

  it("no additions: 'added' is [] and 'alerts' is the SAME input reference", () => {
    const existing = makeAlert({ id: "e1", severidad: "ok", timestamp: 1 })
    const incomingDuplicate = makeAlert({ id: "e1", severidad: "parar", timestamp: 999 })
    const input = deepFreeze([existing])

    const { alerts, added } = mergeShiftAlerts(input, [incomingDuplicate], 100)

    expect(alerts).toBe(input)
    expect(added).toEqual([])
  })

  it("does not mutate the input or incoming arrays", () => {
    const existing = deepFreeze(makeAlert({ id: "e1", timestamp: 1 }))
    const incoming = deepFreeze(makeAlert({ id: "new1", timestamp: 999 }))
    const input = deepFreeze([existing])
    const incomingArr = deepFreeze([incoming])

    mergeShiftAlerts(input, incomingArr, 100)

    expect(input[0].timestamp).toBe(1)
    expect(incomingArr[0].timestamp).toBe(999)
  })

  it("dedupes ids repeated inside 'incoming' itself, keeping the first occurrence", () => {
    const first = makeAlert({ id: "dup", severidad: "parar", titulo: "primero", timestamp: 1 })
    const second = makeAlert({ id: "dup", severidad: "ok", titulo: "segundo", timestamp: 2 })
    const input = deepFreeze([] as Alerta[])

    const { alerts, added } = mergeShiftAlerts(input, [first, second], 500)

    expect(alerts).toHaveLength(1)
    expect(alerts[0].titulo).toBe("primero")
    expect(alerts[0].timestamp).toBe(500)
    expect(added).toHaveLength(1)
    expect(added[0].titulo).toBe("primero")
  })
})

describe("ordenarAlertas (re-export)", () => {
  it("orders alerts the same way sortAlerts does", () => {
    const parar = makeAlert({ id: "p", severidad: "parar", timestamp: 100 })
    const atencion = makeAlert({ id: "a", severidad: "atencion", timestamp: 100 })
    const ok = makeAlert({ id: "o", severidad: "ok", timestamp: 100 })
    const input = deepFreeze([ok, atencion, parar])

    expect(ordenarAlertas(input)).toEqual(sortAlerts(input))
  })
})
