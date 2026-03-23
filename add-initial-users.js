// Script to add initial authorized users to the database
// Run this to add the first admin user so you can log in

const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.db");

// Add your email addresses here
const INITIAL_USERS = [
    { email: 'nikhil.devadas@mobisy.com', name: 'Nikhil Devadas', role: 'admin' },
    { email: 'anjana.mohan@mobisy.com', name: 'Anjana Mohan', role: 'admin' },
    { email: 'lav@mobisy.com', name: 'Lav', role: 'user' },
    { email: 'kishore@mobisy.com', name: 'Kishore', role: 'user' },
    { email: 'prarabdh.mishra@mobisy.com', name: 'Prarabdh Mishra', role: 'user' },
    { email: 'archita@mobisy.com', name: 'Archita', role: 'user' },
    { email: 'noman@mobisy.com', name: 'Noman', role: 'user' },
    { email: 'krishna.kothari@mobisy.com', name: 'Krishna Kothari', role: 'user' },
    { email: 'nikhil@mobisy.com', name: 'Nikhil', role: 'user' },
    { email: 'lalit@mobisy.com', name: 'Lalit', role: 'user' },
    { email: 'shree@mobisy.com', name: 'Shree', role: 'user' },
    { email: 'vasu@mobisy.com', name: 'Vasu', role: 'user' },
    { email: 'utkarsh.gupta@mobisy.com', name: 'Utkarsh Gupta', role: 'user' },
    { email: 'raj.grewal@mobisy.com', name: 'Raj Grewal', role: 'user' },
    { email: 'arvind.kandi@mobisy.com', name: 'Arvind Kandi', role: 'user' },
    { email: 'ankit.kumar@mobisy.com', name: 'Ankit Kumar', role: 'user' },
    { email: 'deepa.dubey@mobisy.com', name: 'Deepa Dubey', role: 'user' },
    { email: 'vishesh@mobisy.com', name: 'Vishesh', role: 'user' },
    { email: 'abdullah.khalid@mobisy.com', name: 'Abdullah Khalid', role: 'user' },
    { email: 'srinidhi@mobisy.com', name: 'Srinidhi', role: 'user' },
    { email: 'madhan.kumar@mobisy.com', name: 'Madhan Kumar', role: 'user' },
    { email: 'nilesh.c@mobisy.com', name: 'Nilesh C', role: 'user' },
];

console.log('Adding initial authorized users...');

INITIAL_USERS.forEach(user => {
    const email = user.email.toLowerCase().trim();
    db.run(
        `INSERT OR IGNORE INTO authorized_users(email, name, role, status, invited_at) VALUES(?, ?, ?, 'active', datetime('now'))`,
        [email, user.name, user.role],
        function(err) {
            if (err) {
                console.error(`❌ Error adding ${email}:`, err.message);
            } else if (this.changes > 0) {
                console.log(`✅ Added: ${email} (${user.name})`);
            } else {
                console.log(`ℹ️  Already exists: ${email}`);
            }
        }
    );
});

// Close database after a short delay to ensure all operations complete
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('\n✅ Done! You can now log in with the authorized emails.');
        }
    });
}, 1000);
