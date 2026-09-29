import Link from "next/link"
import {
  AlertTriangle,
  Boxes,
  FileBarChart,
  LayoutGrid,
  Search,
  Settings,
  ShieldCheck,
  Wrench,
} from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { NotificationBell } from "@/components/oficina/notification-bell"
import { PushToggle } from "@/components/oficina/push-toggle"

// The office desk shell (O2): sidebar + header, shared by every /oficina/**
// page. Only Resumen, Alertas and Reportes have a real screen behind them;
// the rest of the sidebar renders inert (aria-disabled) per O-D4 instead of
// linking to a page that does not exist.

type ItemNav = { href: string; label: string; Icono: typeof LayoutGrid; activo?: boolean }

function itemsNav(pathname: string): ItemNav[] {
  return [
    { href: "/oficina", label: "Resumen", Icono: LayoutGrid },
    { href: "#", label: "Líneas", Icono: Boxes },
    { href: "/oficina/alertas/torque-fuera-de-rango-l3-e7", label: "Alertas", Icono: AlertTriangle },
    { href: "#", label: "Calidad y garantías", Icono: ShieldCheck },
    { href: "#", label: "Causa raíz", Icono: Wrench },
    { href: "/oficina/reportes", label: "Reportes", Icono: FileBarChart },
    { href: "#", label: "Configuración", Icono: Settings },
  ].map((item) => ({ ...item, activo: pathname === item.href || pathname.startsWith(item.href + "/") }))
}

export function OfficeShell({
  pathname,
  title,
  subtitle,
  children,
}: {
  pathname: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh w-full bg-neutral-50 text-foreground">
      {/* Desk view (O-D3): the sidebar collapses below md instead of forcing
          horizontal scroll on a narrow window -- the office view targets a
          desktop browser, not a phone, but it still must not overflow. */}
      <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border bg-white p-3 md:flex">
        <div className="flex items-center gap-2 px-2 py-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-indigo-700 text-xs font-black text-white">
            AI
          </span>
          <span className="text-sm font-bold">AutoInsight</span>
        </div>
        <nav className="mt-2 flex flex-col gap-0.5">
          {itemsNav(pathname).map(({ href, label, Icono, activo }) =>
            href === "#" ? (
              <span
                key={label}
                aria-disabled="true"
                className="flex cursor-not-allowed items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-400"
              >
                <Icono className="size-4" strokeWidth={2} aria-hidden />
                {label}
              </span>
            ) : (
              <Link
                key={label}
                href={href}
                aria-current={activo ? "page" : undefined}
                className={
                  activo
                    ? "flex items-center gap-2 rounded-md bg-indigo-50 px-2 py-1.5 text-sm font-semibold text-indigo-700"
                    : "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
                }
              >
                <Icono className="size-4" strokeWidth={2} aria-hidden />
                {label}
              </Link>
            ),
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-6 py-3">
          <div className="flex flex-col">
            <h1 className="text-lg font-bold">{title}</h1>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input placeholder="Buscar alertas, estaciones..." className="w-64 pl-8" disabled />
            </div>
            <NotificationBell />
            <PushToggle />
            <div className="flex overflow-hidden rounded-md border border-border">
              <Link href="/oficina" className="bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700">
                Oficina
              </Link>
              <Link href="/planta" className="px-3 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-50">
                Planta
              </Link>
            </div>
            <Avatar>AR</Avatar>
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
