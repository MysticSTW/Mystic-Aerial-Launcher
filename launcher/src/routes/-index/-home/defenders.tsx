import type { WorldInfoMission } from '../../../types/data/advanced-mode/world-info'

import { Collection } from '@discordjs/collection'
import { useTranslation } from 'react-i18next'

import { EmptySection } from '../-components/-empty'
import {
  MissionItem,
  MissionsContainer,
  Modifiers,
} from '../-components/-missions'
import { TitleSection } from '../-components/-title'

import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { isDefender } from '../../../lib/validations/resources'

export function DefendersSection({
  data,
}: {
  data: Collection<string, WorldInfoMission>
}) {
  const { t } = useTranslation(['alerts'])

  return (
    <section aria-labelledby="title-defenders">
      <TitleSection
        deps={data}
        id="title-defenders"
      >
        {t('sections.defenders.title')}
      </TitleSection>
      <EmptySection
        total={data.size}
        title={t('sections.defenders.empty')}
      >
        <MissionsContainer>
          {data.map((mission) => {
            const reward = mission.ui.alert.rewards.find((reward) =>
              isDefender(reward.itemId)
            )

            if (!reward) {
              return null
            }

            return (
              <MissionItem
                data={mission}
                key={mission.raw.mission.missionGuid}
              >
                <>
                  <img
                    src={reward.imageUrl}
                    className="img-type"
                  />
                  {reward.quantity > 1
                    ? numberWithCommaSeparator(reward.quantity)
                    : null}
                  <Modifiers data={mission.ui.mission.modifiers} />
                </>
              </MissionItem>
            )
          })}
        </MissionsContainer>
      </EmptySection>
    </section>
  )
}
