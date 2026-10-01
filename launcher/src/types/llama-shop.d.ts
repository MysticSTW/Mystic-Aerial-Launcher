export type TodaysLlama = {
  name: string
  price: number | null
  templateId: string
}

export type WeeklyRewardProgress = {
  accountId: string
  completed: boolean
  displayName: string
  progress: number
  required: number
}

export type WeeklyReward = {
  accounts: Array<WeeklyRewardProgress>
  name: string
  resource: string
}
