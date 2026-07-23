export interface AdvertisementBanner {
  id: string
  imageUrl: string
  sequence: number
  redirectUrl?: string
  createdAt: string
  updatedAt: string
}

export type CreateAdvertisementBannerInput = Omit<AdvertisementBanner, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateAdvertisementBannerInput = Partial<CreateAdvertisementBannerInput>
