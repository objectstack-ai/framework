// @vitest-environment happy-dom
// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObjectDataForm } from '../src/components/ObjectDataForm';
import { ObjectStackProvider } from '@objectstack/client-react';
import { ObjectStackClient } from '@objectstack/client';

const mockClient = {
  meta: {
    getItem: vi.fn(),
  },
  data: {
    create: vi.fn(),
    update: vi.fn(),
  },
} as unknown as ObjectStackClient;

const mockObjectDef = {
  name: 'test_object',
  label: 'Test Object',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: false },
    { name: 'is_active', label: 'Active', type: 'boolean', required: false },
  ],
};

function renderWithProvider(component: React.ReactElement) {
  return render(
    <ObjectStackProvider client={mockClient}>
      {component}
    </ObjectStackProvider>
  );
}

describe('ObjectDataForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.meta.getItem = vi.fn().mockResolvedValue({ item: mockObjectDef });
    mockClient.data.create = vi.fn().mockResolvedValue({ id: 'new-id' });
    mockClient.data.update = vi.fn().mockResolvedValue({ success: true });
  });

  it('should render form fields based on object definition', async () => {
    const onSuccess = vi.fn();
    const onCancel = vi.fn();

    renderWithProvider(
      <ObjectDataForm
        objectApiName="test_object"
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Active')).toBeInTheDocument();
    });
  });

  it('should populate form with existing record data', async () => {
    const record = {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      is_active: true,
    };

    renderWithProvider(
      <ObjectDataForm
        objectApiName="test_object"
        record={record}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
      expect(nameInput.value).toBe('John Doe');

      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      expect(emailInput.value).toBe('john@example.com');
    });
  });

  it('should call onCreate when submitting new record', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    renderWithProvider(
      <ObjectDataForm
        objectApiName="test_object"
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
    });

    // Fill in form
    await user.type(screen.getByLabelText('Name'), 'New User');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');

    // Submit
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockClient.data.create).toHaveBeenCalledWith(
        'test_object',
        expect.objectContaining({
          name: 'New User',
          email: 'new@example.com',
        })
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should call onUpdate when submitting existing record', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const record = { id: '1', name: 'John Doe', email: 'john@example.com' };

    renderWithProvider(
      <ObjectDataForm
        objectApiName="test_object"
        record={record}
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
    });

    // Update name
    const nameInput = screen.getByLabelText('Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');

    // Submit
    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockClient.data.update).toHaveBeenCalledWith(
        'test_object',
        '1',
        expect.objectContaining({
          name: 'Updated Name',
        })
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderWithProvider(
      <ObjectDataForm
        objectApiName="test_object"
        onSuccess={vi.fn()}
        onCancel={onCancel}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });
});
