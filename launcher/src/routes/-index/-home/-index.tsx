import { LoadingMissions } from '../-components/-loading'
import { DefendersSection } from './defenders'
import { EndgameTwinePeaksSection } from './endgame-twine-peaks'
import { EndgameVenturesSection } from './endgame-ventures'
import { SurvivorsSection } from './survivors'
import { TodaysLlamaSection } from './todays-llama'
import { UncommonPerkUpSection } from './uncommon-perk-up'
import { VBucksSection } from './vbucks'

import { useAlertItemCounter } from '../-hooks'
import { useHomeData } from './-hooks'

import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { isLegendaryOrMythicSurvivor } from '../../../lib/validations/resources'
import { assets } from '../../../lib/repository'

export function HomeAlerts() {
  const {
    defenders,
    endgame,
    loading,
    survivors,
    uncommonPerks,
    vbucks,
  } = useHomeData()
  const vbucksTotal = useAlertItemCounter({
    data: vbucks,
    key: 'currency_mtxswap',
  })
  const survivorsTotal = useAlertItemCounter({
    data: survivors,
    validationFn: isLegendaryOrMythicSurvivor,
  })
  const uncommonPerksTotal = useAlertItemCounter({
    data: uncommonPerks,
    key: 'alteration_upgrade_uc',
  })

  return (
    <>
      <TodaysLlamaSection />

      <ul className="gap-2 grid grid-cols-3">
        <PreviewItem
          imageUrl={assets('currency_mtxswap')}
          quantity={vbucksTotal}
          title="Total V-Bucks"
        />
        <PreviewItem
          imageUrl={assets('voucher_generic_worker_sr')}
          quantity={survivorsTotal}
          title="Survivors"
        />
        <PreviewItem
          imageUrl={assets('reagent_alteration_upgrade_uc')}
          quantity={uncommonPerksTotal}
          title="Uncommon PERK-UP!"
        />
      </ul>

      <div className="space-y-1">
        {loading.isFetching ? (
          <div className="mt-6 space-y-6">
            <LoadingMissions
              total={2}
              section
              showTitle
            />
            <LoadingMissions
              total={2}
              section
              showTitle
            />
          </div>
        ) : (
          <>
            <VBucksSection data={vbucks} />
            <SurvivorsSection data={survivors} />
            <DefendersSection data={defenders} />
            <EndgameTwinePeaksSection data={endgame.twinePeaks} />
            <EndgameVenturesSection data={endgame.ventures} />
            <UncommonPerkUpSection data={uncommonPerks} />
          </>
        )}
      </div>
    </>
  )
}

function PreviewItem({
  imageUrl,
  quantity,
}: {
  imageUrl: string
  title: string
  quantity: number
}) {
  return (
    <li className="border flex items-center rounded">
      <div className="bg-transparent flex flex-shrink-0 h-10 items-center justify-center w-11">
        <img
          src={imageUrl}
          className="size-7"
        />
      </div>
      <div className="flex-grow font-medium px-2 text-center truncate">
        {numberWithCommaSeparator(quantity)}
      </div>
    </li>
  )
}
