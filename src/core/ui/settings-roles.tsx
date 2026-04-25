import { useSettings } from '@/core/hooks/use-settings'
import { SettingsList } from './settings-list'

export function SettingsRoles() {
  const { roles, addRole, removeRole, updateRole } = useSettings()

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
