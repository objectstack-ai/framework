// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * App Component
 *
 * Main application wrapper that provides the TanStack Router instance.
 */

import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';

export default function App() {
  return <RouterProvider router={router} />;
}
