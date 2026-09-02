import { connectDatabase } from '../config/db'
import mongoose from 'mongoose'
import { shopifyService } from '../modules/shopify/shopify.service'
import { systemSettingsStore } from '../modules/system-settings/system-settings.store'

// Need to make sure User model is registered before we use it
import { userStore } from '../modules/auth/auth.store'

const generateReferralCode = (name: string) => {
  const cleanName = (name || 'USER').replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase()
  const randomChars = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
  return `ATH-${cleanName}-${randomChars}`
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const backfillReferrals = async () => {
  console.log('Connecting to database...')
  await connectDatabase()
  console.log('Database connected.\n')

  // Trigger userStore to initialize the Mongoose model
  await userStore.findByEmail('dummy@example.com')

  const UserModel = mongoose.models.User
  if (!UserModel) {
    console.error('User model not found!')
    process.exit(1)
  }

  // Find all users who do not have a referral code
  const usersToUpdate = await UserModel.find({
    $or: [
      { referralCode: { $exists: false } },
      { referralCode: null },
      { referralCode: '' }
    ]
  })

  console.log(`Found ${usersToUpdate.length} users who need a referral code.`)
  if (usersToUpdate.length === 0) {
    console.log('Nothing to do.')
    process.exit(0)
  }

  const settings = await systemSettingsStore.getReferralSettings()
  const defaultPoints = settings.signupBonus

  let successCount = 0

  for (let i = 0; i < usersToUpdate.length; i++) {
    const user = usersToUpdate[i]
    
    // 1. Generate code and add points
    const newCode = generateReferralCode(user.name || user.email.split('@')[0])
    user.referralCode = newCode
    user.points = defaultPoints
    
    await user.save()
    console.log(`[${i + 1}/${usersToUpdate.length}] Updated user ${user.email} -> Code: ${newCode}, Points: ${defaultPoints}`)

    // 2. Create the discount code in Shopify
    try {
      await shopifyService.createDiscountCode(newCode)
      console.log(`   -> Created Shopify discount for ${newCode}`)
    } catch (err: any) {
      console.error(`   -> Failed to create Shopify discount for ${newCode}:`, err.message)
    }

    successCount++

    // 3. Sleep for 500ms to avoid hitting Shopify API rate limits (Shopify allows 2 requests/sec on basic plan)
    await sleep(500)
  }

  console.log(`\n✅ Migration complete! Successfully backfilled ${successCount} users.`)
  process.exit(0)
}

backfillReferrals().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
