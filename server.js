const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { JSDOM } = require('jsdom'); // To modify HTML responses
const url = require('url');

const app = express();

app.use('/proxy/:url(*)', async (req, res, next) => {
    const target = decodeURIComponent(req.params.url);
    console.log(`Proxying request to: ${target}`);

    const proxy = createProxyMiddleware({
        target: target.startsWith('http') ? target : `https://${target}`,
        changeOrigin: true,
        selfHandleResponse: true, // Allows us to modify responses
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

                // Only modify HTML responses
                if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].includes('text/html')) {
                    try {
                        const dom = new JSDOM(body);
                        const document = dom.window.document;

                        // Fix relative links
                        document.querySelectorAll('a, link, script, img, iframe, form').forEach(el => {
                            let attr = el.tagName === 'FORM' ? 'action' : 'href';
                            if (el.tagName === 'SCRIPT' || el.tagName === 'IMG' || el.tagName === 'IFRAME') attr = 'src';

                            if (el[attr] && !el[attr].startsWith('http') && !el[attr].startsWith('data:')) {
                                el[attr] = `/proxy/${encodeURIComponent(new URL(el[attr], target).href)}`;
                            }
                        });

                        body = dom.serialize();
                    } catch (err) {
                        console.error('HTML Rewrite Error:', err);
                    }
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
