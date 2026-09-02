import { env } from '../../config/env'
import mongoose from 'mongoose'
import { systemSettingsStore } from '../system-settings/system-settings.store'

let cachedToken: string | null = null;
let tokenExpiryTime: number | null = null;

async function getShopifyAccessToken(): Promise<string | null> {
  // Check if we have a valid cached token (give a 5 minute buffer)
  if (cachedToken && tokenExpiryTime && Date.now() < tokenExpiryTime - 5 * 60 * 1000) {
    return cachedToken;
  }

  const shopifyDomain = process.env.SHOPIFY_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!shopifyDomain || !clientId || !clientSecret) {
    console.warn('Shopify API credentials (DOMAIN, CLIENT_ID, CLIENT_SECRET) not fully configured.');
    return null;
  }

  try {
    const response = await fetch(`https://${shopifyDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Shopify access token: ${await response.text()}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    // data.expires_in is in seconds, convert to milliseconds
    tokenExpiryTime = Date.now() + (data.expires_in * 1000); 
    return cachedToken;
  } catch (error) {
    console.error('Error fetching Shopify access token:', error);
    return null;
  }
}

export const shopifyService = {
  createDiscountCode: async (code: string) => {
    try {
      const shopifyDomain = process.env.SHOPIFY_DOMAIN
      const shopifyAccessToken = await getShopifyAccessToken()
      
      if (!shopifyDomain || !shopifyAccessToken) {
        console.warn('Shopify API credentials not configured. Skipping discount code creation.')
        return
      }

      const settings = await systemSettingsStore.getReferralSettings()
      
      const priceRuleData = {
        price_rule: {
          title: `Referral - ${code}`,
          target_type: 'line_item',
          target_selection: 'all',
          allocation_method: 'across',
          value_type: 'percentage',
          value: `-${settings.discountPercentage.toFixed(1)}`, // Dynamic discount
          customer_selection: 'all',
          starts_at: new Date().toISOString()
        }
      }

      const priceRuleRes = await fetch(`https://${shopifyDomain}/admin/api/2024-01/price_rules.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyAccessToken
        },
        body: JSON.stringify(priceRuleData)
      })

      if (!priceRuleRes.ok) {
        throw new Error(`Failed to create PriceRule: ${await priceRuleRes.text()}`)
      }

      const priceRule = await priceRuleRes.json()

      const discountCodeData = {
        discount_code: {
          code: code
        }
      }

      const discountRes = await fetch(`https://${shopifyDomain}/admin/api/2024-01/price_rules/${priceRule.price_rule.id}/discount_codes.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyAccessToken
        },
        body: JSON.stringify(discountCodeData)
      })

      if (!discountRes.ok) {
        throw new Error(`Failed to create Discount Code: ${await discountRes.text()}`)
      }

      console.log(`Successfully created Shopify discount code: ${code}`)
    } catch (error) {
      console.error('Error creating Shopify discount code:', error)
    }
  },

  handleOrderCreated: async (orderPayload: any) => {
    try {
      if (!orderPayload || !orderPayload.discount_codes) {
        return
      }

      for (const discount of orderPayload.discount_codes) {
        const code = discount.code
        if (code && code.startsWith('ATH-')) {
          const UserModel = mongoose.models.User
          if (!UserModel) {
            console.error('User model not found')
            return
          }
          const referrer = await UserModel.findOne({ referralCode: code })
          
          if (referrer) {
            const settings = await systemSettingsStore.getReferralSettings()
            const rewardPoints = settings.referralReward
            referrer.points = (referrer.points || 0) + rewardPoints
            await referrer.save()
            console.log(`Rewarded ${rewardPoints} points to referrer ${referrer.id} for order ${orderPayload.id}`)
          }
        }
      }
    } catch (error) {
      console.error('Error processing Shopify order:', error)
    }
  }
}
