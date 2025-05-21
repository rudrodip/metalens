// test/index.spec.ts
import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker, { Buffer } from '../src/index'; // Assuming Buffer might be needed if responses are binary or for specific types
import { InvalidUrlError, DomainNotFoundError, NotFoundError, NetworkError, HttpError } from '../../src/error'; // Adjust path

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

// Helper to create a request to the /api/metadata endpoint
function createMetadataRequest(urlToFetch: string, method: 'GET' | 'POST' = 'GET') {
  if (method === 'GET') {
    const url = new URL('http://example.com/api/metadata');
    url.searchParams.set('url', urlToFetch);
    return new IncomingRequest(url.toString());
  } else { // POST
    return new IncomingRequest('http://example.com/api/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlToFetch }),
    });
  }
}

describe('Metalens Worker API', () => {
  // Test the root endpoint - this might need adjustment based on actual root response
  it('responds with HTML for the root path (integration style)', async () => {
    const response = await SELF.fetch('http://example.com/');
    expect(response.headers.get('content-type')).toContain('text/html');
    const text = await response.text();
    expect(text).toContain('<title>Metalens</title>'); // Check for a title or known HTML content
  });

  describe('/api/metadata endpoint', () => {
    // Mock actual fetch calls made by getWebsiteContent
    // This is tricky in Cloudflare worker test environment.
    // For true integration tests of error handling, we'd ideally let fetch run against controlled mock servers.
    // If direct fetch mocking isn't straightforward here, these tests will be more like integration tests
    // of the worker logic assuming fetch behaves as expected (e.g., actual internet requests).
    // For now, let's assume we can test with real (but potentially unreliable) external fetches or that some internal mocking handles this.

    it('should return 400 for invalid URL scheme (e.g., ftp://)', async () => {
      const request = createMetadataRequest('ftp://example.com');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, { ...env }, ctx); // Pass a new env object
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(400);
      const jsonResponse = await response.json();
      expect(jsonResponse.errorType).toBe('InvalidUrlError');
      expect(jsonResponse.error).toContain('Invalid URL scheme');
    });

    it('should return 400 for invalid URL scheme (e.g., mailto:)', async () => {
      const request = createMetadataRequest('mailto:test@example.com', 'POST');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, { ...env }, ctx);
      await waitOnExecutionContext(ctx);
      
      expect(response.status).toBe(400);
      const jsonResponse = await response.json();
      expect(jsonResponse.errorType).toBe('InvalidUrlError');
    });
    
    // This test would require a domain that genuinely doesn't exist or a way to mock DNS resolution
    // it('should return 404 for a domain that does not exist', async () => {
    //   const request = createMetadataRequest('http://domain-that-does-not-exist-blahblah.com');
    //   const ctx = createExecutionContext();
    //   const response = await worker.fetch(request, { ...env }, ctx);
    //   await waitOnExecutionContext(ctx);
      
    //   expect(response.status).toBe(404); // Assuming DomainNotFoundError maps to 404 via getErrorStatusCode
    //   const jsonResponse = await response.json();
    //   expect(jsonResponse.errorType).toBe('DomainNotFoundError');
    // });

    // This test requires a URL that returns a 404
    // it('should return 404 for a URL that results in a 404 error', async () => {
    //   const request = createMetadataRequest('https://example.com/nonexistentpage12345');
    //   const ctx = createExecutionContext();
    //   const response = await worker.fetch(request, { ...env }, ctx);
    //   await waitOnExecutionContext(ctx);
      
    //   expect(response.status).toBe(404);
    //   const jsonResponse = await response.json();
    //   expect(jsonResponse.errorType).toBe('NotFoundError');
    // });
    
    it('should return 400 if URL parameter is missing (GET)', async () => {
      const request = new IncomingRequest('http://example.com/api/metadata'); // No URL query param
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, { ...env }, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(400);
      const jsonResponse = await response.json();
      expect(jsonResponse.error).toBe('URL is required');
    });

    it('should return 400 if URL parameter is missing (POST)', async () => {
      const request = new IncomingRequest('http://example.com/api/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noturl: 'test' }), // Incorrect body
      });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, { ...env }, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(400);
      const jsonResponse = await response.json();
      expect(jsonResponse.error).toBe('URL is required');
    });

    // A test for a successful response would be good, but requires a reliable external URL
    // or a more complex mocking setup for `fetch` within the Cloudflare test environment.
    // For example:
    // it('should return metadata for a valid URL (e.g., example.com)', async () => {
    //   const request = createMetadataRequest('https://example.com');
    //   const ctx = createExecutionContext();
    //   const response = await worker.fetch(request, { ...env }, ctx);
    //   await waitOnExecutionContext(ctx);
      
    //   expect(response.status).toBe(200);
    //   const jsonResponse = await response.json();
    //   expect(jsonResponse.title).toBe('Example Domain');
    //   // Add more assertions for description, image, etc.
    // });
  });
});
