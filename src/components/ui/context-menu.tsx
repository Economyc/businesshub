"use client"

import { ChevronRight } from "lucide-react"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"

import { cn } from "@/lib/utils"

// Menú contextual (click derecho / long-press) construido sobre Base UI, el
// mismo primitivo que usa el Popover. Estilado con tokens del design system:
// popup flotante con borde 1px + shadow (igual que PopoverContent), items con
// hover `bg-bone`. Soporta submenús (Sub / SubTrigger / SubContent).

function ContextMenu({ ...props }: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root {...props} />
}

function ContextMenuTrigger({ ...props }: ContextMenuPrimitive.Trigger.Props) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
}

const POPUP_CLASS = cn(
  "min-w-[12rem] rounded-xl border border-border bg-card-bg p-1.5 shadow-lg outline-none",
  "duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
)

function ContextMenuContent({
  className,
  children,
  ...props
}: ContextMenuPrimitive.Popup.Props) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className="z-[100]" sideOffset={4}>
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(POPUP_CLASS, className)}
          {...props}
        >
          {children}
        </ContextMenuPrimitive.Popup>
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

const ITEM_CLASS = cn(
  "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-body text-graphite text-left cursor-pointer select-none",
  "transition-colors outline-none hover:bg-bone data-highlighted:bg-bone",
  "data-disabled:opacity-50 data-disabled:pointer-events-none",
)

function ContextMenuItem({
  className,
  ...props
}: ContextMenuPrimitive.Item.Props) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      className={cn(ITEM_CLASS, className)}
      {...props}
    />
  )
}

function ContextMenuSeparator({
  className,
  ...props
}: ContextMenuPrimitive.Separator.Props) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("my-1 h-px bg-border/60", className)}
      {...props}
    />
  )
}

function ContextMenuSub({ ...props }: ContextMenuPrimitive.SubmenuRoot.Props) {
  return <ContextMenuPrimitive.SubmenuRoot {...props} />
}

function ContextMenuSubTrigger({
  className,
  children,
  ...props
}: ContextMenuPrimitive.SubmenuTrigger.Props) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      data-slot="context-menu-sub-trigger"
      className={cn(ITEM_CLASS, "data-popup-open:bg-bone justify-between", className)}
      {...props}
    >
      <span className="inline-flex items-center gap-2 min-w-0 truncate">{children}</span>
      <ChevronRight size={14} strokeWidth={1.5} className="text-mid-gray shrink-0" />
    </ContextMenuPrimitive.SubmenuTrigger>
  )
}

function ContextMenuSubContent({
  className,
  children,
  ...props
}: ContextMenuPrimitive.Popup.Props) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className="z-[100]" sideOffset={4}>
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-sub-content"
          className={cn(POPUP_CLASS, "max-h-[min(24rem,60vh)] overflow-y-auto", className)}
          {...props}
        >
          {children}
        </ContextMenuPrimitive.Popup>
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
}
