import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startServer } from '../src/server'; // Adjust path if necessary
import { Hono } from 'hono';

// Mock dependencies
vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}));
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  default: { readFileSync: vi.fn() }, // Handle potential default export CJS/ESM interop
}));
vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'), // Basic mock for path.join
  default: { join: (...args: string[]) => args.join('/') },
}));

// Mock htmlAssetPath (simulating bundler behavior)
// This path is relative to __dirname which will be test/ if server.js is in dist/
// For testing, we can assume htmlAssetPath will be a simple relative path like './index.html'
// as if it were copied to the same directory as the test or a known relative location.
// The actual value is less important than fs.readFileSync being called with a derivative of it.
vi.mock('../src/index.html', () => ({
  default: './index.html', // Mocked path for the import
}));


describe('startServer', () => {
  const mockServe = await import('@hono/node-server').then(mod => mod.serve);
  const mockFs = await import('fs').then(mod => mod.readFileSync);
  
  let originalProcessVersions: any;
  let originalProcessEnv: any;
  let originalProcessCwd: any;

  beforeEach(() => {
    vi.resetAllMocks();
    originalProcessVersions = { ...process.versions };
    originalProcessEnv = { ...process.env };
    originalProcessCwd = process.cwd;

    // Mock process.cwd to return a consistent path for tests
    process.cwd = vi.fn(() => '/test-project');

    // Default mock for fs.readFileSync to avoid ENOENT if not specifically tested for failure
    (mockFs as vi.Mock).mockReturnValue('<html>Mock HTML</html>');
    
    // Default mock for serve: calls the success callback immediately
    (mockServe as vi.Mock).mockImplementation((options, callback) => {
      if (callback) {
        // Simulate async server start
        setTimeout(() => callback({ port: options.port, address: 'localhost' }), 0);
      }
      const mockServerInstance = {
        on: vi.fn(),
        close: vi.fn(),
      };
      return mockServerInstance;
    });
  });

  afterEach(() => {
    process.versions = originalProcessVersions;
    process.env = originalProcessEnv;
    process.cwd = originalProcessCwd;
  });

  it('should resolve if server starts successfully in production mode', async () => {
    process.env.METALENS_DEV = 'false';
    await expect(startServer(3000)).resolves.toBeUndefined();
    expect(mockServe).toHaveBeenCalled();
    expect(mockFs).toHaveBeenCalledWith('/test-project/dist/index.html', 'utf-8'); // Assuming __dirname is dist
  });

  it('should resolve if server starts successfully in development mode', async () => {
    process.env.METALENS_DEV = 'true';
    (mockFs as vi.Mock).mockReturnValue('<html>Dev HTML</html>');
    await expect(startServer(3000)).resolves.toBeUndefined();
    expect(mockFs).toHaveBeenCalledWith('/test-project/src/index.html', 'utf-8');
  });

  it('should reject if not in a Node.js environment', async () => {
    // @ts-ignore
    delete process.versions.node; // Simulate non-Node.js environment
    await expect(startServer(3000)).rejects.toThrow('Preview server can only be used in a Node.js environment.');
  });

  it('should reject if HTML file reading fails in production mode', async () => {
    process.env.METALENS_DEV = 'false';
    const readError = new Error('Failed to read file');
    (readError as any).code = 'ENOENT'; // Simulate file not found
    (mockFs as vi.Mock).mockImplementation(() => { throw readError; });
    
    await expect(startServer(3000)).rejects.toThrow('Failed to load essential UI file (index.html): Failed to read file');
  });
  
  it('should reject if HTML file reading fails in development mode', async () => {
    process.env.METALENS_DEV = 'true';
    const readError = new Error('Dev HTML read error');
    (mockFs as vi.Mock).mockImplementation(() => { throw readError; });

    await expect(startServer(3000)).rejects.toThrow('Failed to load UI content: Dev HTML read error');
  });

  it('should reject if serve function throws an error', async () => {
    process.env.METALENS_DEV = 'false';
    const serveError = new Error('Serve function failed');
    (mockServe as vi.Mock).mockImplementation(() => {
      throw serveError;
    });
    await expect(startServer(3000)).rejects.toThrow(serveError);
  });

  it('should reject if server instance emits an error event during startup', async () => {
    process.env.METALENS_DEV = 'false';
    const startupError = new Error('EADDRINUSE');
    (mockServe as vi.Mock).mockImplementation((options, callback) => {
      const mockServerInstance = {
        on: vi.fn((event, cb) => {
          if (event === 'error') {
            // Simulate async error emission
            setTimeout(() => cb(startupError), 0);
          }
        }),
        close: vi.fn(),
      };
      // Do NOT call the success callback (info) in this scenario
      return mockServerInstance;
    });

    await expect(startServer(3000)).rejects.toThrow(startupError);
  });

  it('should handle server instance without an "on" method gracefully (though unlikely for Hono)', async () => {
    process.env.METALENS_DEV = 'false';
    // Mock serve to return an object without an 'on' method, but still call the success callback
    (mockServe as vi.Mock).mockImplementation((options, callback) => {
       if (callback) {
        setTimeout(() => callback({ port: options.port, address: 'localhost' }), 0);
      }
      return {}; // No 'on' method
    });
    await expect(startServer(3000)).resolves.toBeUndefined();
  });

  // Test path construction for production HTML loading
  // This depends on __dirname. In Vitest/Node, __dirname is the directory of the current file.
  // If server.ts is compiled to dist/server.js, then __dirname in that context is /path/to/project/dist.
  // The import htmlAssetPath from '../src/index.html' is tricky.
  // After bundling, htmlAssetPath should be a path string relative to the bundled server.js.
  // If bun build copies src/index.html to dist/index.html, then htmlAssetPath might be './index.html'.
  // So, path.join(__dirname, './index.html') would be dist/index.html.
  it('should attempt to load HTML from correct path in production', async () => {
    process.env.METALENS_DEV = 'false';
    // The path.join mock is basic. __dirname in tests is test/
    // The key is that it tries to use htmlAssetPath.
    // The mocked htmlAssetPath is './index.html'
    // path.join(__dirname, htmlAssetPath) becomes 'test/./index.html' if __dirname is 'test'
    // Or, if server.ts is in src/, and test is in test/, and output is dist/,
    // __dirname for server.js (in dist/) would be /abs/path/to/dist
    // And htmlAssetPath (if copied to dist/) would be './index.html'
    // So, path.join(__dirname, './index.html') = /abs/path/to/dist/index.html
    // Our fs mock needs to expect this.
    
    // Let's refine the fs mock for this specific test to check the path
    // Assuming the compiled server.js is in 'dist' and index.html is copied to 'dist'
    // and htmlAssetPath becomes './index.html' relative to dist/server.js
    const expectedProdHtmlPath = '/test-project/dist/index.html'; // Based on mocked process.cwd and assumed dist structure
     (mockFs as vi.Mock).mockImplementation((pathArg) => {
      if (pathArg === expectedProdHtmlPath) {
        return '<html>Prod HTML via specific path</html>';
      }
      throw new Error(`ENOENT: File not found at ${pathArg}`);
    });

    await expect(startServer(3000)).resolves.toBeUndefined();
    expect(mockFs).toHaveBeenCalledWith(expectedProdHtmlPath, 'utf-8');
  });
});

// Minimal mock for Hono app used in server.ts, just to avoid errors if it's constructed.
vi.mock('hono', () => {
  class MockHono {
    constructor() {}
    get = vi.fn(() => this);
    post = vi.fn(() => this);
    // Add other methods if server.ts uses them on the app instance before serve()
  }
  return { Hono: MockHono };
});
