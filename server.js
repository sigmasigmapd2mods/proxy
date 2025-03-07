const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use('/proxy/:url(*)', (req, res, next) => {
    const target = decodeURIComponent(req.params.url);
    console.log(`Proxying request to: ${target}`);

    const proxy = createProxyMiddleware({
        target: target.startsWith('http') ? target : `https://${target}`,
        changeOrigin: true,
        selfHandleResponse: true, // Lets us modify the response
        onProxyRes: (proxyRes, req, res) => {
            // Remove security headers to avoid CORS issues
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['access-control-allow-origin'];

            // Modify "Location" header for redirects
            if (proxyRes.headers['location']) {
                proxyRes.headers['location'] = `/proxy/${encodeURIComponent(proxyRes.headers['location'])}`;
            }

            // Pipe the modified response back
            let body = '';
            proxyRes.on('data', chunk => (body += chunk));
            proxyRes.on('end', () => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                res.end(body);
            });
        },
        onError: (err, req, res) => {
            console.error(`Proxy error: ${err.message}`);
            res.status(500).send('Error connecting to target.');
        }
    });

    proxy(req, res, next);
});

app.listen(8080, () => {
    console.log('Proxy server running on http://localhost:8080');
});
