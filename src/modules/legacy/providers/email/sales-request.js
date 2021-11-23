const send = require('./mail')

const feedback = async ({ email, name, plan }) => {
  const message = {
    from: email,
    to: 'laura@kyso.io',
    subject: `Sales request from ${name} (${email})`,
    html: `User ${name} (${email}) is requesting access to Kyso's ${plan} plan`,
    text: `User ${name} (${email}) is requesting access to Kyso's ${plan} plan`,
  }

  return send(message)
}

feedback.handler = async (req, res, next) => {
  try {
    const { email, name, plan } = req.body
    res.send(await feedback({ email, name, plan }))
  } catch (err) {
    next(err)
  }
}

module.exports = feedback
