import { PageTransition } from './page-transition'
import { PageHeader } from './page-header'
import { SettingsTeamMembers } from './settings-team-members'

export function SettingsTeam() {
  return (
    <PageTransition>
      <PageHeader title="Equipo" />
      <SettingsTeamMembers />
    </PageTransition>
  )
}
