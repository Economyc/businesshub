import { useCompany } from '@/core/hooks/use-company'
import { SettingsList } from './settings-list'

export function SettingsRoles() {
  const { roles, addRole, removeRole, updateRole } = useCompany()

  return (
    <SettingsList
      title="Cargos"
      items={roles}
      onAdd={addRole}
      onRemove={removeRole}
      onUpdate={updateRole}
      placeholder="Nuevo cargo..."
      itemLabel="cargo"
    />
  )
}
