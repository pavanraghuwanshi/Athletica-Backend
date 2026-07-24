import { deviceStore } from './device.store'
import { userStore } from '../auth/auth.store'

export class DeviceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 401 | 403 | 404 | 409 | 500,
  ) {
    super(message)
  }
}

export const deviceService = {
  bulkUpload: async (macIds: string[]) => {
    if (!Array.isArray(macIds) || macIds.length === 0) {
      throw new DeviceError('Invalid payload: expected a non-empty array of MAC IDs', 400)
    }

    const validMacIds = macIds.filter(id => typeof id === 'string' && id.trim().length > 0)
    
    if (validMacIds.length === 0) {
      throw new DeviceError('Invalid payload: no valid MAC IDs found', 400)
    }

    const insertedCount = await deviceStore.bulkInsert(validMacIds)
    
    return {
      message: 'Bulk upload successful',
      insertedCount,
    }
  },

  activateDevice: async (macId: string, userId: string) => {
    if (!macId || typeof macId !== 'string') {
      throw new DeviceError('Valid MAC ID is required', 400)
    }

    const device = await deviceStore.findByMacId(macId)

    if (!device) {
      throw new DeviceError('Device not found', 404)
    }

    // if (device.userId && device.userId !== userId) {
    //   throw new DeviceError('Device already activated by another user', 403)
    // }

    let activationTime = device.activationTime
    
    if (!activationTime) {
      activationTime = new Date().toISOString()
      await deviceStore.activateDevice(macId, userId, activationTime)
    } else {
      // Even if already activated, we might still want to add it to this user's list
      // Or maybe update the userId. For now we will update user ID if not set.
      if (!device.userId) {
        await deviceStore.activateDevice(macId, userId, activationTime)
      }
    }

    await userStore.addDevice(userId, macId)

    return {
      status: 'ok',
      message: 'device exist',
    }
  },
}
