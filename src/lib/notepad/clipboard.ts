// Clipboard sanitization helpers for the quick notepad.
//
// Split out from _NotepadApp.tsx so the pure logic is testable without a
// React runtime. The two browser-only helpers (reencodeAsPng,
// writeImageToClipboard) are still exported here for colocation, but they
// require a real browser environment (createImageBitmap / canvas /
// ClipboardItem) and are exercised by manual QA, not unit tests.

// LocalStorage key for the copy-with-styles toggle.
export const KEEP_STYLES_KEY = 'wemee-notepad-keep-styles';

// Properties to clear when neutralizing a background. We list every longhand
// because (a) some CSS engines — including jsdom — leave residual longhands
// behind after `removeProperty('background')`, polluting the clipboard HTML,
// and (b) being explicit is a no-op cost in real browsers.
const BACKGROUND_PROPS = [
    'background',
    'background-color',
    'background-image',
    'background-position',
    'background-size',
    'background-repeat',
    'background-origin',
    'background-clip',
    'background-attachment',
] as const;

// Always-applied: remove anything that paints — or merely describes — a
// background, regardless of the keep-styles toggle.
export function stripBackground(el: HTMLElement): void {
    for (const prop of BACKGROUND_PROPS) {
        el.style.removeProperty(prop);
    }
}

// Plain-text mode: drop inline styles and classes entirely. `<img>` still
// keeps src/width/height attributes naturally — we only strip presentation
// hooks, not the image itself.
export function stripAllStyling(el: HTMLElement): void {
    el.removeAttribute('style');
    el.removeAttribute('class');
}

// Sanitize a cloned range fragment into the HTML string we'll put on the
// clipboard. Clones the fragment internally so callers can reuse it.
export function sanitizeFragmentToHtml(
    fragment: DocumentFragment,
    keepStyles: boolean
): string {
    const container = document.createElement('div');
    container.appendChild(fragment.cloneNode(true));

    const elements = container.querySelectorAll<HTMLElement>('*');
    elements.forEach((el) => {
        if (keepStyles) {
            stripBackground(el);
        } else {
            stripAllStyling(el);
        }
    });

    return container.innerHTML;
}

// Sanitize an HTML string coming from an external clipboard before we
// insert it into the editor. External sources (Google Sheets, Word, web
// pages) ship inline `color` / `background` / `font` declarations sized
// for *their* surface — black text on white. The notepad runs a dark
// theme, so honoring those styles makes pasted text invisible. We always
// strip presentation, regardless of the keep-styles copy toggle.
//
// What survives: semantic tags (<p>, <br>, <strong>, <em>, <ul>, <li>,
// <table>, <img>, …) and structural attributes like <img src>.
// What gets dropped: every <style>/<link>/<script>/<meta> node, every
// inline `style` attribute, every `class` attribute.
export function sanitizePastedHtml(html: string): string {
    const container = document.createElement('div');
    container.innerHTML = html;

    container
        .querySelectorAll('style, link, script, meta')
        .forEach((el) => el.remove());

    container
        .querySelectorAll<HTMLElement>('*')
        .forEach((el) => stripAllStyling(el));

    return container.innerHTML;
}

// Returns the `<img>` if the fragment is essentially just one image (no
// other meaningful text content). Used to decide whether to additionally
// write image/png to the clipboard.
export function findSoleImage(fragment: DocumentFragment): HTMLImageElement | null {
    const probe = document.createElement('div');
    probe.appendChild(fragment.cloneNode(true));

    const images = probe.querySelectorAll('img');
    if (images.length !== 1) return null;

    const text = probe.textContent?.trim() ?? '';
    if (text.length > 0) return null;

    return images[0];
}

// Re-encode an arbitrary image blob as PNG via canvas. ClipboardItem only
// supports image/png reliably across browsers, so we normalize. Browser-only.
export async function reencodeAsPng(blob: Blob): Promise<Blob> {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    ctx.drawImage(bitmap, 0, 0);
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('canvas.toBlob returned null'));
        }, 'image/png');
    });
}

// Write a single image to the system clipboard as image/png so it can be
// pasted into Photoshop, Figma, chat apps, etc. Destinations that only read
// raw image formats won't see the text/html version. Browser-only.
export async function writeImageToClipboard(img: HTMLImageElement): Promise<void> {
    const src = img.getAttribute('src') ?? '';
    if (!src.startsWith('data:image/')) return;

    try {
        const res = await fetch(src);
        const blob = await res.blob();
        const pngBlob = blob.type === 'image/png' ? blob : await reencodeAsPng(blob);
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob }),
        ]);
    } catch (err) {
        // Non-fatal: text/html is already on the clipboard via the sync path.
        console.warn('Failed to write image/png to clipboard:', err);
    }
}
