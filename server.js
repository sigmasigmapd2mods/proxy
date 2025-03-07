const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use('/proxy/:url(*)', (req, res, next) => {
    const target = decodeURIComponent(req.params.url);
    console.log(`Proxying request to: ${target}`);

    createProxyMiddleware({
        target: target.startsWith('http') ? target : `https://${target}`,
        changeOrigin: true,
        selfHandleResponse: true, // Lets us modify the response
        onProxyRes(proxyRes, req, res) {
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
            res.status(500).send('Error connecting to target.');
        }
    })(req, res, next);
});

app.listen(8080, () => {
    console.log('Proxy server running on http://localhost:8080');
});

onProxyRes(proxyRes, req, res) {
    delete proxyRes.headers['x-frame-options']; // Allows embedding in iframes
    delete proxyRes.headers['content-security-policy']; // Avoids CSP blocking
    delete proxyRes.headers['access-control-allow-origin']; // Prevents CORS errors

    if (proxyRes.headers['location']) {
        proxyRes.headers['location'] = `/proxy/${encodeURIComponent(proxyRes.headers['location'])}`;
    }

    let body = '';
    proxyRes.on('data', chunk => (body += chunk));
    proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        res.end(body);
    });
}

