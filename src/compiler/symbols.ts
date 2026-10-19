import type { DataType } from "./ast.ts";

export interface SymbolRecord {
    name: string;
    uniqueName: string;
    type: DataType;
    line: number;
    column: number;
    scopeLevel: number;
    scopeId: number;
    isInitialized: boolean;
}

let globalScopeCounter = 0;

export function resetScopeCounter(): void {
    globalScopeCounter = 0;
}

export class SymbolTable {
    private symbols: Map<string, SymbolRecord> = new Map();
    public readonly parent: SymbolTable | null = null;
    public readonly children: SymbolTable[] = [];
    public readonly scopeLevel: number;
    public readonly scopeId: number;

    constructor(parent: SymbolTable | null = null, scopeLevel = 0) {
        this.parent = parent;
        this.scopeLevel = scopeLevel;
        this.scopeId = parent === null ? 0 : ++globalScopeCounter;
        if (parent) {
            parent.children.push(this);
        }
    }

    public define(symbol: Omit<SymbolRecord, "scopeLevel" | "scopeId" | "uniqueName">): boolean {
        if (this.symbols.has(symbol.name)) {
            return false;
        }
        const uniqueName = this.scopeId === 0 ? symbol.name : `${symbol.name}_s${this.scopeId}`;
        this.symbols.set(symbol.name, {
            ...symbol,
            uniqueName,
            scopeLevel: this.scopeLevel,
            scopeId: this.scopeId,
        });
        return true;
    }

    public lookup(name: string): SymbolRecord | undefined {
        const symbol = this.symbols.get(name);
        if (symbol) return symbol;
        if (this.parent) return this.parent.lookup(name);
        return undefined;
    }

    public lookupCurrentScope(name: string): SymbolRecord | undefined {
        return this.symbols.get(name);
    }

    public getAllSymbols(): SymbolRecord[] {
        const all: SymbolRecord[] = [];
        for (const record of this.symbols.values()) {
            all.push(record);
        }
        for (const child of this.children) {
            all.push(...child.getAllSymbols());
        }
        return all;
    }
}
