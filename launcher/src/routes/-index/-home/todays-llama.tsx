import type { ReactNode } from 'react'
import type { TodaysLlama, WeeklyReward } from '../../../types/llama-shop'

import { useEffect, useState } from 'react'

import { getLlamaImage } from '../../../lib/llama-images'
import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { assets } from '../../../lib/repository'

type ShopExtras = {
  llamas: Array<TodaysLlama>
  weekly: Array<WeeklyReward>
}

// The llama and the weekly reward are loaded together and only shown once
// both are ready, so they always appear at the same time. The last result is
// kept between tab switches so the section renders at full height straight
// away.
let cached: ShopExtras | null = null
let pending: Promise<ShopExtras> | null = null

function loadShopExtras() {
  pending ??= Promise.all([
    window.electronAPI.requestTodaysLlamas().catch(() => []),
    window.electronAPI.requestWeeklyReward().catch(() => []),
  ])
    .then(([llamas, weekly]) => {
      cached = { llamas, weekly }

      return cached
    })
    .finally(() => {
      pending = null
    })

  return pending
}

/**
 * Called on app start so the data is usually ready before Home is shown.
 */
export function preloadShopExtras() {
  loadShopExtras().catch(() => {})
}

function useShopExtras() {
  const [data, setData] = useState<ShopExtras | null>(cached)

  useEffect(() => {
    let active = true

    loadShopExtras()
      .then((response) => {
        if (active) {
          setData(response)
        }
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  return data
}

export function TodaysLlamaSection() {
  const data = useShopExtras()
  const llamas = data?.llamas ?? []
  const weekly = data?.weekly ?? []

  if (llamas.length <= 0 && weekly.length <= 0) {
    return null
  }

  // Same 3 column grid as the totals row below, so the boxes line up.
  return (
    <div className="gap-2 grid grid-cols-3 mb-4">
      {llamas.map((llama) => (
        <Item
          image={getLlamaImage(llama.templateId)}
          key={llama.templateId}
          name={llama.name}
          title="Today's Llama"
        >
          {llama.price !== null && (
            <div className="flex gap-1 items-center mt-0.5 text-muted-foreground text-xs">
              <img
                src={assets('currency_xrayllama')}
                className="size-4"
                alt=""
              />
              {numberWithCommaSeparator(llama.price)}
            </div>
          )}
        </Item>
      ))}

      {weekly.map((reward) => (
        <Item
          image={assets(reward.resource)}
          key={reward.resource}
          name={reward.name}
          title="Weekly Supercharger"
        />
      ))}
    </div>
  )
}

function Item({
  children,
  image,
  name,
  title,
}: {
  children?: ReactNode
  image: string
  name: string
  title: string
}) {
  return (
    <div className="flex flex-col min-w-0">
      <h2 className="font-medium mb-2 text-muted-foreground text-sm">
        {title}
      </h2>
      <div className="border border-white/15 flex flex-grow gap-3 items-center pl-2 pr-3 py-1.5 rounded-lg">
        <img
          src={image}
          className="flex-shrink-0 object-contain size-16"
          alt=""
        />
        <div className="leading-tight min-w-0">
          <div className="font-medium text-white">{name}</div>
          {children}
        </div>
      </div>
    </div>
  )
}
