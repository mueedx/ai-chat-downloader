// test/minidom.js
// A very small HTML parser and DOM, written for the tests only. It supports exactly the
// subset the extension uses: tag names, classes, ids, attribute selectors with =, ^= and
// *=, descendant combinators, comma-separated groups, and textContent. It lets the real
// adapter and renderer code be tested in Node with no browser and no dependency.

import { readFileSync } from 'node:fs';

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr', 'path'
]);

const ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'>`]+)))?/g;

class TextNode {
  constructor(value) {
    this.nodeType = 3;
    this.nodeValue = value;
    this.childNodes = [];
    this.parentNode = null;
  }

  get textContent() {
    return this.nodeValue;
  }
}

class Element {
  constructor(tagName) {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.childNodes = [];
    this.parentNode = null;
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.clientHeight = 0;
  }

  get children() {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }

  get className() {
    return this.getAttribute('class') || '';
  }

  getAttribute(name) {
    const value = this.attributes.get(name.toLowerCase());
    return value === undefined ? null : value;
  }

  setAttribute(name, value) {
    this.attributes.set(name.toLowerCase(), String(value));
  }

  hasAttribute(name) {
    return this.attributes.has(name.toLowerCase());
  }

  get textContent() {
    return this.childNodes.map((node) => node.textContent).join('');
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    return matchesAll(this, selector);
  }
}

class Document extends Element {
  constructor() {
    super('#document');
    this.documentElement = null;
  }

  get title() {
    const node = this.querySelector('title');
    return node ? node.textContent.trim() : '';
  }
}

function parseAttributes(source) {
  const attributes = new Map();
  ATTRIBUTE.lastIndex = 0;
  let match = ATTRIBUTE.exec(source);
  while (match) {
    const name = match[1].toLowerCase();
    const value = match[3] !== undefined ? match[3] : match[4] !== undefined ? match[4] : match[5];
    attributes.set(name, value === undefined ? '' : value);
    match = ATTRIBUTE.exec(source);
  }
  return attributes;
}

export function parseHtml(html) {
  const document = new Document();
  const stack = [document];
  let index = 0;

  const appendText = (text) => {
    if (!text) return;
    stack[stack.length - 1].childNodes.push(new TextNode(text));
  };

  while (index < html.length) {
    const next = html.indexOf('<', index);

    if (next === -1) {
      appendText(html.slice(index));
      break;
    }

    appendText(html.slice(index, next));

    if (html.startsWith('<!--', next)) {
      const end = html.indexOf('-->', next);
      index = end === -1 ? html.length : end + 3;
      continue;
    }

    if (html.startsWith('<!', next)) {
      const end = html.indexOf('>', next);
      index = end === -1 ? html.length : end + 1;
      continue;
    }

    const end = html.indexOf('>', next);
    if (end === -1) {
      appendText(html.slice(next));
      break;
    }

    const raw = html.slice(next + 1, end).trim();

    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim().toLowerCase();
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tagName.toLowerCase() === name) {
          stack.length = i;
          break;
        }
      }
      index = end + 1;
      continue;
    }

    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const spaceAt = body.search(/\s/);
    const tagName = (spaceAt === -1 ? body : body.slice(0, spaceAt)).toLowerCase();
    const element = new Element(tagName);

    for (const [name, value] of parseAttributes(spaceAt === -1 ? '' : body.slice(spaceAt))) {
      element.setAttribute(name, value);
    }

    if (tagName === 'html') document.documentElement = element;

    const parent = stack[stack.length - 1];
    element.parentNode = parent;
    parent.childNodes.push(element);

    if (!selfClosing && !VOID_TAGS.has(tagName)) stack.push(element);

    index = end + 1;
  }

  return document;
}

export function loadFixture(name) {
  return parseHtml(readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8'));
}

/** Parses one compound selector such as `div.a.b[attr="v"]`. Returns null if unsupported. */
function parseCompound(text) {
  // `*` is the universal selector. The diagnostic samples every element on a page, so the
  // tests have to be able to ask for all of them.
  if (text === '*') return { tag: null, universal: true, classes: [], id: null, attributes: [] };
  const compound = { tag: null, classes: [], id: null, attributes: [] };
  const pattern = /([.#]?[-\w]+|\[[^\]]+\])/g;
  let consumed = '';
  let match = pattern.exec(text);

  while (match) {
    const token = match[0];
    consumed += token;
    if (token.startsWith('.')) {
      compound.classes.push(token.slice(1));
    } else if (token.startsWith('#')) {
      compound.id = token.slice(1);
    } else if (token.startsWith('[')) {
      const body = token.slice(1, -1);
      const attribute = body.match(/^([-a-zA-Z0-9_:]+)(?:(=|\^=|\*=|\$=|~=)(.*))?$/);
      if (!attribute) return null;
      const raw = attribute[3] === undefined ? null : attribute[3];
      compound.attributes.push({
        name: attribute[1],
        operator: attribute[2] || null,
        value: raw === null ? null : raw.replace(/^["']|["']$/g, '')
      });
    } else if (/^[a-zA-Z]/.test(token)) {
      compound.tag = token.toLowerCase();
    } else {
      return null;
    }
    match = pattern.exec(text);
  }

  return consumed === text ? compound : null;
}

function parseSelector(selector) {
  return String(selector)
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean)
    .map((group) => {
      const parts = group.split(/\s+/).filter(Boolean);
      const compounds = parts.map(parseCompound);
      return compounds.includes(null) ? null : compounds;
    });
}

function matchesCompound(element, compound) {
  if (compound.tag && element.tagName.toLowerCase() !== compound.tag) return false;
  if (compound.id && element.getAttribute('id') !== compound.id) return false;
  for (const className of compound.classes) {
    if (!element.className.split(/\s+/).includes(className)) return false;
  }
  for (const attribute of compound.attributes) {
    const value = element.getAttribute(attribute.name);
    if (value === null) return false;
    if (attribute.operator === null) continue;
    if (attribute.operator === '=' && value !== attribute.value) return false;
    if (attribute.operator === '^=' && !value.startsWith(attribute.value)) return false;
    if (attribute.operator === '*=' && !value.includes(attribute.value)) return false;
    if (attribute.operator === '$=' && !value.endsWith(attribute.value)) return false;
    if (attribute.operator === '~=' && !value.split(/\s+/).includes(attribute.value)) return false;
  }
  return true;
}

function matchesChain(element, compounds) {
  let index = compounds.length - 1;
  if (!matchesCompound(element, compounds[index])) return false;
  index -= 1;

  let ancestor = element.parentNode;
  while (index >= 0 && ancestor) {
    if (ancestor.nodeType === 1 && matchesCompound(ancestor, compounds[index])) index -= 1;
    ancestor = ancestor.parentNode;
  }

  return index < 0;
}

function descendants(node, out) {
  for (const child of node.childNodes) {
    if (child.nodeType !== 1) continue;
    out.push(child);
    descendants(child, out);
  }
  return out;
}

function matchesAll(root, selector) {
  const groups = parseSelector(selector);
  // A browser throws on a selector it cannot parse, and dom.js reports that as `unsupported`
  // rather than as a count of zero. Returning an empty list here would make the two look alike.
  if (!groups.length || groups.includes(null)) {
    throw new SyntaxError('not a valid selector: ' + selector);
  }

  return descendants(root, []).filter((element) =>
    groups.some((chain) => matchesChain(element, chain))
  );
}

export { Element, TextNode, Document };