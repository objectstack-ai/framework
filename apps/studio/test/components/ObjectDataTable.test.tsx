// @vitest-environment happy-dom
// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ObjectDataTable } from '../src/components/ObjectDataTable';
import { ObjectStackProvider } from '@objectstack/client-react';
import { ObjectStackClient } from '@objectstack/client';

// Mock ObjectStack client
const mockClient = {
  meta: {
    getItems: vi.fn(),
  },
  data: {
    query: vi.fn(),
    delete: vi.fn(),
  },
} as unknown as ObjectStackClient;

const mockObjectMetadata = {
  name: 'test_object',
  label: 'Test Object',
  fields: [
    { name: 'id', label: 'ID', type: 'text', isPrimaryKey: true },
    { name: 'name', label: 'Name', type: 'text' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'is_active', label: 'Active', type: 'boolean' },
  ],
};

const mockRecords = [
  { id: '1', name: 'John Doe', email: 'john@example.com', is_active: true },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', is_active: false },
];

function renderWithProvider(component: React.ReactElement) {
  return render(
    <ObjectStackProvider client={mockClient}>
      {component}
    </ObjectStackProvider>
  );
}

describe('ObjectDataTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mocks
    mockClient.meta.getItems = vi.fn().mockResolvedValue([mockObjectMetadata]);
    mockClient.data.query = vi.fn().mockResolvedValue({
      items: mockRecords,
      total: 2,
      hasMore: false,
    });
  });

  it('should render loading state initially', () => {
    renderWithProvider(
      <ObjectDataTable objectApiName="test_object" onEdit={vi.fn()} />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render table with data after loading', async () => {
    renderWithProvider(
      <ObjectDataTable objectApiName="test_object" onEdit={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Check column headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should display boolean values correctly', async () => {
    renderWithProvider(
      <ObjectDataTable objectApiName="test_object" onEdit={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Yes/)).toBeInTheDocument();
      expect(screen.getByText(/No/)).toBeInTheDocument();
    });
  });

  it('should call onEdit when edit button is clicked', async () => {
    const onEdit = vi.fn();
    renderWithProvider(
      <ObjectDataTable objectApiName="test_object" onEdit={onEdit} />
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find and click edit button (first row)
    const editButtons = screen.getAllByLabelText(/Edit/i);
    editButtons[0].click();

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({
      id: '1',
      name: 'John Doe',
    }));
  });

  it('should handle empty data gracefully', async () => {
    mockClient.data.query = vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      hasMore: false,
    });

    renderWithProvider(
      <ObjectDataTable objectApiName="test_object" onEdit={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText(/No records found/i)).toBeInTheDocument();
    });
  });

  it('should display total record count', async () => {
    renderWithProvider(
      <ObjectDataTable objectApiName="test_object" onEdit={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText(/2 records/i)).toBeInTheDocument();
    });
  });
});
