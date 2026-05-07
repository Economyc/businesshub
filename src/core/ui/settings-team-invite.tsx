import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Timestamp } from 'firebase/firestore'
import { modalVariants } from '@/core/animations/variants'
import { useCompany } from '@/core/hooks/use-company'
import { usePermissions } from '@/core/hooks/use-permissions'
import { createMember } from '@/core/services/permissions-service'

interface Props {
  open: boolean
  onClose: () => void
  onInvited: () => void
}

export function SettingsTeamInvite({ open, onClose, onInvited }: Props) {
  const { selectedCompany } = useCompany()
  const { member, roles } = usePermissions()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('viewer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCompany || !member) return

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Ingresa un email valido')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Create a placeholder membership with invited status
      // The user will be created when they actually sign up
      const placeholderId = `invited_${trimmedEmail.replace(/[^a-z0-9]/g, '_')}`
      await createMember(selectedCompany.id, placeholderId, {
        userId: placeholderId,
        email: trimmedEmail,
        displayName: trimmedEmail.split('@')[0],
        role,
        status: 'invited',
        invitedBy: member.userId,
        invitedAt: Timestamp.now(),
      })

      setEmail('')
      setRole('viewer')
      onInvited()
      onClose()
    } catch (err: unknown) {
      console.error('Error inviting member:', err)
      setError(err instanceof Error ? err.message : 'Error al invitar miembro')
    } finally {
      setLoading(false)
    }
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
            onClick={loading ? undefined : onClose}
          />
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative bg-surface-elevated rounded-xl p-4 sm:p-6 shadow-lg max-w-md w-full mx-4 border border-border"
          >
            <h3 className="text-subheading font-semibold text-dark-graphite mb-1">
              Invitar miembro
            </h3>
            <p className="text-body text-mid-gray mb-5">
              Agrega un nuevo miembro a {selectedCompany?.name}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-body font-medium border border-input-border text-graphite hover:bg-bone transition-all duration-200 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="px-4 py-2 rounded-lg text-body font-medium btn-primary transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  Invitar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
