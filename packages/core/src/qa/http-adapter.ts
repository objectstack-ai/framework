// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { QA } from '@objectstack/spec';
import { TestExecutionAdapter } from './adapter.js';

export class HttpTestAdapter implements TestExecutionAdapter {
  constructor(private baseUrl: string, private authToken?: string) {}

  async execute(action: QA.TestAction, _context: Record<string, unknown>): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    // If action.user is specified, maybe add a specific header for impersonation if supported?
    if (action.user) {
        headers['X-Run-As'] = action.user;
    }

    switch (action.type) {
      case 'create_record':
        return this.createRecord(action.target, action.payload || {}, headers);
      case 'update_record':
        return this.updateRecord(action.target, action.payload || {}, headers);
      case 'delete_record':
        return this.deleteRecord(action.target, action.payload || {}, headers);
      case 'read_record':
        return this.readRecord(action.target, action.payload || {}, headers);
        case 'query_records':
        return this.queryRecords(action.target, action.payload || {}, headers);
      case 'api_call':
        return this.rawApiCall(action.target, action.payload || {}, headers);
        case 'wait':
            const ms = Number(action.payload?.duration || 1000);
            return new Promise(resolve => setTimeout(() => resolve({ waited: ms }), ms));
      default:
        throw new Error(`Unsupported action type in HttpAdapter: ${action.type}`);
    }
  }

  private async createRecord(objectName: string, data: Record<string, unknown>, headers: Record<string, string>) {
    const response = await fetch(`${this.baseUrl}/api/data/${objectName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  private async updateRecord(objectName: string, data: Record<string, unknown>, headers: Record<string, string>) {
    const id = data.id;
    if (!id) throw new Error('Update record requires id in payload');
    const response = await fetch(`${this.baseUrl}/api/data/${objectName}/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  private async deleteRecord(objectName: string, data: Record<string, unknown>, headers: Record<string, string>) {
    const id = data.id;
    if (!id) throw new Error('Delete record requires id in payload');
    const response = await fetch(`${this.baseUrl}/api/data/${objectName}/${id}`, {
      method: 'DELETE',
      headers
    });
    return this.handleResponse(response);
  }

  private async readRecord(objectName: string, data: Record<string, unknown>, headers: Record<string, string>) {
    const id = data.id;
    if (!id) throw new Error('Read record requires id in payload');
    const response = await fetch(`${this.baseUrl}/api/data/${objectName}/${id}`, {
      method: 'GET',
      headers
    });
    return this.handleResponse(response);
  }

  private async queryRecords(objectName: string, data: Record<string, unknown>, headers: Record<string, string>) {
      // Assuming query via POST or GraphQL-like endpoint
      const response = await fetch(`${this.baseUrl}/api/data/${objectName}/query`, {
          method: 'POST',
          headers,
          body: JSON.stringify(data)
      });
      return this.handleResponse(response);
  }

  private async rawApiCall(endpoint: string, data: Record<string, unknown>, headers: Record<string, string>) {
      const method = (data.method as string) || 'GET';
      const body = data.body ? JSON.stringify(data.body) : undefined;
      const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
      
      const response = await fetch(url, {
          method,
          headers,
          body
      });
      return this.handleResponse(response);
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${text}`);
    }
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return response.json();
    }
    return response.text();
  }
}
