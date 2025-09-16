/**
 * Cross-platform base64 encoding that works in both browser and Node.js
 * @param str - String to encode
 * @returns Base64 encoded string
 */
const base64Encode = (str: string): string => {
  // Check if we're in a browser environment
  if (typeof window !== "undefined" && typeof btoa !== "undefined") {
    return btoa(str);
  }
  // Node.js environment - use Buffer
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf8").toString("base64");
  }
  // Fallback for other environments
  throw new Error("No base64 encoding method available");
};

/**
 * Creates a Basic Authentication header from username and password
 * @param username - The username for basic auth
 * @param password - The password for basic auth
 * @returns The Authorization header value (e.g., "Basic dXNlcm5hbWU6cGFzc3dvcmQ=")
 */
export const basicAuthHeader = (username: string, password: string): string => {
  const credentials = base64Encode(`${username}:${password}`);
  return `Basic ${credentials}`;
};

/**
 * Creates headers object with optional basic auth and additional headers
 * @param baseHeaders - Base headers object
 * @param auth - Authentication configuration
 * @param additionalHeaders - Additional headers to merge
 * @returns Headers object with auth and additional headers
 */
export const createAuthHeaders = (
  baseHeaders: Record<string, string> = {},
  auth?: { username?: string; password?: string; token?: string },
  additionalHeaders?: Record<string, string>,
): Record<string, string> => {
  const headers = { ...baseHeaders };

  // Add basic auth if username and password are provided
  if (auth?.username && auth?.password) {
    headers.Authorization = basicAuthHeader(auth.username, auth.password);
  }
  // Add token auth if token is provided and no basic auth
  else if (auth?.token) {
    headers.Authorization = auth.token;
  }

  // Merge additional headers
  if (additionalHeaders) {
    Object.assign(headers, additionalHeaders);
  }

  return headers;
};
