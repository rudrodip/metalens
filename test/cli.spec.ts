import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleMetadataActions } from '../src/cli'; // Assuming handleMetadataActions is exported or can be tested via a wrapper
import { PageMetadata } from '../src/types'; // Assuming this type is available

// Mock dependencies
vi.mock('../src/server', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual, // Import and retain default exports
    startServer: vi.fn(),
    findAvailablePort: vi.fn().mockResolvedValue(3000), // Mock findAvailablePort to return a fixed port
  };
});

vi.mock('open', () => ({
  default: vi.fn(), // Mock the default export of 'open'
}));

vi.mock('inquirer', () => ({
  default: { // Assuming inquirer is used as default export
    prompt: vi.fn(),
  },
}));

// Mock chalk to return the input string, so we don't have to match chalk's specific ANSI codes
vi.mock('chalk', () => ({
    default: {
        red: (str: string) => str,
        yellow: (str: string) => str,
        // Add other colors if used by the error messages being tested
    }
}));


describe('handleMetadataActions - preview', () => {
  const mockStartServer = await import('../src/server').then(mod => mod.startServer);
  const mockOpen = await import('open').then(mod => mod.default);
  const mockInquirerPrompt = await import('inquirer').then(mod => mod.default.prompt);

  let consoleLogSpy: vi.SpyInstance;
  let consoleErrorSpy: vi.SpyInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const mockMetadata: PageMetadata = { // Using PageMetadata from previous subtask (turn 6)
    title: 'Test Title',
    meta: { description: 'Test Description' },
    openGraph: { 'og:title': 'OG Test Title' },
    twitter: { 'twitter:title': 'Twitter Test Title' },
  };
  const testUrl = 'https://example.com';

  it('should start server and open browser when preview action is selected and server starts successfully', async () => {
    (mockInquirerPrompt as vi.Mock).mockResolvedValueOnce({ action: 'preview' });
    (mockStartServer as vi.Mock).mockResolvedValue(undefined); // Simulate successful server start

    await handleMetadataActions(mockMetadata, testUrl);

    expect(mockStartServer).toHaveBeenCalledWith(3000, testUrl);
    expect(consoleLogSpy).toHaveBeenCalledWith('\n🌐 Starting local preview server...');
    const expectedPreviewUrl = `http://localhost:3000?url=${encodeURIComponent(testUrl)}`;
    expect(consoleLogSpy).toHaveBeenCalledWith(`Opening preview at ${expectedPreviewUrl}`);
    expect(mockOpen).toHaveBeenCalledWith(expectedPreviewUrl);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should log error and not open browser when preview action is selected and server fails to start', async () => {
    (mockInquirerPrompt as vi.Mock).mockResolvedValueOnce({ action: 'preview' });
    const serverError = new Error('Server failed to start');
    (mockStartServer as vi.Mock).mockRejectedValue(serverError); // Simulate server start failure

    await handleMetadataActions(mockMetadata, testUrl);

    expect(mockStartServer).toHaveBeenCalledWith(3000, testUrl);
    expect(consoleLogSpy).toHaveBeenCalledWith('\n🌐 Starting local preview server...');
    expect(consoleErrorSpy).toHaveBeenCalledWith("\n❌ Failed to start local preview server.");
    expect(consoleErrorSpy).toHaveBeenCalledWith(`   Error: ${serverError.message}`);
    expect(consoleErrorSpy).toHaveBeenCalledWith("   Please check if the port is already in use or if there are other errors in the console.");
    expect(mockOpen).not.toHaveBeenCalled();
  });
  
  it('should handle other actions like "log" correctly', async () => {
    (mockInquirerPrompt as vi.Mock).mockResolvedValueOnce({ action: 'log' });
    await handleMetadataActions(mockMetadata, testUrl);
    expect(consoleLogSpy).toHaveBeenCalledWith("\n📋 Metadata Content:");
    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(mockMetadata, null, 2));
    expect(mockStartServer).not.toHaveBeenCalled();
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
