const { sign, verify } = require('hono/jwt')
async function main() {
  const secret = 'my-secret'
  const payload = { sub: '123' }
  const token = await sign(payload, secret)
  console.log('Token', token)
  try {
     const decoded = await verify(token, secret)
     console.log('Decoded', decoded)
  } catch(e) {
     console.error(e)
  }
}
main()
