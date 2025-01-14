# **News Summary Plugin**

This plugin fetches news summaries from RSS feeds and generates Markdown summaries in Obsidian. It uses OpenAI for generating concise summaries and allows manual installation.

---

## **Manual Installation Instructions**

### 1. Clone the Repository

Clone the plugin repository to your local machine:

```bash
git clone https://github.com/your-repo/news-summary-plugin.git
cd news-summary-plugin
```

---

### 2. Build the Plugin

To build the plugin, you need Node.js and npm installed on your system. Follow these steps:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build the Plugin**:
   ```bash
   npm run build
   ```

This will generate a `main.js` file in the project folder.

---

### 3. Locate the Obsidian Vault on macOS

1. Open the Obsidian app.
2. Note the vault name shown in the sidebar or vault switcher.
3. Use Finder to locate the vault:
   - Vaults are typically stored in:
     ```bash
     ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/<vault-name>
     ```
   - If not using iCloud, look in:
     ```bash
     ~/Documents/<vault-name>
     ```
   - You can also search Finder for the folder containing your `.md` files.

4. Note the path to your vault folder.

---

### 4. Install the Plugin

1. Navigate to your vault folder in Finder.
2. Open the `.obsidian` folder inside the vault folder. If this folder does not exist, create it.
3. Inside `.obsidian`, create a `plugins` folder if it does not already exist:
   ```bash
   mkdir -p <vault-folder>/.obsidian/plugins/news-summary-plugin
   ```
4. Copy the plugin files to the `news-summary-plugin` folder:
   ```bash
   cp -R ./dist/* <vault-folder>/.obsidian/plugins/news-summary-plugin/
   ```

---

### 5. Enable the Plugin in Obsidian

Since community plugins are disabled by default:

1. Open Obsidian and go to **Settings > About**.
2. Toggle **Restricted Mode** off.
3. Navigate to **Settings > Community Plugins** and enable **Third-party plugins**.
4. Go to **Community Plugins** and click **Manage Installed Plugins**.
5. Locate **News Summary Plugin** in the list and toggle it on.
6. Configure the plugin with your OpenAI key and RSS feed list.

---

### 6. Test the Plugin

- Open your vault and notes in Obsidian.
- Use the right-click context menu in your notes list to generate today's news summary.
- Alternatively, use `Cmd+P` and search for **News Summary** in the command palette.
- If the plugin doesn’t load, check the Obsidian console (`Ctrl+Shift+I` or `Cmd+Option+I`) for any errors.

---

## **Uninstallation**

To remove the plugin:

1. Delete the `news-summary-plugin` folder:
   ```bash
   rm -rf <vault-folder>/.obsidian/plugins/news-summary-plugin
   ```
2. Restart Obsidian to remove traces of the plugin.

---

## **Troubleshooting**

- **Missing `.obsidian` folder**: Ensure you’ve opened the vault in Obsidian at least once, as this initializes the `.obsidian` folder.
- **Build Errors**:
  - Ensure you have Node.js (LTS version recommended) installed.
  - Run `npm install` again to ensure dependencies are correctly installed.

---

## **License**

This plugin is licensed under the MIT License.
