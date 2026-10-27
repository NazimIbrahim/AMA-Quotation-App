const fs = require('fs');
const { execSync } = require('child_process');

function getGitHubToken() {
  const output = execSync('git credential fill', {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
  });
  const passLine = output.split('\n').find((l) => l.startsWith('password='));
  if (!passLine) throw new Error('Could not get GitHub token from git credentials');
  return passLine.split('=')[1].trim();
}

async function upload() {
  const token = getGitHubToken();
  const repo = 'NazimIbrahim/AMA-Quotation-App';
  const releaseId = 425962925;
  const assetName = 'AMA-Ceramics-Quotation-System-Setup-2.4.6.exe';
  const filePath = 'D:/AMA-Qutation App/client/release/AMA Ceramics Quotation System-Setup-2.4.6.exe';
  const size = fs.statSync(filePath).size;

  console.log(`Checking existing assets on release ${releaseId}...`);
  const checkRes = await fetch(`https://api.github.com/repos/${repo}/releases/${releaseId}/assets`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'AMA-Quotation-App',
      Accept: 'application/vnd.github+json',
    },
  });
  if (checkRes.ok) {
    const assets = await checkRes.json();
    const existing = assets.find((a) => a.name === assetName);
    if (existing) {
      if (existing.size === size && existing.state === 'uploaded') {
        console.log('Already fully uploaded! URL:', existing.browser_download_url);
        return existing.browser_download_url;
      }
      console.log(`Deleting incomplete asset ${existing.id}...`);
      await fetch(`https://api.github.com/repos/${repo}/releases/assets/${existing.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'AMA-Quotation-App',
          Accept: 'application/vnd.github+json',
        },
      });
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const uploadUrl = `https://uploads.github.com/repos/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`;
  console.log(`Uploading via curl.exe --http1.1 (${(size / 1024 / 1024).toFixed(2)} MB)...`);

  const cmd = `curl.exe --http1.1 -sS -X POST -H "Authorization: Bearer ${token}" -H "Content-Type: application/octet-stream" -H "Content-Length: ${size}" --upload-file "${filePath}" "${uploadUrl}"`;
  const result = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 600000 });
  const parsed = JSON.parse(result);
  console.log('Uploaded successfully! URL:', parsed.browser_download_url);
  return parsed.browser_download_url;
}

upload().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});
