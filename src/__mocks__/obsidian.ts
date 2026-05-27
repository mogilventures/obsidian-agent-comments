/**
 * Minimal Obsidian API mock for Jest tests.
 * Only stubs out the classes and methods actually used in the plugin.
 */

export class Plugin {
  app: any = {};
  vault: any = {};
  manifest: any = {};

  async loadData(): Promise<any> {
    return {};
  }

  async saveData(_data: any): Promise<void> {
    // no-op
  }

  addRibbonIcon(_icon: string, _title: string, _callback: () => void): HTMLElement {
    return document.createElement('div');
  }

  addCommand(_command: any): void {
    // no-op
  }

  registerEditorExtension(_ext: any): void {
    // no-op
  }

  registerView(_type: string, _viewCreator: any): void {
    // no-op
  }

  addSettingTab(_tab: any): void {
    // no-op
  }

  register(_callback: () => void): void {
    // no-op
  }

  registerEvent(_eventRef: any): void {
    // no-op
  }
}

export class ItemView {
  containerEl: HTMLElement = document.createElement('div');
  app: any = {};
  leaf: any = {};
  navigation: boolean = false;

  addAction(_icon: string, _title: string, _callback: () => void): HTMLElement {
    return document.createElement('div');
  }

  register(_callback: () => void): void {
    // no-op
  }

  registerEvent(_eventRef: any): void {
    // no-op
  }

  getViewType(): string {
    return '';
  }

  getDisplayText(): string {
    return '';
  }

  getIcon(): string {
    return '';
  }

  async onOpen(): Promise<void> {
    // no-op
  }

  async onClose(): Promise<void> {
    // no-op
  }
}

export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: HTMLElement = document.createElement('div');

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }

  display(): void {
    // no-op
  }

  hide(): void {
    // no-op
  }
}

export class Setting {
  private el: HTMLElement = document.createElement('div');

  constructor(_containerEl: HTMLElement) {
    // no-op
  }

  setName(_name: string): this {
    return this;
  }

  setDesc(_desc: string | DocumentFragment): this {
    return this;
  }

  addText(_cb: (text: any) => any): this {
    return this;
  }

  addToggle(_cb: (toggle: any) => any): this {
    return this;
  }

  addTextArea(_cb: (textarea: any) => any): this {
    return this;
  }

  addButton(_cb: (button: any) => any): this {
    return this;
  }

  addDropdown(_cb: (dropdown: any) => any): this {
    return this;
  }

  setHeading(): this {
    return this;
  }

  setClass(_cls: string): this {
    return this;
  }
}

export class Notice {
  constructor(_message: string, _timeout?: number) {
    // no-op
  }
}

export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
  stat: { ctime: number; mtime: number; size: number } = { ctime: 0, mtime: 0, size: 0 };
  vault: any = {};
  parent: any = null;

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() ?? path;
    const parts = this.name.split('.');
    this.extension = parts.length > 1 ? parts.pop()! : '';
    this.basename = parts.join('.');
  }
}

export class WorkspaceLeaf {
  view: any = null;

  async setViewState(_state: any): Promise<void> {
    // no-op
  }

  getViewState(): any {
    return {};
  }
}

export class MarkdownView extends ItemView {
  file: TFile | null = null;
  editor: any = null;

  getMode(): string {
    return 'source';
  }
}

export class Modal {
  app: any;
  contentEl: HTMLElement = document.createElement('div');
  titleEl: HTMLElement = document.createElement('div');
  modalEl: HTMLElement = document.createElement('div');

  constructor(app: any) {
    this.app = app;
  }

  open(): void {
    // no-op
  }

  close(): void {
    // no-op
  }

  onOpen(): void {
    // no-op
  }

  onClose(): void {
    // no-op
  }
}

export class Vault {
  async read(_file: TFile): Promise<string> {
    return '';
  }

  async modify(_file: TFile, _content: string): Promise<void> {
    // no-op
  }

  adapter: {
    exists: (_path: string) => Promise<boolean>;
    mkdir: (_path: string) => Promise<void>;
    read: (_path: string) => Promise<string>;
    write: (_path: string, _data: string) => Promise<void>;
    remove: (_path: string) => Promise<void>;
    list: (_path: string) => Promise<{ files: string[]; folders: string[] }>;
  } = {
    exists: async () => false,
    mkdir: async () => undefined,
    read: async () => '',
    write: async () => undefined,
    remove: async () => undefined,
    list: async () => ({ files: [], folders: [] }),
  };
}
