#!/usr/bin/env node
// Validate every `related:` path in blog frontmatter resolves to an actual
// page. Wired into `npm run prebuild` so a typo (e.g. /tools/notpead/) blocks
// the build rather than shipping a broken backlink.
//
// Pages auto-render <RelatedNotes /> via BaseLayout, so we don't need to check
// that the destination page calls the component — only that the destination
// page exists at all.

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG_DIR = join(ROOT, 'src/content/blog');
const PAGES_DIR = join(ROOT, 'src/pages');
const CONTENT_BLOG_DIR = join(ROOT, 'src/content/blog');

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const RELATED_RE = /^related:\s*\[(.*?)\]/m;
const PATH_RE = /["']([^"']+)["']/g;

async function exists(path) {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

async function pageExists(urlPath) {
    const trimmed = urlPath.replace(/^\/+|\/+$/g, '');
    if (!trimmed) return true; // homepage

    // Blog posts live in the content collection, not in src/pages
    if (trimmed.startsWith('blog/')) {
        const slug = trimmed.slice('blog/'.length);
        const candidates = [
            join(CONTENT_BLOG_DIR, `${slug}.md`),
            join(CONTENT_BLOG_DIR, slug, 'index.md'),
        ];
        for (const c of candidates) {
            if (await exists(c)) return true;
        }
        return false;
    }

    // Astro routes: either `foo/index.astro` (directory) or `foo.astro` (file)
    const candidates = [
        join(PAGES_DIR, trimmed, 'index.astro'),
        join(PAGES_DIR, `${trimmed}.astro`),
    ];
    for (const c of candidates) {
        if (await exists(c)) return true;
    }
    return false;
}

function extractRelated(frontmatter) {
    const m = frontmatter.match(RELATED_RE);
    if (!m) return [];
    return Array.from(m[1].matchAll(PATH_RE)).map((m) => m[1]);
}

async function main() {
    const entries = await readdir(BLOG_DIR);
    const mdFiles = entries.filter((f) => f.endsWith('.md'));
    let totalChecked = 0;
    const broken = [];

    for (const file of mdFiles) {
        const full = join(BLOG_DIR, file);
        const content = await readFile(full, 'utf-8');
        const fmMatch = content.match(FRONTMATTER_RE);
        if (!fmMatch) continue;

        const related = extractRelated(fmMatch[1]);
        for (const path of related) {
            totalChecked++;
            if (!(await pageExists(path))) {
                broken.push({ file, path });
            }
        }
    }

    if (broken.length) {
        console.error(`\n[check-related-links] FAIL — ${broken.length} broken link(s):\n`);
        for (const { file, path } of broken) {
            console.error(`  ${file}`);
            console.error(`    related: "${path}" → no matching page in src/pages/\n`);
        }
        console.error(`Fix the typo, remove the entry, or create the destination page.\n`);
        process.exit(1);
    }

    console.log(
        `[check-related-links] OK — ${totalChecked} related links across ${mdFiles.length} posts.`,
    );
}

main().catch((err) => {
    console.error(`[check-related-links] threw:`, err);
    process.exit(1);
});
