export function TorqueChart({ serie, limite }: { serie: number[]; limite: number }) {
  const max = Math.max(...serie, limite) * 1.1
  return (
    <div className="flex h-40 items-end gap-2" role="img" aria-label={`Mediciones de torque, límite ${limite} Nm`}>
      {serie.map((valor, i) => (
        <div
          key={i}
          className={`w-full rounded-t-sm ${valor > limite ? "bg-red-500" : valor > limite * 0.9 ? "bg-amber-500" : "bg-indigo-600"}`}
          style={{ height: `${Math.max(6, Math.round((valor / max) * 100))}%` }}
          title={`Medición ${i + 1}: ${valor} Nm`}
        />
      ))}
    </div>
  )
}
