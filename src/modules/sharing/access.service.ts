import { env } from '../../config/env'
import { sendEmail } from '../../shared/email/email.service'
import { userStore } from '../auth/auth.store'
import { AuthError } from '../auth/auth.service'
import type { AuthUserResponse } from '../auth/auth.types'
import { accessStore } from './access.store'

const normalizeEmail = (email?: string) => email?.trim().toLowerCase() ?? ''

const hashOtp = async (requestId: string, otp: string) => {
  const bytes = new TextEncoder().encode(`${requestId}:${otp}:${env.jwtSecret}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const generateOtp = () => {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
}

const toResponse = async (request: {
  id: string
  requesterUserId: string
  ownerUserId: string
  status: string
  otpExpiresAt?: Date | null
  verifiedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}) => {
  const [requester, owner] = await Promise.all([
    userStore.findById(request.requesterUserId),
    userStore.findById(request.ownerUserId),
  ])

  return {
    id: request.id,
    requester: requester ? { id: requester.id, name: requester.name, email: requester.email } : null,
    owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
    status: request.status,
    otpExpiresAt: request.otpExpiresAt,
    verifiedAt: request.verifiedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }
}

export const accessService = {
  connectByEmail: async (requester: AuthUserResponse, ownerEmailInput?: string) => {
    const ownerEmail = normalizeEmail(ownerEmailInput)

    if (!ownerEmail) {
      throw new AuthError('User email is required', 400)
    }

    if (ownerEmail === requester.email) {
      throw new AuthError('You already have access to your own data', 400)
    }

    const owner = await userStore.findByEmail(ownerEmail)

    if (!owner) {
      throw new AuthError('User not found', 404)
    }

    const existing = await accessStore.findOpen(requester.id, owner.id)

    if (existing) {
      throw new AuthError('An open or active request already exists for this user', 409)
    }

    const request = await accessStore.create(requester.id, owner.id)
    const otp = generateOtp()
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
    const updated = await accessStore.update(request.id, {
      status: 'otpPending',
      otpHash: await hashOtp(request.id, otp),
      otpExpiresAt,
    })

    try {
      await sendEmail({
        to: owner.email,
        subject: 'Your Athhleticaa connection OTP',
        text: `${requester.name} (${requester.email}) wants to connect with your Athhleticaa account. Your OTP is ${otp}. It expires in 10 minutes. Share it only if you approve this connection.`,
      })
    } catch {
      await accessStore.deleteById(request.id)
      throw new AuthError('Unable to send OTP email', 502)
    }

    return {
      request: await toResponse(updated!),
      message: 'OTP sent to the user email. It expires in 10 minutes.',
    }
  },

  requestAccess: async (requester: AuthUserResponse, ownerEmailInput?: string) => {
    const ownerEmail = normalizeEmail(ownerEmailInput)

    if (!ownerEmail) {
      throw new AuthError('User email is required', 400)
    }

    if (ownerEmail === requester.email) {
      throw new AuthError('You already have access to your own data', 400)
    }

    const owner = await userStore.findByEmail(ownerEmail)

    if (!owner) {
      throw new AuthError('User not found', 404)
    }

    const existing = await accessStore.findOpen(requester.id, owner.id)

    if (existing) {
      throw new AuthError('An open or active request already exists for this user', 409)
    }

    return toResponse(await accessStore.create(requester.id, owner.id))
  },

  accept: async (owner: AuthUserResponse, requestId: string) => {
    const request = await accessStore.findById(requestId)

    if (!request || request.ownerUserId !== owner.id) {
      throw new AuthError('Access request not found', 404)
    }

    if (request.status !== 'pending') {
      throw new AuthError('Only pending requests can be accepted', 409)
    }

    const otp = generateOtp()
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
    const updated = await accessStore.update(request.id, {
      status: 'otpPending',
      otpHash: await hashOtp(request.id, otp),
      otpExpiresAt,
    })

    return {
      request: await toResponse(updated!),
      otp,
      message: 'Share this OTP with the requesting user. It expires in 10 minutes.',
    }
  },

  reject: async (owner: AuthUserResponse, requestId: string) => {
    const request = await accessStore.findById(requestId)

    if (!request || request.ownerUserId !== owner.id) {
      throw new AuthError('Access request not found', 404)
    }

    if (!['pending', 'otpPending'].includes(request.status)) {
      throw new AuthError('This request cannot be rejected', 409)
    }

    return toResponse((await accessStore.update(request.id, {
      status: 'rejected',
      otpHash: undefined,
      otpExpiresAt: undefined,
    }))!)
  },

  verifyOtp: async (requester: AuthUserResponse, requestId: string, otp?: string) => {
    const request = await accessStore.findById(requestId)

    if (!request || request.requesterUserId !== requester.id) {
      throw new AuthError('Access request not found', 404)
    }

    if (request.status !== 'otpPending' || !request.otpHash || !request.otpExpiresAt) {
      throw new AuthError('This request is not waiting for OTP verification', 409)
    }

    if (request.otpExpiresAt.getTime() <= Date.now()) {
      await accessStore.setStatus(request.id, 'rejected')
      throw new AuthError('OTP has expired; create a new access request', 400)
    }

    if (!/^\d{6}$/.test(otp ?? '') || (await hashOtp(request.id, otp!)) !== request.otpHash) {
      throw new AuthError('Invalid OTP', 401)
    }

    return toResponse((await accessStore.update(request.id, {
      status: 'active',
      otpHash: undefined,
      otpExpiresAt: undefined,
      verifiedAt: new Date(),
    }))!)
  },

  revoke: async (owner: AuthUserResponse, requestId: string) => {
    const request = await accessStore.findById(requestId)

    if (!request || request.ownerUserId !== owner.id) {
      throw new AuthError('Access grant not found', 404)
    }

    if (request.status !== 'active') {
      throw new AuthError('Only active access can be revoked', 409)
    }

    return toResponse((await accessStore.setStatus(request.id, 'revoked'))!)
  },

  listSent: async (requester: AuthUserResponse) => {
    return Promise.all((await accessStore.listByRequester(requester.id)).map(toResponse))
  },

  listReceived: async (owner: AuthUserResponse) => {
    return Promise.all((await accessStore.listByOwner(owner.id)).map(toResponse))
  },

  hasActiveAccess: (requesterUserId: string, ownerUserId: string) => {
    return accessStore.hasActive(requesterUserId, ownerUserId)
  },
}
