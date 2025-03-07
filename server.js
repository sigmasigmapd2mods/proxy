const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use('/proxy', createProxyMiddleware({
    target: 'https://example.com', // Change this to the target site
    changeOrigin: true,
    pathRewrite: { '^/proxy': '' }
}));

app.listen(8080, () => {
    console.log('Proxy server running on port 8080');
});
