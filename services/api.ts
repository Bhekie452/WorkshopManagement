
import { AuthService } from './auth';

// Centralized API domain configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * A wrapper around the Fetch API to streamline API calls.
 * It automatically adds the JWT token to the headers and provides
 * a consistent way to handle responses and errors.
 */
export class ApiCall {
  private static async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    body?: any
  ): Promise<T> {
    const token = await AuthService.getIdToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    // Construct the full URL, avoiding double slashes
    const url = `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        // Attempt to parse error response
        const errorData = await response.json().catch(() => ({
          message: `HTTP error! status: ${response.status} ${response.statusText}`,
        }));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }

      // Handle cases where response body might be empty
      if (response.status === 204) {
        return Promise.resolve(null as T);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      console.error(`API call failed: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  static get<T>(endpoint: string): Promise<T> {
    return this.request<T>('GET', endpoint);
  }

  static post<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>('POST', endpoint, body);
  }

  static put<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>('PUT', endpoint, body);
  }

  static patch<T>(endpoint: string, body: any): Promise<T> {
    return this.request<T>('PATCH', endpoint, body);
  }

  static delete<T>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint);
  }
}
