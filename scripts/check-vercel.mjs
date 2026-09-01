import { promises as fs } from 'fs';

// Check the actual deployed chunk on Vercel vs our local file
const chunk = await fetch('https://qistflow.vercel.app/_next/static/chunks/app/(dashboard)/whatsapp/connection/page-b95cbb70ce719823.js').then(r => r.text());
const local = await fs.readFile('src/app/(dashboard)/whatsapp/connection/page.tsx', 'utf-8');

console.log('=== Vercel chunk: ===');
console.log('  Size:', chunk.length);
console.log('  Has AlwaysData:', chunk.includes('AlwaysData Background Worker'));
console.log('  Has WhatsApp Device Connection:', chunk.includes('WhatsApp Device Connection'));
console.log('  Has NOT_CONNECTED:', chunk.includes('NOT_CONNECTED'));
console.log('  Has safePost:', chunk.includes('safePost'));

console.log('\n=== Local file: ===');
console.log('  Size:', local.length);
console.log('  Has AlwaysData:', local.includes('AlwaysData Background Worker'));
console.log('  Has NOT_CONNECTED:', local.includes('NOT_CONNECTED'));
console.log('  Has safePost:', local.includes('safePost'));

// Check Vercel deployed commit via response header
const r = await fetch('https://qistflow.vercel.app', { method: 'HEAD' });
console.log('\n=== Vercel response headers ===');
for (const [k, v] of r.headers.entries()) {
  if (k.startsWith('x-') || k === 'age') console.log(' ', k, ':', v);
}
