import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/core/hooks/use-auth'

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200'

function getErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos'
    case 'auth/invalid-email':
      return 'Correo electrónico inválido'
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido deshabilitada'
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Intenta más tarde'
    default:
      return 'Error al iniciar sesión'
  }
}

export function LoginPage() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  if (user) return <Navigate to="/home" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err: any) {
      setError(getErrorMessage(err?.code ?? ''))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bone px-5">
      <div className="w-full max-w-sm md:scale-110 md:origin-center">
        <div className="text-center mb-8">
          <h1 className="text-[26px] md:text-[28px] font-bold text-dark-graphite tracking-tight">
            Business<span className="font-light text-mid-gray">Hub</span>
          </h1>
          <p className="text-caption text-mid-gray mt-1">Inicia sesión para continuar</p>
        </div>

        <div className="bg-surface rounded-xl card-elevated p-5 md:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="correo@empresa.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-caption uppercase tracking-wider text-mid-gray mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={inputClass + ' pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mid-gray hover:text-graphite transition-colors"
                >
                  {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-caption text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-[10px] btn-primary text-body font-medium transition-all duration-200 hover:-translate-y-px hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
