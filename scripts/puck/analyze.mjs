// Static analysis shared by generate.mjs and verify.mjs: reads every story tagged `puck`, its
// Angular component (via the TypeScript type checker and Angular's template parser) and builds a
// model of Puck blocks. Nothing is executed: no Angular, no Storybook, no browser.

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';
import { parseTemplate, TmplAstContent } from '@angular/compiler';
import { config } from './config.mjs';

/** Keys allowed in a story's `parameters.puck` block. Anything else is reported (catches typos). */
const PUCK_PARAM_KEYS = new Set(['category', 'label', 'type', 'fields', 'exclude']);
const FIELD_OVERRIDES = new Set(['text', 'textarea', 'number', 'radio', 'select']);

class DynamicValueError extends Error {}

/**
 * @param {string} root repository root
 * @returns {{ blocks: Block[], skipped: string[] }}
 */
export function analyze(root) {
  const cfgPath = resolve(root, config.storiesTsconfig);
  const parsed = ts.getParsedCommandLineOfConfigFile(cfgPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    },
  });
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const libraryExports = readLibraryExports(program, checker, resolve(root, config.libraryEntry));

  const blocks = [];
  const skipped = [];

  for (const sf of program.getSourceFiles()) {
    if (!sf.fileName.endsWith('.stories.ts') || sf.fileName.includes('/node_modules/')) continue;
    const storyFile = relative(root, sf.fileName);
    const block = analyzeStory(sf, storyFile, checker, libraryExports, root);
    if (block === null) skipped.push(storyFile);
    else blocks.push(block);
  }

  blocks.sort((a, b) => a.name.localeCompare(b.name));
  checkDuplicates(blocks, 'name', 'block type');
  checkDuplicates(blocks, 'tag', 'custom element tag');
  skipped.sort();
  return { blocks, skipped };
}

/** Returns null when the story is not opted in (no `puck` tag). */
function analyzeStory(sf, storyFile, checker, libraryExports, root) {
  const block = {
    name: '', label: '', category: config.defaultCategory, storyFile,
    component: '', componentFile: '', exportName: '', selector: '', tag: '',
    props: [], excluded: [], slot: null, outputs: [],
    diagnostics: [],
  };
  const error = (message) => block.diagnostics.push({ level: 'error', message });
  const warn = (message) => block.diagnostics.push({ level: 'warning', message });

  const metaNode = findDefaultExportObject(sf, checker);
  if (!metaNode) {
    // Can't even read the tags: only report if the file mentions the tag at all.
    if (sf.text.includes(`'${config.tag}'`) || sf.text.includes(`"${config.tag}"`)) {
      block.name = storyFile;
      error('story default export (meta) is not a static object literal');
      return block;
    }
    return null;
  }

  const meta = readStatic(metaNode, ['title', 'tags', 'args', 'argTypes'], error);
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  if (!tags.includes(config.tag)) return null;

  const puck = readPuckParameters(metaNode, error);
  const args = isPlainObject(meta.args) ? meta.args : {};
  const argTypes = isPlainObject(meta.argTypes) ? meta.argTypes : {};

  // --- component -----------------------------------------------------------------------------
  const componentProp = getProperty(metaNode, 'component');
  if (!componentProp || !ts.isIdentifier(componentProp.initializer)) {
    block.name = storyFile;
    error('meta.component must be set to the component class');
    return block;
  }
  const classDecl = resolveClass(componentProp.initializer, checker);
  if (!classDecl) {
    block.name = storyFile;
    error(`cannot resolve component class "${componentProp.initializer.text}"`);
    return block;
  }
  block.component = classDecl.name?.text ?? '';
  block.componentFile = relative(root, classDecl.getSourceFile().fileName);
  block.exportName = libraryExports.get(classDecl) ?? '';
  if (!block.exportName) error(`${block.component} is not exported from ${config.libraryEntry}`);

  const decorator = readComponentDecorator(classDecl, error);
  block.selector = decorator.selector ?? '';
  const selectorRe = new RegExp(`^${escapeRe(config.selectorPrefix)}[a-z][a-z0-9-]*$`);
  if (!selectorRe.test(block.selector)) {
    error(`selector "${block.selector}" must be a single element selector starting with "${config.selectorPrefix}"`);
  }
  const bare = block.selector.slice(config.selectorPrefix.length);
  block.tag = config.tagPrefix + bare;
  block.name = puck.type ?? pascalCase(bare || block.component);
  if (!/^[A-Z][A-Za-z0-9]*$/.test(block.name)) error(`block type "${block.name}" must be PascalCase`);
  block.label = puck.label ?? block.name;
  block.category = puck.category ?? config.defaultCategory;
  if (!puck.category) warn(`no parameters.puck.category, using "${config.defaultCategory}"`);

  if (decorator.standalone === false) error('component must be standalone');
  if (decorator.hasHostDirectives) warn('hostDirectives: inputs of host directives are not detected');
  if (classDecl.heritageClauses?.some((h) => h.token === ts.SyntaxKind.ExtendsKeyword)) {
    warn('component extends a base class: inherited inputs are not detected');
  }
  if (/from\s+['"]@angular\/router['"]/.test(classDecl.getSourceFile().text)) {
    warn('imports @angular/router: the elements build has no router unless you provide one');
  }
  if (usesInject(classDecl)) {
    warn('injects services: make sure they are provided in projects/elements/src/main.ts (runtime smoke test catches gaps)');
  }

  // --- template: <ng-content> ------------------------------------------------------------------
  const template = readTemplate(decorator, classDecl, error);
  if (template !== null) {
    const contents = findContentSlots(template, block.componentFile, error);
    if (contents.length > 1 || contents.some((s) => s !== '*')) {
      error(`only one default <ng-content> is supported (found: ${contents.map((s) => `select="${s}"`).join(', ')})`);
    } else if (contents.length === 1) {
      block.slot = 'content';
    }
  }

  // --- inputs & outputs ------------------------------------------------------------------------
  const { inputs, outputs } = readMembers(classDecl, checker, error, warn);
  block.outputs = outputs.sort();
  const exclude = new Set(Array.isArray(puck.exclude) ? puck.exclude : []);
  const fieldOverrides = isPlainObject(puck.fields) ? puck.fields : {};

  for (const name of exclude) {
    if (!inputs.some((i) => i.name === name)) error(`parameters.puck.exclude: "${name}" is not an input`);
  }
  for (const name of Object.keys(fieldOverrides)) {
    if (!inputs.some((i) => i.name === name)) error(`parameters.puck.fields: "${name}" is not an input`);
  }
  if (block.slot && inputs.some((i) => i.name === block.slot)) {
    error(`input "${block.slot}" clashes with the generated slot field of the same name`);
  }
  for (const key of Object.keys(args)) {
    if (!inputs.some((i) => i.name === key) && !outputs.includes(key)) warn(`story arg "${key}" is not an input`);
  }

  for (const input of inputs) {
    if (exclude.has(input.name)) {
      block.excluded.push(input.name);
      continue;
    }
    const prop = buildProp(input, args, argTypes[input.name], fieldOverrides[input.name], error, warn);
    if (prop) block.props.push(prop);
  }
  block.excluded.sort();
  return block;
}

// ---------------------------------------------------------------------------------------------
// Props & fields
// ---------------------------------------------------------------------------------------------

function buildProp(input, args, argType, override, error, warn) {
  const where = `input "${input.name}"`;
  if (input.kind === 'unsupported') {
    error(`${where}: type "${input.tsType}" can't be edited in Puck - exclude it via parameters.puck.exclude`);
    return null;
  }

  // Default: story arg (realistic content) > component default.
  let value;
  if (Object.hasOwn(args, input.name)) value = args[input.name];
  else if (input.hasDefault) value = input.default;
  else {
    error(`${where}: no default - add it to the story's args (required inputs need one too)`);
    return null;
  }
  if (!matchesKind(value, input)) {
    error(`${where}: default ${JSON.stringify(value)} doesn't match type "${input.tsType}"`);
    return null;
  }

  // argTypes.options must agree with the TypeScript union (catches stories drifting from the component).
  if (input.kind === 'enum' && Array.isArray(argType?.options)) {
    const a = [...argType.options].map(String).sort();
    const b = [...input.options].map(String).sort();
    if (a.join('|') !== b.join('|')) {
      error(`${where}: argTypes.options [${a}] don't match the type's options [${b}]`);
    }
  }

  const control = typeof argType?.control === 'string' ? { type: argType.control } : argType?.control ?? {};
  let field;
  switch (input.kind) {
    case 'string': {
      const type = override ?? 'text';
      if (type !== 'text' && type !== 'textarea') return badOverride();
      field = { type };
      if (type === 'text' && String(value).length > config.longTextWarning) {
        warn(`${where}: long default text - consider parameters.puck.fields.${input.name} = 'textarea'`);
      }
      break;
    }
    case 'number': {
      if (override && override !== 'number') return badOverride();
      field = { type: 'number' };
      for (const k of ['min', 'max', 'step']) if (typeof control[k] === 'number') field[k] = control[k];
      break;
    }
    case 'boolean': {
      if (override && override !== 'radio') return badOverride();
      field = { type: 'radio', options: [{ label: 'yes', value: true }, { label: 'no', value: false }] };
      break;
    }
    case 'enum': {
      if (override && override !== 'radio' && override !== 'select') return badOverride();
      const fromControl = control.type === 'radio' || control.type === 'inline-radio' ? 'radio'
        : control.type === 'select' ? 'select' : null;
      const type = override ?? fromControl ?? (input.options.length <= 3 ? 'radio' : 'select');
      field = { type, options: input.options.map((v) => ({ label: String(v), value: v })) };
      break;
    }
  }
  return { name: input.name, kind: input.kind, tsType: input.tsType, options: input.options, field, default: value };

  function badOverride() {
    error(`${where}: field override "${override}" doesn't fit type "${input.tsType}"`);
    return null;
  }
}

function matchesKind(value, input) {
  switch (input.kind) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number';
    case 'boolean': return typeof value === 'boolean';
    case 'enum': return input.options.includes(value);
    default: return false;
  }
}

/** Maps a TypeScript type onto one of the supported kinds. */
function classifyType(type, checker, typeNode) {
  const tsType = checker.typeToString(type);
  let parts = type.isUnion() ? type.types : [type];
  parts = parts.filter((t) => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)));
  if (parts.length === 0) return { kind: 'unsupported', tsType };

  const all = (flag) => parts.every((t) => t.flags & flag);
  if (all(ts.TypeFlags.BooleanLiteral) || all(ts.TypeFlags.Boolean)) return { kind: 'boolean', tsType };
  if (parts.length === 1 && parts[0].flags & ts.TypeFlags.String) return { kind: 'string', tsType };
  if (parts.length === 1 && parts[0].flags & ts.TypeFlags.Number) return { kind: 'number', tsType };
  if (all(ts.TypeFlags.StringLiteral) || all(ts.TypeFlags.NumberLiteral)) {
    // The checker's union order depends on which file it saw first, so unrelated changes could
    // reorder options. Use the order written in the source declaration instead (sorted as fallback).
    const values = parts.map((t) => t.value);
    const written = literalsInSourceOrder(typeNode, checker);
    const sameSet = written && written.length === values.length && values.every((v) => written.includes(v));
    return { kind: 'enum', tsType, options: sameSet ? written : [...values].sort() };
  }
  return { kind: 'unsupported', tsType };
}

/** Literal values of a union type node, following type aliases, in the order they are written. */
function literalsInSourceOrder(node, checker, depth = 0) {
  if (!node || depth > 5) return null;
  if (ts.isParenthesizedTypeNode(node)) return literalsInSourceOrder(node.type, checker, depth + 1);
  if (ts.isLiteralTypeNode(node)) {
    if (ts.isStringLiteral(node.literal)) return [node.literal.text];
    if (ts.isNumericLiteral(node.literal)) return [Number(node.literal.text)];
    return null;
  }
  if (ts.isUnionTypeNode(node)) {
    const out = [];
    for (const t of node.types) {
      const part = literalsInSourceOrder(t, checker, depth + 1);
      if (part === null) {
        if (t.kind === ts.SyntaxKind.UndefinedKeyword || (ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword)) continue;
        return null;
      }
      out.push(...part);
    }
    return out;
  }
  if (ts.isTypeReferenceNode(node)) {
    let symbol = checker.getSymbolAtLocation(node.typeName);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const decl = symbol?.declarations?.find(ts.isTypeAliasDeclaration);
    return decl ? literalsInSourceOrder(decl.type, checker, depth + 1) : null;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Component class
// ---------------------------------------------------------------------------------------------

function readMembers(classDecl, checker, error, warn) {
  const inputs = [];
  const outputs = [];
  for (const member of classDecl.members) {
    if (!ts.isPropertyDeclaration(member) || !member.name || !ts.isIdentifier(member.name)) continue;
    const name = member.name.text;
    const init = member.initializer;
    const decorators = (ts.getDecorators(member) ?? []).map(decoratorName);

    // Signal APIs: input(), input.required(), model(), output()
    const callee = init && ts.isCallExpression(init) ? calleeName(init.expression) : null;
    if (callee === 'output' || decorators.includes('Output')) {
      outputs.push(name);
      continue;
    }
    const isSignalInput = callee === 'input' || callee === 'input.required' || callee === 'model' || callee === 'model.required';
    if (!isSignalInput && !decorators.includes('Input')) continue;
    if (callee?.startsWith('model')) warn(`input "${name}": model() is treated as a plain input`);

    let readType;
    let hasDefault = false;
    let defaultValue;
    if (isSignalInput) {
      const signalType = checker.getTypeAtLocation(member.name);
      readType = checker.getTypeArguments(signalType)[0];
      const required = callee.endsWith('.required');
      const [first, second] = init.arguments;
      const optionsArg = required ? first : second;
      if (optionsArg && ts.isObjectLiteralExpression(optionsArg) && getProperty(optionsArg, 'alias')) {
        error(`input "${name}": aliases are not supported`);
      }
      if (!required && first) {
        try {
          defaultValue = evaluate(first);
          hasDefault = true;
        } catch {
          // non-literal default (e.g. a constant) → the story must provide an arg
        }
      }
    } else {
      readType = checker.getTypeAtLocation(member.name);
      const inputDecorator = ts.getDecorators(member).find((d) => decoratorName(d) === 'Input');
      if (ts.isCallExpression(inputDecorator.expression) && inputDecorator.expression.arguments.length) {
        const arg = inputDecorator.expression.arguments[0];
        if (ts.isStringLiteral(arg) || (ts.isObjectLiteralExpression(arg) && getProperty(arg, 'alias'))) {
          error(`input "${name}": aliases are not supported`);
        }
      }
      if (init) {
        try {
          defaultValue = evaluate(init);
          hasDefault = true;
        } catch {}
      }
    }
    if (!readType) {
      error(`input "${name}": cannot determine its type`);
      continue;
    }
    const typeNode = isSignalInput ? init.typeArguments?.[0] : member.type;
    inputs.push({ name, hasDefault, default: defaultValue, ...classifyType(readType, checker, typeNode) });
  }
  inputs.sort((a, b) => a.name.localeCompare(b.name));
  return { inputs, outputs };
}

function readComponentDecorator(classDecl, error) {
  const decorator = (ts.getDecorators(classDecl) ?? []).find((d) => decoratorName(d) === 'Component');
  const result = { selector: undefined, template: undefined, templateUrl: undefined, standalone: undefined, hasHostDirectives: false };
  if (!decorator || !ts.isCallExpression(decorator.expression)) {
    error('class has no @Component decorator');
    return result;
  }
  const arg = decorator.expression.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) {
    error('@Component() argument must be an object literal');
    return result;
  }
  for (const key of ['selector', 'template', 'templateUrl', 'standalone']) {
    const prop = getProperty(arg, key);
    if (!prop) continue;
    try {
      result[key] = evaluate(prop.initializer);
    } catch {
      error(`@Component.${key} must be a literal`);
    }
  }
  result.hasHostDirectives = !!getProperty(arg, 'hostDirectives');
  return result;
}

function readTemplate(decorator, classDecl, error) {
  if (typeof decorator.template === 'string') return decorator.template;
  if (typeof decorator.templateUrl === 'string') {
    const file = resolve(dirname(classDecl.getSourceFile().fileName), decorator.templateUrl);
    try {
      return readFileSync(file, 'utf8');
    } catch {
      error(`templateUrl "${decorator.templateUrl}" not found`);
      return null;
    }
  }
  error('component has neither template nor templateUrl');
  return null;
}

/** Selectors of all <ng-content> elements, including ones nested in control-flow blocks. */
function findContentSlots(template, url, error) {
  const parsed = parseTemplate(template, url, {});
  if (parsed.errors?.length) {
    error(`template parse error: ${parsed.errors[0].msg}`);
    return [];
  }
  const found = [];
  const seen = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (node instanceof TmplAstContent) found.push(node.selector);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object' && 'sourceSpan' in value) walk(value);
    }
  };
  parsed.nodes.forEach(walk);
  return found;
}

function usesInject(classDecl) {
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'inject') found = true;
    if (ts.isConstructorDeclaration(node) && node.parameters.length > 0) found = true;
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(classDecl, visit);
  return found;
}

function readLibraryExports(program, checker, entryFile) {
  const map = new Map();
  const sf = program.getSourceFile(entryFile);
  if (!sf) return map;
  const moduleSymbol = checker.getSymbolAtLocation(sf);
  if (!moduleSymbol) return map;
  for (const exp of checker.getExportsOfModule(moduleSymbol)) {
    const target = exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
    const decl = target.valueDeclaration;
    if (decl && ts.isClassDeclaration(decl)) map.set(decl, exp.name);
  }
  return map;
}

function resolveClass(identifier, checker) {
  let symbol = checker.getSymbolAtLocation(identifier);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const decl = symbol?.valueDeclaration;
  return decl && ts.isClassDeclaration(decl) ? decl : null;
}

// ---------------------------------------------------------------------------------------------
// Story meta (static evaluation only)
// ---------------------------------------------------------------------------------------------

function findDefaultExportObject(sf, checker) {
  for (const stmt of sf.statements) {
    if (!ts.isExportAssignment(stmt) || stmt.isExportEquals) continue;
    let expr = unwrap(stmt.expression);
    if (ts.isIdentifier(expr)) {
      const decl = checker.getSymbolAtLocation(expr)?.valueDeclaration;
      if (!decl || !ts.isVariableDeclaration(decl) || !decl.initializer) return null;
      expr = unwrap(decl.initializer);
    }
    return ts.isObjectLiteralExpression(expr) ? expr : null;
  }
  return null;
}

function readStatic(objectNode, keys, error) {
  const out = {};
  for (const key of keys) {
    const prop = getProperty(objectNode, key);
    if (!prop) continue;
    try {
      out[key] = evaluate(prop.initializer);
    } catch (e) {
      error(`meta.${key} must be static (literals only): ${e.message}`);
    }
  }
  return out;
}

function readPuckParameters(metaNode, error) {
  const params = getProperty(metaNode, 'parameters');
  if (!params) return {};
  const paramsObj = unwrap(params.initializer);
  if (!ts.isObjectLiteralExpression(paramsObj)) {
    error('meta.parameters must be an object literal');
    return {};
  }
  const puckProp = getProperty(paramsObj, 'puck');
  if (!puckProp) return {};
  let puck;
  try {
    puck = evaluate(puckProp.initializer);
  } catch (e) {
    error(`parameters.puck must be static (literals only): ${e.message}`);
    return {};
  }
  if (!isPlainObject(puck)) {
    error('parameters.puck must be an object');
    return {};
  }
  for (const key of Object.keys(puck)) {
    if (!PUCK_PARAM_KEYS.has(key)) error(`parameters.puck.${key} is not a known option (${[...PUCK_PARAM_KEYS].join(', ')})`);
  }
  for (const [name, value] of Object.entries(isPlainObject(puck.fields) ? puck.fields : {})) {
    if (!FIELD_OVERRIDES.has(value)) error(`parameters.puck.fields.${name}: "${value}" must be one of ${[...FIELD_OVERRIDES].join(', ')}`);
  }
  return puck;
}

/** Evaluates literal-only expressions; throws DynamicValueError for anything else. */
function evaluate(node) {
  node = unwrap(node);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((e) => {
      if (ts.isSpreadElement(e)) throw new DynamicValueError('spread');
      return evaluate(e);
    });
  }
  if (ts.isObjectLiteralExpression(node)) {
    const obj = {};
    for (const p of node.properties) {
      if (!ts.isPropertyAssignment(p)) throw new DynamicValueError(ts.SyntaxKind[p.kind]);
      const key = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) || ts.isNumericLiteral(p.name) ? p.name.text : null;
      if (key === null) throw new DynamicValueError('computed key');
      obj[key] = evaluate(p.initializer);
    }
    return obj;
  }
  throw new DynamicValueError(`"${node.getText().slice(0, 40)}"`);
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function unwrap(node) {
  while (
    ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)
  ) node = node.expression;
  return node;
}

function getProperty(objectNode, name) {
  return objectNode.properties.find(
    (p) => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === name,
  );
}

function decoratorName(decorator) {
  const expr = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression;
  return ts.isIdentifier(expr) ? expr.text : '';
}

function calleeName(expr) {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) return `${expr.expression.text}.${expr.name.text}`;
  return null;
}

function checkDuplicates(blocks, key, what) {
  const seen = new Map();
  for (const block of blocks) {
    if (!block[key]) continue;
    const other = seen.get(block[key]);
    if (other) {
      block.diagnostics.push({ level: 'error', message: `duplicate ${what} "${block[key]}" (also used by ${other.storyFile})` });
    } else seen.set(block[key], block);
  }
}

const pascalCase = (s) => s.split('-').filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * @typedef {{ name: string, kind: 'string'|'number'|'boolean'|'enum', tsType: string, options?: (string|number)[],
 *             field: object, default: unknown }} Prop
 * @typedef {{ name: string, label: string, category: string, storyFile: string, component: string,
 *             componentFile: string, exportName: string, selector: string, tag: string, props: Prop[],
 *             excluded: string[], slot: string|null, outputs: string[],
 *             diagnostics: { level: 'error'|'warning', message: string }[] }} Block
 */
