const app = require('./app'); // Points to your app logic
const port = 3000;

app.listen(port, () => {
    console.log(`-----------------------------------------`);
    console.log(`🚀 EcoTrack Server running!`);
    console.log(`URL: http://localhost:${port}`);
    console.log(`Press Ctrl+C to stop`);
    console.log(`-----------------------------------------`);
});