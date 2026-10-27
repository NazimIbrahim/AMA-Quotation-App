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

async function run() {
  const token = getGitHubToken();
  const repo = 'NazimIbrahim/AMA-Quotation-App';
  const releaseId = 425962925;

  const releaseNotes = `## AMA Ceramics Quotation System v2.4.6 Release Notes

### 🎯 1. Direct Target Overwrite (No Cumulative Summing)
- **Exact Target Replacement**: Entering a target amount in the **"Set / Update Salesperson Target"** modal or using the inline quick-edit now **directly updates the active target to that exact entered amount**, completely preventing amounts from adding or accumulating on top of previous targets.
- **Deduplication & Automatic Sync**: Saved targets automatically overwrite and clean up duplicate historical rows for that salesperson, keeping both \`sales_targets\` and \`users.monthly_target\` perfectly synchronized.
- **Analytics Precision**: Fixed performance calculation query to pick the latest defined target without summing historical entries.

### 📅 2. Automatic Monthly Date Normalization
- **Auto-Calculated Month Boundaries**: Selecting **"Monthly Target"** now automatically fills the start date as the first day of the month (\`YYYY-MM-01\`) and the end date as the last day of the month (\`YYYY-MM-31\`), ensuring quotation dates fall seamlessly within the active window.
- **Pre-filled Values**: Opening the target modal or selecting another salesperson instantly pre-populates their current target amount.

---

### 📦 Download Links
- **Desktop Client Setup (Windows)**: [AMA-Ceramics-Quotation-System-Setup-2.4.6.exe](https://github.com/NazimIbrahim/AMA-Quotation-App/releases/download/v2.4.6/AMA-Ceramics-Quotation-System-Setup-2.4.6.exe)
- **Central LAN Host Server Setup (Windows)**: [AMA-Ceramics-Host-Server-Setup-2.4.6.exe](https://github.com/NazimIbrahim/AMA-Quotation-App/releases/download/v2.4.6/AMA-Ceramics-Host-Server-Setup-2.4.6.exe)
`;

  const patchRes = await fetch(`https://api.github.com/repos/${repo}/releases/${releaseId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'AMA-Quotation-App',
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({ body: releaseNotes }),
  });

  if (!patchRes.ok) {
    throw new Error('Patch failed: ' + (await patchRes.text()));
  }
  const res = await patchRes.json();
  console.log('Successfully updated release notes for tag:', res.tag_name);
}

run().catch(console.error);
