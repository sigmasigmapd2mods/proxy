const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { JSDOM } = require('jsdom');

const app = express();

// Function to rewrite URLs inside CSS
const rewriteCSS = (css, baseURL) => {
    return css.replace(/url\(["']?(.*?)["']?\)/g, (match, url) => {
        if (url.startsWith('http') || url.startsWith('data:')) return match;
        return `url("/proxy/${encodeURIComponent(new URL(url, baseURL).href)}")`;
    });
};

app.use('/proxy/:url(*)', async (req, res, next) => {
    const target = decodeURIComponent(req.params.url);
    console.log(`Proxying request to: ${target}`);

    const proxy = createProxyMiddleware({
        target: target.startsWith('http') ? target : `https://${target}`,
        changeOrigin: true,
        selfHandleResponse: true, // Lets us modify responses
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
                    // Modify HTML to rewrite links & scripts
                    try {
                        const dom = new JSDOM(body);
                        const document = dom.window.document;

                        document.querySelectorAll('a, link, script, img, iframe, form').forEach(el => {
                            let attr = el.tagName === 'FORM' ? 'action' : 'href';
                            if (['SCRIPT', 'IMG', 'IFRAME', 'LINK'].includes(el.tagName)) attr = 'src';

                            if (el[attr] && !el[attr].startsWith('http') && !el[attr].startsWith('data:')) {
                                el[attr] = `/proxy/${encodeURIComponent(new URL(el[attr], target).href)}`;
                            }
                        });

                        body = dom.serialize();
                    } catch (err) {
                        console.error('HTML Rewrite Error:', err);
                    }
                } else if (contentType.includes('text/css')) {
                    // Rewrite CSS URLs
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
