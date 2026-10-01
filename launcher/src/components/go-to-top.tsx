import { ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { memo, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '../lib/utils'

type GoToTopProps = {
  containerId: string
}

export const GoToTop = memo(({ containerId }: GoToTopProps) => {
  const { t } = useTranslation(['general'])

  const { scrollToTopButtonIsVisible, scrollButtonOnClick } =
    useScrollToTop({
      containerId,
    })

  // Portal to <body> so `fixed` is relative to the window, not to a
  // transformed/blurred ancestor (which made the button scroll with content).
  return createPortal(
    <button
      aria-label={t('go-to-top')}
      className={cn(
        'backdrop-blur-sm bg-background/20 border border-white/15 bottom-5 fixed flex h-7 items-center justify-center opacity-0 pointer-events-none right-2 rounded-full text-foreground/70 transition-all w-7 z-30',
        'hover:bg-background/50 hover:border-white/30 hover:text-foreground',
        {
          'opacity-100 pointer-events-auto': scrollToTopButtonIsVisible,
        }
      )}
      title={t('go-to-top')}
      type="button"
      onClick={scrollButtonOnClick}
    >
      <ChevronUp className="h-4 w-4" />
    </button>,
    document.body
  )
})

function useScrollToTop(config: Pick<GoToTopProps, 'containerId'>) {
  const [scrollToTopButtonIsVisible, setScrollToTopButtonIsVisible] =
    useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setScrollToTopButtonIsVisible(!entry.isIntersecting)
      },
      {
        threshold: [0],
      }
    )

    const $container = document.getElementById(config.containerId)

    if ($container) {
      observer.observe($container)
    }

    return () => {
      observer.disconnect()
    }
  }, [])

  const scrollButtonOnClick = () => {
    document.querySelector('.main-wrapper-content')?.scroll({
      behavior: 'smooth',
      top: 0,
    })
  }

  return {
    scrollToTopButtonIsVisible,
    scrollButtonOnClick,
  }
}
