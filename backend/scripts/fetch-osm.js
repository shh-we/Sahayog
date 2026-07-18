import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));

const query = `[out:json][timeout:60];
way["highway"](27.660,85.305,27.690,85.330);
(._;>;);
out body;`;

const body = 'data=' + encodeURIComponent(query);

console.log('Fetching OSM data from Overpass API...');

const options = {
  hostname: 'overpass-api.de',
  path: '/api/interpreter',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body),
    'User-Agent': 'SahayogDev/1.0 (routing-graph-builder)',
    'Accept': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      const outPath = resolve(__dirname, '..', 'data', 'patan-osm-raw.json');
      writeFileSync(outPath, data, 'utf8');
      console.log(`Fetched ${data.length} bytes → ${outPath}`);
    } else {
      console.error(`HTTP ${res.statusCode}`);
      console.error(data.substring(0, 500));
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.write(body);
req.end();
