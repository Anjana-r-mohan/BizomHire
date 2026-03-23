// Add initial authorized users to Firestore (Production)
const { Firestore } = require("@google-cloud/firestore");

const db = new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'bizomhire-dashboard',
});

const usersCollection = db.collection('authorized_users');

// Add your authorized email addresses here
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

console.log('🔄 Adding authorized users to Firestore (Production)...\n');

async function addUsers() {
    let added = 0;
    let existing = 0;
    let errors = 0;

    for (const user of INITIAL_USERS) {
        try {
            const email = user.email.toLowerCase().trim();
            
            // Check if user already exists
            const snapshot = await usersCollection
                .where('email', '==', email)
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                console.log(`ℹ️  Already exists: ${email}`);
                existing++;
            } else {
                // Add user
                await usersCollection.add({
                    email: email,
                    name: user.name,
                    role: user.role,
                    status: 'active',
                    invited_by: 'system',
                    invited_at: new Date().toISOString(),
                    created_at: new Date().toISOString()
                });
                console.log(`✅ Added: ${email} (${user.name})`);
                added++;
            }
        } catch (error) {
            console.error(`❌ Error adding ${user.email}:`, error.message);
            errors++;
        }
    }

    console.log('\n📊 Summary:');
    console.log(`   Added: ${added} users`);
    console.log(`   Already existing: ${existing} users`);
    console.log(`   Errors: ${errors} users`);
    console.log('\n✅ Done! Users can now log in to production.');
}

addUsers().catch(console.error);
