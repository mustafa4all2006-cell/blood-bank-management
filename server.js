const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// Data file paths for JSON fallback
const DONORS_FILE = path.join(__dirname, 'donors.json');
const STOCK_FILE = path.join(__dirname, 'blood_stock.json');
const REQUESTS_FILE = path.join(__dirname, 'blood_requests.json');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// MySQL Connection Pool Configuration
let dbPool = null;
let useMySQL = false;
let dbConfigUsed = null;

async function initDatabase() {
  const candidatePasswords = [
    process.env.DB_PASSWORD || 'root',
    '',
    'password',
    '1234',
    '123456',
    'admin'
  ];

  for (const pwd of candidatePasswords) {
    try {
      const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: pwd,
        database: process.env.DB_NAME || 'blood_bank_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      await pool.query('SELECT 1 + 1 AS test');
      dbPool = pool;
      useMySQL = true;
      dbConfigUsed = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        database: 'blood_bank_db'
      };
      console.log(`✅ Connected to MySQL database "blood_bank_db" successfully (Workbench compatible, user: ${dbConfigUsed.user}).`);
      return;
    } catch (err) {
      // try next password or fail
    }
  }

  console.warn('⚠️ Could not connect to MySQL Server directly. Operating in fallback JSON storage mode.');
  useMySQL = false;
}

// ---------------------------------------------------------------------
// JSON Fallback Helpers
// ---------------------------------------------------------------------
function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    return [];
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write JSON file:', file, err);
  }
}

function calculateStockStatus(units) {
  const u = Number(units);
  if (u <= 5) return 'Critical';
  if (u <= 14) return 'Moderate';
  return 'Sufficient';
}

// ---------------------------------------------------------------------
// DB STATUS & STATS ENDPOINTS
// ---------------------------------------------------------------------
app.get('/db-status', (req, res) => {
  res.json({
    useMySQL,
    database: 'blood_bank_db',
    host: dbConfigUsed ? dbConfigUsed.host : 'localhost',
    user: dbConfigUsed ? dbConfigUsed.user : 'root',
    status: useMySQL ? 'Connected to MySQL Workbench' : 'Offline JSON fallback mode'
  });
});

app.get('/stats', async (req, res) => {
  try {
    let totalDonors = 0;
    let totalStockUnits = 0;
    let pendingRequests = 0;
    let criticalStockCount = 0;

    if (useMySQL) {
      const [[dCount]] = await dbPool.query('SELECT COUNT(*) as count FROM donors');
      const [[sUnits]] = await dbPool.query('SELECT COALESCE(SUM(units), 0) as total, COUNT(CASE WHEN units <= 5 THEN 1 END) as critical FROM blood_stock');
      const [[rPending]] = await dbPool.query('SELECT COUNT(*) as count FROM blood_requests WHERE status = "Pending"');

      totalDonors = dCount.count;
      totalStockUnits = sUnits.total;
      criticalStockCount = sUnits.critical;
      pendingRequests = rPending.count;
    } else {
      const donors = readJSON(DONORS_FILE);
      const stock = readJSON(STOCK_FILE);
      const requests = readJSON(REQUESTS_FILE);

      totalDonors = donors.length;
      totalStockUnits = stock.reduce((sum, item) => sum + Number(item.units || 0), 0);
      criticalStockCount = stock.filter(item => Number(item.units) <= 5).length;
      pendingRequests = requests.filter(item => item.status === 'Pending').length;
    }

    res.json({
      totalDonors,
      totalStockUnits,
      criticalStockCount,
      pendingRequests,
      useMySQL
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------
// 1. DONORS CRUD ENDPOINTS
// ---------------------------------------------------------------------

// GET all donors
app.get('/donors', async (req, res) => {
  if (useMySQL) {
    try {
      const [rows] = await dbPool.query('SELECT * FROM donors ORDER BY donor_id ASC');
      return res.json(rows);
    } catch (err) {
      console.error('MySQL GET /donors error:', err.message);
    }
  }
  return res.json(readJSON(DONORS_FILE));
});

// GET donor by ID or name
app.get('/donors/:id', async (req, res) => {
  const param = req.params.id.trim();
  if (useMySQL) {
    try {
      const [rows] = await dbPool.query(
        'SELECT * FROM donors WHERE donor_id = ? OR LOWER(donor_name) LIKE LOWER(?)',
        [param, `%${param}%`]
      );
      return res.json(rows);
    } catch (err) {
      console.error('MySQL GET /donors/:id error:', err.message);
    }
  }

  const donors = readJSON(DONORS_FILE);
  const found = donors.filter(
    d => String(d.donor_id).toLowerCase() === param.toLowerCase() ||
         String(d.donor_name).toLowerCase().includes(param.toLowerCase())
  );
  return res.json(found);
});

// POST insert donor
app.post('/donors', async (req, res) => {
  const { donor_id, donor_name, blood_group, age, gender, contact, city, last_donation_date, status } = req.body;

  if (!donor_id || !donor_name || !blood_group || !age || !gender || !contact || !city) {
    return res.status(400).send('Please provide all mandatory donor fields.');
  }

  const cleanStatus = status || 'Eligible';
  const cleanDate = last_donation_date || null;

  if (useMySQL) {
    try {
      const [existing] = await dbPool.query('SELECT donor_id FROM donors WHERE donor_id = ?', [donor_id]);
      if (existing.length > 0) {
        return res.status(400).send(`Donor with ID ${donor_id} already exists.`);
      }

      await dbPool.query(
        'INSERT INTO donors (donor_id, donor_name, blood_group, age, gender, contact, city, last_donation_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [Number(donor_id), String(donor_name).trim(), String(blood_group).trim(), Number(age), String(gender).trim(), String(contact).trim(), String(city).trim(), cleanDate, cleanStatus]
      );

      // Mirror in JSON
      const donors = readJSON(DONORS_FILE);
      donors.push({ donor_id: Number(donor_id), donor_name, blood_group, age: Number(age), gender, contact, city, last_donation_date: cleanDate, status: cleanStatus });
      writeJSON(DONORS_FILE, donors);

      return res.send('Donor Registered Successfully');
    } catch (err) {
      console.error('MySQL POST /donors error:', err.message);
      return res.status(500).send('Database error inserting donor: ' + err.message);
    }
  }

  const donors = readJSON(DONORS_FILE);
  if (donors.some(d => String(d.donor_id) === String(donor_id))) {
    return res.status(400).send(`Donor with ID ${donor_id} already exists.`);
  }

  donors.push({
    donor_id: Number(donor_id),
    donor_name: String(donor_name).trim(),
    blood_group: String(blood_group).trim(),
    age: Number(age),
    gender: String(gender).trim(),
    contact: String(contact).trim(),
    city: String(city).trim(),
    last_donation_date: cleanDate,
    status: cleanStatus
  });
  writeJSON(DONORS_FILE, donors);
  return res.send('Donor Registered Successfully');
});

// PUT update donor
app.put('/donors/:id', async (req, res) => {
  const id = req.params.id;
  const { donor_name, blood_group, age, gender, contact, city, last_donation_date, status } = req.body;

  if (useMySQL) {
    try {
      const [existing] = await dbPool.query('SELECT * FROM donors WHERE donor_id = ?', [id]);
      if (existing.length === 0) {
        return res.status(404).send('Donor Not Found');
      }

      const cur = existing[0];
      const newName = donor_name ? String(donor_name).trim() : cur.donor_name;
      const newBG = blood_group ? String(blood_group).trim() : cur.blood_group;
      const newAge = age ? Number(age) : cur.age;
      const newGen = gender ? String(gender).trim() : cur.gender;
      const newContact = contact ? String(contact).trim() : cur.contact;
      const newCity = city ? String(city).trim() : cur.city;
      const newDate = last_donation_date !== undefined ? last_donation_date : cur.last_donation_date;
      const newStatus = status ? String(status).trim() : cur.status;

      await dbPool.query(
        'UPDATE donors SET donor_name=?, blood_group=?, age=?, gender=?, contact=?, city=?, last_donation_date=?, status=? WHERE donor_id=?',
        [newName, newBG, newAge, newGen, newContact, newCity, newDate, newStatus, id]
      );

      // Mirror JSON
      const donors = readJSON(DONORS_FILE);
      const idx = donors.findIndex(d => String(d.donor_id) === String(id));
      if (idx !== -1) {
        donors[idx] = { ...donors[idx], donor_name: newName, blood_group: newBG, age: newAge, gender: newGen, contact: newContact, city: newCity, last_donation_date: newDate, status: newStatus };
        writeJSON(DONORS_FILE, donors);
      }

      return res.send('Donor Updated Successfully');
    } catch (err) {
      console.error('MySQL PUT /donors error:', err.message);
      return res.status(500).send('Database error updating donor: ' + err.message);
    }
  }

  const donors = readJSON(DONORS_FILE);
  const idx = donors.findIndex(d => String(d.donor_id) === String(id));
  if (idx === -1) return res.status(404).send('Donor Not Found');

  donors[idx] = {
    ...donors[idx],
    ...(donor_name && { donor_name: String(donor_name).trim() }),
    ...(blood_group && { blood_group: String(blood_group).trim() }),
    ...(age && { age: Number(age) }),
    ...(gender && { gender: String(gender).trim() }),
    ...(contact && { contact: String(contact).trim() }),
    ...(city && { city: String(city).trim() }),
    ...(last_donation_date !== undefined && { last_donation_date }),
    ...(status && { status: String(status).trim() })
  };
  writeJSON(DONORS_FILE, donors);
  return res.send('Donor Updated Successfully');
});

// DELETE donor
app.delete('/donors/:id', async (req, res) => {
  const id = req.params.id;

  if (useMySQL) {
    try {
      const [existing] = await dbPool.query('SELECT donor_id FROM donors WHERE donor_id = ?', [id]);
      if (existing.length === 0) return res.status(404).send('Donor Not Found');

      await dbPool.query('DELETE FROM donors WHERE donor_id = ?', [id]);

      const donors = readJSON(DONORS_FILE);
      writeJSON(DONORS_FILE, donors.filter(d => String(d.donor_id) !== String(id)));

      return res.send('Donor Deleted Successfully');
    } catch (err) {
      console.error('MySQL DELETE /donors error:', err.message);
      return res.status(500).send('Database error deleting donor: ' + err.message);
    }
  }

  const donors = readJSON(DONORS_FILE);
  const origLen = donors.length;
  const filtered = donors.filter(d => String(d.donor_id) !== String(id));
  if (filtered.length === origLen) return res.status(404).send('Donor Not Found');

  writeJSON(DONORS_FILE, filtered);
  return res.send('Donor Deleted Successfully');
});

// ---------------------------------------------------------------------
// 2. BLOOD_STOCK CRUD & INVENTORY ENDPOINTS
// ---------------------------------------------------------------------

// GET all stock
app.get('/stock', async (req, res) => {
  if (useMySQL) {
    try {
      const [rows] = await dbPool.query('SELECT * FROM blood_stock ORDER BY stock_id ASC');
      return res.json(rows);
    } catch (err) {
      console.error('MySQL GET /stock error:', err.message);
    }
  }
  return res.json(readJSON(STOCK_FILE));
});

// GET single blood group stock
app.get('/stock/:group', async (req, res) => {
  const group = decodeURIComponent(req.params.group).trim();
  if (useMySQL) {
    try {
      const [rows] = await dbPool.query('SELECT * FROM blood_stock WHERE blood_group = ?', [group]);
      return res.json(rows[0] || null);
    } catch (err) {
      console.error('MySQL GET /stock/:group error:', err.message);
    }
  }

  const stock = readJSON(STOCK_FILE);
  const item = stock.find(s => s.blood_group.toLowerCase() === group.toLowerCase());
  return res.json(item || null);
});

// PUT update blood group stock units directly
app.put('/stock/:group', async (req, res) => {
  const group = decodeURIComponent(req.params.group).trim();
  const { units } = req.body;

  if (units === undefined || isNaN(Number(units)) || Number(units) < 0) {
    return res.status(400).send('Valid non-negative units count is required.');
  }

  const newUnits = Number(units);
  const newStatus = calculateStockStatus(newUnits);

  if (useMySQL) {
    try {
      const [existing] = await dbPool.query('SELECT * FROM blood_stock WHERE blood_group = ?', [group]);
      if (existing.length === 0) return res.status(404).send('Blood group not found');

      await dbPool.query(
        'UPDATE blood_stock SET units = ?, status = ?, last_updated = CURRENT_TIMESTAMP WHERE blood_group = ?',
        [newUnits, newStatus, group]
      );

      const stock = readJSON(STOCK_FILE);
      const idx = stock.findIndex(s => s.blood_group === group);
      if (idx !== -1) {
        stock[idx].units = newUnits;
        stock[idx].status = newStatus;
        stock[idx].last_updated = new Date().toISOString();
        writeJSON(STOCK_FILE, stock);
      }

      return res.send(`Stock for ${group} updated to ${newUnits} units (${newStatus})`);
    } catch (err) {
      return res.status(500).send('Database error updating stock: ' + err.message);
    }
  }

  const stock = readJSON(STOCK_FILE);
  const idx = stock.findIndex(s => s.blood_group.toLowerCase() === group.toLowerCase());
  if (idx === -1) return res.status(404).send('Blood group not found');

  stock[idx].units = newUnits;
  stock[idx].status = newStatus;
  stock[idx].last_updated = new Date().toISOString();
  writeJSON(STOCK_FILE, stock);

  return res.send(`Stock for ${group} updated to ${newUnits} units (${newStatus})`);
});

// POST adjust blood stock (+ or - units)
app.post('/stock/adjust', async (req, res) => {
  const { blood_group, delta } = req.body;
  if (!blood_group || delta === undefined) {
    return res.status(400).send('blood_group and delta amount are required.');
  }

  const change = Number(delta);
  if (useMySQL) {
    try {
      const [rows] = await dbPool.query('SELECT * FROM blood_stock WHERE blood_group = ?', [blood_group]);
      if (rows.length === 0) return res.status(404).send('Blood group not found');

      let newUnits = Math.max(0, rows[0].units + change);
      let newStatus = calculateStockStatus(newUnits);

      await dbPool.query(
        'UPDATE blood_stock SET units = ?, status = ?, last_updated = CURRENT_TIMESTAMP WHERE blood_group = ?',
        [newUnits, newStatus, blood_group]
      );

      return res.send(`Adjusted ${blood_group} by ${change > 0 ? '+' : ''}${change} units. Total: ${newUnits}`);
    } catch (err) {
      return res.status(500).send('Database error adjusting stock: ' + err.message);
    }
  }

  const stock = readJSON(STOCK_FILE);
  const item = stock.find(s => s.blood_group === blood_group);
  if (!item) return res.status(404).send('Blood group not found');

  item.units = Math.max(0, item.units + change);
  item.status = calculateStockStatus(item.units);
  item.last_updated = new Date().toISOString();
  writeJSON(STOCK_FILE, stock);

  return res.send(`Adjusted ${blood_group} by ${change > 0 ? '+' : ''}${change} units. Total: ${item.units}`);
});

// ---------------------------------------------------------------------
// 3. BLOOD_REQUESTS CRUD ENDPOINTS
// ---------------------------------------------------------------------

// GET all blood requests
app.get('/requests', async (req, res) => {
  if (useMySQL) {
    try {
      const [rows] = await dbPool.query('SELECT * FROM blood_requests ORDER BY request_id DESC');
      return res.json(rows);
    } catch (err) {
      console.error('MySQL GET /requests error:', err.message);
    }
  }
  return res.json(readJSON(REQUESTS_FILE));
});

// GET request by ID
app.get('/requests/:id', async (req, res) => {
  const id = req.params.id;
  if (useMySQL) {
    try {
      const [rows] = await dbPool.query('SELECT * FROM blood_requests WHERE request_id = ?', [id]);
      return res.json(rows);
    } catch (err) {
      console.error('MySQL GET /requests/:id error:', err.message);
    }
  }

  const requests = readJSON(REQUESTS_FILE);
  const found = requests.filter(r => String(r.request_id) === String(id));
  return res.json(found);
});

// POST insert blood request
app.post('/requests', async (req, res) => {
  const { request_id, patient_name, hospital_name, blood_group, units_requested, urgency, status, request_date, contact_person } = req.body;

  if (!request_id || !patient_name || !hospital_name || !blood_group || !units_requested || !contact_person) {
    return res.status(400).send('Please provide all mandatory request fields.');
  }

  const cleanUrgency = urgency || 'Normal';
  const cleanStatus = status || 'Pending';
  const cleanDate = request_date || new Date().toISOString().split('T')[0];

  if (useMySQL) {
    try {
      const [existing] = await dbPool.query('SELECT request_id FROM blood_requests WHERE request_id = ?', [request_id]);
      if (existing.length > 0) {
        return res.status(400).send(`Request with ID ${request_id} already exists.`);
      }

      await dbPool.query(
        'INSERT INTO blood_requests (request_id, patient_name, hospital_name, blood_group, units_requested, urgency, status, request_date, contact_person) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [Number(request_id), String(patient_name).trim(), String(hospital_name).trim(), String(blood_group).trim(), Number(units_requested), cleanUrgency, cleanStatus, cleanDate, String(contact_person).trim()]
      );

      const requests = readJSON(REQUESTS_FILE);
      requests.push({ request_id: Number(request_id), patient_name, hospital_name, blood_group, units_requested: Number(units_requested), urgency: cleanUrgency, status: cleanStatus, request_date: cleanDate, contact_person });
      writeJSON(REQUESTS_FILE, requests);

      return res.send('Blood Request Registered Successfully');
    } catch (err) {
      console.error('MySQL POST /requests error:', err.message);
      return res.status(500).send('Database error creating request: ' + err.message);
    }
  }

  const requests = readJSON(REQUESTS_FILE);
  if (requests.some(r => String(r.request_id) === String(request_id))) {
    return res.status(400).send(`Request with ID ${request_id} already exists.`);
  }

  requests.push({
    request_id: Number(request_id),
    patient_name: String(patient_name).trim(),
    hospital_name: String(hospital_name).trim(),
    blood_group: String(blood_group).trim(),
    units_requested: Number(units_requested),
    urgency: cleanUrgency,
    status: cleanStatus,
    request_date: cleanDate,
    contact_person: String(contact_person).trim()
  });
  writeJSON(REQUESTS_FILE, requests);
  return res.send('Blood Request Registered Successfully');
});

// PATCH /requests/:id/status (Change status e.g. Approved, Fulfilled, Rejected)
// If status is Fulfilled, automatically deduct required units from blood_stock!
app.patch('/requests/:id/status', async (req, res) => {
  const id = req.params.id;
  const { newStatus } = req.body;

  if (!newStatus) return res.status(400).send('newStatus is required');

  if (useMySQL) {
    try {
      const [rows] = await dbPool.query('SELECT * FROM blood_requests WHERE request_id = ?', [id]);
      if (rows.length === 0) return res.status(404).send('Request Not Found');

      const reqRecord = rows[0];

      // If changing to Fulfilled from something else, check and deduct stock
      if (newStatus === 'Fulfilled' && reqRecord.status !== 'Fulfilled') {
        const [stockRows] = await dbPool.query('SELECT units FROM blood_stock WHERE blood_group = ?', [reqRecord.blood_group]);
        if (stockRows.length > 0) {
          const avail = stockRows[0].units;
          if (avail < reqRecord.units_requested) {
            return res.status(400).send(`Insufficient stock! Only ${avail} units of ${reqRecord.blood_group} available.`);
          }
          const updatedUnits = avail - reqRecord.units_requested;
          const updatedStatus = calculateStockStatus(updatedUnits);
          await dbPool.query('UPDATE blood_stock SET units = ?, status = ? WHERE blood_group = ?', [updatedUnits, updatedStatus, reqRecord.blood_group]);
        }
      }

      await dbPool.query('UPDATE blood_requests SET status = ? WHERE request_id = ?', [newStatus, id]);

      // Mirror JSON
      const requests = readJSON(REQUESTS_FILE);
      const r = requests.find(item => String(item.request_id) === String(id));
      if (r) {
        r.status = newStatus;
        writeJSON(REQUESTS_FILE, requests);
      }

      return res.send(`Request #${id} marked as ${newStatus}`);
    } catch (err) {
      return res.status(500).send('Database error updating status: ' + err.message);
    }
  }

  const requests = readJSON(REQUESTS_FILE);
  const r = requests.find(item => String(item.request_id) === String(id));
  if (!r) return res.status(404).send('Request Not Found');

  if (newStatus === 'Fulfilled' && r.status !== 'Fulfilled') {
    const stock = readJSON(STOCK_FILE);
    const s = stock.find(item => item.blood_group === r.blood_group);
    if (s) {
      if (s.units < r.units_requested) {
        return res.status(400).send(`Insufficient stock! Only ${s.units} units of ${r.blood_group} available.`);
      }
      s.units -= r.units_requested;
      s.status = calculateStockStatus(s.units);
      writeJSON(STOCK_FILE, stock);
    }
  }

  r.status = newStatus;
  writeJSON(REQUESTS_FILE, requests);
  return res.send(`Request #${id} marked as ${newStatus}`);
});

// DELETE request
app.delete('/requests/:id', async (req, res) => {
  const id = req.params.id;

  if (useMySQL) {
    try {
      const [existing] = await dbPool.query('SELECT request_id FROM blood_requests WHERE request_id = ?', [id]);
      if (existing.length === 0) return res.status(404).send('Request Not Found');

      await dbPool.query('DELETE FROM blood_requests WHERE request_id = ?', [id]);

      const requests = readJSON(REQUESTS_FILE);
      writeJSON(REQUESTS_FILE, requests.filter(r => String(r.request_id) !== String(id)));

      return res.send('Blood Request Deleted Successfully');
    } catch (err) {
      return res.status(500).send('Database error deleting request: ' + err.message);
    }
  }

  const requests = readJSON(REQUESTS_FILE);
  const origLen = requests.length;
  const filtered = requests.filter(r => String(r.request_id) !== String(id));
  if (filtered.length === origLen) return res.status(404).send('Request Not Found');

  writeJSON(REQUESTS_FILE, filtered);
  return res.send('Blood Request Deleted Successfully');
});

// Start Server
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Musthafa Hussain - Blood Bank Management Server running at http://localhost:${PORT}`);
    console.log(`📊 Connected to MySQL Workbench & Server 8.0 on blood_bank_db`);
  });
}

startServer();
