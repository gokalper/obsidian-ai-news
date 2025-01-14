import { Plugin, PluginSettingTab, App, Setting, Notice, Menu } from 'obsidian';
import Parser from 'rss-parser';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';


interface NewsSummaryPluginSettings {
  rssFeeds: string[];
  numArticles: number;
  openaiModel: string;
  prompt: string;
  openaiApiKey: string;
}


function fetchWithCurl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`Executing curl fallback for URL: ${url}`);
    exec(`curl -s ${url}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Curl failed for URL: ${url}`, stderr);
        reject(stderr || 'Unknown error occurred with curl.');
      } else {
        console.log(`Curl succeeded for URL: ${url}`);
        resolve(stdout);
      }
    });
  });
}

const DEFAULT_SETTINGS: NewsSummaryPluginSettings = {
  rssFeeds: [],
  numArticles: 5,
  openaiModel: 'gpt-4o-mini',
  prompt: `
  You are a Markdown formatter tasked with organizing a detailed list of news items into a well-structured document. 
  The input includes news headlines, summaries, and article links. Your task involves the following:
  
  ### Metadata and Context
  - **Input Structure**: A list of news headlines, summaries, and article links.
  
  ### Task Requirements
  1. **Summarization**: Extract and retain only the most critical information from the input data.
  2. **Deduplication**: Identify and remove redundant or overlapping information.
  3. **Prioritization**: Organize the news items based on their importance and relevance.
  4. **Categorization**: Group related news items into thematic categories (e.g., Global Politics, Technology).
  
  ### Response Structure
  - Provide concise summaries for each category.
  - Include clickable links to the original articles.
  
  ### User Needs
  - Assume the user is interested in concise and well-organized information.
  - Do not summarize what this document aims to accomplish or a summary of the data provided only provide the content no addition context of what it is and why.
  `,
  openaiApiKey: '',
};

export default class NewsSummaryPlugin extends Plugin {
  settings: NewsSummaryPluginSettings;

  async onload() {
    console.log('Loading News Summary Plugin...');
    await this.loadSettings();

    this.addSettingTab(new NewsSummarySettingTab(this.app, this));

    this.addCommand({
      id: 'generate-news-summary',
      name: "Generate Today's News Summary",
      callback: async () => {
        await this.generateNewsSummaryIncrementally();
      },
    });

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu: Menu) => {
        menu.addItem((item) => {
          item
            .setTitle("Generate Today's News Summary")
            .setIcon('document')
            .onClick(async () => {
              await this.generateNewsSummaryIncrementally();
            });
        });
      })
    );


    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu: Menu, editor, view) => {
        const selectedText = editor.getSelection();
    
        const url = this.extractFirstUrl(selectedText);
    
        if (url) {
          menu.addItem((item) => {
            item
              .setTitle('Summarize URL Inline')
              .setIcon('document')
              .onClick(async () => {
                await this.summarizeUrlInPlace(url, editor);
              });
          });
        }
      })
    );

  }

  onunload() {
    console.log('Unloading News Summary Plugin...');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  extractFirstUrl(text: string): string | null {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  }

async summarizeUrlInPlace(url: string, editor: any) {
  const openai = new OpenAI({
    apiKey: this.settings.openaiApiKey,
    dangerouslyAllowBrowser: true,
  });

  try {
    url = url.replace(/[)]*$/, '');
    console.log(`Cleaned URL: ${url}`);

    const jinaApiUrl = `https://r.jina.ai/${url}`;
    console.log(`Fetching from Jina proxy URL: ${jinaApiUrl}`);

    let rawMarkdown: string;
    try {
      const response = await fetch(jinaApiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      rawMarkdown = await response.text();
    } catch (fetchError) {
      console.error(`Fetch failed, attempting curl fallback for URL: ${jinaApiUrl}`, fetchError);
      rawMarkdown = await fetchWithCurl(jinaApiUrl);
    }

    console.log(`Raw Markdown fetched: ${rawMarkdown.substring(0, 500)}...`);

    const hasValidContent = /^(Title|Markdown Content|Published Time):/m.test(rawMarkdown);

    if (!hasValidContent) {
      console.warn(`The Jina service returned unusable content for URL: ${url}`);
      editor.replaceRange(
        `\n\n> **Error:** Unable to fetch meaningful content from [${url}](${url}). Please check the URL.\n`,
        { line: editor.getCursor().line + 1, ch: 0 }
      );
      return;
    }

    console.warn(`Ignoring warnings and summarizing content for URL: ${url}`);

    const prompt = `
You are a Markdown formatter. Summarize the following content into concise Markdown with bullet points and headings where appropriate.

Content to Summarize:
${rawMarkdown}

Summarize this content for Markdown readers.
    `;

    const chatResponse = await openai.chat.completions.create({
      model: this.settings.openaiModel,
      messages: [{ role: 'user', content: prompt }],
    });

    const summary =
      chatResponse.choices[0]?.message?.content ||
      'Error: Unable to summarize the content.';

    // Insert the summary below the URL
    editor.replaceRange(
      `\n\n> **Summary:**\n>\n> ${summary.split('\n').join('\n> ')}\n`,
      { line: editor.getCursor().line + 1, ch: 0 }
    );

    console.log(`Generated Summary: ${summary.substring(0, 500)}...`);
    new Notice('URL summarized and inserted below the URL.');
  } catch (error) {
    console.error(`Error summarizing URL: ${url}`, error);
    new Notice('Failed to summarize the URL. Check the console for details.');
  }
}


  async generateNewsSummaryIncrementally() {
    const parser = new Parser();
    const openai = new OpenAI({
      apiKey: this.settings.openaiApiKey,
      dangerouslyAllowBrowser: true,
    });

    const currentDate = new Date();
    const formattedDate = `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1
    ).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    const noteTitle = `News Summaries/${formattedDate} News Summary.md`;

    const basePath = (this.app.vault.adapter as any).getBasePath();
    const filePath = path.join(basePath, noteTitle);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      `# Today's News Summary - ${formattedDate}\n\n`
    );

    const feedConfig = this.parseRSSFeedConfig(this.settings.rssFeeds);

    for (const [category, feeds] of Object.entries(feedConfig)) {
      try {
        const summaries: string[] = [];

        for (const feedUrl of feeds) {
          const feed = await parser.parseURL(feedUrl);
          feed.items.slice(0, this.settings.numArticles).forEach((item) => {
            summaries.push(
              `- **[${item.title}](${item.link})**: ${
                item.contentSnippet || item.summary || item.content
              }`
            );
          });
        }

        const categoryPrompt = `
Category: ${category}

Articles:
${summaries.join('\n')}

${this.settings.prompt}
        `;

        const response = await openai.chat.completions.create({
          model: this.settings.openaiModel,
          messages: [{ role: 'user', content: categoryPrompt }],
        });

        const markdown =
          response.choices[0]?.message?.content ||
          `## ${category}\n- Error generating summary.`;

        fs.appendFileSync(filePath, `## ${category}\n\n${markdown}\n\n---\n`);
        new Notice(`Added "${category}" section to the summary.`);
      } catch (error) {
        console.error(`Failed to process category "${category}":`, error);
        fs.appendFileSync(
          filePath,
          `## ${category}\n\n- Error processing this category.\n\n---\n`
        );
      }
    }

    new Notice('News summary generation complete!');
  }

  parseRSSFeedConfig(rssFeeds: string[]) {
    const feedConfig: Record<string, string[]> = {};
    let currentCategory = 'Uncategorized';

    rssFeeds.forEach((line) => {
      if (line.startsWith('#')) {
        currentCategory = line.replace('#', '').trim();
        feedConfig[currentCategory] = [];
      } else if (line.trim()) {
        feedConfig[currentCategory].push(line.trim());
      }
    });

    return feedConfig;
  }
}

class NewsSummarySettingTab extends PluginSettingTab {
  plugin: NewsSummaryPlugin;

  constructor(app: App, plugin: NewsSummaryPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'News Summary Plugin Settings' });

    new Setting(containerEl)
      .setName('RSS Feeds')
      .setDesc('Add or remove RSS feed URLs (one per line).')
      .addTextArea((textArea) => {
        textArea
          .setPlaceholder('Enter RSS feeds, one per line...')
          .setValue(this.plugin.settings.rssFeeds.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.rssFeeds = value
              .split('\n')
              .map((feed) => feed.trim())
              .filter((feed) => feed);
            await this.plugin.saveSettings();
          });

        textArea.inputEl.style.height = '150px';
        textArea.inputEl.style.width = '100%';
      });

    new Setting(containerEl)
      .setName('Number of Articles')
      .setDesc('Specify the number of recent articles to fetch per feed.')
      .addText((text) =>
        text
          .setPlaceholder('Enter a number')
          .setValue(this.plugin.settings.numArticles.toString())
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.numArticles = num;
              await this.plugin.saveSettings();
            } else {
              new Notice('Please enter a valid positive number.');
            }
          })
      );

    new Setting(containerEl)
      .setName('OpenAI Model')
      .setDesc('Select the OpenAI model to use.')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({ 'gpt-4o': 'GPT-4o', 'gpt-4o-mini': 'GPT-4o-mini' })
          .setValue(this.plugin.settings.openaiModel)
          .onChange(async (value) => {
            this.plugin.settings.openaiModel = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('Enter your OpenAI API key.')
      .addText((text) =>
        text
          .setPlaceholder('Enter OpenAI API key')
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Prompt')
      .setDesc('Customize the prompt for ChatGPT.')
      .addTextArea((textArea) => {
        textArea
          .setValue(this.plugin.settings.prompt)
          .onChange(async (value) => {
            this.plugin.settings.prompt = value;
            await this.plugin.saveSettings();
          });

        textArea.inputEl.style.height = '150px';
        textArea.inputEl.style.width = '100%';
      });
  }
}