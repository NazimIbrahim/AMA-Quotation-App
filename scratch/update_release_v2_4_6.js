const fs = require('fs');
const path = require('path');
const https = require('https');
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

function streamUploadToGitHub(token, uploadUrl, filePath, fileSize) {
  return new Promise((resolve, reject) => {
    const url = new URL(uploadUrl);
    const options = {
      method: 'POST',
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.2',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'AMA-Quotation-App',
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileSize,
      },
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ raw: data });
          }
        } else {
          reject(new Error(`GitHub upload failed with HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(300000, () => {
      req.destroy(new Error('Upload socket timed out after 5 minutes'));
    });

    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (err) => reject(err));
    fileStream.pipe(req);
  });
}

async function uploadAssetWithRetry(token, releaseId, filePath, assetName, repo, maxAttempts = 3) {
  const stats = fs.statSync(filePath);
  const uploadUrl = `https://uploads.github.com/repos/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
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
          if (existing.size === stats.size && existing.state === 'uploaded') {
            console.log(`Asset ${assetName} already completely uploaded. Reusing.`);
            return existing.browser_download_url;
          }
          console.log(`Cleaning up incomplete/previous asset ${assetName} (ID: ${existing.id})...`);
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

      console.log(`[Attempt ${attempt}/${maxAttempts}] Uploading ${assetName} (${(stats.size / 1024 / 1024).toFixed(2)} MB via native OpenSSL stream)...`);
      const parsed = await streamUploadToGitHub(token, uploadUrl, filePath, stats.size);
      if (parsed.browser_download_url) {
        console.log(`Successfully uploaded: ${parsed.name}`);
        console.log(`Direct link: ${parsed.browser_download_url}`);
        return parsed.browser_download_url;
      } else {
        throw new Error(`Upload response: ${JSON.stringify(parsed)}`);
      }
    } catch (err) {
      console.warn(`Attempt ${attempt} failed: ${err.message}`);
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

async function main() {
  const token = getGitHubToken();
  const repo = 'NazimIbrahim/AMA-Quotation-App';
  const tag = 'v2.4.6';

  console.log(`Checking release info for tag ${tag}...`);
  let res = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'AMA-Quotation-App',
      Accept: 'application/vnd.github+json',
    },
  });

  let release;
  if (!res.ok) {
    console.log(`Release ${tag} does not exist yet. Creating new release...`);
    const createRes = await fetch(`https://api.github.com/repos/${repo}/releases`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'AMA-Quotation-App',
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        tag_name: tag,
        name: `v2.4.6 - Direct Target Overwrite & Monthly Date Normalization`,
        body: 'Release in progress...',
        draft: false,
        prerelease: false,
      }),
    });
    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create release: ${errText}`);
    }
    release = await createRes.json();
    console.log(`Created release ${release.name} (ID: ${release.id})`);
  } else {
    release = await res.json();
    console.log(`Found release ${release.name} (ID: ${release.id})`);
  }

  const clientExePath = path.resolve(__dirname, '../client/release/AMA Ceramics Quotation System-Setup-2.4.6.exe');
  const hostExePath = path.resolve(__dirname, '../client/release/AMA-Ceramics-Host-Server-Setup-2.4.6.exe');

  if (!fs.existsSync(clientExePath)) {
    throw new Error(`Client executable not found at: ${clientExePath}`);
  }
  if (!fs.existsSync(hostExePath)) {
    throw new Error(`Host Server executable not found at: ${hostExePath}`);
  }

  const hostUrl = await uploadAssetWithRetry(
    token,
    release.id,
    hostExePath,
    'AMA-Ceramics-Host-Server-Setup-2.4.6.exe',
    repo,
    5
  );

  console.log('Waiting 5s before next upload...');
  await new Promise((r) => setTimeout(r, 5000));

  const clientUrl = await uploadAssetWithRetry(
    token,
    release.id,
    clientExePath,
    'AMA-Ceramics-Quotation-System-Setup-2.4.6.exe',
    repo,
    5
  );

  const releaseNotes = `## AMA Ceramics Quotation System v2.4.6 Release Notes

### 🎯 1. Direct Target Overwrite (No Cumulative Summing)
- **Exact Target Replacement**: Entering a target amount in the "Set / Update Salesperson Target" modal or using inline quick-edit now **directly updates the active target to that exact amount**, completely preventing amounts from adding or accumulating on top of previous targets.
- **Deduplication & Automatic Sync**: Saved targets automatically overwrite and clean up duplicate historical rows for that salesperson, keeping both \`sales_targets\` and \`users.monthly_target\` perfectly synchronized.
- **Analytics Precision**: Fixed performance calculation query to pick the latest defined target without summing historical entries.

### 📅 2. Automatic Monthly Date Normalization
- **Auto-Calculated Month Boundaries**: Selecting "Monthly Target" now automatically fills the start date as the first day of the month (\`YYYY-MM-01\`) and the end date as the last day of the month (\`YYYY-MM-31\`), ensuring quotation dates fall seamlessly within the active window.
- **Pre-filled Values**: Opening the target modal or selecting another salesperson instantly pre-populates their current target amount.

---

### 📦 Download Links
- **Desktop Client Setup (Windows)**: [AMA-Ceramics-Quotation-System-Setup-2.4.6.exe](${clientUrl})
- **Central LAN Host Server Setup (Windows)**: [AMA-Ceramics-Host-Server-Setup-2.4.6.exe](${hostUrl})
`;

  console.log('Updating release notes...');
  const patchRes = await fetch(`https://api.github.com/repos/${repo}/releases/${release.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'AMA-Quotation-App',
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      body: releaseNotes,
    }),
  });

  if (!patchRes.ok) {
    console.warn('Failed to update release notes:', await patchRes.text());
  } else {
    console.log('Release notes updated successfully!');
  }

  console.log(`\n🎉 Release v2.4.6 published successfully at: https://github.com/${repo}/releases/tag/${tag}`);
}

main().catch((err) => {
  console.error('Release failed:', err);
  process.exit(1);
});
