import { Hono } from 'hono'
import { systemSettingsController } from './system-settings.controller'

const systemSettingsRoutes = new Hono()

systemSettingsRoutes.get('/referral', systemSettingsController.getReferralSettings)
systemSettingsRoutes.put('/referral', systemSettingsController.updateReferralSettings)

export { systemSettingsRoutes }
