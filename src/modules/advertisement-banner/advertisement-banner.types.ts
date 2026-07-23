export interface AdvertisementBanner {
  id: string
  fileUrl: string
  contentType: 'image' | 'video'
  sequence: number
  redirectUrl?: string
  createdAt: string
  updatedAt: string
}

export interface CreateAdvertisementBannerInput {
  file?: File | string // `string` for backward compatibility or cases where it's parsed as something else, but primarily it'll be a File from multipart/form-data
  contentType?: 'image' | 'video'
  sequence?: number
  redirectUrl?: string
}

export type UpdateAdvertisementBannerInput = Partial<CreateAdvertisementBannerInput>
