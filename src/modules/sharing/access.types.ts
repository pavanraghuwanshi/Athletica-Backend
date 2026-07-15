export type AccessStatus = 'pending' | 'otpPending' | 'active' | 'rejected' | 'revoked'

export type AccessRequest = {
  id: string
  requesterUserId: string
  ownerUserId: string
  status: AccessStatus
  otpHash?: string
  otpExpiresAt?: Date
  otpSendCount?: number
  otpHoldUntil?: Date
  verifiedAt?: Date
  createdAt: Date
  updatedAt: Date
}
