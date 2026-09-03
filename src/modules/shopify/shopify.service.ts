import { env } from '../../config/env'
import mongoose from 'mongoose'
import { systemSettingsStore } from '../system-settings/system-settings.store'

let cachedToken: string | null = null;
let tokenExpiryTime: number | null = null;

async function getShopifyAccessToken(): Promise<string | null> {
  // If a permanent Custom App Admin token is provided, use it directly (no OAuth needed)
  if (process.env.SHOPIFY_ACCESS_TOKEN) {
    return process.env.SHOPIFY_ACCESS_TOKEN;
  }

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
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
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
      
      const graphqlQuery = {
        query: `mutation CreateDiscount($basicCodeDiscount: DiscountCodeBasicInput!) {
          discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
            codeDiscountNode {
              id
              codeDiscount {
                ... on DiscountCodeBasic {
                  title
                  codes(first: 1) {
                    nodes {
                      code
                    }
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }`,
        variables: {
          basicCodeDiscount: {
            title: `Referral - ${code}`,
            code: code,
            startsAt: new Date().toISOString(),
            customerSelection: {
              all: true
            },
            appliesOncePerCustomer: false,
            customerGets: {
              value: {
                // GraphQL expects percentage as a float between 0.0 and 1.0 (e.g., 0.1 for 10%)
                percentage: settings.discountPercentage / 100
              },
              items: {
                all: true
              }
            }
          }
        }
      }

      const response = await fetch(`https://${shopifyDomain}/admin/api/2026-04/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyAccessToken
        },
        body: JSON.stringify(graphqlQuery)
      })

      if (!response.ok) {
        throw new Error(`Failed to create Discount Code via GraphQL: ${await response.text()}`)
      }

      const responseData = await response.json()
      
      if (responseData.data?.discountCodeBasicCreate?.userErrors?.length > 0) {
        const errors = responseData.data.discountCodeBasicCreate.userErrors
          .map((err: any) => `${err.field}: ${err.message}`)
          .join(', ')
        throw new Error(`Shopify GraphQL userErrors: ${errors}`)
      }

      console.log(`Successfully created Shopify discount code via GraphQL: ${code}`)
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
