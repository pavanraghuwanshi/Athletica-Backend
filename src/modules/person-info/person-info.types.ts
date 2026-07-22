export type PersonInfo = {
  userId: string
  gender: 'Male' | 'Female' | 'Other'
  name: string
  height: number
  weight: number
  age: number
  createdAt: string
  updatedAt: string
}

export type SavePersonInfoInput = {
  gender: 'Male' | 'Female' | 'Other'
  name: string
  height: number
  weight: number
  age: number
}
