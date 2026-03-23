const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { Parser } = require("json2csv");
const multer = require("multer");
const csvParser = require("csv-parser");
const xlsx = require("xlsx");
const fs = require("fs");

const upload = multer({ dest: "uploads/" });

const app = express();
app.use(express.json());
app.use(cors());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'bizomhire-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.userEmail) {
        return next();
    }
    
    // Check if it's an API request
    if (req.path.startsWith('/api') || req.path.startsWith('/jobs') || 
        req.path.startsWith('/departments') || req.path.startsWith('/roles') || 
        req.path.startsWith('/levels')) {
        return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    
    // Redirect to login for HTML pages
    res.redirect('/login.html');
}

// Auth routes (before static middleware)
app.post('/auth/login', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    
    try {
        // Check if email is in authorized_users database
        if (USE_FIRESTORE) {
            const snapshot = await usersCollection
                .where('email', '==', normalizedEmail)
                .where('status', '==', 'active')
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                req.session.userEmail = normalizedEmail;
                const userData = snapshot.docs[0].data();
                return res.json({ success: true, email: normalizedEmail, name: userData.name });
            } else {
                return res.status(403).json({ 
                    message: 'Access denied. Your email is not authorized to access this system.' 
                });
            }
        } else {
            db.get(
                `SELECT * FROM authorized_users WHERE LOWER(email) = ? AND status = 'active'`,
                [normalizedEmail],
                (err, row) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ message: 'Server error during authentication' });
                    }
                    
                    if (row) {
                        req.session.userEmail = normalizedEmail;
                        return res.json({ success: true, email: normalizedEmail, name: row.name });
                    } else {
                        return res.status(403).json({ 
                            message: 'Access denied. Your email is not authorized to access this system.' 
                        });
                    }
                }
            );
        }
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ message: 'Server error during authentication' });
    }
});

app.post('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ success: true });
    });
});

app.get('/auth/status', (req, res) => {
    if (req.session && req.session.userEmail) {
        res.json({ authenticated: true, email: req.session.userEmail });
    } else {
        res.json({ authenticated: false });
    }
});

// Serve static files (login.html is accessible without auth)
app.use(express.static("public"));

// Protect the main dashboard
app.get('/', requireAuth, (req, res, next) => {
    // If authenticated, serve index.html
    res.sendFile(__dirname + '/public/index.html');
});

// Determine environment - use SQLite for local, Firestore for production
const USE_FIRESTORE = process.env.NODE_ENV === 'production' || process.env.USE_FIRESTORE === 'true';

let db, jobsCollection, departmentsCollection, rolesCollection, levelsCollection, usersCollection;

if (USE_FIRESTORE) {
    console.log("Using Firestore (Production)");
    const { Firestore } = require("@google-cloud/firestore");
    db = new Firestore({
        projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT,
    });
    jobsCollection = db.collection('jobs');
    departmentsCollection = db.collection('departments');
    rolesCollection = db.collection('roles');
    levelsCollection = db.collection('levels');
    usersCollection = db.collection('authorized_users');
} else {
    console.log("Using SQLite (Local Development)");
    const sqlite3 = require("sqlite3").verbose();
    db = new sqlite3.Database("./database.db");
    
    // Create tables if they don't exist
    db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department TEXT,
    role TEXT,
    level TEXT,
    status TEXT,
    posted_date TEXT,
    offered_date TEXT,
    expected_tat INTEGER,
    hr_name TEXT
    )`);

    db.run(`ALTER TABLE jobs ADD COLUMN hr_name TEXT`, () => {});
    db.run(`ALTER TABLE jobs ADD COLUMN location TEXT`, () => {});

    db.run(`
    CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
    )`);

    db.run(`
    CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
    )`);

    db.run(`
    CREATE TABLE IF NOT EXISTS levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
    )`);

    db.run(`
    CREATE TABLE IF NOT EXISTS authorized_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    invited_by TEXT,
    invited_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.log("authorized_users table already exists or error:", err.message);
        } else {
            console.log("Created authorized_users table");
        }
    });
}

// Helper function to parse dates in DD-MM-YYYY or DD-M-YYYY format
function parseDate(dateStr) {
    if (!dateStr) return null;
    
    const str = dateStr.toString().trim();
    
    // Handle Excel serial numbers (e.g., 45336)
    // Excel stores dates as days since 1/1/1900
    const numValue = parseFloat(str);
    if (!isNaN(numValue) && numValue > 1000 && numValue < 100000 && !str.includes('-') && !str.includes('/')) {
        // Excel epoch starts at 1/1/1900, but has a leap year bug (treats 1900 as leap year)
        // We need to subtract 1 day after 2/28/1900 to account for this
        const excelEpoch = new Date(1900, 0, 1);
        const daysToAdd = numValue - 1; // Excel counts from 1, not 0
        const adjustedDays = numValue > 60 ? daysToAdd - 1 : daysToAdd; // Account for Excel's leap year bug
        const date = new Date(excelEpoch.getTime() + adjustedDays * 24 * 60 * 60 * 1000);
        console.log(`Parsed Excel serial ${numValue} -> ${date.toISOString()}`);
        return date;
    }
    
    // Check if it's YYYY-MM-DD format (from HTML date inputs)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const parts = str.split('-');
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const day = parseInt(parts[2]);
        return new Date(year, month - 1, day); // month is 0-indexed
    }
    
    // Handle text months like "7-Jan-2026" or "7-January-2026"
    const monthNames = {
        'jan': 0, 'january': 0,
        'feb': 1, 'february': 1,
        'mar': 2, 'march': 2,
        'apr': 3, 'april': 3,
        'may': 4,
        'jun': 5, 'june': 5,
        'jul': 6, 'july': 6,
        'aug': 7, 'august': 7,
        'sep': 8, 'september': 8,
        'oct': 9, 'october': 9,
        'nov': 10, 'november': 10,
        'dec': 11, 'december': 11
    };
    
    // Try DD-MM-YYYY or DD-M-YYYY or D-MM-YYYY format (from Excel)
    const parts = str.split(/[-\/]/);
    if (parts.length === 3) {
        const day = parseInt(parts[0]);
        let month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        
        // Check if middle part is a text month
        if (isNaN(month)) {
            const monthText = parts[1].toLowerCase();
            month = monthNames[monthText];
            if (month !== undefined) {
                return new Date(year, month, day);
            }
        }
        
        // If day > 12, it's definitely DD-MM-YYYY format
        // If month > 12, it's definitely MM-DD-YYYY format (swap them)
        if (month > 12) {
            return new Date(year, day - 1, month); // MM-DD-YYYY (swap day and month)
        } else if (day > 12) {
            return new Date(year, month - 1, day); // DD-MM-YYYY
        } else {
            // Assume DD-MM-YYYY (international format)
            return new Date(year, month - 1, day);
        }
    }
    
    // Fallback to native parsing
    return new Date(str);
}

// Normalize any date format to DD-MM-YYYY (e.g., 13-2-2026)
function normalizeDate(dateStr) {
    if (!dateStr) return null;
    
    // If already in DD-MM-YYYY or DD-M-YYYY or D-M-YYYY format, return as is
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
        return dateStr;
    }
    
    // Parse the date and convert to DD-MM-YYYY
    const date = parseDate(dateStr);
    if (!date || isNaN(date)) return null;
    
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
}

function calculateTAT(start, end) {
    let startDate = parseDate(start);
    let endDate = parseDate(end);
    
    if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) {
        return null;
    }
    
    let count = 0;

    while (startDate <= endDate) {
        let day = startDate.getDay();
        if (day !== 0 && day !== 6) count++;
        startDate.setDate(startDate.getDate() + 1);
    }

    return count;
}

// Job endpoints
app.post("/jobs", requireAuth, async (req, res) => {
    const { department, role, level, location, status, posted_date, expected_tat, hr_name } = req.body;

    // Normalize date to YYYY-MM-DD format for consistency
    const normalizedPostedDate = normalizeDate(posted_date);

    if (USE_FIRESTORE) {
        try {
            const docRef = await jobsCollection.add({
                department,
                role,
                level,
                location,
                status,
                posted_date: normalizedPostedDate,
                expected_tat: expected_tat ? parseInt(expected_tat) : null,
                hr_name,
                offered_date: null,
                created_at: new Date().toISOString()
            });
            res.send({ id: docRef.id });
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.run(
            `INSERT INTO jobs(department,role,level,location,status,posted_date,expected_tat,hr_name)
             VALUES(?,?,?,?,?,?,?,?)`,
            [department, role, level, location, status, normalizedPostedDate, expected_tat, hr_name],
            function (err) {
                if (err) return res.status(500).send({ error: err.message });
                res.send({ id: this.lastID });
            }
        );
    }
});

app.put("/jobs/:id", requireAuth, async (req, res) => {
    const { department, role, level, location, status, posted_date, offered_date, expected_tat, hr_name } = req.body;

    // Normalize dates to YYYY-MM-DD format for consistency
    const normalizedPostedDate = normalizeDate(posted_date);
    const normalizedOfferedDate = offered_date ? normalizeDate(offered_date) : null;

    if (USE_FIRESTORE) {
        try {
            await jobsCollection.doc(req.params.id).update({
                department,
                role,
                level,
                location,
                status,
                posted_date: normalizedPostedDate,
                offered_date: normalizedOfferedDate,
                expected_tat: expected_tat ? parseInt(expected_tat) : null,
                hr_name,
                updated_at: new Date().toISOString()
            });
            res.send({ message: "updated" });
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.run(
            `UPDATE jobs SET department=?, role=?, level=?, location=?, status=?, posted_date=?, offered_date=?, expected_tat=?, hr_name=? WHERE id=?`,
            [department, role, level, location, status, normalizedPostedDate, normalizedOfferedDate, expected_tat, hr_name, req.params.id],
            err => {
                if (err) return res.status(500).send({ error: err.message });
                res.send({ message: "updated" });
            }
        );
    }
});

app.delete("/jobs/:id", requireAuth, async (req, res) => {
    if (USE_FIRESTORE) {
        try {
            await jobsCollection.doc(req.params.id).delete();
            res.send({ message: "deleted" });
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.run(`DELETE FROM jobs WHERE id=?`, [req.params.id], err => {
            if (err) return res.status(500).send({ error: err.message });
            res.send({ message: "deleted" });
        });
    }
});

app.get("/jobs", requireAuth, async (req, res) => {
    if (USE_FIRESTORE) {
        try {
            const snapshot = await jobsCollection.orderBy('created_at', 'desc').get();
            const jobs = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                let tat = null;
                
                // Calculate TAT if both dates exist and are not empty
                if (data.offered_date && data.posted_date && 
                    data.offered_date !== "" && data.posted_date !== "") {
                    tat = calculateTAT(data.posted_date, data.offered_date);
                }

                jobs.push({
                    id: doc.id,
                    ...data,
                    actual_tat: tat
                });
            });

            res.send(jobs);
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.all(`SELECT * FROM jobs ORDER BY id DESC`, (err, rows) => {
            if (err) return res.status(500).send({ error: err.message });

            const result = rows.map(r => {
                let tat = null;
                if (r.offered_date)
                    tat = calculateTAT(r.posted_date, r.offered_date);

                return { ...r, actual_tat: tat };
            });

            res.send(result);
        });
    }
});

// Debug endpoint to see parsed data
app.post("/jobs/debug-upload", requireAuth, upload.single("file"), async (req, res) => {
    const results = [];
    const fileExtension = req.file.originalname.toLowerCase().split('.').pop();
    
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        try {
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });
            
            data.forEach(row => {
                const normalizedData = {};
                for (let key in row) {
                    const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
                    let value = row[key];
                    if (typeof value === 'string') {
                        value = value.trim();
                    }
                    normalizedData[normalizedKey] = value;
                }
                results.push(normalizedData);
            });
            
            fs.unlinkSync(req.file.path);
            res.json({ 
                message: "Debug output - not saved", 
                count: results.length,
                sample: results.slice(0, 3),
                allData: results
            });
        } catch (err) {
            fs.unlinkSync(req.file.path);
            res.status(500).send({ error: err.message });
        }
    } else {
        fs.unlinkSync(req.file.path);
        res.status(400).send({ error: "Please upload Excel file" });
    }
});

// Function to sync master data (departments, roles, levels) from uploaded jobs
async function syncMasterData(uploadedData) {
    if (USE_FIRESTORE) {
        try {
            // Extract unique values
            const departments = new Set();
            const roles = new Set();
            const levels = new Set();
            
            uploadedData.forEach(row => {
                if (row.department && row.department.trim()) departments.add(row.department.trim());
                if (row.role && row.role.trim()) roles.add(row.role.trim());
                if (row.level && row.level.trim()) levels.add(row.level.trim());
            });
            
            console.log(`Syncing master data: ${departments.size} departments, ${roles.size} roles, ${levels.size} levels`);
            
            // Get existing departments
            const existingDepts = await departmentsCollection.get();
            const existingDeptNames = new Set();
            existingDepts.forEach(doc => existingDeptNames.add(doc.data().name));
            
            // Add new departments
            const deptBatch = db.batch();
            let deptCount = 0;
            departments.forEach(dept => {
                if (!existingDeptNames.has(dept)) {
                    const docRef = departmentsCollection.doc();
                    deptBatch.set(docRef, { name: dept });
                    deptCount++;
                }
            });
            if (deptCount > 0) await deptBatch.commit();
            
            // Get existing roles
            const existingRoles = await rolesCollection.get();
            const existingRoleNames = new Set();
            existingRoles.forEach(doc => existingRoleNames.add(doc.data().name));
            
            // Add new roles
            const roleBatch = db.batch();
            let roleCount = 0;
            roles.forEach(role => {
                if (!existingRoleNames.has(role)) {
                    const docRef = rolesCollection.doc();
                    roleBatch.set(docRef, { name: role });
                    roleCount++;
                }
            });
            if (roleCount > 0) await roleBatch.commit();
            
            // Get existing levels
            const existingLevels = await levelsCollection.get();
            const existingLevelNames = new Set();
            existingLevels.forEach(doc => existingLevelNames.add(doc.data().name));
            
            // Add new levels
            const levelBatch = db.batch();
            let levelCount = 0;
            levels.forEach(level => {
                if (!existingLevelNames.has(level)) {
                    const docRef = levelsCollection.doc();
                    levelBatch.set(docRef, { name: level });
                    levelCount++;
                }
            });
            if (levelCount > 0) await levelBatch.commit();
            
            console.log(`Added: ${deptCount} departments, ${roleCount} roles, ${levelCount} levels`);
        } catch (err) {
            console.error("Error syncing master data:", err);
        }
    } else {
        // SQLite version
        const departments = new Set();
        const roles = new Set();
        const levels = new Set();
        
        uploadedData.forEach(row => {
            if (row.department && row.department.trim()) departments.add(row.department.trim());
            if (row.role && row.role.trim()) roles.add(row.role.trim());
            if (row.level && row.level.trim()) levels.add(row.level.trim());
        });
        
        const insertDept = db.prepare("INSERT OR IGNORE INTO departments(name) VALUES(?)");
        const insertRole = db.prepare("INSERT OR IGNORE INTO roles(name) VALUES(?)");
        const insertLevel = db.prepare("INSERT OR IGNORE INTO levels(name) VALUES(?)");
        
        departments.forEach(dept => insertDept.run(dept));
        roles.forEach(role => insertRole.run(role));
        levels.forEach(level => insertLevel.run(level));
        
        insertDept.finalize();
        insertRole.finalize();
        insertLevel.finalize();
    }
}

// Bulk upload
app.post("/jobs/bulk", requireAuth, upload.single("file"), async (req, res) => {
    const results = [];
    const fileExtension = req.file.originalname.toLowerCase().split('.').pop();
    
    // Handle XLSX files
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        try {
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });
            
            // Normalize data
            data.forEach(row => {
                const normalizedData = {};
                for (let key in row) {
                    const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
                    let value = row[key];
                    
                    // Trim strings
                    if (typeof value === 'string') {
                        value = value.trim();
                    }
                    
                    normalizedData[normalizedKey] = value;
                }
                results.push(normalizedData);
            });
            
            // Process results
            await processUploadedData(results, req, res);
        } catch (err) {
            fs.unlinkSync(req.file.path);
            return res.status(500).send({ error: "Error parsing XLSX file: " + err.message });
        }
    }
    // Handle CSV files
    else if (fileExtension === 'csv') {
        fs.createReadStream(req.file.path)
            .pipe(csvParser({
                mapHeaders: ({ header }) => header.trim().toLowerCase()
            }))
            .on("data", (data) => {
                // Normalize the data object keys and trim values
                const normalizedData = {};
                for (let key in data) {
                    normalizedData[key.trim().toLowerCase()] = typeof data[key] === 'string' ? data[key].trim() : data[key];
                }
                results.push(normalizedData);
            })
            .on("end", async () => {
                await processUploadedData(results, req, res);
            })
            .on("error", (err) => {
                fs.unlinkSync(req.file.path);
                res.status(500).send({ error: "Error parsing CSV file: " + err.message });
            });
    } else {
        fs.unlinkSync(req.file.path);
        return res.status(400).send({ error: "Invalid file type. Please upload CSV or XLSX file." });
    }
});

// Process uploaded data (shared for both CSV and XLSX)
async function processUploadedData(results, req, res) {
    if (USE_FIRESTORE) {
        try {
            const batch = db.batch();
            let validCount = 0;
            
            results.forEach((row, index) => {
                // Skip rows where all required fields are empty
                if (!row.department && !row.role && !row.level) {
                    return;
                }
                
                const docRef = jobsCollection.doc();
                const uploadTimestamp = new Date();
                uploadTimestamp.setMilliseconds(uploadTimestamp.getMilliseconds() + index);
                
                // Helper function to get value safely
                const getValue = (row, ...keys) => {
                    for (const key of keys) {
                        if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
                            return row[key];
                        }
                    }
                    return null;
                };
                
                // Parse posted_date (opened_date)
                let postedDateRaw = getValue(row, 'posted_date', 'posteddate', 'posted date', 'opened_date', 'openeddate', 'opened date');
                let postedDate = normalizeDate(postedDateRaw);
                
                // Parse offered_date
                let offeredDateRaw = getValue(row, 'offered_date', 'offereddate', 'offered date');
                let offeredDate = normalizeDate(offeredDateRaw);
                
                // Fix: If offered_date exists but opened_date doesn't, swap them
                // (can't offer a job before it's opened)
                if (offeredDate && !postedDate) {
                    postedDate = offeredDate;
                    offeredDate = null;
                }
                
                // Parse expected_tat - handle both string and number from Excel (including misspelled "expceted_tat")
                const expectedTatRaw = getValue(row, 'expected_tat', 'expectedtat', 'expected tat', 'expceted_tat', 'excpeted_tat', 'tat');
                let expectedTat = 7; // default
                if (expectedTatRaw !== null) {
                    const parsed = parseInt(expectedTatRaw);
                    if (!isNaN(parsed) && parsed > 0) {
                        expectedTat = parsed;
                    }
                }
                
                console.log(`Processing row: dept=${row.department}, expected_tat_raw=${expectedTatRaw}, parsed=${expectedTat}, posted=${postedDate}, offered=${offeredDate}`);
                
                // Normalize status - capitalize first letter
                let status = (row.status || "Open").toString().trim();
                status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
                
                batch.set(docRef, {
                    department: row.department || "",
                    role: row.role || "",
                    level: row.level || "",
                    location: row.location || "",
                    status: status,
                    posted_date: postedDate,
                    offered_date: offeredDate,
                    expected_tat: expectedTat,
                    hr_name: getValue(row, 'hr_name', 'hrname', 'hr name', 'hr') || "",
                    row_order: index,
                    created_at: uploadTimestamp.toISOString()
                });
                validCount++;
            });
            
            await batch.commit();
            
            // Auto-populate departments, roles, and levels from uploaded data
            await syncMasterData(results);
            
            fs.unlinkSync(req.file.path);
            res.send({ message: "Bulk upload completed", count: validCount });
        } catch (err) {
            fs.unlinkSync(req.file.path);
            res.status(500).send({ error: err.message });
        }
    } else {
        const stmt = db.prepare(`INSERT INTO jobs(department,role,level,location,status,posted_date,offered_date,expected_tat,hr_name) VALUES(?,?,?,?,?,?,?,?,?)`);
        let validCount = 0;
        
        results.forEach(row => {
            // Skip rows where all required fields are empty
            if (!row.department && !row.role && !row.level) {
                return;
            }
            
            // Helper function to get value safely
            const getValue = (row, ...keys) => {
                for (const key of keys) {
                    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
                        return row[key];
                    }
                }
                return null;
            };
            
            // Parse posted_date (opened_date)
            let postedDateRaw = getValue(row, 'posted_date', 'posteddate', 'posted date', 'opened_date', 'openeddate', 'opened date');
            let postedDate = normalizeDate(postedDateRaw);
            
            // Parse offered_date
            let offeredDateRaw = getValue(row, 'offered_date', 'offereddate', 'offered date');
            let offeredDate = normalizeDate(offeredDateRaw);
            
            // Fix: If offered_date exists but opened_date doesn't, swap them
            // (can't offer a job before it's opened)
            if (offeredDate && !postedDate) {
                postedDate = offeredDate;
                offeredDate = null;
            }
            
            // Parse expected_tat - handle both string and number from Excel (including misspelled "expceted_tat")
            const expectedTatRaw = getValue(row, 'expected_tat', 'expectedtat', 'expected tat', 'expceted_tat', 'excpeted_tat', 'tat');
            let expectedTat = 7; // default
            if (expectedTatRaw !== null) {
                const parsed = parseInt(expectedTatRaw);
                if (!isNaN(parsed) && parsed > 0) {
                    expectedTat = parsed;
                }
            }
            
            // Normalize status - capitalize first letter
            let status = (row.status || "Open").toString().trim();
            status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
            
            stmt.run(
                row.department || "",
                row.role || "",
                row.level || "",
                row.location || "",
                status,
                postedDate,
                offeredDate,
                expectedTat,
                getValue(row, 'hr_name', 'hrname', 'hr name', 'hr') || ""
            );
            validCount++
        });
        
        stmt.finalize();
        
        // Auto-populate departments, roles, and levels from uploaded data
        await syncMasterData(results);
        
        fs.unlinkSync(req.file.path);
        res.send({ message: "Bulk upload completed", count: validCount });
    }
}

// Sync master data from existing jobs
app.post("/sync-master-data-from-jobs", requireAuth, async (req, res) => {
    try {
        console.log("Starting sync of master data from existing jobs...");
        
        // Step 1: Fetch all existing jobs
        let jobs = [];
        if (USE_FIRESTORE) {
            const snapshot = await jobsCollection.get();
            snapshot.forEach(doc => {
                jobs.push(doc.data());
            });
        } else {
            jobs = await new Promise((resolve, reject) => {
                db.all("SELECT * FROM jobs", [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
        
        console.log(`Found ${jobs.length} existing jobs`);
        
        // Step 2: Extract unique values
        const departments = new Set();
        const roles = new Set();
        const levels = new Set();
        
        jobs.forEach(job => {
            if (job.department && job.department.trim()) {
                departments.add(job.department.trim());
            }
            if (job.role && job.role.trim()) {
                roles.add(job.role.trim());
            }
            if (job.level && job.level.trim()) {
                levels.add(job.level.trim());
            }
        });
        
        console.log(`Extracted: ${departments.size} departments, ${roles.size} roles, ${levels.size} levels`);
        
        // Step 3: Get existing master data
        let existingDepartments = new Set();
        let existingRoles = new Set();
        let existingLevels = new Set();
        
        if (USE_FIRESTORE) {
            // Get existing departments
            const deptSnapshot = await departmentsCollection.get();
            deptSnapshot.forEach(doc => existingDepartments.add(doc.data().name));
            
            // Get existing roles
            const roleSnapshot = await rolesCollection.get();
            roleSnapshot.forEach(doc => existingRoles.add(doc.data().name));
            
            // Get existing levels
            const levelSnapshot = await levelsCollection.get();
            levelSnapshot.forEach(doc => existingLevels.add(doc.data().name));
        } else {
            // Get existing departments
            const depts = await new Promise((resolve, reject) => {
                db.all("SELECT name FROM departments", [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            depts.forEach(d => existingDepartments.add(d.name));
            
            // Get existing roles
            const rolesData = await new Promise((resolve, reject) => {
                db.all("SELECT name FROM roles", [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            rolesData.forEach(r => existingRoles.add(r.name));
            
            // Get existing levels
            const levelsData = await new Promise((resolve, reject) => {
                db.all("SELECT name FROM levels", [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            levelsData.forEach(l => existingLevels.add(l.name));
        }
        
        console.log(`Existing: ${existingDepartments.size} departments, ${existingRoles.size} roles, ${existingLevels.size} levels`);
        
        // Step 4: Add only new values
        let addedDepts = 0;
        let addedRoles = 0;
        let addedLevels = 0;
        
        if (USE_FIRESTORE) {
            let batch = db.batch();
            let batchCount = 0;
            
            // Add new departments
            for (const dept of departments) {
                if (!existingDepartments.has(dept)) {
                    const docRef = departmentsCollection.doc();
                    batch.set(docRef, { name: dept });
                    addedDepts++;
                    batchCount++;
                    
                    if (batchCount >= 500) {
                        await batch.commit();
                        batch = db.batch();
                        batchCount = 0;
                    }
                }
            }
            
            // Add new roles
            for (const role of roles) {
                if (!existingRoles.has(role)) {
                    const docRef = rolesCollection.doc();
                    batch.set(docRef, { name: role });
                    addedRoles++;
                    batchCount++;
                    
                    if (batchCount >= 500) {
                        await batch.commit();
                        batch = db.batch();
                        batchCount = 0;
                    }
                }
            }
            
            // Add new levels
            for (const level of levels) {
                if (!existingLevels.has(level)) {
                    const docRef = levelsCollection.doc();
                    batch.set(docRef, { name: level });
                    addedLevels++;
                    batchCount++;
                    
                    if (batchCount >= 500) {
                        await batch.commit();
                        batch = db.batch();
                        batchCount = 0;
                    }
                }
            }
            
            if (batchCount > 0) {
                await batch.commit();
            }
        } else {
            // SQLite: Add new departments
            const deptStmt = db.prepare("INSERT OR IGNORE INTO departments (name) VALUES (?)");
            for (const dept of departments) {
                if (!existingDepartments.has(dept)) {
                    await new Promise((resolve, reject) => {
                        deptStmt.run(dept, (err) => {
                            if (err) reject(err);
                            else {
                                addedDepts++;
                                resolve();
                            }
                        });
                    });
                }
            }
            deptStmt.finalize();
            
            // SQLite: Add new roles
            const roleStmt = db.prepare("INSERT OR IGNORE INTO roles (name) VALUES (?)");
            for (const role of roles) {
                if (!existingRoles.has(role)) {
                    await new Promise((resolve, reject) => {
                        roleStmt.run(role, (err) => {
                            if (err) reject(err);
                            else {
                                addedRoles++;
                                resolve();
                            }
                        });
                    });
                }
            }
            roleStmt.finalize();
            
            // SQLite: Add new levels
            const levelStmt = db.prepare("INSERT OR IGNORE INTO levels (name) VALUES (?)");
            for (const level of levels) {
                if (!existingLevels.has(level)) {
                    await new Promise((resolve, reject) => {
                        levelStmt.run(level, (err) => {
                            if (err) reject(err);
                            else {
                                addedLevels++;
                                resolve();
                            }
                        });
                    });
                }
            }
            levelStmt.finalize();
        }
        
        console.log(`Added: ${addedDepts} departments, ${addedRoles} roles, ${addedLevels} levels`);
        
        res.send({
            message: "Master data synced successfully",
            added: {
                departments: addedDepts,
                roles: addedRoles,
                levels: addedLevels
            },
            total: {
                departments: departments.size,
                roles: roles.size,
                levels: levels.size
            }
        });
    } catch (err) {
        console.error("Error syncing master data:", err);
        res.status(500).send({ error: err.message });
    }
});

// Department endpoints
app.get("/departments", requireAuth, async (req, res) => {
    if (USE_FIRESTORE) {
        try {
            const snapshot = await departmentsCollection.orderBy('name').get();
            const departments = [];
            
            snapshot.forEach(doc => {
                departments.push({ id: doc.id, ...doc.data() });
            });
            
            res.send(departments);
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.all(`SELECT * FROM departments ORDER BY name`, (err, rows) => {
            if (err) return res.status(500).send({ error: err.message });
            res.send(rows);
        });
    }
});

app.post("/departments", requireAuth, async (req, res) => {
    let { name } = req.body;
    
    // Normalize: capitalize first letter of each word
    name = name.trim().split(/\s+/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
    
    if (USE_FIRESTORE) {
        try {
            // Check if department already exists (case-insensitive)
            const snapshot = await departmentsCollection.get();
            const existing = snapshot.docs.find(doc => 
                doc.data().name.toLowerCase() === name.toLowerCase()
            );
            
            if (existing) {
                return res.status(400).send({ error: "Department already exists" });
            }
            
            const docRef = await departmentsCollection.add({ name });
            res.send({ id: docRef.id, name });
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.run(`INSERT INTO departments(name) VALUES(?)`, [name], function(err) {
            if (err) return res.status(500).send({ error: err.message });
            res.send({ id: this.lastID, name });
        });
    }
});

app.delete("/departments/:id", requireAuth, async (req, res) => {
    if (USE_FIRESTORE) {
        try {
            await departmentsCollection.doc(req.params.id).delete();
            res.send({ message: "deleted" });
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.run(`DELETE FROM departments WHERE id=?`, [req.params.id], err => {
            if (err) return res.status(500).send({ error: err.message });
            res.send({ message: "deleted" });
        });
    }
});

// Role endpoints
app.get("/roles", requireAuth, async (req, res) => {
    if (USE_FIRESTORE) {
        try {
            const snapshot = await rolesCollection.orderBy('name').get();
            const roles = [];
            
            snapshot.forEach(doc => {
                roles.push({ id: doc.id, ...doc.data() });
            });
            
            res.send(roles);
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.all(`SELECT * FROM roles ORDER BY name`, (err, rows) => {
            if (err) return res.status(500).send({ error: err.message });
            res.send(rows);
        });
    }
});

app.post("/roles", requireAuth, async (req, res) => {
    let { name } = req.body;
    
    // Normalize: capitalize first letter of each word
    name = name.trim().split(/\s+/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
    
    if (USE_FIRESTORE) {
        try {
            // Check if role already exists (case-insensitive)
            const snapshot = await rolesCollection.get();
            const existing = snapshot.docs.find(doc => 
                doc.data().name.toLowerCase() === name.toLowerCase()
            );
            
            if (existing) {
                return res.status(400).send({ error: "Role already exists" });
            }
            
            const docRef = await rolesCollection.add({ name });
            res.send({ id: docRef.id, name });
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.run(`INSERT INTO roles(name) VALUES(?)`, [name], function(err) {
            if (err) return res.status(500).send({ error: err.message });
            res.send({ id: this.lastID, name });
        });
    }
});

app.delete("/roles/:id", requireAuth, async (req, res) => {
    if (USE_FIRESTORE) {
        try {
            await rolesCollection.doc(req.params.id).delete();
            res.send({ message: "deleted" });
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.run(`DELETE FROM roles WHERE id=?`, [req.params.id], err => {
            if (err) return res.status(500).send({ error: err.message });
            res.send({ message: "deleted" });
        });
    }
});

// Level endpoints
app.get("/levels", requireAuth, async (req, res) => {
    if (USE_FIRESTORE) {
        try {
            const snapshot = await levelsCollection.orderBy('name').get();
            const levels = [];
            
            snapshot.forEach(doc => {
                levels.push({ id: doc.id, ...doc.data() });
            });
            
            res.send(levels);
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.all(`SELECT * FROM levels ORDER BY name`, (err, rows) => {
            if (err) return res.status(500).send({ error: err.message });
            res.send(rows);
        });
    }
});

app.post("/levels", requireAuth, async (req, res) => {
    let { name } = req.body;
    
    // Normalize: capitalize first letter of each word
    name = name.trim().split(/\s+/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
    
    if (USE_FIRESTORE) {
        try {
            // Check if level already exists (case-insensitive)
            const snapshot = await levelsCollection.get();
            const existing = snapshot.docs.find(doc => 
                doc.data().name.toLowerCase() === name.toLowerCase()
            );
            
            if (existing) {
                return res.status(400).send({ error: "Level already exists" });
            }
            
            const docRef = await levelsCollection.add({ name });
            res.send({ id: docRef.id, name });
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.run(`INSERT INTO levels(name) VALUES(?)`, [name], function(err) {
            if (err) return res.status(500).send({ error: err.message });
            res.send({ id: this.lastID, name });
        });
    }
});

app.delete("/levels/:id", requireAuth, async (req, res) => {
    if (USE_FIRESTORE) {
        try {
            await levelsCollection.doc(req.params.id).delete();
            res.send({ message: "deleted" });
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.run(`DELETE FROM levels WHERE id=?`, [req.params.id], err => {
            if (err) return res.status(500).send({ error: err.message });
            res.send({ message: "deleted" });
        });
    }
});

// Authorized Users endpoints
app.get("/authorized-users", requireAuth, async (req, res) => {
    if (USE_FIRESTORE) {
        try {
            const snapshot = await usersCollection.orderBy('email').get();
            const users = [];
            
            snapshot.forEach(doc => {
                users.push({ id: doc.id, ...doc.data() });
            });
            
            res.send(users);
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.all(`SELECT * FROM authorized_users ORDER BY email`, (err, rows) => {
            if (err) return res.status(500).send({ error: err.message });
            res.send(rows);
        });
    }
});

app.post("/authorized-users", requireAuth, async (req, res) => {
    const { email, name, role = 'user' } = req.body;
    
    if (!email) {
        return res.status(400).send({ error: 'Email is required' });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    const invitedBy = req.session.userEmail;
    const invitedAt = new Date().toISOString();
    
    if (USE_FIRESTORE) {
        try {
            // Check if user already exists
            const snapshot = await usersCollection
                .where('email', '==', normalizedEmail)
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                return res.status(400).send({ error: "User with this email already exists" });
            }
            
            const docRef = await usersCollection.add({
                email: normalizedEmail,
                name: name || '',
                role: role,
                status: 'active',
                invited_by: invitedBy,
                invited_at: invitedAt,
                created_at: invitedAt
            });
            
            res.send({ 
                id: docRef.id, 
                email: normalizedEmail, 
                name: name || '', 
                role, 
                status: 'active',
                invited_by: invitedBy,
                invited_at: invitedAt
            });
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.run(
            `INSERT INTO authorized_users(email, name, role, status, invited_by, invited_at) VALUES(?, ?, ?, 'active', ?, ?)`,
            [normalizedEmail, name || '', role, invitedBy, invitedAt],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).send({ error: "User with this email already exists" });
                    }
                    return res.status(500).send({ error: err.message });
                }
                res.send({ 
                    id: this.lastID, 
                    email: normalizedEmail, 
                    name: name || '', 
                    role,
                    status: 'active',
                    invited_by: invitedBy,
                    invited_at: invitedAt
                });
            }
        );
    }
});

app.delete("/authorized-users/:id", requireAuth, async (req, res) => {
    if (USE_FIRESTORE) {
        try {
            await usersCollection.doc(req.params.id).delete();
            res.send({ message: "User removed" });
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.run(`DELETE FROM authorized_users WHERE id=?`, [req.params.id], err => {
            if (err) return res.status(500).send({ error: err.message });
            res.send({ message: "User removed" });
        });
    }
});

// Update user status (activate/deactivate instead of delete)
app.put("/authorized-users/:id", requireAuth, async (req, res) => {
    const { status, name, role } = req.body;
    
    if (USE_FIRESTORE) {
        try {
            const updateData = {};
            if (status) updateData.status = status;
            if (name !== undefined) updateData.name = name;
            if (role) updateData.role = role;
            
            await usersCollection.doc(req.params.id).update(updateData);
            res.send({ message: "User updated", id: req.params.id, ...updateData });
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        const updates = [];
        const params = [];
        
        if (status) {
            updates.push('status = ?');
            params.push(status);
        }
        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (role) {
            updates.push('role = ?');
            params.push(role);
        }
        
        if (updates.length === 0) {
            return res.status(400).send({ error: 'No valid fields to update' });
        }
        
        params.push(req.params.id);
        
        db.run(
            `UPDATE authorized_users SET ${updates.join(', ')} WHERE id = ?`,
            params,
            function(err) {
                if (err) return res.status(500).send({ error: err.message });
                res.send({ message: "User updated", id: req.params.id });
            }
        );
    }
});

app.get("/export", requireAuth, async (req, res) => {
    const { department, role, level, status } = req.query;
    
    if (USE_FIRESTORE) {
        try {
            let query = jobsCollection;

            if (department) {
                query = query.where('department', '==', department);
            }
            if (role) {
                query = query.where('role', '==', role);
            }
            if (level) {
                query = query.where('level', '==', level);
            }
            if (status) {
                query = query.where('status', '==', status);
            }

            const snapshot = await query.get();
            const jobs = [];
            
            snapshot.forEach(doc => {
                jobs.push({ id: doc.id, ...doc.data() });
            });

            const parser = new Parser();
            const csv = parser.parse(jobs);
            res.attachment("hiring_report.csv");
            res.send(csv);
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        let query = `SELECT * FROM jobs WHERE 1=1`;
        const params = [];

        if (department) {
            query += ` AND department=?`;
            params.push(department);
        }
        if (role) {
            query += ` AND role=?`;
            params.push(role);
        }
        if (level) {
            query += ` AND level=?`;
            params.push(level);
        }
        if (status) {
            query += ` AND status=?`;
            params.push(status);
        }

        db.all(query, params, (err, rows) => {
            if (err) return res.status(500).send({ error: err.message });
            const parser = new Parser();
            const csv = parser.parse(rows);
            res.attachment("hiring_report.csv");
            res.send(csv);
        });
    }
});

// Clear all jobs endpoint (use with caution)
app.delete("/jobs/clear/all", requireAuth, async (req, res) => {
    if (USE_FIRESTORE) {
        try {
            const snapshot = await jobsCollection.get();
            const batch = db.batch();
            let count = 0;
            
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
                count++;
            });
            
            await batch.commit();
            res.send({ message: `Deleted ${count} jobs from Firestore`, count });
        } catch (err) {
            res.status(500).send({ error: err.message });
        }
    } else {
        db.run(`DELETE FROM jobs`, function(err) {
            if (err) return res.status(500).send({ error: err.message });
            res.send({ message: `Deleted ${this.changes} jobs`, count: this.changes });
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});