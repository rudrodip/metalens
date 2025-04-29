import { PageMetadata, MetaTagType, OpenGraphType, TwitterType } from "./types";
import { decode } from "html-entities";
import { 
  NetworkError,
  HttpError, 
  NotFoundError,
  ContentParsingError,
  InvalidUrlError,
  DomainNotFoundError,
  determineErrorType
} from "./error";

export function isInEnum<T extends Record<string, string>>(
  enumObj: T,
  value: string
): value is T[keyof T] {
  return Object.values(enumObj).includes(value);
}

export async function getWebsiteContent(url: string) {
  try {
    try {
      new URL(url);
    } catch (e) {
      throw new InvalidUrlError(url);
    }

    let response;
    try {
      response = await fetch(url);
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
        throw new DomainNotFoundError(url);
      }
      throw new NetworkError(`Failed to connect to ${url}: ${fetchError instanceof Error ? fetchError.message : 'Unknown connection error'}`);
    }
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundError(url);
      }
      throw new HttpError(response.status, response.statusText);
    }
    
    try {
      return await response.text();
    } catch (textError) {
      throw new ContentParsingError(`Failed to extract text content: ${textError instanceof Error ? textError.message : 'Unknown parsing error'}`);
    }
  } catch (error) {
    if (error instanceof NetworkError || 
        error instanceof HttpError || 
        error instanceof NotFoundError || 
        error instanceof ContentParsingError || 
        error instanceof InvalidUrlError ||
        error instanceof DomainNotFoundError) {
      throw error;
    }
    
    throw determineErrorType(error, url);
  }
}

export function extractTitle(content: string) {
  const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
  return titleMatch ? decode(titleMatch[1].trim()) : "No title found";
}

export function extractMetadata(content: string) {
  const title = extractTitle(content);
  const metaTagRegex = /<meta[^>]*>/gi;
  const metaTags = [...content.matchAll(metaTagRegex)];

  const metadata: PageMetadata = {
    title,
    meta: {},
    openGraph: {},
    twitter: {},
  };

  metaTags.forEach((match) => {
    const metaTag = match[0];

    const nameMatch = metaTag.match(/name=["']([^"']*)["']/i);
    const propertyMatch = metaTag.match(/property=["']([^"']*)["']/i);
    const contentMatch = metaTag.match(/content=["']([^"']*)["']/i);

    if (!contentMatch) return;

    const name = nameMatch ? nameMatch[1] : undefined;
    const property = propertyMatch ? propertyMatch[1] : undefined;
    const content = decode(contentMatch[1]);

    if (name && isInEnum(MetaTagType, name)) {
      metadata.meta[name as MetaTagType] = content;
    }

    if (
      metaTag.includes('rel="canonical"') ||
      metaTag.includes("rel='canonical'")
    ) {
      const hrefMatch = metaTag.match(/href=["']([^"']*)["']/i);
      if (hrefMatch) {
        metadata.meta[MetaTagType.Canonical] = hrefMatch[1];
      }
    }

    if (property) {
      if (isInEnum(OpenGraphType, property)) {
        metadata.openGraph[property as OpenGraphType] = content;
      } else if (
        property.startsWith("og:") ||
        property.startsWith("article:") ||
        property.startsWith("profile:") ||
        property.startsWith("book:")
      ) {
        const matchingKey = Object.values(OpenGraphType).find(
          (val) => val === property
        );
        if (matchingKey) {
          metadata.openGraph[matchingKey as OpenGraphType] = content;
        } else {
          (metadata.openGraph as Record<string, string>)[property] = content;
        }
      }
    }

    if (
      (property && property.startsWith("twitter:")) ||
      (name && name.startsWith("twitter:"))
    ) {
      const twitterProperty = property || (name as string);
      if (isInEnum(TwitterType, twitterProperty)) {
        metadata.twitter[twitterProperty as TwitterType] = content;
      } else {
        (metadata.twitter as Record<string, string>)[twitterProperty] = content;
      }
    }
  });

  return metadata;
}

export function parseUrlForFilename(url: string): string {
  let normalizedUrl = url.trim();
  
  if (!normalizedUrl.match(/^https?:\/\//i)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }
  
  try {
    const urlObj = new URL(normalizedUrl);
    let filename = urlObj.hostname + urlObj.pathname.replace(/\/$/, "");
    
    return filename.replace(/[^a-zA-Z0-9]/g, "_");
  } catch (error) {
    return normalizedUrl.replace(/^https?:\/\//i, "").replace(/[^a-zA-Z0-9]/g, "_");
  }
}

export function parseFileName(filename: string): string {
  if (!filename.endsWith(".json")) {
    filename += ".json";
  }
  return filename;
}

export async function getMetaTags(url: string) {
  if (!url.match(/^https?:\/\//i)) {
    const isLocalhost = url.startsWith('localhost') || url.includes('localhost:');
    url = `${isLocalhost ? 'http' : 'https'}://${url}`;
  }
  const content = await getWebsiteContent(url);
  return extractMetadata(content);
}
