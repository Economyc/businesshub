import { computeCacheCoverage } from './cache-service'

// `stampedDays` = `${date}_${localId}` → millis de sincronización (formato del
// meta `pos-sales-cache-meta.days`). computeCacheCoverage es pura.
const T = (s: string) => new Date(s + 'T00:00:00Z').getTime()

describe('computeCacheCoverage', () => {
  it('todos los días stampados → completo, sin faltantes', () => {
    const stamped = {
      '2026-06-01_5': T('2026-06-01'),
      '2026-06-02_5': T('2026-06-02'),
      '2026-06-03_5': T('2026-06-03'),
    }
    const cov = computeCacheCoverage(stamped, 5, '2026-06-01', '2026-06-03')
    expect(cov.total).toBe(3)
    expect(cov.covered).toBe(3)
    expect(cov.missingDates).toEqual([])
    expect(cov.complete).toBe(true)
  })

  it('detecta días faltantes en el rango', () => {
    const stamped = {
      '2026-06-01_5': T('2026-06-01'),
      '2026-06-03_5': T('2026-06-03'),
    }
    const cov = computeCacheCoverage(stamped, 5, '2026-06-01', '2026-06-03')
    expect(cov.total).toBe(3)
    expect(cov.covered).toBe(2)
    expect(cov.missingDates).toEqual(['2026-06-02'])
    expect(cov.complete).toBe(false)
  })

  it('un día con 0 ventas pero stampado cuenta como cubierto', () => {
    // El stamp es la verdad de "sincronizado", no si hubo ventas.
    const stamped = { '2026-06-01_5': T('2026-06-01') }
    const cov = computeCacheCoverage(stamped, 5, '2026-06-01', '2026-06-01')
    expect(cov.complete).toBe(true)
    expect(cov.covered).toBe(1)
  })

  it('filtra por localId: stamps de otro local no cuentan', () => {
    const stamped = {
      '2026-06-01_5': T('2026-06-01'),
      '2026-06-02_9': T('2026-06-02'), // otro local
    }
    const cov = computeCacheCoverage(stamped, 5, '2026-06-01', '2026-06-02')
    expect(cov.missingDates).toEqual(['2026-06-02'])
    expect(cov.complete).toBe(false)
  })

  it('ignora días fuera del rango', () => {
    const stamped = {
      '2026-05-31_5': T('2026-05-31'), // antes del rango
      '2026-06-01_5': T('2026-06-01'),
      '2026-06-02_5': T('2026-06-02'),
      '2026-06-03_5': T('2026-06-03'), // después del rango
    }
    const cov = computeCacheCoverage(stamped, 5, '2026-06-01', '2026-06-02')
    expect(cov.total).toBe(2)
    expect(cov.complete).toBe(true)
  })

  it('lastSyncedAt = el stamp más reciente del rango', () => {
    const stamped = {
      '2026-06-01_5': T('2026-06-01'),
      '2026-06-02_5': T('2026-06-05'), // sincronizado más tarde
    }
    const cov = computeCacheCoverage(stamped, 5, '2026-06-01', '2026-06-02')
    expect(cov.lastSyncedAt?.getTime()).toBe(T('2026-06-05'))
  })

  it('cache vacío → todos los días faltan y lastSyncedAt null', () => {
    const cov = computeCacheCoverage({}, 5, '2026-06-01', '2026-06-03')
    expect(cov.total).toBe(3)
    expect(cov.covered).toBe(0)
    expect(cov.missingDates).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
    expect(cov.complete).toBe(false)
    expect(cov.lastSyncedAt).toBeNull()
  })

  it('localId numérico distinto que coincide por prefijo no se confunde', () => {
    // local 5 vs 15: la key usa el último '_' como separador, así que "15" no
    // matchea "5".
    const stamped = {
      '2026-06-01_15': T('2026-06-01'),
    }
    const cov = computeCacheCoverage(stamped, 5, '2026-06-01', '2026-06-01')
    expect(cov.complete).toBe(false)
    expect(cov.missingDates).toEqual(['2026-06-01'])
  })
})
