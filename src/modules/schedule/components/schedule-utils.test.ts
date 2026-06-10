import { buildScheduleSheet } from './schedule-utils'
import type { Employee } from '@/modules/talent/types'
import type { Novelty, Shift } from '../types'

const dates = ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14']

const ana = { id: 'e1', name: 'Ana', identification: '111', department: 'Cocina' } as Employee
const beto = { id: 'e2', name: 'Beto', identification: '222', department: 'Servicio' } as Employee

const groups = [
  { department: 'Cocina', employees: [ana] },
  { department: 'Servicio', employees: [beto] },
]

function makeNovelty(partial: Partial<Novelty>): Novelty {
  return {
    id: 'n', weekKey: '2026-W24', date: dates[0], employeeId: 'e1',
    typeId: 't1', typeName: 'Incapacidad', color: 'red',
    ...partial,
  } as Novelty
}

function build(novelties: Novelty[]) {
  return buildScheduleSheet({
    weekName: 'Semana 8 – 14 jun 2026',
    dates,
    groups,
    byCell: new Map<string, Shift[]>(),
    noveltyByCell: new Map(novelties.map((n) => [`${n.employeeId}|${n.date}`, n])),
    metrics: new Map(),
    weekTotal: 0,
    shifts: [],
    novelties,
  })
}

describe('buildScheduleSheet — hoja Novedades', () => {
  it('incluye la hoja "Novedades" siempre, vacía si no hay novedades', () => {
    const sheets = build([])
    expect(sheets).toHaveLength(2)
    expect(sheets[1].name).toBe('Novedades')
    expect(sheets[1].data).toHaveLength(0)
    expect(sheets[1].fields.map((f) => f.header)).toEqual([
      'Fecha', 'Empleado', 'Documento', 'Departamento', 'Novedad', 'Notas',
    ])
  })

  it('lista las novedades con datos del empleado, ordenadas por fecha y nombre', () => {
    const sheets = build([
      makeNovelty({ id: 'n2', employeeId: 'e2', date: dates[2], typeName: 'Vacaciones', notes: 'aprobadas' }),
      makeNovelty({ id: 'n1', employeeId: 'e1', date: dates[0] }),
    ])
    expect(sheets[1].data).toEqual([
      {
        fecha: '2026-06-08 (Lun)', empleado: 'Ana', documento: '111',
        departamento: 'Cocina', novedad: 'Incapacidad', notas: '',
      },
      {
        fecha: '2026-06-10 (Mié)', empleado: 'Beto', documento: '222',
        departamento: 'Servicio', novedad: 'Vacaciones', notas: 'aprobadas',
      },
    ])
  })

  it('omite novedades de empleados fuera de los grupos visibles', () => {
    const sheets = build([makeNovelty({ employeeId: 'fantasma' })])
    expect(sheets[1].data).toHaveLength(0)
  })

  it('mantiene la hoja del horario como primera hoja', () => {
    const sheets = build([])
    expect(sheets[0].name).toBe('Semana 8 – 14 jun 2026')
    // 2 empleados + fila de total
    expect(sheets[0].data).toHaveLength(3)
  })
})
