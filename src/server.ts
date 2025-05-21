import { Hono } from "hono";
import { getMetaTags } from "./utils";
import {
  MetalensError,
  NetworkError,
  HttpError,
  NotFoundError,
  InvalidUrlError,
  ContentParsingError,
  DomainNotFoundError
} from "./error";

// Attempt to import HTML asset for Bun bundler to copy
// @ts-ignore - This import is for the bundler; htmlAssetPath might not be used directly if Bun handles it.
import htmlAssetPath from './index.html';

let serve: any;
let path: any;
let fs: any;
let net: any;

const isNode = typeof process !== 'undefined' && 
               typeof process.versions === 'object' && 
               process.versions !== null && 
               typeof process.versions.node === 'string';

if (isNode) {
  try {
    serve = require('@hono/node-server').serve;
    path = require('path');
    fs = require('fs');
    net = require('net');
  } catch (error) {
    console.error("Failed to import Node-specific modules:", error);
  }
}

const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
};

export const findAvailablePort = async (basePort: number): Promise<number> => {
  let port = basePort;
  
  while (!(await isPortAvailable(port))) {
    port++;
  }
  
  return port;
};

export function createApp(initialContent?: string): Hono {
  const app = new Hono();
  
  app.post("/api/metadata", async (c) => {
    try {
      const body = await c.req.json();
      const url = body.url;
      
      if (!url) {
        return c.json({ error: "URL is required" }, 400);
      }
      
      try {
        const metadata = await getMetaTags(url);
        
        return c.json({
          title: metadata.title,
          description: metadata.openGraph["og:description"] || metadata.meta["description"] || "",
          image: metadata.openGraph["og:image"] || "",
          url: metadata.openGraph["og:url"] || url,
          metadata: metadata
        });
      } catch (metaError) {
        const errorCode = getErrorStatusCode(metaError);
        const errorType = metaError instanceof MetalensError ? metaError.name : 'Error';
        const errorMessage = metaError instanceof Error ? metaError.message : 'Failed to fetch metadata';
        
        console.error(`${errorType}: ${errorMessage}`);
        return c.json({ 
          error: errorMessage,
          errorType: errorType
        }, errorCode); // Removed type assertion
      }
    } catch (error) {
      console.error("Error processing request:", error);
      return c.json({ error: "Invalid request format" }, 400);
    }
  });
  
  app.get("/api/metadata", async (c) => {
    const url = c.req.query("url");
    
    if (!url) {
      return c.json({ error: "URL is required" }, 400);
    }
    
    try {
      const metadata = await getMetaTags(url);
      
      return c.json({
        title: metadata.title,
        description: metadata.openGraph["og:description"] || metadata.meta["description"] || "",
        image: metadata.openGraph["og:image"] || "",
        url: metadata.openGraph["og:url"] || url,
        metadata: metadata
      });
    } catch (error) {
      const errorCode = getErrorStatusCode(error);
      const errorType = error instanceof MetalensError ? error.name : 'Error';
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch metadata';
      
      console.error(`${errorType}: ${errorMessage}`);
      return c.json({ 
        error: errorMessage,
        errorType: errorType
        }, errorCode); // Removed type assertion
    }
  });
  
  if (initialContent) {
    app.get("/", async (c) => {
      try {
        return c.html(initialContent);
      } catch (error) {
        console.error(`Error serving HTML content:`, error);
        return c.text(`Failed to load UI. Please check server logs.`, 500);
      }
    });
  }
  
  return app;
}

export async function startServer(port: number = 3141, initialUrl?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isNode) {
      // console.error("startServer can only be used in a Node.js environment");
      // Reject if not in Node.js environment, as server cannot start
      return reject(new Error("Preview server can only be used in a Node.js environment."));
    }

    let content = "";
    let resolved = false; // Flag to track if promise has been resolved

  try {
    if (process.env.METALENS_DEV === "true") {
      console.log("Running in development mode: loading HTML from src/");
      content = fs.readFileSync(path.join(process.cwd(), "src/index.html"), "utf-8");
    } else {
      // Load from bundled location.
      // htmlAssetPath should be the path provided by Bun's bundler after copying the asset.
      // It's typically relative to the output file, so path.join(__dirname, htmlAssetPath) is a common pattern.
      // If htmlAssetPath is already absolute, path.join might not be strictly necessary but is harmless.
      // However, Bun's asset imports usually give a path relative to the outdir root.
      // Given outDir is 'dist', and server.ts will be in 'dist', __dirname should be 'dist'.
      // If htmlAssetPath is './index.html' (relative to dist), then path.join(__dirname, htmlAssetPath) is correct.
      const localHtmlPath = path.join(__dirname, htmlAssetPath);
      console.log(`Production mode: attempting to load HTML from ${localHtmlPath}`);
      content = fs.readFileSync(localHtmlPath, "utf-8");
    }
  } catch (error) {
    console.error("Error loading HTML content:", error);
    // Add more specific error for production mode if file not found
    if (process.env.METALENS_DEV !== "true" && error.code === 'ENOENT') {
      console.error(`Bundled index.html not found at expected path: ${error.path}`);
      // Reject if HTML content fails to load, as server can't serve essential UI
      return reject(new Error(`Failed to load essential UI file (index.html): ${error.message}`));
    }
    // For other HTML loading errors, or if in dev mode and it fails (less critical for this specific promise)
    content = "<html><body><h1>Error loading UI</h1><p>Please check server logs.</p></body></html>";
    // Potentially reject here too, or allow server to start with error page if preferred.
    // For robustness, if HTML isn't there, the server shouldn't start "successfully".
    return reject(new Error(`Failed to load UI content: ${error.message}`));
  }

  const app = createApp(content);
  
  try {
    const serverInstance = serve({
      port,
      fetch: app.fetch
    }, (info) => { // Callback on successful listen
      if (!resolved) {
        resolved = true;
        console.log(`Preview server started at http://localhost:${info.port}`);
        if (initialUrl) {
          console.log(`Initial URL for preview: ${initialUrl}`);
        }
        console.log("Press Ctrl+C to stop the server");
        resolve();
      }
    });

    // Handle server errors (e.g., port in use)
    // Node's http.Server emits 'error' for things like EADDRINUSE
    if (serverInstance && typeof serverInstance.on === 'function') {
      serverInstance.on('error', (err: Error) => {
        if (!resolved) {
          resolved = true; // Ensure reject is only called once
          console.error("Preview server failed to start:", err);
          reject(err);
        } else {
          // Handle runtime errors after server has started if necessary
          console.error("Preview server runtime error:", err);
        }
      });
    } else {
      // If serve doesn't return a typical server instance or the callback isn't called,
      // we might be in a situation where we can't easily determine startup success.
      // This else block is a fallback/assumption. If `serve` with callback is standard, it should work.
      // For now, assume the callback is the primary success indicator.
      // If no callback and no error event, and no synchronous throw, it's tricky.
      // However, the Hono docs imply `serve` itself can take a callback for listening.
      // Let's assume the (info) callback is reliable. If it's not called and no error,
      // it might hang, which is an issue with the underlying serve or our understanding.
      // The primary check is the callback. If it's not called, and no error, the promise might not resolve/reject.
      // This structure relies on either the callback being called or an error being emitted/thrown.
    }

    // A potential issue: if `serve` starts listening but the callback is somehow delayed,
    // and an error occurs before the callback, `resolved` might still be false.
    // The `serverInstance.on('error', ...)` should catch EADDRINUSE.
    // If `serve` throws synchronously (e.g. invalid options), the outer catch handles it.

  } catch (error) {
    if (!resolved) {
      resolved = true;
      console.error("Error during server initialization:", error);
      reject(error);
    }
  }
  // No explicit Promise.resolve() here; handled by the (info) callback or error paths.
});
}

// Explicitly type the return codes for better type safety with Hono
type MetalensErrorCode = 400 | 404 | 422 | 500 | 503;

function getErrorStatusCode(error: unknown): MetalensErrorCode {
  if (error instanceof NetworkError) {
    return 503;
  } else if (error instanceof DomainNotFoundError) {
    return 404;
  } else if (error instanceof NotFoundError) { // This is a subclass of HttpError, check first
    return 404;
  } else if (error instanceof HttpError) {
    const code = error.statusCode;
    // Ensure the returned code is one of the allowed MetalensErrorCode types
    if (code === 400 || code === 404 || code === 500 || code === 503) {
      return code as MetalensErrorCode; // Assert as specific valid code
    }
    return 500; // Default for other HttpErrors
  } else if (error instanceof InvalidUrlError) {
    return 400;
  } else if (error instanceof ContentParsingError) {
    return 422;
  } else {
    return 500; // Default for unknown errors
  }
}
