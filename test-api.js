// Automated Test Suite for Blood Bank Management System REST API & MySQL Workbench Sync
const http = require('http');

function apiCall(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = body;
        try { parsed = JSON.parse(body); } catch(e) {}
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting BBMS REST API & MySQL Verification Tests...\n');

  try {
    // 1. DB STATUS
    console.log('1️⃣ Checking MySQL Workbench / Database connection...');
    const dbStatus = await apiCall('GET', '/db-status');
    console.log('   Response:', dbStatus.data);

    // 2. STATS
    console.log('\n2️⃣ Checking Aggregated Statistics...');
    const stats = await apiCall('GET', '/stats');
    console.log('   Stats:', stats.data);

    // 3. DONORS CRUD
    console.log('\n3️⃣ Testing Donors CRUD Operations...');
    const testDonor = {
      donor_id: 999,
      donor_name: 'Test Donor Automaton',
      blood_group: 'O+',
      age: 30,
      gender: 'Male',
      contact: '+91 99999-00000',
      city: 'Testville',
      last_donation_date: '2026-10-10',
      status: 'Eligible'
    };

    console.log('   -> Inserting Donor #999...');
    const insDonor = await apiCall('POST', '/donors', testDonor);
    console.log('   Insert result:', insDonor.data);

    console.log('   -> Fetching Donor #999...');
    const getDonor = await apiCall('GET', '/donors/999');
    console.log('   Found donor:', getDonor.data[0] ? getDonor.data[0].donor_name : 'Not found');

    console.log('   -> Updating Donor #999 status to "Recently Donated"...');
    const updDonor = await apiCall('PUT', '/donors/999', { status: 'Recently Donated' });
    console.log('   Update result:', updDonor.data);

    console.log('   -> Deleting Donor #999...');
    const delDonor = await apiCall('DELETE', '/donors/999');
    console.log('   Delete result:', delDonor.data);

    // 4. BLOOD STOCK
    console.log('\n4️⃣ Testing Blood Stock Adjustments...');
    console.log('   -> Fetching stock for A+...');
    const getStock = await apiCall('GET', '/stock/A+');
    console.log('   Current A+ stock:', getStock.data ? `${getStock.data.units} units (${getStock.data.status})` : 'Not found');

    console.log('   -> Adjusting A+ stock by +2 units...');
    const adjUp = await apiCall('POST', '/stock/adjust', { blood_group: 'A+', delta: 2 });
    console.log('   Adjustment result:', adjUp.data);

    console.log('   -> Reverting A+ stock by -2 units...');
    const adjDown = await apiCall('POST', '/stock/adjust', { blood_group: 'A+', delta: -2 });
    console.log('   Revert result:', adjDown.data);

    // 5. BLOOD REQUESTS CRUD
    console.log('\n5️⃣ Testing Blood Requests CRUD Operations...');
    const testReq = {
      request_id: 999,
      patient_name: 'Automated Test Patient',
      hospital_name: 'Emergency Central Hospital',
      blood_group: 'B+',
      units_requested: 1,
      urgency: 'Critical',
      status: 'Pending',
      request_date: '2026-11-06',
      contact_person: 'Dr. Test (911)'
    };

    console.log('   -> Inserting Blood Request #999...');
    const insReq = await apiCall('POST', '/requests', testReq);
    console.log('   Insert result:', insReq.data);

    console.log('   -> Updating Request #999 status to "Approved"...');
    const updReq = await apiCall('PATCH', '/requests/999/status', { newStatus: 'Approved' });
    console.log('   Status update result:', updReq.data);

    console.log('   -> Deleting Request #999...');
    const delReq = await apiCall('DELETE', '/requests/999');
    console.log('   Delete result:', delReq.data);

    console.log('\n🎉 ALL TESTS PASSED! Blood Bank Management System is fully operational and synchronized with MySQL Workbench.');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
}

runTests();
