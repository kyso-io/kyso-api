const Mailgun = require('mailgun-js')
const logger = require('../logger')

module.exports = async ({ to, subject, text, from = 'support@kyso.io' }) => {
  if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_EMAIL_DOMAIN) {
    logger.info(`Mailgun is disabled. Enable it by setting the MAILGUN_API_KEY and MAILGUN_EMAIL_DOMAIN environment variables.`)
    return
  }

  const mailgun = new Mailgun({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_EMAIL_DOMAIN,
  })

  const message = {
    from,
    to,
    subject,
    html: text
  }

  return mailgun.messages().send(message)
}
