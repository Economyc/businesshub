import { findMatchingLocal } from './company-mapping'
import type { PosLocal } from './types'

const local = (id: string, desc: string): PosLocal => ({
  local_id: id,
  local_descripcion: desc,
})

// Dominio real del tenant `filipo` (9405) desde que abrió San Lucas: dos
// locales que empiezan con "FILIPO", así que el nivel 3 (name como palabra
// única) dejó de desempatar.
const FILIPO = [local('1', 'FILIPO BELÉN'), local('6', 'FILIPO POBLADO')]
// Dominio del tenant `blue` (8267).
const BLUE = [local('1', 'BLUE MANILA'), local('2', 'BLUE ESCONDITE')]

describe('findMatchingLocal', () => {
  describe('nivel 0 — override posLocalId', () => {
    it('resuelve una sede cuyo nombre en el POS no se parece a su location', () => {
      // Filipo San Lucas está cargada en el POS como "FILIPO POBLADO": ningún
      // nivel heurístico la encuentra, por eso existe el override.
      const m = findMatchingLocal(FILIPO, {
        name: 'Filipo',
        location: 'San Lucas',
        posLocalId: 6,
      })
      expect(m?.local_id).toBe('6')
    })

    it('gana sobre el match exacto por nombre', () => {
      const m = findMatchingLocal(FILIPO, {
        name: 'Filipo',
        location: 'Belen',
        posLocalId: 6,
      })
      expect(m?.local_id).toBe('6')
    })

    it('devuelve null si el id no existe en el dominio, sin caer al heurístico', () => {
      // Belén matchearía por nivel 1, pero un override roto debe dar "sin
      // datos" en vez de sincronizar el local equivocado.
      const m = findMatchingLocal(FILIPO, {
        name: 'Filipo',
        location: 'Belen',
        posLocalId: 99,
      })
      expect(m).toBeNull()
    })

    it('funciona sin name ni location', () => {
      const m = findMatchingLocal(FILIPO, { posLocalId: 1 })
      expect(m?.local_id).toBe('1')
    })

    it('acepta local_id numérico del POS', () => {
      const m = findMatchingLocal(
        [{ local_id: 6 as unknown as string, local_descripcion: 'FILIPO POBLADO' }],
        { posLocalId: 6 },
      )
      expect(m?.local_descripcion).toBe('FILIPO POBLADO')
    })
  })

  describe('niveles heurísticos (sin override)', () => {
    it('nivel 1 — Belén sigue matcheando por exacto con 2 locales "FILIPO"', () => {
      const m = findMatchingLocal(FILIPO, { name: 'Filipo', location: 'Belen' })
      expect(m?.local_id).toBe('1')
    })

    it('nivel 2 — location como palabra', () => {
      const m = findMatchingLocal(BLUE, { name: 'Blue Smash Brgr', location: 'Manila' })
      expect(m?.local_id).toBe('1')
    })

    it('nivel 3 — name como palabra única', () => {
      const m = findMatchingLocal([local('1', 'FILIPO'), local('2', 'RANA BRAVA CAFÉ')], {
        name: 'Filipo',
        location: 'Belen',
      })
      expect(m?.local_id).toBe('1')
    })

    it('null cuando el name matchea varios locales (ambigüedad)', () => {
      const m = findMatchingLocal(FILIPO, { name: 'Filipo', location: 'San Lucas' })
      expect(m).toBeNull()
    })

    it('null sin location', () => {
      expect(findMatchingLocal(FILIPO, { name: 'Filipo' })).toBeNull()
    })
  })

  it('null con dominio vacío o company ausente', () => {
    expect(findMatchingLocal([], { name: 'Filipo', location: 'Belen', posLocalId: 6 })).toBeNull()
    expect(findMatchingLocal(FILIPO, null)).toBeNull()
  })
})
