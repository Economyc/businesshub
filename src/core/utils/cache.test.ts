import { cacheGet, cacheSet, cacheDel } from './cache'

describe('cacheGet', () => {
  it('returns null for non-existent key', () => {
    expect(cacheGet('nonexistent')).toBeNull()
  })

  it('returns parsed JSON for existing key', () => {
    localStorage.setItem('bh:test', JSON.stringify({ a: 1 }))
    expect(cacheGet('test')).toEqual({ a: 1 })
  })

  it('prepends "bh:" prefix to key', () => {
    localStorage.setItem('bh:mykey', '"hello"')
    expect(cacheGet('mykey')).toBe('hello')
  })

  it('returns null if stored value is invalid JSON', () => {
    localStorage.setItem('bh:bad', '{invalid json')
    expect(cacheGet('bad')).toBeNull()
  })

  it('returns typed value correctly', () => {
    localStorage.setItem('bh:nums', JSON.stringify([1, 2, 3]))
    const result = cacheGet<number[]>('nums')
    expect(result).toEqual([1, 2, 3])
  })
})

describe('cacheSet', () => {
  it('stores JSON-stringified value with "bh:" prefix', () => {
    cacheSet('foo', { bar: 42 })
    expect(localStorage.getItem('bh:foo')).toBe('{"bar":42}')
  })

  it('overwrites existing value', () => {
    cacheSet('key', 'first')
    cacheSet('key', 'second')
    expect(cacheGet('key')).toBe('second')
  })
})

describe('cacheDel', () => {
  it('removes item with "bh:" prefix', () => {
    cacheSet('delme', 'value')
    expect(cacheGet('delme')).toBe('value')
    cacheDel('delme')
    expect(cacheGet('delme')).toBeNull()
  })
})
