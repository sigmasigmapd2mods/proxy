const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 10000; // Render assigns a port automatically

// Middleware to rewrite URLs inside proxied content
const rewriteHTML = (body, target) => {
    return body.replace(/(href|src|action)=["'](.*?)["']/g, (match, attr, url) => {
        if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('#')) return match;
        return `${attr}="/proxy/${encodeURIComponent(new URL(url, target).href)}"`;
    });
};

const rewriteCSS = (body, target) => {
    return body.replace(/url\(["']?(.*?)["']?\)/g, (match, url) => {
        if (url.startsWith('http') || url.startsWith('data:')) return match;
        return `url("/proxy/${encodeURIComponent(new URL(url, target).href)}")`;
    });
};

app.use('/proxy/:url(*)', async (req, res, next) => {
    const target = decodeURIComponent(req.params.url);

    // Prevent infinite loops by blocking self-referencing requests
    if (target.includes(req.get('host'))) {
        return res.status(400).send('Proxy loop detected.');
    }

    console.log(`Proxying request to: ${target}`);

    const proxy = createProxyMiddleware({
        target: target.startsWith('http') ? target : `https://${target}`,
        changeOrigin: true,
        selfHandleResponse: true,
        onProxyRes: (proxyRes, req, res) => {
            let body = '';
            proxyRes.on('data', chunk => (body += chunk));
            proxyRes.on('end', () => {
                res.writeHead(proxyRes.statusCode, {
                    ...proxyRes.headers,
                    'access-control-allow-origin': '*', // Allow resources to load
                    'content-security-policy': "default-src * 'unsafe-inline' 'unsafe-eval' data:",
                    'x-frame-options': 'ALLOWALL'
                });

                const contentType = proxyRes.headers['content-type'] || '';

                if (contentType.includes('text/html')) {
                    body = rewriteHTML(body, target);
                } else if (contentType.includes('text/css')) {
                    body = rewriteCSS(body, target);
                }

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

app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});
