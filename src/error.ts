export class MetalensError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetalensError';
    Object.setPrototypeOf(this, MetalensError.prototype);
  }
}

export class NetworkError extends MetalensError {
  constructor(message: string = 'Network error occurred while fetching the URL') {
    super(message);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class DomainNotFoundError extends MetalensError {
  constructor(url: string) {
    super(`Domain not found: "${url}"`);
    this.name = 'DomainNotFoundError';
    Object.setPrototypeOf(this, DomainNotFoundError.prototype);
  }
}

export class HttpError extends MetalensError {
  statusCode: number;

  constructor(statusCode: number, statusText: string) {
    super(`HTTP error: ${statusCode} ${statusText}`);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export class NotFoundError extends HttpError {
  constructor(url: string) {
    super(404, 'Not Found');
    this.name = 'NotFoundError';
    this.message = `The URL "${url}" could not be found (404)`;
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class InvalidUrlError extends MetalensError {
  constructor(url: string) {
    super(`Invalid URL format: "${url}"`);
    this.name = 'InvalidUrlError';
    Object.setPrototypeOf(this, InvalidUrlError.prototype);
  }
}

export class ContentParsingError extends MetalensError {
  constructor(message: string = 'Failed to parse website content') {
    super(message);
    this.name = 'ContentParsingError';
    Object.setPrototypeOf(this, ContentParsingError.prototype);
  }
}

export class MetadataExtractionError extends MetalensError {
  constructor(message: string = 'Failed to extract metadata from content') {
    super(message);
    this.name = 'MetadataExtractionError';
    Object.setPrototypeOf(this, MetadataExtractionError.prototype);
  }
}

export function determineErrorType(error: unknown, url: string = ''): MetalensError {
  if (error instanceof MetalensError) {
    return error;
  }
  
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
    return new DomainNotFoundError(url);
  }
  
  if (
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ECONNRESET') ||
    errorMessage.includes('ECONNABORTED') ||
    errorMessage.includes('network error') ||
    errorMessage.includes('Failed to fetch')
  ) {
    return new NetworkError(`Network error: Unable to connect to ${url || 'the server'}`);
  }
  
  if (
    errorMessage.includes('Invalid URL') || 
    errorMessage.includes('invalid URL') ||
    errorMessage.includes('URL constructor')
  ) {
    return new InvalidUrlError(url);
  }
  
  if (
    errorMessage.includes('Failed to extract text content') ||
    errorMessage.includes('parse') ||
    errorMessage.includes('SyntaxError')
  ) {
    return new ContentParsingError(errorMessage);
  }
  
  return new MetalensError(errorMessage);
} 