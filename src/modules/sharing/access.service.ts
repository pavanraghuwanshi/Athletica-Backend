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

const OTP_TTL_MS = 10 * 60 * 1000
const OTP_HOLD_MS = 10 * 60 * 1000
const MAX_OTP_SENDS_BEFORE_HOLD = 5

type OtpRequestState = {
  id: string
  otpSendCount?: number | null
  otpHoldUntil?: Date | null
}

const toResponse = async (request: {
  id: string
  requesterUserId: string
  ownerUserId: string
  status: string
  otpExpiresAt?: Date | null
  otpSendCount?: number | null
  otpHoldUntil?: Date | null
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
    otpSendsRemaining:
      request.status === 'otpPending'
        ? Math.max(0, MAX_OTP_SENDS_BEFORE_HOLD - (request.otpSendCount ?? 0))
        : undefined,
    otpHoldUntil: request.otpHoldUntil,
    verifiedAt: request.verifiedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }
}

const sendConnectionOtpEmail = async (ownerEmail: string, requester: AuthUserResponse, otp: string) => {
  await sendEmail({
    to: ownerEmail,
    subject: 'Your Athhleticaa connection OTP',
    text: `${requester.name} (${requester.email}) wants to connect with your Athhleticaa account. Your OTP is ${otp}. It expires in 10 minutes. Share it only if you approve this connection.`,
  })
}

const getNextOtpSendState = async (request: OtpRequestState) => {
  const now = Date.now()

  if (request.otpHoldUntil && request.otpHoldUntil.getTime() > now) {
    const retryAfterSeconds = Math.ceil((request.otpHoldUntil.getTime() - now) / 1000)
    throw new AuthError(`OTP resend limit reached; try again after ${retryAfterSeconds} seconds`, 429)
  }

  const otpSendCount = request.otpHoldUntil ? 0 : request.otpSendCount ?? 0

  if (otpSendCount >= MAX_OTP_SENDS_BEFORE_HOLD) {
    const otpHoldUntil = new Date(now + OTP_HOLD_MS)
    await accessStore.update(request.id, { otpHoldUntil })
    throw new AuthError('OTP resend limit reached; try again after 10 minutes', 429)
  }

  const nextOtpSendCount = otpSendCount + 1

  return {
    otpSendCount: nextOtpSendCount,
    otpHoldUntil: nextOtpSendCount >= MAX_OTP_SENDS_BEFORE_HOLD ? new Date(now + OTP_HOLD_MS) : undefined,
  }
}

const getOtpSentMessage = (otpSendCount: number) => {
  return otpSendCount >= MAX_OTP_SENDS_BEFORE_HOLD
    ? 'OTP sent. Five sends used; resends are available again after 10 minutes.'
    : 'OTP sent. It expires in 10 minutes.'
}

const sendConnectionOtp = async (
  request: OtpRequestState,
  requester: AuthUserResponse,
  ownerEmail: string,
  deleteRequestOnFailure = false,
) => {
  const sendState = await getNextOtpSendState(request)
  const otp = generateOtp()
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS)

  try {
    await sendConnectionOtpEmail(ownerEmail, requester, otp)
  } catch {
    if (deleteRequestOnFailure) {
      await accessStore.deleteById(request.id)
    }

    throw new AuthError('Unable to send OTP email', 502)
  }

  const updated = await accessStore.update(request.id, {
    status: 'otpPending',
    otpHash: await hashOtp(request.id, otp),
    otpExpiresAt,
    ...sendState,
  })

  return {
    request: await toResponse(updated!),
    message: getOtpSentMessage(sendState.otpSendCount),
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
      if (existing.status === 'active') {
        return {
          request: await toResponse(existing),
          message: 'Access is already active for this user.',
        }
      }

      return sendConnectionOtp(existing, requester, owner.email)
    }

    const request = await accessStore.create(requester.id, owner.id)
    return sendConnectionOtp(request, requester, owner.email, true)
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
      return toResponse(existing)
    }

    return toResponse(await accessStore.create(requester.id, owner.id))
  },

  accept: async (owner: AuthUserResponse, requestId: string) => {
    const request = await accessStore.findById(requestId)

    if (!request || request.ownerUserId !== owner.id) {
      throw new AuthError('Access request not found', 404)
    }

    if (!['pending', 'otpPending'].includes(request.status)) {
      throw new AuthError('Only pending requests can receive an OTP', 409)
    }

    const sendState = await getNextOtpSendState(request)
    const otp = generateOtp()
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS)
    const updated = await accessStore.update(request.id, {
      status: 'otpPending',
      otpHash: await hashOtp(request.id, otp),
      otpExpiresAt,
      ...sendState,
    })

    return {
      request: await toResponse(updated!),
      otp,
      message:
        sendState.otpSendCount >= MAX_OTP_SENDS_BEFORE_HOLD
          ? 'Share this OTP with the requester. Five sends used; another OTP is available after 10 minutes.'
          : 'Share this OTP with the requesting user. It expires in 10 minutes.',
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
      otpSendCount: undefined,
      otpHoldUntil: undefined,
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

    if (requester.role === 'user') {
      await userStore.setRole(requester.id, 'admin')
    }

    return toResponse((await accessStore.update(request.id, {
      status: 'active',
      otpHash: undefined,
      otpExpiresAt: undefined,
      otpSendCount: undefined,
      otpHoldUntil: undefined,
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

  listActiveOwnerIds: async (requesterUserId: string) => {
    return (await accessStore.listActiveByRequester(requesterUserId)).map((request) => request.ownerUserId)
  },

  listReceived: async (owner: AuthUserResponse) => {
    return Promise.all((await accessStore.listByOwner(owner.id)).map(toResponse))
  },

  hasActiveAccess: (requesterUserId: string, ownerUserId: string) => {
    return accessStore.hasActive(requesterUserId, ownerUserId)
  },
}
