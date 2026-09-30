import { useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronRight, Clock, Laptop, Loader2, Play, SearchX, Smartphone, VideoOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageHeader } from '@/core/ui/page-header'
import { PageTransition } from '@/core/ui/page-transition'
import { SearchInput } from '@/core/ui/search-input'
import { EmptyState } from '@/core/ui/empty-state'
import { cn } from '@/lib/utils'
import { TUTORIAL_SECTIONS, TUTORIALS, tutorialsOf, type Tutorial, type TutorialSection } from '../catalog'
import { useTutorialUrl } from '../services'

/** Minusculas y sin tildes: "marcacion" encuentra "Marcación". */
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Indice de /tutoriales (mismo patron que /informes): una tarjeta por seccion con
 * sus videos y un buscador que filtra los de todas. Lo ve cualquier miembro.
 */
export function TutorialsPage() {
  const [query, setQuery] = useState('')
  const q = normalize(query.trim())

  const visible = useMemo(() => {
    return TUTORIAL_SECTIONS
      .map((section) => {
        const all = tutorialsOf(section.id)
        // Si coincide la seccion, se ven todos sus videos.
        if (!q || normalize(section.title).includes(q)) return { section, items: all }
        return { section, items: all.filter((t) => normalize(`${t.title} ${t.description} ${t.device}`).includes(q)) }
      })
      .filter(({ items }) => items.length > 0)
  }, [q])

  return (
    <PageTransition>
      <PageHeader
        title="Tutoriales"
        subtitle={<span className="text-body text-mid-gray">Videos cortos para aprender a usar cada sección</span>}
      />

      <div className="mb-6 max-w-md">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar tutorial…" />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl card-elevated bg-card-bg">
          <EmptyState icon={SearchX} title="Sin resultados" description={`Ningún tutorial coincide con “${query.trim()}”.`} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 auto-rows-fr">
          {visible.map(({ section, items }) => <SectionCard key={section.id} section={section} items={items} searching={q !== ''} />)}
        </div>
      )}
    </PageTransition>
  )
}

/** Tarjeta de seccion: solo el conteo, no la lista de videos (con muchos videos
 *  la tarjeta creceria sin fin). Buscando, el conteo es de los que coinciden. */
function SectionCard({ section, items, searching }: { section: TutorialSection; items: Tutorial[]; searching: boolean }) {
  const { id, icon: Icon, title, description } = section
  const n = items.length
  const count = searching
    ? `${n} ${n === 1 ? 'coincide' : 'coinciden'}`
    : `${n} ${n === 1 ? 'video' : 'videos'}`
  return (
    <Link
      to={`/tutoriales/${id}`}
      className="group flex h-full flex-col gap-4 rounded-2xl card-elevated bg-card-bg p-6 transition-colors hover:border-border-hover"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-bone text-mid-gray">
          <Icon size={20} strokeWidth={1.5} />
        </span>
        <Badge variant="outline">{count}</Badge>
      </div>
      <div className="space-y-1">
        <h2 className="flex items-center gap-1 text-subheading font-medium text-dark-graphite">
          {title}
          <ChevronRight size={16} strokeWidth={1.5} className="text-mid-gray transition-transform group-hover:translate-x-0.5" />
        </h2>
        <p className="text-caption text-mid-gray">{description}</p>
      </div>
    </Link>
  )
}

/** /tutoriales/:sectionId: galeria de los videos de una seccion. `?ver=<id>`
 *  abre ese video directo (los enlaces del indice llegan asi). */
export function TutorialSectionPage() {
  const { sectionId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const section = TUTORIAL_SECTIONS.find((s) => s.id === sectionId)
  const items = tutorialsOf(sectionId)
  const playing = TUTORIALS.find((t) => t.id === params.get('ver') && t.sectionId === sectionId) ?? null

  if (!section) return <Navigate to="/tutoriales" replace />

  const play = (t: Tutorial | null) => setParams(t ? { ver: t.id } : {}, { replace: true })

  return (
    <PageTransition>
      <PageHeader
        title={section.title}
        subtitle={<span className="text-body text-mid-gray">{section.description}</span>}
        backTo="/tutoriales"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => <TutorialCard key={t.id} tutorial={t} onPlay={() => play(t)} />)}
      </div>

      <PlayerDialog tutorial={playing} onClose={() => play(null)} />
    </PageTransition>
  )
}

function TutorialCard({ tutorial: t, onPlay }: { tutorial: Tutorial; onPlay: () => void }) {
  const { data: url, isError } = useTutorialUrl(t.storagePath)
  const DeviceIcon = t.device === 'Celular' ? Smartphone : Laptop

  return (
    <button
      type="button"
      onClick={onPlay}
      disabled={!url}
      className="card-elevated group flex flex-col overflow-hidden rounded-xl bg-card-bg text-left transition-colors hover:border-border-hover disabled:cursor-default"
    >
      {/* Miniatura: el primer segundo del video. Misma proporcion para todas las
          tarjetas; el vertical se muestra completo sobre el fondo. */}
      <div className="relative aspect-[16/10] w-full bg-smoke">
        {url && (
          <video
            src={`${url}#t=1`}
            preload="metadata"
            muted
            playsInline
            className={cn('absolute inset-0 h-full w-full', t.orientation === 'portrait' ? 'object-contain' : 'object-cover')}
          />
        )}
        {/* Play en la esquina: los videos abren con un titulo al centro que no se tapa. */}
        <div className="absolute inset-0 flex items-end justify-end p-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-card-bg text-dark-graphite transition-transform group-hover:scale-105">
            {isError ? (
              <VideoOff size={20} strokeWidth={1.5} className="text-mid-gray" />
            ) : url ? (
              <Play size={20} strokeWidth={1.5} className="ml-0.5" />
            ) : (
              <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-mid-gray" />
            )}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-body font-medium text-dark-graphite">{t.title}</p>
        <p className="text-caption text-mid-gray">{isError ? 'No se pudo cargar el video.' : t.description}</p>
        <div className="mt-auto flex gap-2 pt-2">
          <Badge><Clock size={12} strokeWidth={1.5} /> {t.duration}</Badge>
          <Badge variant="outline"><DeviceIcon size={12} strokeWidth={1.5} /> {t.device}</Badge>
        </div>
      </div>
    </button>
  )
}

function PlayerDialog({ tutorial, onClose }: { tutorial: Tutorial | null; onClose: () => void }) {
  return (
    <Dialog open={tutorial !== null} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
      <DialogContent className={tutorial?.orientation === 'portrait' ? 'sm:max-w-sm' : 'sm:max-w-4xl'}>
        {tutorial && <Player tutorial={tutorial} />}
      </DialogContent>
    </Dialog>
  )
}

function Player({ tutorial: t }: { tutorial: Tutorial }) {
  const { data: url } = useTutorialUrl(t.storagePath)
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.title}</DialogTitle>
        <DialogDescription>{t.description}</DialogDescription>
      </DialogHeader>
      {url && (
        <video
          src={url}
          controls
          autoPlay
          playsInline
          className="max-h-[75dvh] w-full rounded-lg bg-smoke"
        />
      )}
    </>
  )
}
