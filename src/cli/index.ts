#!/usr/bin/env node
/**
 * LeadrsAgents CLI
 * Command-line interface for the Agent OS
 */

import { Command } from 'commander';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

import { runCommand } from './commands/run.js';
import { explainCommand } from './commands/explain.js';
import { ingestCommand } from './commands/ingest.js';
import { testCommand } from './commands/test.js';

const program = new Command();

program
  .name('leadrs')
  .description('LeadrsAgents - AI Agent OS')
  .version('1.0.0');

// Run command - process a request
program
  .command('run')
  .description('Run a request through the agent system')
  .argument('<request>', 'The request to process (in quotes)')
  .option('-u, --user <email>', 'User email', process.env.DEFAULT_USER_EMAIL)
  .option('-c, --client <id>', 'Client ID')
  .option('-d, --debug', 'Show debug information')
  .action(runCommand);

// Explain command - debug a job
program
  .command('explain')
  .description('Explain what happened in a job')
  .argument('<job-id>', 'The job ID to explain')
  .action(explainCommand);

// Ingest command - add knowledge
program
  .command('ingest')
  .description('Ingest knowledge from a source')
  .argument('<source>', 'Source to ingest (folder path or "drive")')
  .option('-c, --client <id>', 'Client ID for the knowledge')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .action(ingestCommand);

// Test command - run tests
program
  .command('test')
  .description('Run system tests')
  .option('-i, --intent', 'Test intent classification')
  .option('-k, --knowledge', 'Test knowledge retrieval')
  .option('-a, --agent <id>', 'Test specific agent')
  .action(testCommand);

program.parse();

