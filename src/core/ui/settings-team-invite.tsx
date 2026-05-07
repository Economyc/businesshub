import { useState } from 'react'
import { Loader2, UserPlus, Copy, Check, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalVariants } from '@/core/animations/variants'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { adminCreateUserCallable } from '@/core/services/permissions-service'

interface Props {
  open: boolean
  onClose: () => void
  onInvited: () => void
}

function generatePassword(length = 12): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, (v) => chars[v % chars.length]).join('')
}

export function SettingsTeamInvite({ open, onClose, onInvited }: Props) {
  const { selectedCompany } = useCompany()
  const { roles } = usePermissions()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState(() => generatePassword())
  const [role, setRole] = useState('viewer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  function reset() {
    setEmail('')
    setDisplayName('')
    setPassword(generatePassword())
    setRole('viewer')
    setError('')
    setCreatedCreds(null)
    setCopied(false)
  }

  function handleClose() {
    if (loading) return
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany) return

    const trimmedEmail = email.trim().toLowerCase()
    const trimmedName = displayName.trim()

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Ingresa un email válido')
      return
    }
    if (!trimmedName) {
      setError('Ingresa un nombre')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setLoading(true)
    setError('')

    try {
      await adminCreateUserCallable({
        companyId: selectedCompany.id,
        email: trimmedEmail,
        password,
        displayName: trimmedName,
        role,
      })
      setCreatedCreds({ email: trimmedEmail, password })
      onInvited()
    } catch (err: unknown) {
      console.error('Error creating member:', err)
      const message = err instanceof Error ? err.message : 'Error al crear miembro'
      setError(message.replace(/^.*\//, '').replace(/-/g, ' '))
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!createdCreds) return
    const text = `Email: ${createdCreds.email}\nContraseña: ${createdCreds.password}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20"
            onClick={loading ? undefined : handleClose}
          />
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative bg-surface-elevated rounded-xl p-4 sm:p-6 shadow-lg max-w-md w-full mx-4 border border-border"
          >
            {createdCreds ? (
              <>
                <h3 className="text-subheading font-semibold text-dark-graphite mb-1">
                  Miembro creado
                </h3>
                <p className="text-body text-mid-gray mb-5">
                  Comparte estas credenciales con el usuario. No se mostrarán de nuevo.
                </p>

                <div className="rounded-lg border border-border/60 bg-bone p-3 space-y-2 mb-4">
                  <div>
                    <div className="text-caption text-mid-gray">Email</div>
                    <div className="text-body font-medium text-dark-graphite break-all">
                      {createdCreds.email}
                    </div>
                  </div>
                  <div>
                    <div className="text-caption text-mid-gray">Contraseña temporal</div>
                    <div className="text-body font-mono text-dark-graphite break-all">
                      {createdCreds.password}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-4 py-2 rounded-lg text-body font-medium border border-input-border text-graphite hover:bg-bone transition-all duration-200 flex items-center gap-2"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-lg text-body font-medium btn-primary transition-all duration-200"
                  >
                    Listo
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-subheading font-semibold text-dark-graphite mb-1">
                  Crear miembro
                </h3>
                <p className="text-body text-mid-gray mb-5">
                  Agrega un nuevo miembro a {selectedCompany?.name}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-caption font-medium text-graphite mb-1.5">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Nombre completo"
                      className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-caption font-medium text-graphite mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite placeholder:text-mid-gray/60 focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-caption font-medium text-graphite mb-1.5">
                      Contraseña temporal
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="flex-1 px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body font-mono text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setPassword(generatePassword())}
                        disabled={loading}
                        title="Generar nueva"
                        className="px-3 rounded-lg border border-input-border text-graphite hover:bg-bone transition-all duration-200 disabled:opacity-50"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-caption font-medium text-graphite mb-1.5">
                      Rol
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-body text-graphite focus:border-input-focus focus:ring-[3px] focus:ring-graphite/5 outline-none transition-all duration-200"
                      disabled={loading}
                    >
                      {roles.filter((r) => r.id !== 'owner').map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label} — {r.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {error && (
                    <p className="text-caption text-negative-text">{error}</p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={loading}
                      className="px-4 py-2 rounded-lg text-body font-medium border border-input-border text-graphite hover:bg-bone transition-all duration-200 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !email.trim() || !displayName.trim()}
                      className="px-4 py-2 rounded-lg text-body font-medium btn-primary transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <UserPlus size={14} />
                      )}
                      Crear
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
