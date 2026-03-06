const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const { Parser } = require("json2csv");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");

const upload = multer({ dest: "uploads/" });

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

const db = new sqlite3.Database("./database.db");

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
)
`);

// Add hr_name column if it doesn't exist (for existing databases)
db.run(`ALTER TABLE jobs ADD COLUMN hr_name TEXT`, (err) => {
    // Ignore error if column already exists
});

db.run(`
CREATE TABLE IF NOT EXISTS departments (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT UNIQUE
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS roles (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT UNIQUE
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS levels (
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT UNIQUE
)
`);

function calculateTAT(start, end) {
    let startDate = new Date(start);
    let endDate = new Date(end);
    let count = 0;

    while (startDate <= endDate) {
        let day = startDate.getDay();
        if (day !== 0 && day !== 6) count++;
        startDate.setDate(startDate.getDate() + 1);
    }

    return count;
}

app.post("/jobs", (req, res) => {
    const { department, role, level, status, posted_date, expected_tat, hr_name } = req.body;

    db.run(
        `INSERT INTO jobs(department,role,level,status,posted_date,expected_tat,hr_name)
         VALUES(?,?,?,?,?,?,?)`,
        [department, role, level, status, posted_date, expected_tat, hr_name],
        function (err) {
            if (err) return res.send(err);
            res.send({ id: this.lastID });
        }
    );
});

app.put("/jobs/:id", (req, res) => {
    const { department, role, level, status, posted_date, offered_date, expected_tat, hr_name } = req.body;

    db.run(
        `UPDATE jobs SET department=?, role=?, level=?, status=?, posted_date=?, offered_date=?, expected_tat=?, hr_name=? WHERE id=?`,
        [department, role, level, status, posted_date, offered_date, expected_tat, hr_name, req.params.id],
        err => {
            if (err) return res.send(err);
            res.send({ message: "updated" });
        }
    );
});

app.delete("/jobs/:id", (req, res) => {
    db.run(`DELETE FROM jobs WHERE id=?`, [req.params.id], err => {
        if (err) return res.send(err);
        res.send({ message: "deleted" });
    });
});

app.get("/jobs", (req, res) => {
    db.all(`SELECT * FROM jobs`, (err, rows) => {
        if (err) return res.send(err);

        const result = rows.map(r => {
            let tat = null;
            if (r.offered_date)
                tat = calculateTAT(r.posted_date, r.offered_date);

            return { ...r, actual_tat: tat };
        });

        res.send(result);
    });
});

// Bulk upload
app.post("/jobs/bulk", upload.single("file"), (req, res) => {
    const results = [];
    
    fs.createReadStream(req.file.path)
        .pipe(csvParser())
        .on("data", (data) => results.push(data))
        .on("end", () => {
            const stmt = db.prepare(`INSERT INTO jobs(department,role,level,status,posted_date,offered_date,expected_tat,hr_name) VALUES(?,?,?,?,?,?,?,?)`);
            
            results.forEach(row => {
                stmt.run(
                    row.department || "",
                    row.role || "",
                    row.level || "",
                    row.status || "Published",
                    row.posted_date || "",
                    row.offered_date || null,
                    row.expected_tat || 7,
                    row.hr_name || ""
                );
            });
            
            stmt.finalize();
            fs.unlinkSync(req.file.path);
            res.send({ message: "Bulk upload completed", count: results.length });
        });
});

// Department endpoints
app.get("/departments", (req, res) => {
    db.all(`SELECT * FROM departments ORDER BY name`, (err, rows) => {
        if (err) return res.send(err);
        res.send(rows);
    });
});

app.post("/departments", (req, res) => {
    const { name } = req.body;
    db.run(`INSERT INTO departments(name) VALUES(?)`, [name], function(err) {
        if (err) return res.send({ error: err.message });
        res.send({ id: this.lastID, name });
    });
});

app.delete("/departments/:id", (req, res) => {
    db.run(`DELETE FROM departments WHERE id=?`, [req.params.id], err => {
        if (err) return res.send(err);
        res.send({ message: "deleted" });
    });
});

// Role endpoints
app.get("/roles", (req, res) => {
    db.all(`SELECT * FROM roles ORDER BY name`, (err, rows) => {
        if (err) return res.send(err);
        res.send(rows);
    });
});

app.post("/roles", (req, res) => {
    const { name } = req.body;
    db.run(`INSERT INTO roles(name) VALUES(?)`, [name], function(err) {
        if (err) return res.send({ error: err.message });
        res.send({ id: this.lastID, name });
    });
});

app.delete("/roles/:id", (req, res) => {
    db.run(`DELETE FROM roles WHERE id=?`, [req.params.id], err => {
        if (err) return res.send(err);
        res.send({ message: "deleted" });
    });
});

// Level endpoints
app.get("/levels", (req, res) => {
    db.all(`SELECT * FROM levels ORDER BY name`, (err, rows) => {
        if (err) return res.send(err);
        res.send(rows);
    });
});

app.post("/levels", (req, res) => {
    const { name } = req.body;
    db.run(`INSERT INTO levels(name) VALUES(?)`, [name], function(err) {
        if (err) return res.send({ error: err.message });
        res.send({ id: this.lastID, name });
    });
});

app.delete("/levels/:id", (req, res) => {
    db.run(`DELETE FROM levels WHERE id=?`, [req.params.id], err => {
        if (err) return res.send(err);
        res.send({ message: "deleted" });
    });
});

app.get("/export", (req, res) => {
    const { department, role, level, status } = req.query;
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
        const parser = new Parser();
        const csv = parser.parse(rows);
        res.attachment("hiring_report.csv");
        res.send(csv);
    });
});

app.listen(3000, () => {
    console.log("Server running http://localhost:3000");
});