import { createHash } from 'crypto'

const API_KEY = '***'

// Compute hash
const hash = createHash('sha256').update(API_KEY).digest('hex')
console.log('API Key:', API_KEY)
console.log('Hash:', hash)
