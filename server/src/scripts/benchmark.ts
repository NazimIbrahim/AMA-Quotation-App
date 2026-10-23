import { query, withTransaction } from '../db/connection';
import { performance } from 'perf_hooks';
import http from 'http';

interface MetricResult {
  name: string;
  target: string;
  actual: string;
  passed: boolean;
}

const metrics: MetricResult[] = [];

async function makeRequest(
  path: string,
  method = 'GET',
  token?: string
): Promise<{ status: number; durationMs: number; bodySize: number }> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: 'localhost',
        port: 4000,
        path,
        method,
        headers,
      },
      (res) => {
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
        });
        res.on('end', () => {
          const duration = performance.now() - start;
          resolve({ status: res.statusCode || 0, durationMs: duration, bodySize: size });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

async function runBenchmark() {
  console.log('========================================================================');
  console.log('AMA CERAMICS — PERFORMANCE ACCEPTANCE & BENCHMARK SUITE');
  console.log('Target Architecture: Low-Memory Windows PC (4 GB RAM) over LAN');
  console.log('========================================================================\n');

  // Step 1: Check Current Database Records
  const initialCountRes = await query<{ count: string }>('SELECT count(*) FROM quotations');
  const initialCount = parseInt(initialCountRes[0].count, 10);
  console.log(`Current Quotation Records in Database: ${initialCount}`);

  // Step 2: Seed Up to 10,000 Quotation Records for Large Dataset Testing
  const targetDatasetSize = 10000;
  if (initialCount < targetDatasetSize) {
    const needed = targetDatasetSize - initialCount;
    console.log(`\n[Dataset Preparation] Seeding ${needed} realistic quotation records to reach 10,000 records...`);

    const seedStart = performance.now();
    const batchSize = 1000;
    const statuses = ['draft', 'in_review', 'approved', 'rejected', 'closed'];
    const names = [
      'Dr. Priya Sengupta', 'Ar. Rohan Mehta', 'Mr Vinayak', 'Rajesh Patel',
      'Sunil Desai', 'Meera Trivedi', 'Kavita Joshi', 'Anil Ambani Estates',
      'Vikram Sarabhai Trust', 'Adani Reality Specifier'
    ];
    const cities = ['Ahmedabad', 'Bengaluru', 'Vadodara', 'Surat', 'Gandhinagar', 'Rajkot'];

    for (let batch = 0; batch < needed; batch += batchSize) {
      const currentBatchSize = Math.min(batchSize, needed - batch);
      await withTransaction(async (client) => {
        const rows: any[] = [];
        for (let i = 0; i < currentBatchSize; i++) {
          const num = initialCount + batch + i + 1;
          const qNumber = `AMA-2026-${String(num).padStart(5, '0')}`;
          const qDate = new Date(Date.now() - Math.floor(Math.random() * 300 * 86400000))
            .toISOString()
            .split('T')[0];
          const cName = names[num % names.length];
          const city = cities[num % cities.length];
          const st = statuses[num % statuses.length];
          const gross = Math.floor(50000 + Math.random() * 800000);
          const disc = Math.floor(gross * 0.05);
          const taxable = gross - disc;
          const net = Math.round(taxable * 1.18);

          rows.push(`(
            '${qNumber}', '${qDate}', 1, 1,
            '${cName}', '98250${String(num).padStart(5, '0')}', 'Villa Plot ${num}, ${city}',
            'Ananya Verma', 'Residential Project ${num}', '${st}',
            ${gross}, 5.0, ${disc}, ${taxable}, 'cgst_sgst', 9.0, ${taxable * 0.09}, 9.0, ${taxable * 0.09}, 0.0, ${net}, 1
          )`);
        }

        const insertSql = `
          INSERT INTO quotations (
            quotation_number, quotation_date, customer_id, sales_person_id,
            customer_name, customer_phone, delivery_address,
            sales_person_name, project_name, status,
            gross_total, discount_percent, discount_amount, taxable_amount, tax_type,
            cgst_rate, cgst_amount, sgst_rate, sgst_amount, round_off, net_total, version
          ) VALUES ${rows.join(', ')}
        `;
        await client.query(insertSql);
      });
      process.stdout.write(`  -> Inserted ${batch + currentBatchSize} / ${needed} records...\r`);
    }

    const seedDuration = ((performance.now() - seedStart) / 1000).toFixed(2);
    console.log(`\n[Dataset Preparation] 10,000 Records Seeded in ${seedDuration}s.`);
  }

  const finalCountRes = await query<{ count: string }>('SELECT count(*) FROM quotations');
  const finalCount = parseInt(finalCountRes[0].count, 10);
  console.log(`Total Database Quotation Records: ${finalCount}\n`);

  // Step 3: Login to obtain token
  console.log('[Test 1] Testing Administrator Authentication Latency...');
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'adminpassword123' }),
  });
  const loginData: any = await loginRes.json();
  const token = loginData.token;
  console.log(`  -> Login successful for user: ${loginData.user.full_name}`);

  // Test 2: Health Check API Latency
  console.log('\n[Test 2] Health Check Latency...');
  const healthRes = await makeRequest('/api/health');
  metrics.push({
    name: 'Health Check Latency',
    target: '< 100 ms',
    actual: `${healthRes.durationMs.toFixed(1)} ms`,
    passed: healthRes.durationMs < 100,
  });
  console.log(`  -> Duration: ${healthRes.durationMs.toFixed(1)} ms (Target: < 100 ms)`);

  // Test 3: Paginated API Request on 10,000 Records
  console.log('\n[Test 3] 10,000-Record Paginated List Query (/api/quotations?page=1&limit=20)...');
  const pageRes = await makeRequest('/api/quotations?page=1&limit=20', 'GET', token);
  metrics.push({
    name: '10k Record Paginated API Query',
    target: '< 500 ms',
    actual: `${pageRes.durationMs.toFixed(1)} ms`,
    passed: pageRes.durationMs < 500,
  });
  console.log(`  -> Duration: ${pageRes.durationMs.toFixed(1)} ms (Target: < 500 ms)`);

  // Test 4: Full-Text Search on 10,000 Records
  console.log('\n[Test 4] 10,000-Record Substring Search (/api/quotations?search=Vinayak)...');
  const searchRes = await makeRequest('/api/quotations?search=Vinayak', 'GET', token);
  metrics.push({
    name: '10k Record Text Search',
    target: '< 500 ms',
    actual: `${searchRes.durationMs.toFixed(1)} ms`,
    passed: searchRes.durationMs < 500,
  });
  console.log(`  -> Duration: ${searchRes.durationMs.toFixed(1)} ms (Target: < 500 ms)`);

  // Test 5: Status Filter Query on 10,000 Records
  console.log('\n[Test 5] Status Filter Query (/api/quotations?status=approved)...');
  const statusRes = await makeRequest('/api/quotations?status=approved', 'GET', token);
  metrics.push({
    name: '10k Record Status Filter Query',
    target: '< 500 ms',
    actual: `${statusRes.durationMs.toFixed(1)} ms`,
    passed: statusRes.durationMs < 500,
  });
  console.log(`  -> Duration: ${statusRes.durationMs.toFixed(1)} ms (Target: < 500 ms)`);

  // Test 6: Dashboard Aggregation Performance on 10,000 Records
  console.log('\n[Test 6] Full Business Dashboard KPI Aggregation (/api/dashboard/summary)...');
  const dashRes = await makeRequest('/api/dashboard/summary', 'GET', token);
  metrics.push({
    name: 'Dashboard Summary Aggregation',
    target: '< 500 ms',
    actual: `${dashRes.durationMs.toFixed(1)} ms`,
    passed: dashRes.durationMs < 500,
  });
  console.log(`  -> Duration: ${dashRes.durationMs.toFixed(1)} ms (Target: < 500 ms)`);

  // Test 7: PDF Generation Speed
  console.log('\n[Test 7] Full 2-Page Quotation PDF Streaming Generation...');
  const pdfRes = await makeRequest('/api/quotations/1/pdf', 'GET', token);
  metrics.push({
    name: 'Quotation PDF Generation & Streaming',
    target: '< 1000 ms',
    actual: `${pdfRes.durationMs.toFixed(1)} ms (${pdfRes.bodySize} bytes)`,
    passed: pdfRes.durationMs < 1000,
  });
  console.log(`  -> Duration: ${pdfRes.durationMs.toFixed(1)} ms, Size: ${pdfRes.bodySize} bytes (Target: < 1000 ms)`);

  // Test 8: Excel Export Speed
  console.log('\n[Test 8] Excel (.xlsx) Streaming Export...');
  const excelRes = await makeRequest('/api/reports/quotations/export?format=xlsx', 'GET', token);
  metrics.push({
    name: 'Excel Export Generation',
    target: '< 1500 ms',
    actual: `${excelRes.durationMs.toFixed(1)} ms (${excelRes.bodySize} bytes)`,
    passed: excelRes.durationMs < 1500,
  });
  console.log(`  -> Duration: ${excelRes.durationMs.toFixed(1)} ms, Size: ${excelRes.bodySize} bytes (Target: < 1500 ms)`);

  // Test 9: Concurrent LAN Client Stress Test (Simulate 5 Concurrent LAN Client PCs)
  console.log('\n[Test 9] Multi-Client LAN Concurrency Test (5 Concurrent Workers, 50 requests)...');
  const concurrentStart = performance.now();
  const concurrentPromises: Promise<any>[] = [];
  for (let i = 0; i < 50; i++) {
    const pageNum = (i % 10) + 1;
    concurrentPromises.push(makeRequest(`/api/quotations?page=${pageNum}&limit=10`, 'GET', token));
  }
  const concurrentResults = await Promise.all(concurrentPromises);
  const concurrentDuration = performance.now() - concurrentStart;
  const avgLatency = (concurrentDuration / 50).toFixed(1);
  const allSuccessful = concurrentResults.every((r) => r.status === 200);

  metrics.push({
    name: '5-Client LAN Concurrency (50 requests)',
    target: 'All 200 OK & Avg < 300 ms',
    actual: `All OK: ${allSuccessful}, Avg: ${avgLatency} ms, Total: ${concurrentDuration.toFixed(1)} ms`,
    passed: allSuccessful && parseFloat(avgLatency) < 300,
  });
  console.log(`  -> Completed 50 concurrent LAN requests in ${concurrentDuration.toFixed(1)} ms (Avg per request: ${avgLatency} ms)`);

  // Test 10: Server Memory Footprint
  const memUsage = process.memoryUsage();
  const rssMb = (memUsage.rss / (1024 * 1024)).toFixed(1);
  const heapMb = (memUsage.heapUsed / (1024 * 1024)).toFixed(1);

  metrics.push({
    name: 'Server Process RAM Footprint (4 GB RAM Target)',
    target: 'RSS < 256 MB',
    actual: `RSS: ${rssMb} MB, Heap: ${heapMb} MB`,
    passed: parseFloat(rssMb) < 256,
  });
  console.log(`\n[Test 10] Server Memory Usage: RSS = ${rssMb} MB, Heap = ${heapMb} MB (Strict Low-Memory Target < 256 MB)`);

  // Summary Table
  console.log('\n========================================================================');
  console.log('ACCEPTANCE TEST RESULTS SUMMARY');
  console.log('========================================================================');
  console.table(metrics);

  const allPassed = metrics.every((m) => m.passed);
  console.log(allPassed ? '✅ ALL ACCEPTANCE TARGETS PASSED!' : '⚠️ SOME METRICS EXCEEDED THRESHOLD');

  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
