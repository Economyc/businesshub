import { QueryClient } from '@tanstack/react-query'

// Defaults globales de React Query:
//  - `staleTime: 2min` → datos se consideran frescos; navegar entre módulos
//    dentro de 2 min sirve desde cache sin fetch (instant).
//  - `gcTime: 10min` → el cache sobrevive 10 min tras dejarse de usar, así
//    volver a un módulo visitado recientemente es instant aunque cambies
//    de company (React Query lo tiene por queryKey).
//  - `refetchOnWindowFocus: true` → al volver al tab del navegador, si los
//    datos tienen > 2 min, refetchea. Cubre el caso "creo algo en móvil,
//    vuelvo al PC": al activar la ventana se actualiza solo. Respetando
//    staleTime evita refetches triviales cada vez que cambias de tab.
//  - `retry: 1` → un solo reintento en error transitorio antes de fallar.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})
