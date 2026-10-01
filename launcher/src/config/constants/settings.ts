import { Language } from '../../locales/resources'

export const defaultAppLanguage: Language = Language.English
export const availableLanguages: Array<{
  id: Language
  title: string
  completed?: boolean
}> = [
  {
    id: Language.English,
    title: 'English',
  },
]
