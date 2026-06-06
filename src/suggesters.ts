import { AbstractInputSuggest, App, TFile, TFolder } from "obsidian";

/** Autocomplete a text input with vault folder paths. */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(
		app: App,
		private input: HTMLInputElement,
		private on_pick: (value: string) => unknown,
	) {
		super(app, input);
	}

	getSuggestions(query: string): TFolder[] {
		const lower = query.toLowerCase();
		return this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder && f.path.toLowerCase().contains(lower));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder): void {
		this.input.value = folder.path;
		this.on_pick(folder.path);
		this.close();
	}
}

/** Autocomplete a text input with vault markdown file paths. */
export class FileSuggest extends AbstractInputSuggest<TFile> {
	constructor(
		app: App,
		private input: HTMLInputElement,
		private on_pick: (value: string) => unknown,
	) {
		super(app, input);
	}

	getSuggestions(query: string): TFile[] {
		const lower = query.toLowerCase();
		return this.app.vault
			.getMarkdownFiles()
			.filter(f => f.path.toLowerCase().contains(lower));
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.input.value = file.path;
		this.on_pick(file.path);
		this.close();
	}
}
