import { usePaymentMethods } from '@/modules/payment-methods/hooks'
import { SettingsList } from './settings-list'

export function SettingsPaymentMethods() {
  const { methods, addMethod, removeMethod, updateMethod } = usePaymentMethods()

  return (
    <SettingsList
      title="Métodos de pago"
      items={methods}
      onAdd={addMethod}
      onRemove={removeMethod}
      onUpdate={updateMethod}
      placeholder="Nuevo método de pago…"
      itemLabel="método de pago"
    />
  )
}
