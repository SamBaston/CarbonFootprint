const app = require('./app');
const port = 3000;

app.listen(port, () => {
    console.log(`-----------------------------------------`);
    console.log(`Application Server running`);
    console.log(`URL: http://localhost:${port}`);
    console.log(`Press Ctrl+C to stop`);
    console.log(`-----------------------------------------`);
});