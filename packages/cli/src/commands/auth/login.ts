// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Command, Flags } from '@oclif/core';
import { printHeader, printSuccess, printError, printKV } from '../../utils/format.js';
import { writeAuthConfig } from '../../utils/auth-config.js';
import { ObjectStackClient } from '@objectstack/client';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * Prompt for a password with masked input (shows * per character).
 * Falls back to plain readline.question() in non-TTY environments.
 */
async function promptPassword(promptText: string): Promise<string> {
  if (!process.stdin.isTTY) {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(promptText);
    rl.close();
    return answer;
  }

  return new Promise((resolve) => {
    const chars: string[] = [];
    process.stdout.write(promptText);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', handler);
      process.stdout.write('\n');
    };

    const handler = (char: string) => {
      switch (char) {
        case '\u0003': // Ctrl+C
          cleanup();
          process.kill(process.pid, 'SIGINT');
          break;
        case '\r':
        case '\n': // Enter
          cleanup();
          resolve(chars.join(''));
          break;
        case '\u007f': // Backspace
          if (chars.length > 0) {
            chars.pop();
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(promptText + '*'.repeat(chars.length));
          }
          break;
        default:
          chars.push(char);
          process.stdout.write('*');
          break;
      }
    };

    process.stdin.on('data', handler);
  });
}

export default class AuthLogin extends Command {
  static override description = 'Authenticate and store session credentials';

  static override examples = [
    '$ os auth login',
    '$ os auth login --url https://api.example.com',
    '$ os auth login --email user@example.com --password mypassword',
  ];

  static override flags = {
    url: Flags.string({
      char: 'u',
      description: 'Server URL',
      default: 'http://localhost:3000',
      env: 'OBJECTSTACK_URL',
    }),
    email: Flags.string({
      char: 'e',
      description: 'Email address',
    }),
    password: Flags.string({
      char: 'p',
      description: 'Password',
    }),
    json: Flags.boolean({
      description: 'Output as JSON',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthLogin);

    try {
      if (!flags.json) {
        printHeader('ObjectStack Login');
        printKV('Server', flags.url);
        console.log('');
      }

      // Prompt for credentials if not provided
      let email = flags.email;
      let password = flags.password;

      if (!email || !password) {
        const rl = readline.createInterface({ input, output });

        if (!email) {
          email = await rl.question('Email: ');
        }

        rl.close();

        if (!password) {
          password = await promptPassword('Password: ');
        }
      }

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Create client and authenticate
      const client = new ObjectStackClient({
        baseUrl: flags.url,
      });

      const response = await client.auth.login({
        type: 'email',
        email,
        password,
      });

      // Check if login was successful
      if (!response.data?.token && !response.data?.user) {
        throw new Error('Login failed: Invalid response from server');
      }

      // Extract token - it might be in different locations depending on the auth system
      const token = response.data?.token || (response as any).token;
      const user = response.data?.user;

      if (!token) {
        throw new Error('Login failed: No token received from server');
      }

      // Store credentials
      await writeAuthConfig({
        url: flags.url,
        token,
        email: user?.email || email,
        userId: user?.id,
        createdAt: new Date().toISOString(),
      });

      if (flags.json) {
        console.log(JSON.stringify({
          success: true,
          email: user?.email || email,
          userId: user?.id,
        }, null, 2));
      } else {
        printSuccess('Authentication successful');
        printKV('Email', user?.email || email);
        if (user?.id) {
          printKV('User ID', user.id);
        }
        console.log('');
        console.log('  Credentials stored in ~/.objectstack/credentials.json');
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
