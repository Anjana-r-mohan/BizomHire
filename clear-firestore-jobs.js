const { Firestore } = require("@google-cloud/firestore");

const db = new Firestore({
    projectId: 'bizomhire-dashboard',
});

const jobsCollection = db.collection('jobs');

async function clearAllJobs() {
    console.log("Deleting all jobs from Firestore...");
    
    try {
        const snapshot = await jobsCollection.get();
        const totalDocs = snapshot.size;
        
        if (totalDocs === 0) {
            console.log("No jobs found in the database.");
            return 0;
        }
        
        console.log(`Found ${totalDocs} jobs. Deleting...`);
        
        const batch = db.batch();
        let count = 0;
        
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });
        
        await batch.commit();
        console.log(`✅ Successfully deleted ${count} jobs from Firestore.`);
        return count;
    } catch (err) {
        console.error("Error:", err.message);
        throw err;
    }
}

clearAllJobs()
    .then((count) => {
        console.log(`Done! Deleted ${count} jobs.`);
        process.exit(0);
    })
    .catch(err => {
        console.error("Failed:", err.message);
        process.exit(1);
    });
