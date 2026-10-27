const fs = require('fs');
const path = require('path');
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

async function uploadAssetCurl(token, releaseId, filePath, assetName, repo, maxAttempts = 3) {
  const stats = fs.statSync(filePath);
  const size = stats.size;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Attempt ${attempt}/${maxAttempts}] Checking existing asset ${assetName} on release ${releaseId}...`);
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
            console.log(`Asset ${assetName} already fully uploaded! Reusing.`);
            return existing.browser_download_url;
          }
          console.log(`Deleting incomplete/stale asset ${existing.id}...`);
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
      console.log(`Uploading ${assetName} (${(size / 1024 / 1024).toFixed(2)} MB via curl --http1.1)...`);

      const cmd = `curl.exe --http1.1 -sS -X POST -H "Authorization: Bearer ${token}" -H "Content-Type: application/octet-stream" -H "Content-Length: ${size}" --upload-file "${filePath}" "${uploadUrl}"`;
      const result = execSync(cmd, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 600000 });
      const parsed = JSON.parse(result);
      if (parsed.browser_download_url) {
        console.log(`Uploaded successfully! URL: ${parsed.browser_download_url}`);
        return parsed.browser_download_url;
      } else {
        throw new Error(`Upload failed: ${result}`);
      }
    } catch (err) {
      console.warn(`Attempt ${attempt} error: ${err.message}`);
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

async function main() {
  const token = getGitHubToken();
  const repo = 'NazimIbrahim/AMA-Quotation-App';
  const tag = 'v2.4.7';

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
    console.log(`Creating new release for ${tag}...`);
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
        name: `v2.4.7 - Quotation Edit & Version History (View Previous Quotes & Revert)`,
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

  const clientExePath = path.resolve(__dirname, '../client/release/AMA Ceramics Quotation System-Setup-2.4.7.exe');
  const hostExePath = path.resolve(__dirname, '../client/release/AMA-Ceramics-Host-Server-Setup-2.4.7.exe');

  if (!fs.existsSync(clientExePath)) {
    throw new Error(`Client executable not found at: ${clientExePath}`);
  }
  if (!fs.existsSync(hostExePath)) {
    throw new Error(`Host Server executable not found at: ${hostExePath}`);
  }

  // Upload Host Server first
  const hostUrl = await uploadAssetCurl(
    token,
    release.id,
    hostExePath,
    'AMA-Ceramics-Host-Server-Setup-2.4.7.exe',
    repo
  );

  console.log('Waiting 3s before uploading client installer...');
  await new Promise((r) => setTimeout(r, 3000));

  // Upload Client App
  const clientUrl = await uploadAssetCurl(
    token,
    release.id,
    clientExePath,
    'AMA-Ceramics-Quotation-System-Setup-2.4.7.exe',
    repo
  );

  const releaseNotes = `## AMA Ceramics Quotation System v2.4.7 Release Notes

### 📜 1. Quotation Edit & Revision History (View Previous Quotes)
- **Automatic Version Snapshotting**: Every single time a quotation is edited or saved, an immutable snapshot of that exact revision is preserved with all customer details, area names, and individual line items (quantities, rates, brands, sizes, discounts, and totals).
- **Inspect Previous Quotes Whenever Desired**:
  - In **Quotation Details**, click the **"History (vX)"** button or the version pill (e.g. \`v2\`) to open the full interactive Revision Timeline.
  - In the **Quotations List**, any edited quotation displays a clickable revision badge (e.g. \`v2\`, \`v3\`) and a direct **History icon** to inspect its audit trail without navigating away.
  - In the **Tile & Sanitary Quotation Editors**, an inline **"Previous Quotes"** header button lets salespersons and managers compare previous pricing and quantities while actively editing.
- **Side-by-Side Detail View**:
  - View exact line-item tables for any past revision, who edited it, the edit timestamp, and any manager approval notes.
  - **Print / Download PDF** for any previous revision with 1 click.
  - **Encrypted PDF Export** for any previous revision.
  - **Restore to This Version**: 1-click restore functionality to revert the active quotation back to any past version snapshot!

---

### 📦 Download Links
- **Desktop Client Setup (Windows)**: [AMA-Ceramics-Quotation-System-Setup-2.4.7.exe](${clientUrl})
- **Central LAN Host Server Setup (Windows)**: [AMA-Ceramics-Host-Server-Setup-2.4.7.exe](${hostUrl})
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

  console.log(`\n🎉 Release v2.4.7 published successfully at: https://github.com/${repo}/releases/tag/${tag}`);
}

main().catch((err) => {
  console.error('Release failed:', err);
  process.exit(1);
});
