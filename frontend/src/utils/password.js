// توليد كلمة مرور مؤقتة عشوائية (من غير الحروف المتشابهة زي O و0 و l و1)
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'

function randomInt(max) {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % max
}

const pick = (chars) => chars[randomInt(chars.length)]

export function generatePassword(length = 12) {
  const all = UPPER + LOWER + DIGITS
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)]
  while (chars.length < length) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
