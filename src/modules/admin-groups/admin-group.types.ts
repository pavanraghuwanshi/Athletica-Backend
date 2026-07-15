export type AdminGroup = {
  id: string
  adminUserId: string
  name: string
  sport?: string
  memberUserIds: string[]
  createdAt: Date
  updatedAt: Date
}

export type AdminGroupInput = {
  name?: string
  sport?: string
  memberUserIds?: string[]
}
