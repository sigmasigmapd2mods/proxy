const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const rewriteCSS = (css, baseURL) => {
    return css.replace(/url\(["']?(.*?)["']?\)/g, (match, url) => {
        if (url.startsWith('http') || url.startsWith('data:')) return match;
        return `url("/proxy/${encodeURIComponent(new URL(url, baseURL).href)}")`;
    });
};

app.use('/proxy/:url(*)', async (req, res, next) => {
    const target = decodeURIComponent(req.params.url);

    // Prevent infinite loops
    if (target.includes(req.get('host'))) {
        return res.status(400).send('Proxy loop detected.');
    }

    console.log(`Proxying request to: ${target}`);

    const proxy = createProxyMiddleware({
        target: target.startsWith('http') ? target : `https://${target}`,
        changeOrigin: true,
        selfHandleResponse: true,
        onProxyRes: async (proxyRes, req, res) => {
            let body = '';
            proxyRes.on('data', chunk => (body += chunk));
            proxyRes.on('end', async () => {
                res.writeHead(proxyRes.statusCode, {
                    ...proxyRes.headers,
                    'access-control-allow-origin': '*',
                    'content-security-policy': "default-src * 'unsafe-inline' 'unsafe-eval' data:",
                    'x-frame-options': 'ALLOWALL'
                });

                const contentType = proxyRes.headers['content-type'] || '';

                if (contentType.includes('text/html')) {
                    // Fix relative links
                    body = body.replace(/(href|src)=["'](.*?)["']/g, (match, attr, link) => {
                        if (link.startsWith('http') || link.startsWith('data:')) return match;
                        return `${attr}="/proxy/${encodeURIComponent(new URL(link, target).href)}"`;
                    });

                    // Fix redirect headers
                    if (proxyRes.headers['location']) {
                        res.setHeader('location', `/proxy/${encodeURIComponent(proxyRes.headers['location'])}`);
                    }
                } else if (contentType.includes('text/css')) {
                    // Fix CSS imports
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

app.listen(8080, () => {
    console.log('Proxy server running on http://localhost:8080');
});
