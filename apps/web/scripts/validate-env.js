const fs = require('fs');
const path = require('path');

const requiredVars = ['NEXT_PUBLIC_API_URL'];

const missing = requiredVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error('❌ Build failed: Missing required environment variables:');
  missing.forEach(v => console.error(`   - ${v}`));
  console.error('\nFor local development, copy .env.example to .env.local and fill in values.');
  console.error('For CI/Production, set these environment variables in your CI/CD pipeline.');
  process.exit(1);
}

console.log('✅ Environment variables validated');
console.log(`   NEXT_PUBLIC_API_URL: ${process.env.NEXT_PUBLIC_API_URL}`);
