import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import nunjucks from "nunjucks";

type FileBody = {
    metadata?: Record<string, unknown>;
    prompts?: Record<string, string>;
};

class Registry {
    private templates = new Map<string, nunjucks.Template>();
    private env = new nunjucks.Environment(null, { autoescape: false });
    constructor(private dir: string) { this.reload(); }

    reload(): void {
        const next = new Map<string, nunjucks.Template>();
        for (const f of readdirSync(this.dir)) {
            if (!f.endsWith(".yaml") && !f.endsWith(".yml")) continue;
            const body = yaml.load(readFileSync(join(this.dir, f), "utf8")) as FileBody;
            for (const [name, text] of Object.entries(body.prompts ?? {})) {
                if (next.has(name)) throw new Error(`duplicate prompt name "${name}" in ${f}`);
                next.set(name, nunjucks.compile(text, this.env));
            }
        }
        this.templates = next;
    }

    render(name: string, vars: Record<string, unknown> = {}): string {
        const t = this.templates.get(name);
        if (!t) throw new Error(`prompt "${name}" not found`);
        return t.render(vars);
    }
}

let _default: Registry | null = null;
export function prompts(): Registry {
    if (!_default) _default = new Registry(process.env.PROMPT_DIR ?? "prompts");
    return _default;
}