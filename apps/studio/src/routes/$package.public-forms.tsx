// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Back-compat redirect from the old `/$package/public-forms` route to
 * the new `/$package/forms` page.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/$package/public-forms')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/$package/forms', params: { package: params.package } });
  },
  component: () => null,
});
