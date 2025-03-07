const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use('/proxy/:url(*)', (req, res, next) => {
    const target = decodeURIComponent(req.params.url); // Decode URL
    console.log(`Proxying request to: ${target}`);

    createProxyMiddleware({
        target: target.startsWith('http') ? target : `https://${target}`, // Ensure valid URL
        changeOrigin: true,
        onError: (err, req, res) => {
            res.status(500).send('Error connecting to target.');
        }
    })(req, res, next);
});

app.listen(8080, () => {
    console.log('Proxy server running on http://localhost:8080');
});
