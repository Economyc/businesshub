import { ClipboardList, ScanFace, type LucideIcon } from 'lucide-react'

// Videos de ayuda de App2. Los MP4 viven en Firebase Storage (`tutorials/`,
// lectura solo con sesion): el repo es publico y no deben ir en git ni en public/.

export type TutorialDevice = 'Celular' | 'Computador'

export interface TutorialSection {
  /** Va en la URL: /tutoriales/:id */
  id: string
  title: string
  description: string
  icon: LucideIcon
}

export interface Tutorial {
  id: string
  sectionId: string
  title: string
  description: string
  /** 'm:ss' para la etiqueta de la tarjeta. */
  duration: string
  device: TutorialDevice
  /** Vertical (grabado en celular) o horizontal: define la forma del reproductor. */
  orientation: 'portrait' | 'landscape'
  storagePath: string
}

export const TUTORIAL_SECTIONS: TutorialSection[] = [
  {
    id: 'marcacion',
    title: 'Marcación',
    description: 'Registro de caras, llegadas tarde, correcciones y cómo marcan los empleados.',
    icon: ScanFace,
  },
  {
    id: 'cierres',
    title: 'Cierres de Caja',
    description: 'Cómo hacer el cierre del día desde el celular o el computador.',
    icon: ClipboardList,
  },
]

export const TUTORIALS: Tutorial[] = [
  {
    id: 'marcacion',
    sectionId: 'marcacion',
    title: 'Cómo funciona la marcación',
    description: 'El panel del administrador y cómo marcan los empleados en la tablet.',
    duration: '0:50',
    device: 'Computador',
    orientation: 'landscape',
    storagePath: 'tutorials/marcacion.mp4',
  },
  {
    id: 'cierre-caja-celular',
    sectionId: 'cierres',
    title: 'Cierre de caja en el celular',
    description: 'Paso a paso para hacer el cierre del día desde el celular.',
    duration: '0:59',
    device: 'Celular',
    orientation: 'portrait',
    storagePath: 'tutorials/cierre-caja-celular.mp4',
  },
  {
    id: 'cierre-caja-computador',
    sectionId: 'cierres',
    title: 'Cierre de caja en el computador',
    description: 'Paso a paso para hacer el cierre del día desde el computador.',
    duration: '0:57',
    device: 'Computador',
    orientation: 'landscape',
    storagePath: 'tutorials/cierre-caja-computador.mp4',
  },
]

export function tutorialsOf(sectionId: string): Tutorial[] {
  return TUTORIALS.filter((t) => t.sectionId === sectionId)
}
