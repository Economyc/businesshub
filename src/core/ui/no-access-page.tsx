import { ShieldX } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageTransition } from './page-transition'

export function NoAccessPage() {
  const navigate = useNavigate()

  return (
    <PageTransition>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <ShieldX size={28} className="text-negative-text" />
        </div>
        <h1 className="text-heading font-semibold text-dark-graphite mb-2">
          Acceso restringido
        </h1>
        <p className="text-body text-mid-gray mb-6 max-w-md">
          No tienes permisos para acceder a este modulo. Contacta al administrador de tu empresa para solicitar acceso.
        </p>
        <button
          onClick={() => navigate('/home')}
          className="px-5 py-2.5 rounded-lg btn-primary text-body font-medium transition-all duration-200"
        >
          Ir al inicio
        </button>
      </div>
    </PageTransition>
  )
}
