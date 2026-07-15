import { AuthError } from '../auth/auth.service'
import type { AuthUserResponse } from '../auth/auth.types'
import { userStore } from '../auth/auth.store'
import { usersService } from '../users/users.service'
import { adminGroupStore } from './admin-group.store'
import type { AdminGroup, AdminGroupInput } from './admin-group.types'

const normalizeText = (value?: string) => value?.trim()

const normalizeMemberIds = async (admin: AuthUserResponse, memberUserIds?: string[]) => {
  if (!memberUserIds) {
    return []
  }

  if (!Array.isArray(memberUserIds) || memberUserIds.some((id) => typeof id !== 'string' || !id.trim())) {
    throw new AuthError('memberUserIds must be an array of user ids', 400)
  }

  return usersService.ensureVisibleUserIds(admin, memberUserIds.map((id) => id.trim()))
}

const toResponse = async (group: AdminGroup) => {
  const members = await userStore.listByIds(group.memberUserIds)

  return {
    id: group.id,
    adminUserId: group.adminUserId,
    name: group.name,
    sport: group.sport,
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      picture: member.picture,
      role: member.role,
    })),
    memberUserIds: group.memberUserIds,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  }
}

const getOwnedGroup = async (admin: AuthUserResponse, groupId: string) => {
  const group = await adminGroupStore.findById(groupId)

  if (!group || group.adminUserId !== admin.id) {
    throw new AuthError('Group not found', 404)
  }

  return group
}

export const adminGroupService = {
  create: async (admin: AuthUserResponse, input: AdminGroupInput) => {
    const name = normalizeText(input.name)

    if (!name) {
      throw new AuthError('Group name is required', 400)
    }

    const group = await adminGroupStore.create({
      adminUserId: admin.id,
      name,
      sport: normalizeText(input.sport),
      memberUserIds: await normalizeMemberIds(admin, input.memberUserIds),
    })

    return toResponse(group)
  },

  list: async (admin: AuthUserResponse) => {
    return Promise.all((await adminGroupStore.listByAdmin(admin.id)).map(toResponse))
  },

  get: async (admin: AuthUserResponse, groupId: string) => {
    return toResponse(await getOwnedGroup(admin, groupId))
  },

  update: async (admin: AuthUserResponse, groupId: string, input: AdminGroupInput) => {
    await getOwnedGroup(admin, groupId)

    const name = input.name === undefined ? undefined : normalizeText(input.name)

    if (input.name !== undefined && !name) {
      throw new AuthError('Group name is required', 400)
    }

    const updated = await adminGroupStore.update(groupId, {
      name,
      sport: input.sport === undefined ? undefined : normalizeText(input.sport),
      memberUserIds: input.memberUserIds === undefined ? undefined : await normalizeMemberIds(admin, input.memberUserIds),
    })

    return toResponse(updated!)
  },

  remove: async (admin: AuthUserResponse, groupId: string) => {
    await getOwnedGroup(admin, groupId)
    await adminGroupStore.deleteById(groupId)

    return { message: 'Group deleted' }
  },
}
