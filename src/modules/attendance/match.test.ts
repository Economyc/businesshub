import { describe, expect, it } from 'vitest'
import {
  findMatch,
  learnDescriptor,
  shouldLearn,
  MAX_DESCRIPTORS,
  type FaceCandidate,
} from '../../../functions/src/attendance/match'

// Vector de 128 con `d` de distancia euclidiana al origen sobre el eje `axis`.
const vec = (d: number, axis = 0) => Array.from({ length: 128 }, (_, i) => (i === axis ? d : 0))
const origin = vec(0)
const person = (id: string, ...descriptors: number[][]): FaceCandidate => ({ employeeId: id, employeeName: id, descriptors })

describe('findMatch', () => {
  it('acepta bajo 0.50 con ventaja suficiente', () => {
    const m = findMatch([origin], [person('a', vec(0.3)), person('b', vec(0.7, 1))])
    expect(m?.employeeId).toBe('a')
    expect(m?.distance).toBeCloseTo(0.3)
  })

  it('rechaza un empate', () => {
    expect(findMatch([origin], [person('a', vec(0.3)), person('b', vec(0.33, 1))])).toBeNull()
  })

  it('entre 0.50 y 0.55 con una sola foto: rechaza', () => {
    expect(findMatch([origin], [person('a', vec(0.52)), person('b', vec(0.9, 1))])).toBeNull()
  })

  it('entre 0.50 y 0.55 con dos fotos que coinciden y ventaja amplia: acepta', () => {
    const m = findMatch([origin, vec(0.01, 2)], [person('a', vec(0.52)), person('b', vec(0.9, 1))])
    expect(m?.employeeId).toBe('a')
  })

  it('segundo nivel exige ventaja amplia', () => {
    expect(findMatch([origin, vec(0.01, 2)], [person('a', vec(0.52)), person('b', vec(0.6, 1))])).toBeNull()
  })

  it('usa la foto de la rafaga que quedo mas cerca', () => {
    const m = findMatch([vec(0.2, 3), origin], [person('a', vec(0.1))])
    expect(m?.probe).toEqual(origin)
  })

  it('sin fotos no hay match', () => {
    expect(findMatch([], [person('a', origin)])).toBeNull()
  })
})

describe('shouldLearn', () => {
  it('aprende hasta 0.45 con ventaja de 0.10', () => {
    expect(shouldLearn({ employeeId: 'a', employeeName: 'a', distance: 0.44, secondDistance: 0.7, probe: origin })).toBe(true)
    expect(shouldLearn({ employeeId: 'a', employeeName: 'a', distance: 0.44, secondDistance: 0.5, probe: origin })).toBe(false)
    expect(shouldLearn({ employeeId: 'a', employeeName: 'a', distance: 0.47, secondDistance: Infinity, probe: origin })).toBe(false)
  })
})

describe('learnDescriptor', () => {
  it('agrega mientras haya cupo', () => {
    expect(learnDescriptor([vec(1)], vec(2))).toHaveLength(2)
  })

  it('lleno, conserva el registro y saca la aprendida mas parecida a la nueva', () => {
    const full = Array.from({ length: MAX_DESCRIPTORS }, (_, i) => vec(i + 1, i))
    const probe = vec(5.1, 4) // casi igual a la de indice 4
    const next = learnDescriptor(full, probe)
    expect(next).toHaveLength(MAX_DESCRIPTORS)
    expect(next[0]).toEqual(full[0])
    expect(next).not.toContainEqual(full[4])
    expect(next[next.length - 1]).toEqual(probe)
  })

  it('con registro de varias fotos no descarta ninguna de ellas', () => {
    const full = Array.from({ length: MAX_DESCRIPTORS }, (_, i) => vec(i + 1, i))
    const probe = vec(2.05, 1) // casi igual a la segunda foto de registro
    const next = learnDescriptor(full, probe, 3)
    expect(next.slice(0, 3)).toEqual(full.slice(0, 3))
    expect(next).toHaveLength(MAX_DESCRIPTORS)
  })
})
