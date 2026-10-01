import type { PropsWithChildren } from 'react'

export function TitleSection({
  children,
  id,
}: PropsWithChildren<{
  deps?: unknown
  id?: string
}>) {
  const onScrollTop = () => {
    const childElement = document.querySelector(
      `[aria-labelledby=${id}]`
    ) as HTMLElement | null

    if (!childElement) {
      return
    }

    document.querySelector('.main-wrapper-content')?.scroll({
      behavior: 'smooth',
      top: childElement.offsetTop,
    })
  }

  return (
    <div>
      <h2
        className="bg-transparent cursor-pointer font-bold mt-2 py-2"
        onClick={onScrollTop}
        id={id}
      >
        <span className="gap-2 inline-flex items-center">
          {children}
        </span>
      </h2>
    </div>
  )
}
