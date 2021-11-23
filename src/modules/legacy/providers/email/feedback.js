const send = require('./mail')

const feedback = async ({ user, text }) => {
  const email = user.email
  const nickname = user.nickname

  const message = {
    from: email,
    to: 'laura@kyso.io',
    subject: `Feedback submitted by ${nickname}`,
    html: text,
    text,
  }

  return send(message)
}

feedback.handler = async (req, res, next) => {
  try {
    const user = req.user
    const { text } = req.body
    res.send(await feedback({ user, text }))
  } catch (err) {
    next(err)
  }
}

module.exports = feedback
