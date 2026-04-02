// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Command, Flags } from '@oclif/core';
import { printHeader, printSuccess, printError } from '../../utils/format.js';
import { deleteAuthConfig } from '../../utils/auth-config.js';

export default class AuthLogout extends Command {
  static override description = 'Clear stored authentication credentials';

  static override examples = [
    '$ os auth logout',
  ];

  static override flags = {
    json: Flags.boolean({
      description: 'Output as JSON',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthLogout);

    try {
      if (!flags.json) {
        printHeader('ObjectStack Logout');
      }

      await deleteAuthConfig();

      if (flags.json) {
        console.log(JSON.stringify({
          success: true,
          message: 'Credentials cleared',
        }, null, 2));
      } else {
        printSuccess('Credentials cleared');
        console.log('');
      }
    } catch (error: any) {
      if (flags.json) {
        console.log(JSON.stringify({
          success: false,
          error: error.message,
        }, null, 2));
        this.exit(1);
      }
      printError(error.message || String(error));
      this.exit(1);
    }
  }
}
