import type { FilterOptionOption } from 'react-select/dist/declarations/src/filters'
import type { StylesConfig } from 'react-select'

import chroma from 'chroma-js'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Select, { components } from 'react-select'

import { defaultColor } from '../../../../config/constants/colors'

export type SelectOption = {
  color?: string
  icon?: string
  label: string
  value: string
}

export type SelectCustomFilter =
  | ((
      candidate: FilterOptionOption<SelectOption>,
      input: string
    ) => boolean)
  | null

const { MultiValue, Option } = components

export function InputTags({
  customFilter,
  isDisabled,
  menuPortalTarget,
  options,
  placeholder,
  value,

  onChange,
}: {
  customFilter?: SelectCustomFilter
  isDisabled?: boolean
  menuPortalTarget?: string
  options: Array<SelectOption>
  placeholder: string
  value: Array<SelectOption>

  onChange: (value: Array<SelectOption>) => void
}) {
  const { t } = useTranslation(['general'])

  const $menuPortalTarget = useRef<HTMLElement>()

  useEffect(() => {
    if (menuPortalTarget) {
      const $element = document.getElementById(menuPortalTarget)

      if ($element) {
        $menuPortalTarget.current = $element
      }
    }
  }, [value])

  return (
    <Select
      placeholder={placeholder}
      noOptionsMessage={() => t('no-options')}
      options={options}
      value={value}
      styles={colourStyles}
      classNames={{
        clearIndicator: () => 'px-1 text-muted-foreground',
        container: () =>
          'border border-white/15 bg-transparent rounded-md',
        control: () =>
          'flex h-10 items-center bg-transparent border border-white/15 rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        dropdownIndicator: () =>
          'pl-1.5 text-muted-foreground w-4 h-4 opacity-50',
        indicatorSeparator: () => 'bg-white/10',
        input: () => 'text-sm placeholder:text-muted-foreground',
        menu: () =>
          'bg-black/40 backdrop-blur-2xl backdrop-saturate-150 border border-white/10 my-2 overflow-hidden rounded-lg shadow-xl z-20',
        multiValue: () =>
          'max-w-56 rounded-md border border-white/15 bg-white/10 text-sm',
        multiValueLabel: () => 'px-1.5',
        multiValueRemove: () =>
          'px-1.5 rounded-r hover:bg-white/15 hover:text-foreground',
        noOptionsMessage: () => 'py-3 text-muted-foreground',
        option: () =>
          'overflow-hidden px-2 py-2 text-ellipsis text-sm hover:bg-white/10',
        placeholder: () => 'text-muted-foreground text-sm',
        valueContainer: () => 'gap-1',
        menuPortal: () => '!z-40',
      }}
      components={{
        Option: (props) => {
          return (
            <Option {...props}>
              <LabelWithIcon
                icon={props.data.icon}
                label={props.data.label}
              />
            </Option>
          )
        },
        MultiValue: (props) => {
          return (
            <MultiValue {...props}>
              <LabelWithIcon
                icon={props.data.icon}
                label={props.data.label}
              />
            </MultiValue>
          )
        },
      }}
      onChange={(values) => {
        onChange(values as Array<SelectOption>)

        return
      }}
      filterOption={customFilter}
      closeMenuOnSelect={false}
      isDisabled={isDisabled}
      menuPortalTarget={$menuPortalTarget.current ?? document.body}
      menuPosition="fixed"
      isMulti
      unstyled
    />
  )
}

function LabelWithIcon({
  label,
  icon,
}: Pick<SelectOption, 'icon' | 'label'>) {
  return (
    <div className="flex gap-1.5 items-center">
      {icon !== undefined && (
        <img
          className="flex-shrink-0 size-4"
          src={icon}
          alt={label}
        />
      )}
      {label}
    </div>
  )
}

function getDefaultColor(color?: string) {
  return color ?? defaultColor
}

const colourStyles: StylesConfig<SelectOption, true> = {
  option: (styles, { data, isDisabled, isFocused, isSelected }) => {
    const currentColor = getDefaultColor(data.color)
    const color = chroma(currentColor)

    return {
      ...styles,
      backgroundColor: isDisabled
        ? undefined
        : isSelected
          ? currentColor
          : isFocused
            ? color.alpha(0.1).css()
            : undefined,
      color: isDisabled
        ? '#666666'
        : isSelected
          ? chroma.contrast(color, 'white') > 2
            ? 'white'
            : 'black'
          : currentColor,
      cursor: isDisabled ? 'not-allowed' : 'default',

      ':active': {
        ...styles[':active'],
        backgroundColor: !isDisabled
          ? isSelected
            ? currentColor
            : color.alpha(0.3).css()
          : undefined,
      },
    }
  },
  multiValue: (styles, { data }) => {
    const color = chroma(getDefaultColor(data.color))
    return {
      ...styles,
      backgroundColor: color.alpha(0.1).css(),
    }
  },
  multiValueLabel: (styles, { data }) => ({
    ...styles,
    color: getDefaultColor(data.color),
  }),
  multiValueRemove: (styles, { data }) => ({
    ...styles,
    color: getDefaultColor(data.color),
    ':hover': {
      backgroundColor: getDefaultColor(data.color),
      color: 'white',
    },
  }),
}
