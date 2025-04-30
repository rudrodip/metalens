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

let serve: any;
let path: any;
let fs: any;

const isNode = typeof process !== 'undefined' && 
               typeof process.versions === 'object' && 
               process.versions !== null && 
               typeof process.versions.node === 'string';

if (isNode) {
  try {
    serve = require('@hono/node-server').serve;
    path = require('path');
    fs = require('fs');
  } catch (error) {
    console.error("Failed to import Node-specific modules:", error);
  }
}

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
        }, errorCode as 400 | 404 | 422 | 500 | 503);
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
      }, errorCode as 400 | 404 | 422 | 500 | 503);
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

export async function startServer(initialUrl?: string): Promise<void> {
  if (!isNode) {
    console.error("startServer can only be used in a Node.js environment");
    return Promise.resolve();
  }

  const hostedHtmlUrl = "https://raw.githubusercontent.com/rudrodip/metalens/refs/heads/main/src/index.html"
  let content = "";

  try {
    if (process.env.METALENS_DEV === "true") {
      console.log("Running in development mode");
      content = fs.readFileSync(path.join(process.cwd(), "src/index.html"), "utf-8");
    } else {
      content = await fetch(hostedHtmlUrl).then(res => res.text());
    }
  } catch (error) {
    console.error("Error loading HTML content:", error);
    content = "<html><body><h1>Error loading UI</h1><p>Please check server logs.</p></body></html>";
  }

  const app = createApp(content);
  
  const server = serve({
    port: 3141,
    fetch: app.fetch
  });
  
  console.log("Preview server started at http://localhost:3141");
  if (initialUrl) {
    console.log(`Initial URL for preview: ${initialUrl}`);
  }
  console.log("Press Ctrl+C to stop the server");
  
  return Promise.resolve();
}

function getErrorStatusCode(error: unknown): number {
  if (error instanceof NetworkError) {
    return 503;
  } else if (error instanceof DomainNotFoundError) {
    return 404;
  } else if (error instanceof NotFoundError) {
    return 404;
  } else if (error instanceof HttpError) {
    const code = error.statusCode;
    if (code === 400 || code === 404 || code === 500 || code === 503) {
      return code;
    }
    return 500;
  } else if (error instanceof InvalidUrlError) {
    return 400;
  } else if (error instanceof ContentParsingError) {
    return 422;
  } else {
    return 500;
  }
}
