import { JSDOM, Document } from 'jsdom';
import { decode } from 'html-entities';
import { PageMetadata, MetaTagType, OpenGraphType, TwitterType } from './types';
import {
  MetalensError,
  NetworkError,
  HttpError,
  NotFoundError,
  InvalidUrlError,
  ContentParsingError,
  MetadataExtractionError,
  DomainNotFoundError,
  determineErrorType,
} from './error';

// Existing normalizeUrlScheme - unchanged
export function normalizeUrlScheme(url: string): string {
  let lowerUrl = url.toLowerCase();

  if (lowerUrl.startsWith('htp://')) {
    url = 'http://' + url.substring(6);
  } else if (lowerUrl.startsWith('htps://')) {
    url = 'https://' + url.substring(7);
  } else if (lowerUrl.startsWith('http//')) {
    url = 'http://' + url.substring(6);
  } else if (lowerUrl.startsWith('https//')) {
    url = 'https://' + url.substring(7);
  } else if (lowerUrl.startsWith('http:/') && !lowerUrl.startsWith('http://')) {
    url = 'http://' + url.substring(5);
  } else if (lowerUrl.startsWith('https:/') && !lowerUrl.startsWith('https://')) {
    url = 'https://' + url.substring(6);
  }

  lowerUrl = url.toLowerCase();

  if (lowerUrl.match(/^[a-zA-Z]+:\/\//i)) {
    if (!lowerUrl.match(/^https?:\/\//i)) {
      throw new InvalidUrlError(url); // Pass the original URL for error reporting
    }
  } else {
    const isLocalhost = lowerUrl.startsWith('localhost') || lowerUrl.includes('localhost:');
    url = `${isLocalhost ? 'http' : 'https'}://${url}`;
  }
  return url;
}

// New getWebsiteContent function
async function getWebsiteContent(normalizedUrl: string): Promise<string> {
  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'MetalensBot/1.0 (+https://github.com/rudrodip/metalens)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow', // Handle redirects
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundError(normalizedUrl);
      }
      throw new HttpError(response.status, response.statusText || `Failed to fetch content from ${normalizedUrl}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      throw new ContentParsingError(
        `Invalid content type. Expected text/html, but received ${contentType} from ${normalizedUrl}`
      );
    }

    const htmlContent = await response.text();
    return htmlContent;
  } catch (error) {
    if (error instanceof MetalensError) {
      throw error; // Re-throw known errors
    }
    // For other errors (fetch exceptions, AbortSignal timeout, etc.), determine their type.
    // determineErrorType is designed for this.
    throw determineErrorType(error, normalizedUrl);
  }
}

// New extractTitle function
function extractTitle(document: Document): string {
  try {
    const titleTag = document.querySelector('title');
    let title = titleTag ? decode(titleTag.textContent || '') : '';

    if (!title) {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
            title = decode(ogTitle.getAttribute('content') || '');
        }
    }
    if (!title) {
        const twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) {
            title = decode(twitterTitle.getAttribute('content') || '');
        }
    }
    return title.trim();
  } catch (e) {
    throw new MetadataExtractionError(`Failed to extract title: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// New extractMetaTagMetadata function
function extractMetaTagMetadata(document: Document): PageMetadata['meta'] {
  const metaData: PageMetadata['meta'] = {};
  try {
    const metaElements = document.querySelectorAll('meta[name]');
    metaElements.forEach(element => {
      const name = element.getAttribute('name') as MetaTagType;
      const content = element.getAttribute('content');
      if (name && content && Object.values(MetaTagType).includes(name)) {
        metaData[name] = decode(content);
      }
    });
  } catch (e) {
    // This is unlikely to throw unless JSDOM itself has issues with querySelectorAll
    throw new MetadataExtractionError(`Failed to extract standard meta tags: ${e instanceof Error ? e.message : String(e)}`);
  }
  return metaData;
}

// New extractOpenGraphMetadata function
function extractOpenGraphMetadata(document: Document): PageMetadata['openGraph'] {
  const ogData: PageMetadata['openGraph'] = {};
  try {
    const ogElements = document.querySelectorAll('meta[property^="og:"]');
    ogElements.forEach(element => {
      const property = element.getAttribute('property') as OpenGraphType;
      const content = element.getAttribute('content');
      if (property && content && Object.values(OpenGraphType).includes(property)) {
        ogData[property] = decode(content);
      }
    });
  } catch (e) {
    throw new MetadataExtractionError(`Failed to extract OpenGraph meta tags: ${e instanceof Error ? e.message : String(e)}`);
  }
  return ogData;
}

// New extractTwitterCardMetadata function
function extractTwitterCardMetadata(document: Document): PageMetadata['twitter'] {
  const twitterData: PageMetadata['twitter'] = {};
  try {
    const twitterElements = document.querySelectorAll('meta[name^="twitter:"]');
    twitterElements.forEach(element => {
      const name = element.getAttribute('name') as TwitterType;
      const content = element.getAttribute('content');
      if (name && content && Object.values(TwitterType).includes(name)) {
        twitterData[name] = decode(content);
      }
    });
  } catch (e) {
    throw new MetadataExtractionError(`Failed to extract Twitter Card meta tags: ${e instanceof Error ? e.message : String(e)}`);
  }
  return twitterData;
}


// Refactored getMetaTags function (this is the main one called by cli.ts)
export async function getMetaTags(rawUrl: string): Promise<PageMetadata> {
  let normalizedUrl = rawUrl; // Keep a reference to the URL used for fetching, for error reporting
  try {
    normalizedUrl = normalizeUrlScheme(rawUrl); // Step 1: Normalize URL (can throw InvalidUrlError)

    const htmlContent = await getWebsiteContent(normalizedUrl); // Step 2: Fetch content (can throw various errors)

    let document: Document;
    try {
      document = new JSDOM(htmlContent).window.document;
    } catch (e) {
      throw new ContentParsingError(`Failed to parse HTML content from ${normalizedUrl}: ${e instanceof Error ? e.message : String(e)}`);
    }

    const title = extractTitle(document); // Step 3a: Extract title
    const meta = extractMetaTagMetadata(document); // Step 3b: Extract standard meta tags
    const openGraph = extractOpenGraphMetadata(document); // Step 3c: Extract OpenGraph
    const twitter = extractTwitterCardMetadata(document); // Step 3d: Extract Twitter Card

    // Construct the PageMetadata object
    const pageMetadata: PageMetadata = {
      title: title || openGraph[OpenGraphType.Title] || twitter[TwitterType.Title] || 'No title found',
      meta,
      openGraph,
      twitter,
    };
    
    // Ensure a URL is present in the metadata, defaulting to the normalized one
    if (!pageMetadata.openGraph[OpenGraphType.Url] && !pageMetadata.meta[MetaTagType.Canonical]) {
        pageMetadata.openGraph[OpenGraphType.Url] = normalizedUrl;
    }


    return pageMetadata;

  } catch (error) {
    // If the error is already a MetalensError, re-throw it.
    // Otherwise, use determineErrorType for unhandled/unexpected errors.
    // Pass normalizedUrl if available, otherwise rawUrl.
    if (error instanceof MetalensError) {
      throw error;
    }
    throw determineErrorType(error, normalizedUrl !== rawUrl ? normalizedUrl : rawUrl);
  }
}


// Existing parseUrlForFilename - needs to use ParsedUrl from types.ts
export interface ParsedUrl { // Re-defining here if not imported, but should be from types.ts
    hostname: string;
    path: string;
    filename: string;
}

export function parseUrlForFilename(rawUrl: string): ParsedUrl { // Changed to use the local ParsedUrl for now
  const normalizedUrl = normalizeUrlScheme(rawUrl);
  try {
    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname;
    let path = urlObj.pathname.replace(/\/$/, ''); 
    if (path === "" && urlObj.search) { // if path is empty but query params exist
        path = urlObj.search;
    } else if (path === "" && urlObj.hash) { // if path is empty but hash exists
        path = urlObj.hash.substring(1); // remove #
    } else if (path === "") {
        path = "_root"; // default for root paths like example.com/
    }

    const filename = `${hostname}${path.replace(/[^a-zA-Z0-9]/g, '_')}.json`; // Changed to .json

    return {
      hostname,
      path,
      filename,
    };
  } catch (error) {
    // This typically happens if normalizeUrlScheme still produced something invalid for URL constructor
    // or if URL parts are unexpectedly absent.
    throw new InvalidUrlError(`Could not parse the normalized URL: ${normalizedUrl} for filename generation. ${error instanceof Error ? error.message : ''}`);
  }
}

// This function seems to be used by cli.ts's getSaveFilename but wasn't in the provided utils.ts
// Adding a basic implementation.
export function parseFileName(filename: string): string {
  // Basic sanitization: remove characters not typically allowed in filenames
  // and ensure it ends with .json
  let sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!sanitized.toLowerCase().endsWith('.json')) {
    if (sanitized.endsWith('.')) {
      sanitized += 'json';
    } else {
      sanitized += '.json';
    }
  }
  // Replace multiple consecutive underscores with a single one
  sanitized = sanitized.replace(/__+/g, '_');
  return sanitized;
}
