// Vercel Serverless Function to proxy API calls to backend
// Catch-all route that handles all /api/* paths

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Backend URL - set this in Vercel environment variables as BACKEND_URL
const BACKEND_URL = process.env.BACKEND_URL || 'https://backend-72zfcspmp-trickals-projects.vercel.app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Password');
      return res.status(200).end();
    }

    // Get the path from the catch-all parameter
    const pathArray = req.query.path as string[] | string;
    const path = Array.isArray(pathArray) ? pathArray.join('/') : (pathArray || '');
    const fullPath = path ? `/${path}` : '';
    
    // Add query string if present
    const queryString = req.url?.includes('?') ? '?' + req.url.split('?')[1] : '';
    const backendUrl = `${BACKEND_URL}${fullPath}${queryString}`;

    console.log(`[API Proxy] ${req.method} ${fullPath || '/'} -> ${backendUrl}`);
    console.log(`[API Proxy] Query:`, req.query);
    console.log(`[API Proxy] Body:`, req.body);

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Forward authorization header if present
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization as string;
    }
    
    // Forward admin password header if present
    if (req.headers['x-admin-password']) {
      headers['X-Admin-Password'] = req.headers['x-admin-password'] as string;
    }

    // Prepare body for requests that need it
    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
      if (req.body) {
        body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }
    }

    // Forward the request to the backend
    const fetchOptions: RequestInit = {
      method: req.method || 'GET',
      headers,
    };

    if (body) {
      fetchOptions.body = body;
    }

    const response = await fetch(backendUrl, fetchOptions);

    // Get response data
    const contentType = response.headers.get('content-type');
    let data: any;
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    // Forward status and data
    res.status(response.status);
    
    // Copy response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    res.json(data);
  } catch (error: any) {
    console.error('[API Proxy] Error:', error);
    console.error('[API Proxy] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to proxy request to backend', 
      message: error.message,
      details: error.toString()
    });
  }
}

