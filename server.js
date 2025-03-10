const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 10000; // Render assigns a port automatically

app.use('/proxy-render/:url(*)', async (req, res) => {
    const target = decodeURIComponent(req.params.url);

    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        // Wait until the page is fully loaded (including JS execution)
        await page.goto(target, { waitUntil: 'domcontentloaded' });

        // Get the fully rendered HTML content
        const content = await page.content();

        // Send the rendered HTML to the client
        res.send(content);

        await browser.close();
    } catch (err) {
        console.error(`Error rendering page: ${err.message}`);
        res.status(500).send('Error rendering page with JavaScript.');
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});
