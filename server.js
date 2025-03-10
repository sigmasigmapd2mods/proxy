const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 10000; // Render assigns a port automatically

app.use('/proxy/:url(*)', (req, res, next) => {
    const target = decodeURIComponent(req.params.url);

    // Prevent infinite loops
    if (target.includes(req.get('host'))) {
        return res.status(400).send('Proxy loop detected.');
    }

    console.log(`Proxying request to: ${target}`);

    const proxy = createProxyMiddleware({
        target: target.startsWith('http') ? target : `https://${target}`,
        changeOrigin: true,
        selfHandleResponse: false, // Stream the response directly
        onProxyRes: (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['access-control-allow-origin'];
        },
        onError: (err, req, res) => {
            console.error(`Proxy error: ${err.message}`);
            res.status(500).send('Error connecting to target.');
        }
    });

    proxy(req, res, next);
});

app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});
