export interface CreateWarrantyClaimInput {
  billFile: File
  name?: string
  invoiceNumber?: string
  purchasingDate?: Date
  reason?: string
}

export interface UpdateWarrantyClaimInput {
  billFile?: File
  name?: string
  invoiceNumber?: string
  purchasingDate?: Date
  reason?: string
  status?: 'pending' | 'approved' | 'rejected'
}
