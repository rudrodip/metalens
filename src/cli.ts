#!/usr/bin/env node

import { getMetaTags, parseFileName, parseUrlForFilename } from "./utils";
import { PageMetadata } from "./types";
import fs from "node:fs/promises";
import { Command } from "commander";
import inquirer from "inquirer";
import { findAvailablePort, startServer } from "./server";
import open from "open";
import {
  NetworkError,
  HttpError,
  NotFoundError,
  InvalidUrlError,
  ContentParsingError,
  DomainNotFoundError
} from "./error";
import chalk from "chalk";

async function getSaveFilename(url: string): Promise<string> {
  const defaultFilename = `${parseUrlForFilename(url)}_metadata.json`;

  const { filename } = await inquirer.prompt([
    {
      type: "input",
      name: "filename",
      message: "Enter filename to save as:",
      default: defaultFilename,
    },
  ]);

  return parseFileName(filename);
}

async function saveAsJson(
  metadata: PageMetadata,
  url: string
): Promise<string> {
  const filename = await getSaveFilename(url);

  await fs.writeFile(filename, JSON.stringify(metadata, null, 2));
  return filename;
}

async function handleMetadataActions(metadata: PageMetadata, url: string): Promise<void> {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: "Log metadata to console", value: "log" },
        { name: "Save metadata to JSON file", value: "save" },
        { name: "View in local preview", value: "preview" },
      ],
    },
  ]);

  switch (action) {
    case "log":
      console.log("\n📋 Metadata Content:");
      console.log(JSON.stringify(metadata, null, 2));
      break;

    case "save":
      console.log("\n💾 Saving metadata to file...");
      const filename = await saveAsJson(metadata, url);
      console.log(`Metadata saved to ${filename}`);
      break;

    case "preview":
      console.log("\n🌐 Starting local preview server...");
      const basePort = 3141;
      const port = await findAvailablePort(basePort);
      try {
        await startServer(port, url); // url is the original website url
        
        const previewUrl = `http://localhost:${port}?url=${encodeURIComponent(url)}`;
        console.log(`Opening preview at ${previewUrl}`);
        await open(previewUrl);
      } catch (serverError) {
        console.error(chalk.red("\n❌ Failed to start local preview server."));
        if (serverError instanceof Error) {
          console.error(chalk.red(`   Error: ${serverError.message}`));
        }
        console.error(chalk.yellow("   Please check if the port is already in use or if there are other errors in the console."));
      }
      break;
  }
}

function displayFormattedError(error: unknown, url: string) {
  console.error("\n❌ Error retrieving metadata");
  
  if (error instanceof DomainNotFoundError) {
    console.error(chalk.red(`   Domain Not Found: "${url}"`));
    console.error(chalk.red(`   ${error.message}`));
    console.error(chalk.red("   The website domain does not exist or cannot be resolved."));
    console.error(chalk.red("   Please check if the domain name is spelled correctly."));
  }
  else if (error instanceof NetworkError) {
    console.error(chalk.yellow(`   Network Error: Unable to connect to ${url}`));
    console.error(chalk.yellow(`   ${error.message}`));
    console.error(chalk.yellow("   Please check your internet connection and try again."));
  } 
  else if (error instanceof NotFoundError) {
    console.error(chalk.magenta(`   Page Not Found: ${url}`));
    console.error(chalk.magenta(`   ${error.message}`));
    console.error(chalk.magenta("   Please check if the URL path is correct and exists."));
  } 
  else if (error instanceof InvalidUrlError) {
    console.error(chalk.blue(`   Invalid URL Format: ${url}`));
    console.error(chalk.blue(`   ${error.message}`));
    console.error(chalk.blue("   Please enter a valid URL including http:// or https://."));
  } 
  else if (error instanceof ContentParsingError) {
    console.error(chalk.cyan(`   Content Parsing Error: ${url}`));
    console.error(chalk.cyan(`   ${error.message}`));
    console.error(chalk.cyan("   The content couldn't be parsed properly."));
  } 
  else if (error instanceof HttpError) {
    console.error(chalk.red(`   HTTP Error ${error.statusCode}: ${url}`));
    console.error(chalk.red(`   ${error.message}`));
  } 
  else {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(chalk.red(`   ${errorMessage}`));
  }
}

async function processUrl(rawUrl: string): Promise<void> {
  // rawUrl is the url as input by the user.
  // Normalization is handled by getMetaTags and parseUrlForFilename (via getSaveFilename).
  try {
    // Log the rawUrl, or a normalized version if preferred for logging.
    // For simplicity, logging rawUrl and letting utils handle errors during normalization.
    // If normalizeUrlScheme was called here for logging, its potential error would need to be handled
    // or it would preempt the error handling within getMetaTags.
    console.log(`\nFetching metadata for ${rawUrl}...`);

    // getMetaTags (from utils.ts) will internally call normalizeUrlScheme.
    // If an InvalidUrlError is thrown, it will be caught by the catch block.
    const metadata = await getMetaTags(rawUrl);
    console.log("\n✅ Metadata retrieved successfully!");
    
    // rawUrl is passed to handleMetadataActions.
    // Inside handleMetadataActions, getSaveFilename(rawUrl) is called.
    // getSaveFilename calls parseUrlForFilename(rawUrl).
    // parseUrlForFilename (from utils.ts) will internally call normalizeUrlScheme.
    await handleMetadataActions(metadata, rawUrl);
  } catch (error) {
    // Pass rawUrl to displayFormattedError so user sees their original input in error message.
    displayFormattedError(error, rawUrl);
    
    const { retry } = await inquirer.prompt([
      {
        type: 'list',
        name: 'retry',
        message: 'Would you like to:',
        choices: [
          { name: 'Try a different URL', value: true },
          { name: 'Exit', value: false }
        ]
      }
    ]);
    
    if (retry) {
      const { newUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newUrl',
          message: 'Enter a new URL:',
          validate: (input) => input.length > 0 ? true : 'URL is required'
        }
      ]);
      
      await processUrl(newUrl);
    } else {
      process.exit(1);
    }
  }
}

export async function runCli(args: string[]): Promise<void> {
  const program = new Command();

  program
    .name("metalens")
    .description("🔍 Metalens - Metadata Explorer")
    .version("0.0.1")
    .argument("[url]", "Website URL to fetch metadata from")
    .action(async (urlArg) => {
      let url = urlArg;

      if (!url) {
        const answers = await inquirer.prompt([
          {
            type: "input",
            name: "url",
            message: "Enter website URL:",
            validate: (input) => (input.length > 0 ? true : "URL is required"),
          },
        ]);
        url = answers.url;
      }

      await processUrl(url);
    });

  program.parse(args);
}
