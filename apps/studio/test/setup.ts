// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Test setup file
 * Configures testing environment and global test utilities
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
