// Fix missing offered_date for Offered/Joined jobs in local database
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.db");

console.log('Fixing missing offered_date for Offered/Joined jobs...\n');

db.run(
    `UPDATE jobs 
     SET offered_date = posted_date 
     WHERE (status = 'Offered' OR status = 'Joined') 
     AND (offered_date IS NULL OR offered_date = '')
     AND posted_date IS NOT NULL`,
    [],
    function(err) {
        if (err) {
            console.error('Error:', err);
            db.close();
        } else {
            console.log(`✅ Updated ${this.changes} jobs with estimated offered_date`);
            console.log('Note: This sets offered_date = posted_date (TAT will show as 0)');
            console.log('      This is temporary test data - update with real dates later!');
            console.log('\nYou can now test the dashboard at http://localhost:3000');
            db.close();
        }
    }
);
