import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

// Red de seguridad global: si un componente tira un error en render, React
// normalmente desmonta todo el árbol y deja pantalla en blanco. Este boundary
// atrapa el error y muestra un fallback con opción de reintentar.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)
    return <DefaultErrorFallback error={error} reset={this.reset} />
  }
}

function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="card-elevated flex w-full max-w-md flex-col items-center gap-4 rounded-2xl p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-negative-bg">
          <AlertTriangle className="h-6 w-6 text-negative" strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <h2 className="text-heading font-medium text-graphite">Algo salió mal</h2>
          <p className="text-body text-mid-gray">
            Ocurrió un error al mostrar esta sección. Puedes reintentar o recargar la página.
          </p>
        </div>
        {import.meta.env.DEV && (
          <pre className="max-h-32 w-full overflow-auto rounded-lg bg-bone p-3 text-caption text-left text-mid-gray">
            {error.message}
          </pre>
        )}
        <div className="flex gap-2">
          <Button onClick={reset} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
          <Button onClick={() => window.location.reload()} size="sm">
            Recargar página
          </Button>
        </div>
      </div>
    </div>
  )
}
