// Quick test to check if API is returning data
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/jobs',
    method: 'GET',
    headers: {
        'Cookie': 'connect.sid=test' // Won't work but let's see the response
    }
};

const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log('\nResponse:');
        try {
            const parsed = JSON.parse(data);
            console.log(`Jobs count: ${parsed.length || 'N/A'}`);
            if (parsed.length > 0) {
                console.log('First job:', JSON.stringify(parsed[0], null, 2));
            }
        } catch (e) {
            console.log(data);
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.end();
