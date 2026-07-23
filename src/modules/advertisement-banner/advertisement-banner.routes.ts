import { Hono } from 'hono'
import { advertisementBannerController } from './advertisement-banner.controller'

export const advertisementBannerRoutes = new Hono()

advertisementBannerRoutes.get('/', advertisementBannerController.listAll)
advertisementBannerRoutes.get('/:id', advertisementBannerController.getById)
advertisementBannerRoutes.post('/', advertisementBannerController.create)
advertisementBannerRoutes.put('/:id', advertisementBannerController.update)
advertisementBannerRoutes.delete('/:id', advertisementBannerController.delete)
