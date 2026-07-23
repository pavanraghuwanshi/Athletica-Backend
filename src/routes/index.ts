import type { Hono } from 'hono'
import { videoController } from '../modules/advertisement-banner/video.controller'
import { authRoutes } from '../modules/auth/auth.routes'
import { usersRoutes } from '../modules/users/users.routes'
import { healthRoutes } from '../modules/health/health.routes'
import { heartRateRoutes } from '../modules/heart-rate/heart-rate.routes'
import { pedometerRoutes } from '../modules/pedometer/pedometer.routes'
import { sleepRoutes } from '../modules/sleep/sleep.routes'
import { bloodOxygenRoutes } from '../modules/blood-oxygen/blood-oxygen.routes'
import { bloodGlucoseRoutes } from '../modules/blood-glucose/blood-glucose.routes'
import { bloodComponentsRoutes } from '../modules/blood-components/blood-components.routes'
import { bodyTemperatureRoutes } from '../modules/body-temperature/body-temperature.routes'
import { hrvRoutes } from '../modules/hrv/hrv.routes'
import { stressRoutes } from '../modules/stress/stress.routes'
import { metRoutes } from '../modules/met/met.routes'
import { bloodPressureRoutes } from '../modules/blood-pressure/blood-pressure.routes'
import { bodyCompositionRoutes } from '../modules/body-composition/body-composition.routes'
import { ecgRoutes } from '../modules/ecg/ecg.routes'
import { sportsWorkoutRoutes } from '../modules/sports-workout/sports-workout.routes'
import { accessRoutes } from '../modules/sharing/access.routes'
import { adminGroupRoutes } from '../modules/admin-groups/admin-group.routes'
import { syncRoutes } from '../modules/sync/sync.routes'
import { personInfoRoutes } from '../modules/person-info/person-info.routes'
import { advertisementBannerRoutes } from '../modules/advertisement-banner/advertisement-banner.routes'

export const registerRoutes = (app: Hono) => {
  app.route('/api/', healthRoutes)
  app.route('/api/auth', authRoutes)
  app.route('/api/users', usersRoutes)
  app.route('/api/person-info', personInfoRoutes)
  app.route('/api/bandpro/heart-rate', heartRateRoutes)
  app.route('/api/bandpro/pedometer', pedometerRoutes)
  app.route('/api/bandpro/sleep', sleepRoutes)
  app.route('/api/bandpro/blood-oxygen', bloodOxygenRoutes)
  app.route('/api/bandpro/blood-glucose', bloodGlucoseRoutes)
  app.route('/api/bandpro/blood-components', bloodComponentsRoutes)
  app.route('/api/bandpro/body-temperature', bodyTemperatureRoutes)
  app.route('/api/bandpro/hrv', hrvRoutes)
  app.route('/api/bandpro/stress', stressRoutes)
  app.route('/api/bandpro/met', metRoutes)
  app.route('/api/bandpro/blood-pressure', bloodPressureRoutes)
  app.route('/api/bandpro/body-composition', bodyCompositionRoutes)
  app.route('/api/bandpro/ecg', ecgRoutes)
  app.route('/api/bandpro/sports-workout', sportsWorkoutRoutes)
  app.route('/api/bandpro/sync', syncRoutes)
  app.route('/api/admin-access', accessRoutes)
  app.route('/api/admin-groups', adminGroupRoutes)
  app.route('/api/advertisement-banner', advertisementBannerRoutes)
  
  app.get('/api/videos/banners/:filename', videoController.streamVideo)
}
