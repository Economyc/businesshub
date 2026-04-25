import { useSettings } from '@/core/hooks/use-settings'
import { SettingsList } from './settings-list'

export function SettingsDepartments() {
  const { departments, addDepartment, removeDepartment, updateDepartment } = useSettings()

  return (
    <SettingsList
      title="Departamentos"
      items={departments}
      onAdd={addDepartment}
      onRemove={removeDepartment}
      onUpdate={updateDepartment}
      placeholder="Nuevo departamento..."
      itemLabel="departamento"
    />
  )
}
