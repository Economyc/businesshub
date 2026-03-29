import { useCompany } from '@/core/hooks/use-company'
import { SettingsList } from './settings-list'

export function SettingsDepartments() {
  const { departments, addDepartment, removeDepartment, updateDepartment } = useCompany()

  return (
    <SettingsList
      title="Departamentos"
      items={departments}
      onAdd={addDepartment}
      onRemove={removeDepartment}
      onUpdate={updateDepartment}
      placeholder="Nuevo departamento..."
    />
  )
}
