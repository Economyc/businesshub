import { useState } from 'react'
import { cn } from '@/lib/utils'
import { PageTransition } from './page-transition'
import { PageHeader } from './page-header'
import { SettingsTeamMembers } from './settings-team-members'
import { SettingsTeamRoles } from './settings-team-roles'

type Tab = 'members' | 'roles'

export function SettingsTeam() {
  const [tab, setTab] = useState<Tab>('members')

  return (
    <PageTransition>
      <PageHeader title="Equipo" />

      <div className="flex gap-1 mb-6 bg-smoke rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('members')}
          className={cn(
            'px-4 py-2 rounded-md text-body font-medium transition-all duration-200',
            tab === 'members'
              ? 'bg-surface shadow-sm text-dark-graphite'
              : 'text-mid-gray hover:text-graphite',
          )}
        >
          Miembros
        </button>
        <button
          onClick={() => setTab('roles')}
          className={cn(
            'px-4 py-2 rounded-md text-body font-medium transition-all duration-200',
            tab === 'roles'
              ? 'bg-surface shadow-sm text-dark-graphite'
              : 'text-mid-gray hover:text-graphite',
          )}
        >
          Roles
        </button>
      </div>

      {tab === 'members' && <SettingsTeamMembers />}
      {tab === 'roles' && <SettingsTeamRoles />}
    </PageTransition>
  )
}
