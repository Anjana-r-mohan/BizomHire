// Import production data to local SQLite database
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const csvParser = require("csv-parser");

const db = new sqlite3.Database("./database.db");

console.log('🔄 Importing production data to local database...\n');

// First, clear existing jobs
db.run('DELETE FROM jobs', (err) => {
    if (err) {
        console.error('❌ Error clearing jobs:', err);
        db.close();
        return;
    }
    
    console.log('✅ Cleared existing jobs');
    console.log('📥 Importing production data...\n');
    
    const jobs = [];
    
    // Read the production CSV
    fs.createReadStream('./hiring_report_prod.csv')
        .pipe(csvParser())
        .on('data', (row) => {
            // Map CSV columns to database columns
            // Skip Firestore-specific columns (id, row_order, created_at, updated_at)
            jobs.push({
                department: row.department || '',
                role: row.role || '',
                level: row.level || '',
                location: row.location || '',
                status: row.status || 'Open',
                posted_date: row.posted_date || '',
                offered_date: row.offered_date || '',
                expected_tat: row.expected_tat ? parseInt(row.expected_tat) : null,
                hr_name: row.hr_name || ''
            });
        })
        .on('end', () => {
            console.log(`Found ${jobs.length} jobs to import`);
            
            // Insert all jobs
            const stmt = db.prepare(`
                INSERT INTO jobs (department, role, level, location, status, posted_date, offered_date, expected_tat, hr_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            let imported = 0;
            let errors = 0;
            
            jobs.forEach((job, index) => {
                stmt.run(
                    job.department,
                    job.role,
                    job.level,
                    job.location,
                    job.status,
                    job.posted_date,
                    job.offered_date,
                    job.expected_tat,
                    job.hr_name,
                    (err) => {
                        if (err) {
                            errors++;
                            console.error(`❌ Error importing job ${index + 1}:`, err.message);
                        } else {
                            imported++;
                        }
                        
                        // Check if all done
                        if (imported + errors === jobs.length) {
                            stmt.finalize();
                            console.log(`\n✅ Import complete!`);
                            console.log(`   Imported: ${imported} jobs`);
                            console.log(`   Errors: ${errors} jobs`);
                            console.log('\n🎉 Production data is now in your local database!');
                            console.log('   Refresh your browser to see the real data.');
                            db.close();
                        }
                    }
                );
            });
        })
        .on('error', (err) => {
            console.error('❌ Error reading CSV:', err);
            db.close();
        });
});
