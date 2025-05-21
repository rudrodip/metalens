import { describe, it, expect } from 'vitest';
import { normalizeUrlScheme, parseUrlForFilename, parseFileName } from '../src/utils'; // Adjust path if src is not at ../
import { InvalidUrlError } from '../src/error'; // Adjust path

describe('normalizeUrlScheme', () => {
  it('should return valid https URLs as is', () => {
    expect(normalizeUrlScheme('https://example.com')).toBe('https://example.com');
  });

  it('should return valid http URLs as is', () => {
    expect(normalizeUrlScheme('http://example.com')).toBe('http://example.com');
    expect(normalizeUrlScheme('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('should prepend https:// to URLs without schemes', () => {
    expect(normalizeUrlScheme('example.com')).toBe('https://example.com');
    expect(normalizeUrlScheme('www.example.com/path?query=value')).toBe('https://www.example.com/path?query=value');
  });

  it('should prepend http:// to localhost URLs without schemes', () => {
    expect(normalizeUrlScheme('localhost')).toBe('http://localhost');
    expect(normalizeUrlScheme('localhost:8080')).toBe('http://localhost:8080');
    expect(normalizeUrlScheme('localhost:3000/path')).toBe('http://localhost:3000/path');
  });

  it('should correct common scheme typos', () => {
    expect(normalizeUrlScheme('htp://example.com')).toBe('http://example.com');
    expect(normalizeUrlScheme('htps://example.com')).toBe('https://example.com');
    expect(normalizeUrlScheme('http//example.com')).toBe('http://example.com'); // common typo
    expect(normalizeUrlScheme('https//example.com')).toBe('https://example.com'); // common typo
    expect(normalizeUrlScheme('http:/example.com')).toBe('http://example.com'); // missing a slash
    expect(normalizeUrlScheme('https:/example.com')).toBe('https://example.com'); // missing a slash
    expect(normalizeUrlScheme('HtpS://example.com')).toBe('https://example.com'); // mixed case typo
  });

  it('should throw InvalidUrlError for invalid schemes', () => {
    expect(() => normalizeUrlScheme('ftp://example.com')).toThrow(InvalidUrlError);
    expect(() => normalizeUrlScheme('ftp://example.com')).toThrow('Invalid URL scheme: Only HTTP/HTTPS URLs are supported. Received: ftp://example.com');
    expect(() => normalizeUrlScheme('file:///path/to/file')).toThrow(InvalidUrlError);
    expect(() => normalizeUrlScheme('mailto:user@example.com')).toThrow(InvalidUrlError);
    expect(() => normalizeUrlScheme('javascript:alert("hi")')).toThrow(InvalidUrlError);
  });

  it('should handle URLs with mixed case schemes correctly', () => {
    expect(normalizeUrlScheme('Http://example.com')).toBe('http://example.com');
    expect(normalizeUrlScheme('Https://example.com')).toBe('https://example.com');
  });

  it('should handle already correct URLs with ports', () => {
    expect(normalizeUrlScheme('https://example.com:8443/path')).toBe('https://example.com:8443/path');
    expect(normalizeUrlScheme('http://example.com:8080')).toBe('http://example.com:8080');
  });
  
  // Based on current normalizeUrlScheme, empty or very malformed strings might not be primary targets
  // as URL constructor down the line would fail. normalizeUrlScheme tries to fix, not validate fully.
  // However, an empty string would become 'https://://' which URL constructor would reject.
  // Let's test how it behaves with an empty string.
  it('should handle empty string by prepending https (though URL downstream will fail)', () => {
    // normalizeUrlScheme itself doesn't throw for this, it just prepends.
    // The error would come from `new URL('')` later if this output was used directly without further validation.
    expect(normalizeUrlScheme('')).toBe('https://'); 
  });

  it('should correctly handle domain names that include "localhost" but are not localhost', () => {
    expect(normalizeUrlScheme('notlocalhost.com')).toBe('https://notlocalhost.com');
    expect(normalizeUrlScheme('localhost.example.com')).toBe('https://localhost.example.com');
  });
});

describe('parseUrlForFilename', () => {
  it('should generate correct filenames for various URLs', () => {
    expect(parseUrlForFilename('https://example.com/path/to/resource').filename).toBe('example.com_path_to_resource.json');
    expect(parseUrlForFilename('http://localhost:3000/test?query=1').filename).toBe('localhost_test_query_1.json');
    expect(parseUrlForFilename('example.com').filename).toBe('example.com__root.json'); // no path, becomes _root
    expect(parseUrlForFilename('https://example.com/').filename).toBe('example.com__root.json'); // trailing slash removed, path is empty
  });

  it('should handle URLs with special characters in path for filename', () => {
    expect(parseUrlForFilename('https://example.com/a!b@c#d$e%f^g&h*i(j)k_l+m=n`o~p;q:r,s.t').filename)
      .toBe('example.com_a_b_c_d_e_f_g_h_i_j_k_l_m_n_o_p_q_r_s_t.json');
  });

  it('should handle URLs with query parameters for filename', () => {
    expect(parseUrlForFilename('https://example.com/search?category=books&author=tolkien').filename)
      .toBe('example.com_search_category_books_author_tolkien.json');
  });
  
  it('should handle URLs with only hash for filename', () => {
    expect(parseUrlForFilename('https://example.com#section1').filename)
      .toBe('example.com_section1.json');
  });

  it('should throw InvalidUrlError for completely invalid URL inputs after normalization', () => {
    // normalizeUrlScheme will turn 'ftp://' into an error before parseUrlForFilename is even called with it by getMetaTags
    // However, if parseUrlForFilename was called directly with a URL that normalizeUrlScheme passes but URL constructor rejects:
    // e.g. normalizeUrlScheme('http://[') might pass, but new URL('http://[') would fail.
    // This test depends on what normalizeUrlScheme actually outputs for such edge cases.
    // For a truly malformed URL that normalizeUrlScheme can't fix and `new URL` rejects:
    expect(() => parseUrlForFilename('http://invalid_domain_name_with_underscore.com:-1/path')).toThrow(InvalidUrlError); // Invalid port
  });
});

describe('parseFileName', () => {
  it('should sanitize filenames and ensure .json extension', () => {
    expect(parseFileName('test file*name?.json')).toBe('test_file_name_.json');
    expect(parseFileName('another/file\\name')).toBe('another_file_name.json');
    expect(parseFileName('noextension')).toBe('noextension.json');
    expect(parseFileName('image.png')).toBe('image.png.json'); // Appends .json if not present
    expect(parseFileName('image.json')).toBe('image.json'); // Keeps .json if present
    expect(parseFileName('image.')).toBe('image.json');
    expect(parseFileName('test___name')).toBe('test_name.json'); // multiple underscores
  });
});
