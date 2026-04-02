import { type ReactNode } from 'react'
import { render, renderHook, type RenderOptions, type RenderHookOptions } from '@testing-library/react'

function AllProviders({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function renderWithProviders(ui: React.ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AllProviders, ...options })
}

export function renderHookWithProviders<T, P>(
  hook: (props: P) => T,
  options?: RenderHookOptions<P>
) {
  return renderHook(hook, { wrapper: AllProviders, ...options })
}

export { render, renderHook } from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
