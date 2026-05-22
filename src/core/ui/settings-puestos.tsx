import { useSettings } from '@/core/hooks/use-settings'
import { SettingsList } from './settings-list'

/**
 * Puestos (antes "Cargos"): cargos laborales de la empresa, usados por el módulo
 * de Equipo/Talento. No confundir con los Roles de acceso (RBAC) en `settings-roles`.
 */
export function SettingsPuestos() {
  const { roles, addRole, removeRole, updateRole } = useSettings()

  return (
    <SettingsList
      title="Puestos"
      items={roles}
      onAdd={addRole}
      onRemove={removeRole}
      onUpdate={updateRole}
      placeholder="Nuevo puesto..."
      itemLabel="puesto"
    />
  )
}
