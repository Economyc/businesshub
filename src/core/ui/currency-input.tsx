import { useState, useEffect } from 'react'

interface CurrencyInputProps {
  value: string | number
  onChange: (raw: string) => void
  name?: string
  placeholder?: string
  required?: boolean
  className?: string
}

function formatWithDots(raw: string): string {
  // Remove everything except digits
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('es-CO')
}

function toRaw(formatted: string): string {
  return formatted.replace(/\D/g, '')
}

export function CurrencyInput({ value, onChange, name, placeholder = '0', required, className }: CurrencyInputProps) {
  const [display, setDisplay] = useState(() => {
    const raw = String(value).replace(/\D/g, '')
    return raw ? formatWithDots(raw) : ''
  })

  // Sync display when value changes externally
  useEffect(() => {
    const raw = String(value).replace(/\D/g, '')
    const current = toRaw(display)
    if (raw !== current) {
      setDisplay(raw ? formatWithDots(raw) : '')
    }
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatWithDots(e.target.value)
    setDisplay(formatted)
    onChange(toRaw(formatted))
  }

  return (
    <div className="relative">
      {display && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mid-gray pointer-events-none select-none">$</span>
      )}
      <input
        name={name}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        className={`${className ?? ''} ${display ? 'pl-7' : ''}`}
      />
    </div>
  )
}
