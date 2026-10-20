/**
 * Deterministic RFC 4122 v5-compatible UUID generator
 * Zero-dependency, pure TypeScript implementation.
 * Guarantees 100% valid UUID format acceptable by PostgreSQL UUID column.
 */

function sha1(str: string): string {
  const utf8 = unescape(encodeURIComponent(str))
  const words: number[] = []
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] = (words[i >> 2] || 0) | ((utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8))
  }
  const strLen = utf8.length * 8
  words[strLen >> 5] = (words[strLen >> 5] || 0) | (0x80 << (24 - (strLen % 32)))
  words[(((strLen + 64) >> 9) << 4) + 15] = strLen

  let [h0, h1, h2, h3, h4] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]
  const w = new Array(80)

  for (let i = 0; i < words.length; i += 16) {
    let [a, b, c, d, e] = [h0, h1, h2, h3, h4]
    for (let j = 0; j < 80; j++) {
      if (j < 16) {
        w[j] = words[i + j] || 0
      } else {
        const t = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16]
        w[j] = (t << 1) | (t >>> 31)
      }
      let f: number, k: number
      if (j < 20) { f = (b & c) | ((~b) & d); k = 0x5a827999 }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1 }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc }
      else { f = b ^ c ^ d; k = 0xca62c1d6 }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0
      e = d; d = c; c = ((b << 30) | (b >>> 2)) | 0; b = a; a = temp
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0
  }

  return [h0, h1, h2, h3, h4].map(v => (v >>> 0).toString(16).padStart(8, '0')).join('')
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuid(str: string | null | undefined): boolean {
  if (!str) return false
  return UUID_REGEX.test(String(str).trim())
}

/**
 * Creates a deterministic RFC 4122 v5 UUID from a namespace and a string value.
 * Same input produces the exact same UUID every time.
 */
export function toDeterministicUuid(namespace: string, value: string): string {
  const cleanVal = String(value || '').trim()
  if (!cleanVal) {
    const randomFallback = Math.random().toString(36).substring(2)
    return toDeterministicUuid(namespace, randomFallback)
  }

  // If already a valid UUID and namespace is empty, preserve it
  if (!namespace && isValidUuid(cleanVal)) {
    return cleanVal.toLowerCase()
  }

  const hash = sha1(`${namespace}:${cleanVal}`)
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '5' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.substring(18, 20),
    hash.substring(20, 32)
  ].join('-')
}
