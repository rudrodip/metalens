import { Hono } from "hono";
import { serve } from '@hono/node-server'
import { getMetaTags } from "./utils";
import path from "node:path";
import fs from "node:fs";
import {
  MetalensError,
  NetworkError,
  HttpError,
  NotFoundError,
  InvalidUrlError,
  ContentParsingError,
  DomainNotFoundError
} from "./error";

export async function startServer(initialUrl?: string): Promise<void> {
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
  
  let staticRoot = path.resolve("./src");
  
  const distIndexPath = path.join(process.cwd(), "dist/index.html");
  const srcIndexPath = path.resolve("./src/index.html");
  
  if (fs.existsSync(distIndexPath)) {
    staticRoot = path.join(process.cwd(), "dist");
  } else if (fs.existsSync(srcIndexPath)) {
    staticRoot = path.resolve("./src");
  } else {
    staticRoot = path.dirname(import.meta.url.replace("file:", ""));
  }
  
  app.get("/", (c) => {
    return c.html(fs.readFileSync(path.join(staticRoot, "index.html"), "utf-8"));
  })
  
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
