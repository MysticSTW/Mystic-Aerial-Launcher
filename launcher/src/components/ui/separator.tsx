import type { ComponentPropsWithoutRef, ElementRef } from 'react'

import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { forwardRef } from 'react'

import { cn } from '../../lib/utils'

const Separator = forwardRef<
  ElementRef<typeof SeparatorPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = 'horizontal', decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-transparent border-none',
        orientation === 'horizontal' ? 'h-0 w-full' : 'h-full w-0',
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
