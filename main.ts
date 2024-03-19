import {
	App,
	normalizePath,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";

interface PluginSettings {
	rootIndexName: string;
	excludeDirectories: string;
	indexTemplate: string;
	rootTemplate: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	rootIndexName: "",
	excludeDirectories: "",
	indexTemplate: "",
	rootTemplate: "",
};

export default class MyPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();
		this.app.workspace.onLayoutReady(() => {
			this.registerEvent(
				this.app.vault.on("create", this.onChange.bind(this))
			);
		});
		this.registerEvent(
			this.app.vault.on("delete", this.onChange.bind(this))
		);
		this.registerEvent(
			this.app.vault.on(
				"rename",
				async (file: TAbstractFile, oldPath: string) => {
					await this.onChange(file);

					const oldFile = this.app.metadataCache.getFirstLinkpathDest(
						this.getFolderPathFromString(oldPath),
						""
					);

					if (oldFile !== null && oldFile.parent !== null) {
						await this.onChange(oldFile.parent);
						return;
					}
					await this.onChange(this.app.vault.getRoot());
				}
			)
		);

		this.addSettingTab(new IndexGeneratorSettingTab(this.app, this));
	}

	async onChange(file: TAbstractFile) {
		if (file instanceof TFile && file.extension === "md") {
			return await this.handleFileChange(file.name, file.parent);
		}

		if (file instanceof TFolder) {
			return await this.handleFileChange("", file);
		}
	}
	getFolderPathFromString(path: string): string {
		const subString =
			path.lastIndexOf("/" || "\\") >= 0 ? path.lastIndexOf("/") : 0;
		return path.substring(0, subString);
	}

	async handleFileChange(fileName: string, parent: TFolder | null) {
		if (parent === null) {
			parent = this.app.vault.getRoot();
		}

		let excludePaths: string[] = [];
		if (this.settings.excludeDirectories !== "") {
			excludePaths = this.settings.excludeDirectories.split(",");
		}

		for (const exclude of excludePaths) {
			if (parent.path.includes(exclude.trim())) {
				return;
			}
		}

		const isRoot = parent.isRoot();
		let parentName = this.settings.rootIndexName;
		if (parentName === "" || !isRoot) {
			parentName =
				parent.name != "" ? parent.name : this.app.vault.getName();
		}

		if (fileName === `${parentName}.md`) {
			return;
		}

		let useTemplateFile = false;
		let templateFileName = "";
		if (this.settings.indexTemplate !== "") {
			templateFileName = normalizePath(
				`${this.settings.indexTemplate}.md`
			);
			useTemplateFile = true;
		}

		if (isRoot && this.settings.rootTemplate !== "") {
			templateFileName = normalizePath(
				`${this.settings.rootTemplate}.md`
			);
			useTemplateFile = true;
		}

		let templateContent = "{{content}}\n";
		if (useTemplateFile) {
			const templateFile = this.app.metadataCache.getFirstLinkpathDest(
				templateFileName,
				""
			);

			if (templateFile === null) {
				new Notice("Missing template file to generate index");
				return;
			}

			templateContent = await this.app.vault.cachedRead(templateFile);
		}

		const links = [];
		for (const child of parent.children) {
			if (child.name === `${parentName}.md`) {
				continue;
			}

			if (child instanceof TFile) {
				if (!child.name.includes(".md")) {
					continue;
				}
				const link = this.app.fileManager.generateMarkdownLink(
					child,
					"",
					"",
					child.name.replace(".md", "")
				);
				links.push(`* ${link}`);
			}

			if (child instanceof TFolder) {
				for (const exclude of excludePaths) {
					if (child.path.includes(exclude.trim())) {
						continue;
					}
				}
				const indexFile = this.app.metadataCache.getFirstLinkpathDest(
					normalizePath(`${child.path}/${child.name}.md`),
					""
				);

				if (indexFile == null) {
					continue;
				}
				const link = this.app.fileManager.generateMarkdownLink(
					indexFile,
					"",
					"",
					indexFile.name.replace(".md", "")
				);
				links.push(`* ${link}`);
			}
		}

		links.sort();
		const content = templateContent
			.replace(/{{\s*title\s*}}/gi, parentName)
			.replace(/{{\s*content\s*}}/gi, links.join("\n"));

		const indexFilePath = normalizePath(`${parent.path}/${parentName}.md`);
		const indexFile = this.app.metadataCache.getFirstLinkpathDest(
			indexFilePath,
			indexFilePath
		);

		if (indexFile === null && links.length > 0) {
			await this.app.vault.create(indexFilePath, content);
			new Notice("Finished updating indices");
			return;
		}

		if (indexFile !== null) {
			if (links.length == 0) {
				await this.app.vault.delete(indexFile);
				new Notice("Finished updating indices");
				return;
			}

			await this.app.vault.modify(indexFile, content);
			new Notice("Finished updating indices");
		}
	}

	onunload() { }

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class IndexGeneratorSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		new Setting(containerEl)
			.setName("Root index file name")
			.setDesc("Name to use for index at the root of vault.")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.rootIndexName)
					.onChange(async (value) => {
						this.plugin.settings.rootIndexName = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Root file template")
			.setDesc("Template file to use for the root of vault index.")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.rootTemplate)
					.onChange(async (value) => {
						this.plugin.settings.rootTemplate = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Template")
			.setDesc("Path to template for index file.")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.indexTemplate)
					.onChange(async (value) => {
						this.plugin.settings.indexTemplate = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Exclude Directories")
			.setDesc("Comma separated list of directories to exclude.")
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.excludeDirectories)
					.onChange(async (value) => {
						this.plugin.settings.excludeDirectories = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
