// Quien puede ver que, por rol.
//
// El caso que motiva este archivo: /informes lo abre tambien gente de mercadeo
// para los informes de domicilios, y dentro de esa misma pagina vive el cierre
// mensual, con el Estado de Resultados completo del negocio — utilidad, caja,
// nomina, arriendos. Dar acceso a la pagina NO puede implicar dar acceso a eso.
//
// `permsFor` habilita todos los tabs de cada pagina concedida, asi que es facil
// volver a colar el cierre sin darse cuenta al tocar los roles.

import { describe, it, expect } from 'vitest'
import { DEFAULT_ROLES } from './default-roles'
import { TAB_IDS, getPageById } from './access-registry'

const roleById = (id: string) => DEFAULT_ROLES.find((r) => r.id === id)

describe('acceso al cierre mensual', () => {
  it('la pagina de informes declara sus dos pestañas', () => {
    const page = getPageById('reports')
    expect(page).toBeDefined()
    const ids = page!.tabs?.map((t) => t.id) ?? []
    expect(ids).toContain(TAB_IDS.reportsDomicilios)
    expect(ids).toContain(TAB_IDS.reportsCierre)
  })

  it('viewer NO puede ver el cierre mensual', () => {
    const viewer = roleById('viewer')
    expect(viewer).toBeDefined()
    expect(viewer!.permissions.tabs[TAB_IDS.reportsCierre]).not.toBe(true)
  })

  it('viewer conserva los informes de domicilios', () => {
    const viewer = roleById('viewer')!
    expect(viewer.permissions.pages.reports).toContain('read')
    expect(viewer.permissions.tabs[TAB_IDS.reportsDomicilios]).toBe(true)
  })

  it('viewer no puede escribir en informes, aunque la pagina ya acepte escritura', () => {
    const viewer = roleById('viewer')!
    expect(viewer.permissions.pages.reports).toEqual(['read'])
  })

  it('owner y admin si pueden ver el cierre', () => {
    for (const id of ['owner', 'admin']) {
      const r = roleById(id)!
      expect(r.permissions.tabs[TAB_IDS.reportsCierre], id).toBe(true)
    }
  })

  it('ningun rol ve el cierre sin ver antes la pagina de informes', () => {
    for (const r of DEFAULT_ROLES) {
      if (r.permissions.tabs[TAB_IDS.reportsCierre] !== true) continue
      expect(r.permissions.pages.reports, r.id).toBeDefined()
    }
  })
})
