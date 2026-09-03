/**
 * setup-https.mjs
 * Run this once to generate local SSL certs for HTTPS dev on phone.
 * Usage: node scripts/setup-https.mjs
 */
import { execSync, spawnSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CERTS_DIR = join(ROOT, 'certs');

// ── Find local IP ──────────────────────────────────────────────────────────────
function getLocalIp() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIp = getLocalIp();
console.log(`\n🔍 Detected local IP: ${localIp}`);

// ── Ensure certs directory exists ─────────────────────────────────────────────
if (!existsSync(CERTS_DIR)) {
  mkdirSync(CERTS_DIR, { recursive: true });
  console.log('📁 Created certs/ directory');
}

// ── Check mkcert is available ─────────────────────────────────────────────────
let mkcertCmd = 'mkcert';
try {
  execSync(`${mkcertCmd} --version`, { stdio: 'ignore' });
} catch {
  console.error('❌ mkcert not found. Install it first:');
  console.error('   winget install FiloSottile.mkcert');
  console.error('   Then restart your terminal and run this script again.');
  process.exit(1);
}

// ── Install local CA (may show UAC prompt on Windows) ────────────────────────
console.log('\n📜 Installing local CA (you may see a UAC/admin prompt)...');
try {
  execSync(`${mkcertCmd} -install`, { stdio: 'inherit' });
} catch {
  console.error('❌ Failed to install local CA. Try running as Administrator.');
  process.exit(1);
}

// ── Generate certs ────────────────────────────────────────────────────────────
const certFile = join(CERTS_DIR, 'cert.pem');
const keyFile  = join(CERTS_DIR, 'key.pem');

console.log(`\n🔑 Generating SSL certificate for localhost + ${localIp}...`);
const result = spawnSync(
  mkcertCmd,
  ['-cert-file', certFile, '-key-file', keyFile, localIp, 'localhost', '127.0.0.1'],
  { stdio: 'inherit', cwd: ROOT }
);

if (result.status !== 0) {
  console.error('❌ Failed to generate certificates.');
  process.exit(1);
}

console.log('\n✅ Done! SSL certs saved to certs/');
console.log('\n📱 NEXT STEPS:');
console.log('─────────────────────────────────────────────────────');
console.log('1. Restart your dev server:   npm run dev');
console.log(`2. On your phone, open:       https://${localIp}:3000`);
console.log('3. Your phone will show a "certificate not trusted" warning.');
console.log('   Tap "Advanced" → "Proceed" (it is safe — this is your own cert).');
console.log('');
console.log('📌 To make the warning disappear on Android:');
console.log(`   Visit http://${localIp}:3000/mkcert-rootCA.pem and install it.`);
console.log('   (or see: https://mkcert.dev for device trust instructions)');
console.log('─────────────────────────────────────────────────────\n');
