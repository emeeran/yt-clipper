/**
 * Mock for Obsidian API
 * This file provides mock implementations of Obsidian classes and functions
 * used in tests.
 */

export class App {
    vault = {
        getAbstractFileByPath: jest.fn(),
        read: jest.fn(),
        create: jest.fn(),
        modify: jest.fn(),
        delete: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
    };
    workspace = {
        getActiveFile: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        getActiveViewOfType: jest.fn()
    };
}

export class TFile {
    path: string = '';
    name: string = '';
    basename: string = '';
    extension: string = '';
    stat = {
        ctime: Date.now(),
        mtime: Date.now(),
        size: 0
    };
    parent = null;
}

export class TFolder {
    path: string = '';
    name: string = '';
    children: (TFile | TFolder)[] = [];
    parent = null;
}

export class Modal {
    app: App;
    contentEl: HTMLElement;
    modalEl: HTMLElement;
    scope: Scope;
    
    constructor(app: App) {
        this.app = app;
        this.contentEl = document.createElement('div');
        this.modalEl = document.createElement('div');
        this.scope = new Scope();
    }
    
    open(): void {}
    close(): void {}
    onOpen(): void {}
    onClose(): void {}
}

export class Scope {
    register(modifiers: string[], key: string | null, func: () => boolean): void {}
    unregister(handler: () => boolean): void {}
}

export class Setting {
    containerEl: HTMLElement;
    
    constructor(containerEl: HTMLElement) {
        this.containerEl = containerEl;
    }
    
    setName(name: string): this { return this; }
    setDesc(desc: string): this { return this; }
    addText(cb: (text: TextComponent) => void): this { return this; }
    addTextArea(cb: (text: TextAreaComponent) => void): this { return this; }
    addToggle(cb: (toggle: ToggleComponent) => void): this { return this; }
    addDropdown(cb: (dropdown: DropdownComponent) => void): this { return this; }
    addSlider(cb: (slider: SliderComponent) => void): this { return this; }
    addButton(cb: (button: ButtonComponent) => void): this { return this; }
    setClass(cls: string): this { return this; }
    setHeading(): this { return this; }
}

export class TextComponent {
    inputEl: HTMLInputElement = document.createElement('input');
    setValue(value: string): this { return this; }
    setPlaceholder(placeholder: string): this { return this; }
    onChange(cb: (value: string) => void): this { return this; }
    getValue(): string { return ''; }
}

export class TextAreaComponent {
    inputEl: HTMLTextAreaElement = document.createElement('textarea');
    setValue(value: string): this { return this; }
    setPlaceholder(placeholder: string): this { return this; }
    onChange(cb: (value: string) => void): this { return this; }
    getValue(): string { return ''; }
}

export class ToggleComponent {
    toggleEl: HTMLElement = document.createElement('div');
    setValue(value: boolean): this { return this; }
    onChange(cb: (value: boolean) => void): this { return this; }
    getValue(): boolean { return false; }
}

export class DropdownComponent {
    selectEl: HTMLSelectElement = document.createElement('select');
    addOption(value: string, display: string): this { return this; }
    setValue(value: string): this { return this; }
    onChange(cb: (value: string) => void): this { return this; }
    getValue(): string { return ''; }
}

export class SliderComponent {
    sliderEl: HTMLInputElement = document.createElement('input');
    setValue(value: number): this { return this; }
    setLimits(min: number, max: number, step: number | 'any'): this { return this; }
    setDynamicTooltip(): this { return this; }
    onChange(cb: (value: number) => void): this { return this; }
    getValue(): number { return 0; }
}

export class ButtonComponent {
    buttonEl: HTMLButtonElement = document.createElement('button');
    setButtonText(text: string): this { return this; }
    setCta(): this { return this; }
    setWarning(): this { return this; }
    onClick(cb: () => void): this { return this; }
}

export class PluginSettingTab {
    app: App;
    containerEl: HTMLElement;
    
    constructor(app: App, plugin: Plugin) {
        this.app = app;
        this.containerEl = document.createElement('div');
    }
    
    display(): void {}
    hide(): void {}
}

export class Plugin {
    app: App;
    manifest: PluginManifest;
    
    constructor(app: App, manifest: PluginManifest) {
        this.app = app;
        this.manifest = manifest;
    }
    
    loadData(): Promise<unknown> { return Promise.resolve({}); }
    saveData(data: unknown): Promise<void> { return Promise.resolve(); }
    addCommand(command: Command): Command { return command; }
    addSettingTab(tab: PluginSettingTab): void {}
    registerObsidianProtocolHandler(action: string, handler: (params: ObsidianProtocolData) => void): void {}
}

export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    minAppVersion: string;
    description: string;
    author: string;
    authorUrl?: string;
    isDesktopOnly?: boolean;
}

export interface Command {
    id: string;
    name: string;
    callback?: () => void;
    checkCallback?: (checking: boolean) => boolean | void;
    hotkeys?: Hotkey[];
}

export interface Hotkey {
    modifiers: string[];
    key: string;
}

export interface ObsidianProtocolData {
    action: string;
    [key: string]: string;
}

export class Notice {
    constructor(message: string, timeout?: number) {}
    hide(): void {}
}

export function requestUrl(request: RequestUrlParam): Promise<RequestUrlResponse> {
    return Promise.resolve({
        status: 200,
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
        json: {},
        text: ''
    });
}

export interface RequestUrlParam {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string | ArrayBuffer;
    throw?: boolean;
}

export interface RequestUrlResponse {
    status: number;
    headers: Record<string, string>;
    arrayBuffer: ArrayBuffer;
    json: unknown;
    text: string;
}
