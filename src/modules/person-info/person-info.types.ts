export type PersonInfo = {
  userId: string
  gender: 'Male' | 'Female' | 'Other'
  name: string
  surname?: string
  height: number
  weight: number
  age: number
  createdAt: string
  updatedAt: string
}

export type SavePersonInfoInput = {
  gender: 'Male' | 'Female' | 'Other'
  name: string
  surname?: string
  height: number
  weight: number
  age: number
}
