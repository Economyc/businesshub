import { useState } from 'react'
import { Shield, Eye, Pencil, Trash2, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEFAULT_ROLES } from '@/core/config/default-roles'
import type { RoleDefinition, ModuleKey } from '@/core/types/permissions'
import { motion, AnimatePresence } from 'framer-motion'

const MODULE_GROUPS: { title: string; modules: { key: ModuleKey; label: string }[] }[] = [
  {
    title: 'General',
    modules: [
      { key: 'home', label: 'Home' },
      { key: 'analytics', label: 'Analisis' },
      { key: 'agent', label: 'Asistente AI' },
    ],
  },
  {
    title: 'Contabilidad',
    modules: [
      { key: 'finance', label: 'Finanzas' },
      { key: 'cartera', label: 'Cartera' },
      { key: 'closings', label: 'Cierres de Caja' },
      { key: 'payroll', label: 'Nomina' },
      { key: 'prestaciones', label: 'Prestaciones' },
    ],
  },
  {
    title: 'Gestion',
    modules: [
      { key: 'contracts', label: 'Contratos' },
      { key: 'partners', label: 'Socios' },
    ],
  },
  {
    title: 'Personas',
    modules: [
      { key: 'talent', label: 'Equipo' },
      { key: 'suppliers', label: 'Proveedores' },
    ],
  },
  {
    title: 'Sistema',
    modules: [
      { key: 'settings', label: 'Configuracion' },
    ],
  },
]

const ACTION_LABELS = [
  { key: 'read', label: 'Ver', icon: Eye },
  { key: 'create', label: 'Crear', icon: Pencil },
  { key: 'update', label: 'Editar', icon: Pencil },
  { key: 'delete', label: 'Borrar', icon: Trash2 },
] as const

function RolePermissionSheet({ role, onClose }: { role: RoleDefinition; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed inset-y-0 right-0 w-full max-w-md bg-surface-elevated border-l border-border shadow-lg z-50 overflow-y-auto"
    >
      <div className="sticky top-0 bg-surface-elevated border-b border-border px-5 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: role.color + '20' }}
          >
            <Shield size={16} style={{ color: role.color }} />
          </div>
          <div>
            <h3 className="text-subheading font-semibold text-dark-graphite">{role.label}</h3>
            <p className="text-caption text-mid-gray">{role.description}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-mid-gray hover:text-graphite hover:bg-bone transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Management permissions */}
        <div className="bg-bone/50 rounded-xl p-4 space-y-3">
          <h4 className="text-caption uppercase tracking-wider text-mid-gray font-medium">
            Permisos de gestion
          </h4>
          <div className="flex items-center justify-between">
            <span className="text-body text-graphite">Gestionar usuarios</span>
            <span
              className={cn(
                'text-caption font-medium px-2 py-0.5 rounded-full',
                role.canManageUsers
                  ? 'bg-green-50 text-green-700'
                  : 'bg-smoke text-mid-gray',
              )}
            >
              {role.canManageUsers ? 'Si' : 'No'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body text-graphite">Gestionar empresa</span>
            <span
              className={cn(
                'text-caption font-medium px-2 py-0.5 rounded-full',
                role.canManageCompany
                  ? 'bg-green-50 text-green-700'
                  : 'bg-smoke text-mid-gray',
              )}
            >
              {role.canManageCompany ? 'Si' : 'No'}
            </span>
          </div>
        </div>

        {/* Module permissions grouped by section */}
        {MODULE_GROUPS.map((group) => (
          <div key={group.title}>
            <h4 className="text-caption uppercase tracking-wider text-mid-gray font-medium mb-3">
              {group.title}
            </h4>
            <div className="rounded-xl bg-bone/50 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-caption text-mid-gray font-medium px-3 py-2">
                      Modulo
                    </th>
                    {ACTION_LABELS.map(({ key, label }) => (
                      <th
                        key={key}
                        className="text-center text-caption text-mid-gray font-medium px-2 py-2 w-14"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.modules.map((mod) => {
                    const perm = role.permissions.find((p) => p.module === mod.key)
                    return (
                      <tr
                        key={mod.key}
                        className="border-b border-border/30 last:border-b-0"
                      >
                        <td className="px-3 py-2.5 text-body text-graphite">{mod.label}</td>
                        {ACTION_LABELS.map(({ key }) => {
                          const has = perm?.actions.includes(key) ?? false
                          return (
                            <td key={key} className="px-2 py-2.5 text-center">
                              <div
                                className={cn(
                                  'w-5 h-5 rounded-full mx-auto flex items-center justify-center text-[10px] font-bold',
                                  has
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-smoke text-mid-gray/40',
                                )}
                              >
                                {has ? '✓' : '—'}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export function SettingsTeamRoles() {
  const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEFAULT_ROLES.map((role) => {
          const moduleCount = role.permissions.length
          const hasFullAccess = role.permissions.every((p) => p.actions.length === 4)

          return (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role)}
              className="text-left bg-surface card-elevated rounded-xl p-4 hover:shadow-md transition-all duration-200 hover:-translate-y-px group"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: role.color + '15' }}
                >
                  <Shield size={18} style={{ color: role.color }} />
                </div>
                <ChevronRight
                  size={14}
                  className="text-mid-gray/40 group-hover:text-graphite transition-colors mt-1"
                />
              </div>
              <div
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold mb-2"
                style={{
                  backgroundColor: role.color + '15',
                  color: role.color,
                }}
              >
                {role.label}
              </div>
              <p className="text-caption text-mid-gray line-clamp-2 mb-3">
                {role.description}
              </p>
              <div className="text-caption text-mid-gray/80">
                {hasFullAccess
                  ? 'Acceso completo'
                  : `${moduleCount} modulos`}
              </div>
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {selectedRole && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setSelectedRole(null)}
            />
            <RolePermissionSheet
              role={selectedRole}
              onClose={() => setSelectedRole(null)}
            />
          </>
        )}
      </AnimatePresence>
    </>
  )
}
