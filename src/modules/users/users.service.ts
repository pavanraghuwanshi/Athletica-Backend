import { AuthError } from '../auth/auth.service'
import { userStore } from '../auth/auth.store'
import type { AuthUserResponse, User } from '../auth/auth.types'
import { accessService } from '../sharing/access.service'

type VisibleUser = Pick<User, 'id' | 'name' | 'email' | 'picture' | 'role' | 'createdAt' | 'updatedAt'> & {
  accessType: 'self' | 'dataAdmin' | 'superAdmin'
}

const toVisibleUser = (user: User, accessType: VisibleUser['accessType']): VisibleUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  picture: user.picture,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  accessType,
})

export const usersService = {
  listVisible: async (viewer: AuthUserResponse) => {
    if (viewer.role === 'superAdmin') {
      return (await userStore.listAll()).map((user) => toVisibleUser(user, user.id === viewer.id ? 'self' : 'superAdmin'))
    }

    const ownerIds = await accessService.listActiveOwnerIds(viewer.id)
    const users = await userStore.listByIds([viewer.id, ...ownerIds])

    return users.map((user) => toVisibleUser(user, user.id === viewer.id ? 'self' : 'dataAdmin'))
  },

  getVisibleById: async (viewer: AuthUserResponse, userId: string) => {
    const users = await usersService.listVisible(viewer)
    const user = users.find((candidate) => candidate.id === userId)

    if (!user) {
      throw new AuthError('User not found or not accessible', 404)
    }

    return user
  },

  ensureVisibleUserIds: async (viewer: AuthUserResponse, userIds: string[]) => {
    const uniqueUserIds = [...new Set(userIds)]
    const visibleUsers = await usersService.listVisible(viewer)
    const visibleUserIds = new Set(visibleUsers.map((user) => user.id))
    const blockedUserId = uniqueUserIds.find((userId) => !visibleUserIds.has(userId))

    if (blockedUserId) {
      throw new AuthError(`User ${blockedUserId} is not accessible`, 403)
    }

    return uniqueUserIds
  },
}
