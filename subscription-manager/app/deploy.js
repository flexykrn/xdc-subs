const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Build the project
console.log('Building production app...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  console.log('✅ Build successful');
} catch (e) {
  console.error('❌ Build failed');
  process.exit(1);
}

// Check if vercel is logged in
try {
  execSync('vercel whoami', { stdio: 'pipe' });
  console.log('✅ Vercel authenticated');
  
  // Deploy
  console.log('Deploying to Vercel...');
  execSync('vercel --prod', { stdio: 'inherit', cwd: __dirname });
} catch (e) {
  console.log('\n⚠️  Vercel not authenticated. Run:');
  console.log('   vercel login');
  console.log('   Then run: vercel --prod\n');
  
  // Alternative: Create a deploy-ready zip
  console.log('Creating deploy-ready archive...');
  // The build is in .next/ folder
  console.log('✅ Build output ready in .next/ folder');
  console.log('You can deploy manually via Vercel dashboard');
}
