import nodemailer from 'nodemailer'
import { env } from '../../config/env'

type SendEmailInput = {
  to: string
  subject: string
  text: string
}

export const sendEmail = async (input: SendEmailInput) => {
  if (!env.smtpUser || !env.smtpPassword) {
    throw new Error('Email service is not configured')
  }

  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPassword,
    },
  })

  await transport.sendMail({
    from: env.emailFrom || env.smtpUser,
    to: input.to,
    subject: input.subject,
    text: input.text,
  })
}
