import { describe, it, expect } from 'vitest';
import {
    stripBackground,
    stripAllStyling,
    sanitizeFragmentToHtml,
    findSoleImage,
} from './clipboard';

// Build a DocumentFragment from an HTML string. <template>.content is itself
// a DocumentFragment, which is exactly what range.cloneContents() returns.
function makeFragment(html: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
}

describe('stripBackground', () => {
    it('removes background-color, background, and background-image', () => {
        const el = document.createElement('div');
        el.setAttribute(
            'style',
            'color:red; background-color:blue; background-image:url(a.png)'
        );
        stripBackground(el);

        expect(el.style.backgroundColor).toBe('');
        expect(el.style.backgroundImage).toBe('');
        expect(el.getAttribute('style') ?? '').not.toMatch(/background/i);
        // unrelated styles survive
        expect(el.style.color).toBe('red');
    });

    it('strips the shorthand `background` form', () => {
        const el = document.createElement('div');
        el.setAttribute('style', 'background: red');
        stripBackground(el);
        expect(el.getAttribute('style') ?? '').not.toMatch(/background/i);
    });

    it('is a no-op when no background is set', () => {
        const el = document.createElement('div');
        el.style.color = 'red';
        stripBackground(el);
        expect(el.style.color).toBe('red');
    });
});

describe('stripAllStyling', () => {
    it('removes both style and class attributes', () => {
        const el = document.createElement('div');
        el.setAttribute('style', 'color:red');
        el.setAttribute('class', 'foo bar');
        stripAllStyling(el);
        expect(el.hasAttribute('style')).toBe(false);
        expect(el.hasAttribute('class')).toBe(false);
    });

    it('does not affect other attributes', () => {
        const el = document.createElement('img');
        el.setAttribute('src', 'data:image/png;base64,X');
        el.setAttribute('style', 'border:1px solid');
        el.setAttribute('class', 'big');
        stripAllStyling(el);
        expect(el.getAttribute('src')).toBe('data:image/png;base64,X');
    });
});

describe('sanitizeFragmentToHtml — keepStyles = true', () => {
    it('strips background-color from inline style', () => {
        const f = makeFragment(
            '<span style="background-color:yellow; color:red">hi</span>'
        );
        const html = sanitizeFragmentToHtml(f, true);
        expect(html).not.toMatch(/background/i);
        expect(html).toMatch(/color:\s*red/);
    });

    it('strips shorthand `background`', () => {
        const f = makeFragment(
            '<span style="background:linear-gradient(red,blue)">hi</span>'
        );
        const html = sanitizeFragmentToHtml(f, true);
        expect(html).not.toMatch(/background/i);
    });

    it('strips background-image', () => {
        const f = makeFragment(
            '<span style="background-image:url(x.png)">hi</span>'
        );
        const html = sanitizeFragmentToHtml(f, true);
        expect(html).not.toMatch(/background/i);
    });

    it('also strips background from nested elements', () => {
        const f = makeFragment(
            '<span style="background-color:#222">' +
                '<strong style="color:white; background-color:#444">text</strong>' +
                '</span>'
        );
        const html = sanitizeFragmentToHtml(f, true);
        expect(html).not.toMatch(/background/i);
        expect(html).toMatch(/<strong/);
        expect(html).toMatch(/color:\s*white/);
    });

    it('preserves <strong> and <em> tags', () => {
        const f = makeFragment('<strong><em>hi</em></strong>');
        const html = sanitizeFragmentToHtml(f, true);
        expect(html).toContain('<strong');
        expect(html).toContain('<em');
    });

    it('preserves <img> with src', () => {
        const f = makeFragment(
            '<img src="data:image/png;base64,iVBOR" alt="">'
        );
        const html = sanitizeFragmentToHtml(f, true);
        expect(html).toContain('src="data:image/png');
    });
});

describe('sanitizeFragmentToHtml — keepStyles = false', () => {
    it('removes the style attribute entirely', () => {
        const f = makeFragment(
            '<span style="color:red; font-weight:bold">hi</span>'
        );
        const html = sanitizeFragmentToHtml(f, false);
        expect(html).not.toContain('style=');
        expect(html).toContain('>hi<');
    });

    it('removes the class attribute', () => {
        const f = makeFragment('<span class="foo">hi</span>');
        const html = sanitizeFragmentToHtml(f, false);
        expect(html).not.toContain('class=');
    });

    it('keeps <img> with src but drops its class', () => {
        const f = makeFragment(
            '<p>hi <img src="data:image/png;base64,X" class="floating"></p>'
        );
        const html = sanitizeFragmentToHtml(f, false);
        expect(html).toContain('<img');
        expect(html).toContain('src="data:image/png');
        expect(html).not.toContain('class=');
    });

    it('keeps semantic tags but drops their inline styles', () => {
        const f = makeFragment(
            '<strong style="color:red"><em style="font-style:italic">hi</em></strong>'
        );
        const html = sanitizeFragmentToHtml(f, false);
        expect(html).toContain('<strong');
        expect(html).toContain('<em');
        expect(html).not.toContain('color');
        expect(html).not.toContain('font-style');
    });
});

describe('sanitizeFragmentToHtml — input isolation', () => {
    it('does not mutate the input fragment', () => {
        const f = makeFragment(
            '<span style="background-color:red; color:blue">hi</span>'
        );
        const styleBefore = (f.firstChild as HTMLElement).getAttribute('style');
        sanitizeFragmentToHtml(f, true);
        const styleAfter = (f.firstChild as HTMLElement).getAttribute('style');
        expect(styleAfter).toBe(styleBefore);
    });
});

describe('findSoleImage', () => {
    it('returns the img when the fragment is just one image', () => {
        const f = makeFragment('<img src="data:image/png;base64,X">');
        const result = findSoleImage(f);
        expect(result).not.toBeNull();
        expect(result?.getAttribute('src')).toBe('data:image/png;base64,X');
    });

    it('returns the img when wrapped in <p>', () => {
        const f = makeFragment('<p><img src="data:image/png;base64,X"></p>');
        expect(findSoleImage(f)).not.toBeNull();
    });

    it('treats whitespace-only surrounding text as empty', () => {
        const f = makeFragment(
            '<p>   <img src="data:image/png;base64,X">   </p>'
        );
        expect(findSoleImage(f)).not.toBeNull();
    });

    it('returns null when there is real text alongside the image', () => {
        const f = makeFragment(
            '<p>hello <img src="data:image/png;base64,X"></p>'
        );
        expect(findSoleImage(f)).toBeNull();
    });

    it('returns null when there are multiple images', () => {
        const f = makeFragment(
            '<img src="data:image/png;base64,a"><img src="data:image/png;base64,b">'
        );
        expect(findSoleImage(f)).toBeNull();
    });

    it('returns null when there is no image', () => {
        const f = makeFragment('<p>just text</p>');
        expect(findSoleImage(f)).toBeNull();
    });

    it('does not consume the input fragment', () => {
        const f = makeFragment('<img src="data:image/png;base64,X">');
        findSoleImage(f);
        expect(f.childNodes.length).toBeGreaterThan(0);
    });
});
