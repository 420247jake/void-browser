#!/usr/bin/env node

// Void Browser Crawler CLI

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { VoidCrawler, DEFAULT_OPTIONS } from './crawler.js';
import { createVoid, openVoid } from './storage.js';
import type { CrawlerStats } from './types.js';

const program = new Command();

program
  .name('void-crawl')
  .description('Void Browser Crawler - Build your web graph')
  .version('1.0.0');

// Crawl command
program
  .command('crawl <url>')
  .description('Start crawling from a seed URL')
  .option('-n, --name <name>', 'Void name (creates <name>.db)', 'void')
  .option('-d, --depth <number>', 'Max crawl depth', '3')
  .option('-m, --max <number>', 'Max nodes to crawl', '100')
  .option('-c, --concurrency <number>', 'Concurrent requests', '5')
  .option('-r, --rate <number>', 'Rate limit in ms per domain', '1000')
  .option('-s, --stay-on-domain', 'Only crawl same domain', false)
  .option('-S, --screenshots', 'Capture screenshots of each page', false)
  .option('-o, --output <dir>', 'Output directory', './voids')
  .action(async (url: string, options) => {
    console.log(chalk.cyan('\nVOID BROWSER CRAWLER\n'));
    
    // Ensure output directory exists
    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
    }

    const dbPath = path.join(options.output, `${options.name}.db`);
    const isNew = !fs.existsSync(dbPath);

    console.log(chalk.dim(`Database: ${dbPath}`));
    console.log(chalk.dim(`Mode: ${isNew ? 'Creating new void' : 'Adding to existing void'}\n`));

    const storage = isNew ? createVoid(options.name, options.output) : openVoid(dbPath);

    const crawlerOptions = {
      maxDepth: parseInt(options.depth),
      maxNodes: parseInt(options.max),
      concurrency: parseInt(options.concurrency),
      rateLimit: parseInt(options.rate),
      stayOnDomain: options.stayOnDomain,
      takeScreenshots: options.screenshots
    };

    console.log(chalk.dim('Settings:'));
    console.log(chalk.dim(`  Max depth: ${crawlerOptions.maxDepth}`));
    console.log(chalk.dim(`  Max nodes: ${crawlerOptions.maxNodes}`));
    console.log(chalk.dim(`  Concurrency: ${crawlerOptions.concurrency}`));
    console.log(chalk.dim(`  Rate limit: ${crawlerOptions.rateLimit}ms`));
    console.log(chalk.dim(`  Stay on domain: ${crawlerOptions.stayOnDomain}`));
    console.log(chalk.dim(`  Screenshots: ${crawlerOptions.takeScreenshots}\n`));

    const spinner = ora('Starting crawler...').start();
    let lastUpdate = Date.now();

    const crawler = new VoidCrawler(storage, crawlerOptions, {
      onStart: () => {
        spinner.text = `Crawling ${chalk.cyan(url)}...`;
      },
      onNode: (nodeUrl, title, depth) => {
        const now = Date.now();
        if (now - lastUpdate > 200) {
          spinner.text = `[Depth ${depth}] ${title || nodeUrl}`;
          lastUpdate = now;
        }
      },
      onError: (errorUrl, error) => {
        // Don't spam errors, just count them
      },
      onProgress: (stats) => {
        spinner.text = `Nodes: ${stats.nodesCrawled} | Edges: ${stats.edgesFound} | Domains: ${stats.domains.size}`;
      },
      onComplete: (stats) => {
        spinner.succeed(chalk.green('Crawl complete!'));
        printStats(stats);
      }
    });

    try {
      await crawler.crawl(url);
    } catch (error) {
      spinner.fail(chalk.red('Crawl failed'));
      console.error(error);
    } finally {
      storage.close();
    }
  });

// Stats command
program
  .command('stats <dbPath>')
  .description('Show stats for a void database')
  .action((dbPath: string) => {
    if (!fs.existsSync(dbPath)) {
      console.error(chalk.red(`Database not found: ${dbPath}`));
      process.exit(1);
    }

    const storage = openVoid(dbPath);
    const stats = storage.getStats();

    console.log(chalk.cyan('\nVOID STATS\n'));
    console.log(`  Database: ${chalk.dim(dbPath)}`);
    console.log(`  Nodes: ${chalk.green(stats.nodes)}`);
    console.log(`  Edges: ${chalk.green(stats.edges)}`);
    console.log(`  Domains: ${chalk.green(stats.domains)}`);
    console.log();

    storage.close();
  });

// List command
program
  .command('list [dir]')
  .description('List all void databases')
  .action((dir: string = './voids') => {
    if (!fs.existsSync(dir)) {
      console.log(chalk.yellow('No voids found.'));
      return;
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.db'));

    if (files.length === 0) {
      console.log(chalk.yellow('No voids found.'));
      return;
    }

    console.log(chalk.cyan('\nYOUR VOIDS\n'));

    for (const file of files) {
      const dbPath = path.join(dir, file);
      const storage = openVoid(dbPath);
      const stats = storage.getStats();
      storage.close();

      console.log(`  ${chalk.green(file.replace('.db', ''))}`);
      console.log(`    ${chalk.dim(`${stats.nodes} nodes, ${stats.edges} edges, ${stats.domains} domains`)}`);
    }

    console.log();
  });

// Export command
program
  .command('export <dbPath>')
  .description('Export void to JSON')
  .option('-o, --output <file>', 'Output file', 'void-export.json')
  .action((dbPath: string, options) => {
    if (!fs.existsSync(dbPath)) {
      console.error(chalk.red(`Database not found: ${dbPath}`));
      process.exit(1);
    }

    const storage = openVoid(dbPath);
    const nodes = storage.getAllNodes();
    const edges = storage.getAllEdges();

    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      nodes,
      edges
    };

    fs.writeFileSync(options.output, JSON.stringify(exportData, null, 2));
    console.log(chalk.green(`Exported to ${options.output}`));
    console.log(chalk.dim(`  ${nodes.length} nodes, ${edges.length} edges`));

    storage.close();
  });

function printStats(stats: CrawlerStats) {
  const duration = (Date.now() - stats.startTime.getTime()) / 1000;

  console.log(chalk.cyan('\nCRAWL STATS\n'));
  console.log(`  Nodes crawled: ${chalk.green(stats.nodesCrawled)}`);
  console.log(`  Edges found: ${chalk.green(stats.edgesFound)}`);
  console.log(`  Domains: ${chalk.green(stats.domains.size)}`);
  console.log(`  Errors: ${chalk.yellow(stats.errors)}`);
  console.log(`  Duration: ${chalk.dim(duration.toFixed(1) + 's')}`);
  console.log(`  Speed: ${chalk.dim((stats.nodesCrawled / duration).toFixed(1) + ' pages/s')}`);
  console.log();
}

program.parse();
