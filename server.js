const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT, 10) || 3000;

// Initialize Next.js app in production or dev mode
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare()
    .then(() => {
        createServer(async (req, res) => {
            try {
                // Parse request URL and pass it to the Next.js request handler
                const parsedUrl = parse(req.url, true);
                await handle(req, res, parsedUrl);
            } catch (err) {
                console.error("Error occurred handling URL:", req.url, err);
                res.statusCode = 500;
                res.end("Internal Server Error");
            }
        })
            .once("error", (err) => {
                console.error("Server listener encountered an error:", err);
                process.exit(1);
            })
            .listen(port, hostname, () => {
                console.log(`> Application is ready and listening on http://${hostname}:${port}`);
            });
    })
    .catch((err) => {
        console.error("Failed to prepare application server:", err);
        process.exit(1);
    });
