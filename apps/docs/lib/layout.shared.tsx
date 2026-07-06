import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';

export const gitConfig = {
  user: 'objectstack-ai',
  repo: 'framework',
  branch: 'main',
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <div className="flex items-center gap-2 font-bold">
          <Image
            src="https://objectstack.ai/logo.svg"
            alt="ObjectStack"
            width={30}
            height={30}
          />
          ObjectStack
        </div>
      ),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
