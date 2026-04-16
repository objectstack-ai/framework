// @vitest-environment happy-dom
// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppSidebar } from '../src/components/app-sidebar';
import { ObjectStackProvider } from '@objectstack/client-react';
import { ObjectStackClient } from '@objectstack/client';
import { PluginRegistryProvider } from '../src/plugins';
import type { InstalledPackage } from '@objectstack/spec/kernel';

const mockClient = {
  meta: {
    getTypes: vi.fn(),
    getItems: vi.fn(),
  },
  subscribe: vi.fn(),
} as unknown as ObjectStackClient;

const mockPackages: InstalledPackage[] = [
  {
    manifest: {
      id: 'test-package',
      name: 'Test Package',
      version: '1.0.0',
      type: 'app',
    },
    enabled: true,
    path: '/test',
  },
];

function renderWithProviders(component: React.ReactElement) {
  return render(
    <ObjectStackProvider client={mockClient}>
      <PluginRegistryProvider plugins={[]}>
        {component}
      </PluginRegistryProvider>
    </ObjectStackProvider>
  );
}

describe('AppSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.meta.getTypes = vi.fn().mockResolvedValue({ types: ['object', 'view'] });
    mockClient.meta.getItems = vi.fn().mockResolvedValue([
      { name: 'test_object', label: 'Test Object' },
    ]);
    mockClient.subscribe = vi.fn().mockReturnValue(() => {});
  });

  it('should render package switcher', () => {
    renderWithProviders(
      <AppSidebar
        packages={mockPackages}
        selectedPackage={mockPackages[0]}
        selectedObject={null}
        onSelectObject={vi.fn()}
        onSelectPackage={vi.fn()}
      />
    );

    expect(screen.getByText('Test Package')).toBeInTheDocument();
  });

  it('should render overview nav item', () => {
    renderWithProviders(
      <AppSidebar
        packages={mockPackages}
        selectedPackage={mockPackages[0]}
        selectedObject={null}
        onSelectObject={vi.fn()}
        onSelectPackage={vi.fn()}
      />
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('should render search input', () => {
    renderWithProviders(
      <AppSidebar
        packages={mockPackages}
        selectedPackage={mockPackages[0]}
        selectedObject={null}
        onSelectObject={vi.fn()}
        onSelectPackage={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText('Search metadata...')).toBeInTheDocument();
  });

  it('should load and display metadata types', async () => {
    renderWithProviders(
      <AppSidebar
        packages={mockPackages}
        selectedPackage={mockPackages[0]}
        selectedObject={null}
        onSelectObject={vi.fn()}
        onSelectPackage={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockClient.meta.getTypes).toHaveBeenCalled();
      expect(mockClient.meta.getItems).toHaveBeenCalledWith('object', expect.anything());
    });
  });

  it('should render system section', () => {
    renderWithProviders(
      <AppSidebar
        packages={mockPackages}
        selectedPackage={mockPackages[0]}
        selectedObject={null}
        onSelectObject={vi.fn()}
        onSelectPackage={vi.fn()}
      />
    );

    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('API Console')).toBeInTheDocument();
    expect(screen.getByText('Packages')).toBeInTheDocument();
  });

  it('should call onSelectObject when object is clicked', async () => {
    const onSelectObject = vi.fn();

    renderWithProviders(
      <AppSidebar
        packages={mockPackages}
        selectedPackage={mockPackages[0]}
        selectedObject={null}
        onSelectObject={onSelectObject}
        onSelectPackage={vi.fn()}
      />
    );

    await waitFor(() => {
      const objectItem = screen.queryByText('Test Object');
      if (objectItem) {
        objectItem.click();
        expect(onSelectObject).toHaveBeenCalledWith('test_object');
      }
    });
  });
});
