import { describe, it, expect, vi, afterEach } from 'vitest'
import { useState, type MouseEvent } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from './context-menu'

// Sin @testing-library (su peer @testing-library/dom no está instalado): montamos
// con react-dom, disparamos eventos nativos y consultamos el DOM a mano. Cubre lo
// que fallaba en producción: que el click derecho ABRA el menú y prevenga el nativo.

let container: HTMLDivElement
let root: Root

function mount(ui: React.ReactElement) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(ui)
  })
}

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

// El menú se renderiza por portal en <body>; sus items son <button>.
function btn(text: string): HTMLButtonElement | undefined {
  return Array.from(document.body.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === text,
  ) as HTMLButtonElement | undefined
}

function Harness({ onMove }: { onMove?: (id: string) => void }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [subOpen, setSubOpen] = useState(false)
  const companies = [
    { id: 'a', name: 'Blue Manila' },
    { id: 'b', name: 'Blue Filipo' },
  ]
  return (
    <div>
      <div
        data-testid="row"
        onContextMenu={(e: MouseEvent) => {
          e.preventDefault()
          setSubOpen(false)
          setMenu({ x: 120, y: 80 })
        }}
      >
        Proveedor X
      </div>
      <ContextMenu open={!!menu} x={menu?.x ?? 0} y={menu?.y ?? 0} onClose={() => setMenu(null)}>
        <ContextMenuItem onSelect={() => setMenu(null)}>Editar</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => setSubOpen((v) => !v)}>Mover a otra compañía</ContextMenuItem>
        {subOpen &&
          companies.map((c) => (
            <ContextMenuItem
              key={c.id}
              indent
              onSelect={() => {
                onMove?.(c.id)
                setMenu(null)
              }}
            >
              {c.name}
            </ContextMenuItem>
          ))}
      </ContextMenu>
    </div>
  )
}

function rightClickRow() {
  const row = container.querySelector('[data-testid="row"]') as HTMLElement
  const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  act(() => {
    row.dispatchEvent(evt)
  })
  return evt
}

describe('ContextMenu', () => {
  it('no se renderiza mientras está cerrado', () => {
    mount(<Harness />)
    expect(btn('Editar')).toBeUndefined()
  })

  it('se abre con click derecho y previene el menú nativo', () => {
    mount(<Harness />)
    const evt = rightClickRow()
    expect(evt.defaultPrevented).toBe(true)
    expect(btn('Editar')).toBeTruthy()
    expect(btn('Mover a otra compañía')).toBeTruthy()
  })

  it('despliega compañías y dispara la acción de mover, luego cierra', () => {
    const onMove = vi.fn()
    mount(<Harness onMove={onMove} />)
    rightClickRow()

    expect(btn('Blue Manila')).toBeUndefined()
    act(() => btn('Mover a otra compañía')!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(btn('Blue Manila')).toBeTruthy()
    expect(btn('Blue Filipo')).toBeTruthy()

    act(() => btn('Blue Manila')!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(onMove).toHaveBeenCalledWith('a')
    expect(btn('Editar')).toBeUndefined()
  })

  it('cierra con click afuera y con Escape', () => {
    mount(<Harness />)
    rightClickRow()
    expect(btn('Editar')).toBeTruthy()
    act(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(btn('Editar')).toBeUndefined()

    rightClickRow()
    expect(btn('Editar')).toBeTruthy()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(btn('Editar')).toBeUndefined()
  })
})
