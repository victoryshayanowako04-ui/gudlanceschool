const express = require('express');
const app = express();
const path = require('path');

// This tells Node to host your index.html, style.css, and app.js cleanly
app.use(express.static(__dirname));

// Start the server on port 3000
app.listen(3000, () => {
    console.log('🚀 Haven Online is running!');
    console.log('👉 Open your browser and go to: http://localhost:3000');
});