// lucide-react v0.577 ships without .d.ts files.
// Declare as wildcard module so all named imports resolve.
declare module 'lucide-react' {
  import type { FC, SVGProps } from 'react'
  type IconProps = SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }
  type LucideIcon = FC<IconProps>
  export type { LucideIcon, IconProps }
  // Every named export is an icon component
  const icons: { [key: string]: LucideIcon }
  export = icons
}

// @base-ui/react submodules — namespace-style exports with .Root, .Popup, etc.
declare module '@base-ui/react/button' {
  const Button: any
  export { Button }
  export namespace Button { type Props = Record<string, any> }
}

declare module '@base-ui/react/dialog' {
  const Dialog: any
  export { Dialog }
  export namespace Dialog {
    namespace Root { type Props = Record<string, any> }
    namespace Trigger { type Props = Record<string, any> }
    namespace Portal { type Props = Record<string, any> }
    namespace Backdrop { type Props = Record<string, any> }
    namespace Popup { type Props = Record<string, any> }
    namespace Title { type Props = Record<string, any> }
    namespace Description { type Props = Record<string, any> }
    namespace Close { type Props = Record<string, any> }
  }
}

declare module '@base-ui/react/input' {
  const Input: any
  export { Input }
}

declare module '@base-ui/react/popover' {
  const Popover: any
  export { Popover }
  export namespace Popover {
    namespace Root { type Props = Record<string, any> }
    namespace Trigger { type Props = Record<string, any> }
    namespace Portal { type Props = Record<string, any> }
    namespace Popup { type Props = Record<string, any> }
    namespace Positioner { type Props = Record<string, any> }
  }
}

declare module '@base-ui/react/select' {
  const Select: any
  export { Select }
  export namespace Select {
    namespace Root { type Props = Record<string, any> }
    namespace Trigger { type Props = Record<string, any> }
    namespace Value { type Props = Record<string, any> }
    namespace Popup { type Props = Record<string, any> }
    namespace Positioner { type Props = Record<string, any> }
    namespace Item { type Props = Record<string, any> }
    namespace Group { type Props = Record<string, any> }
    namespace GroupLabel { type Props = Record<string, any> }
    namespace Separator { type Props = Record<string, any> }
  }
}

declare module '@base-ui/react/tabs' {
  const Tabs: any
  export { Tabs }
}

declare module '@base-ui/react/checkbox' {
  const Checkbox: any
  export { Checkbox }
}

declare module '@base-ui-components/react/checkbox' {
  export * from '@base-ui/react/checkbox'
}

declare module '@base-ui-components/react/tooltip' {
  const Tooltip: any
  export { Tooltip }
}
