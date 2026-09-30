import { useQuery } from '@tanstack/react-query'
import { getDownloadURL, ref as storageRef } from 'firebase/storage'
import { getAppStorage } from '@/core/firebase/config'

/** Vista previa en local sin subir nada: con `VITE_TUTORIALS_LOCAL=1` los videos
 *  salen de `public/tutorials-local/` (ignorada por git) en vez de Storage. */
const LOCAL = import.meta.env.DEV && import.meta.env.VITE_TUTORIALS_LOCAL === '1'

async function tutorialUrl(path: string): Promise<string> {
  if (LOCAL) return `/tutorials-local/${path.split('/').pop()}`
  const storage = await getAppStorage()
  return getDownloadURL(storageRef(storage, path))
}

export function useTutorialUrl(path: string) {
  return useQuery({
    queryKey: ['tutorialUrl', path],
    queryFn: () => tutorialUrl(path),
    staleTime: Infinity,
    retry: 1,
  })
}
