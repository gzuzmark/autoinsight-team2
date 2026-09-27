import { cn } from '@/lib/utils'

function Avatar({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Avatar }
