// Configuration for allowed email addresses
// Add authorized email addresses to this list
// You can also use environment variable ALLOWED_EMAILS as comma-separated list

const ALLOWED_EMAILS = [
    // Add your authorized emails here
    // Example:
    // 'john.doe@example.com',
    // 'jane.smith@example.com',
];

// Check if environment variable has allowed emails
const envEmails = process.env.ALLOWED_EMAILS;
if (envEmails) {
    const emailList = envEmails.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
    ALLOWED_EMAILS.push(...emailList);
}

// Function to check if an email is allowed
function isEmailAllowed(email) {
    if (!email) return false;
    const normalizedEmail = email.trim().toLowerCase();
    return ALLOWED_EMAILS.some(allowedEmail => 
        allowedEmail.toLowerCase() === normalizedEmail
    );
}

// Get all allowed emails (for admin purposes)
function getAllowedEmails() {
    return [...ALLOWED_EMAILS];
}

module.exports = {
    isEmailAllowed,
    getAllowedEmails,
    ALLOWED_EMAILS
};
