// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import chalk from 'chalk';
import yaml from 'yaml';

/**
 * Output format options for CLI commands
 */
export type OutputFormat = 'json' | 'table' | 'yaml';

/**
 * Format and output data according to the specified format
 */
export function formatOutput(data: any, format: OutputFormat = 'json'): void {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(data, null, 2));
      break;

    case 'yaml':
      console.log(yaml.stringify(data));
      break;

    case 'table':
      // For table format, handle different data structures
      if (Array.isArray(data)) {
        printTable(data);
      } else if (data && typeof data === 'object') {
        // For single objects, print as key-value pairs
        printKeyValue(data);
      } else {
        console.log(String(data));
      }
      break;

    default:
      console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Print data as a table (for arrays of objects)
 */
function printTable(data: any[]): void {
  if (data.length === 0) {
    console.log(chalk.dim('(no data)'));
    return;
  }

  // Get all unique keys from all objects
  const keys = Array.from(
    new Set(data.flatMap(item => Object.keys(item)))
  );

  // Print header
  console.log(chalk.bold(keys.join(' | ')));
  console.log(chalk.dim('─'.repeat(keys.join(' | ').length)));

  // Print rows
  for (const item of data) {
    const values = keys.map(key => {
      const value = item[key];
      if (value === null || value === undefined) return chalk.dim('-');
      if (typeof value === 'object') return chalk.dim('[object]');
      return String(value);
    });
    console.log(values.join(' | '));
  }

  console.log(chalk.dim(`\n${data.length} row(s)`));
}

/**
 * Print object as key-value pairs
 */
function printKeyValue(data: Record<string, any>, indent = 0): void {
  const prefix = '  '.repeat(indent);

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      console.log(`${prefix}${chalk.dim(key + ':')} ${chalk.dim('null')}`);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      console.log(`${prefix}${chalk.bold(key + ':')}`);
      printKeyValue(value, indent + 1);
    } else if (Array.isArray(value)) {
      console.log(`${prefix}${chalk.dim(key + ':')} ${chalk.dim(`[${value.length} items]`)}`);
    } else {
      console.log(`${prefix}${chalk.dim(key + ':')} ${chalk.white(String(value))}`);
    }
  }
}
