// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /account — Account settings layout.
 *
 * Pure layout route. The four sub-sections (Profile / Security / Sessions /
 * Two-Factor) are exposed as top-level entries on the global Account
 * sidebar; this layout simply renders the page header plus an `<Outlet/>`
 * for the active sub-route.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useObjectTranslation } from '@object-ui/i18n';
import { User } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { useSession } from '@/hooks/useSession';

export const Route = createFileRoute('/account')({
  component: AccountLayout,
});

function AccountLayout() {
  const { t } = useObjectTranslation();
  const { user } = useSession();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="page-enter mx-auto flex max-w-4xl flex-col gap-6">
          <PageHeader
            icon={User}
            title={t('topBar.breadcrumb.account')}
            description={user?.email ?? undefined}
          />
          <Outlet />
        </div>
      </div>
    </div>
  );
}
