// Recipes (Writers Room, Kyle 2026-10-18): Kyle's own standing instructions in plain English, one `recipe` note per file
// in the vault's `Recipes/` folder (title, use_for, the instruction as the body), used by name: a job's ask gets
// "Use the recipe [[Name]]." and any agent handed a recipe follows it on top of its usual rules.
import { Frontmatter } from './frontmatter.js';
import { basename } from './links.ts';
import { safeTitle } from './scenes.ts';
import { makeNote } from './vault-index.ts';
import { freePath } from './notes.ts';
import type { NoteRecord, VaultIndex, VaultSource } from './types.ts';

export const RECIPES_FOLDER = 'Recipes';

const str = (v: unknown) => (v == null ? '' : String(v).trim());

/** Every recipe in the vault, A to Z. */
export function recipeNotes(index: VaultIndex): NoteRecord[] {
  return Object.values(index.notes).filter((n) => n.type === 'recipe' && n.path.startsWith(RECIPES_FOLDER + '/'))
    .sort((a, b) => recipeName(a).localeCompare(recipeName(b)));
}

/** A recipe's name: its title, or else its file name. */
export function recipeName(n: NoteRecord): string {
  return str(n.data.title) || basename(n.path);
}

/** A job's ask with a recipe named in it, once. No recipe leaves the ask as it is. */
export function withRecipe(ask: string, name: string): string {
  const r = safeTitle(name);
  if (!r) return ask;
  const line = 'Use the recipe [[' + r + ']] (in the vault\'s Recipes folder) on top of your usual rules.';
  if (ask.indexOf('[[' + r + ']]') >= 0) return ask;
  return ask.trim() ? ask.trim() + '\n\n' + line : line;
}

export interface RecipeFields {
  title: string;
  use_for: string;
  /** The instruction in Kyle's words (the note's body). */
  body: string;
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function recipeText(r: RecipeFields, now: Date): string {
  const data: Record<string, unknown> = { type: 'recipe', title: r.title };
  if (str(r.use_for)) data.use_for = str(r.use_for).replace(/\s+/g, ' ');
  data.created = ymd(now);
  return Frontmatter.join(data, '\n' + r.body.trim() + '\n');
}

/** Write a new recipe as Kyle's commit. */
export async function createRecipe(source: VaultSource, r: RecipeFields, now: Date): Promise<NoteRecord> {
  if (!source.write) throw new Error('This vault cannot be changed from the app.');
  const title = safeTitle(r.title);
  if (!title) throw new Error('Give the recipe a name first.');
  if (!r.body.trim()) throw new Error('Write what the recipe tells the team to do.');
  for (let attempt = 0; ; attempt++) {
    const { files } = await source.tree();
    const path = freePath(RECIPES_FOLDER, title, files.map((f) => f.path));
    const text = recipeText({ ...r, title }, now);
    try {
      const sha = await source.write(path, text, '', 'recipes: add ' + title + '\n\nWritten in the Story Forge app.');
      return makeNote(path, sha, text);
    } catch (e) {
      if ((e as { conflict?: boolean }).conflict && attempt < 3) continue;
      throw e;
    }
  }
}

/** The recipe's text with a new use_for and instruction. Only those change: every other line Kyle wrote stays. */
export function editRecipeText(text: string, useFor: string, body: string): string {
  const p = Frontmatter.parse(text);
  if (p.error) throw new Error('This recipe\'s properties cannot be read (' + p.error + '). Fix it in Obsidian, then try again.');
  const u = str(useFor).replace(/\s+/g, ' ');
  let out = text;
  if (u) out = Frontmatter.setScalar(out, 'use_for', u);
  else if (p.data && p.data.use_for != null) {
    const s = Frontmatter.split(out);
    out = s.open + (s.yaml || '').split(/\r?\n/).filter((l: string) => !/^use_for[ \t]*:/.test(l)).join('\n') + s.close + s.body;
  }
  const s = Frontmatter.split(out);
  // An unchanged instruction keeps its own spacing, so a save with nothing new writes nothing.
  if (body.trim() === s.body.trim()) return out;
  return s.open + (s.yaml || '') + s.close + '\n' + body.trim() + '\n';
}

/** Save Kyle's changes to a recipe: re-read it, change use_for and the instruction, and, when he renamed it, move the
 * file to its new name (the old file goes only after the new one is saved). Returns the saved note. */
export async function saveRecipe(source: VaultSource, note: NoteRecord, r: RecipeFields): Promise<NoteRecord> {
  if (!source.write || !source.readFresh) throw new Error('This vault cannot be changed from the app.');
  if (!r.body.trim()) throw new Error('A recipe needs its instruction. Write it, or leave the recipe as it was.');
  const title = safeTitle(r.title) || recipeName(note);
  const { text, sha } = await source.readFresh(note.path);
  let next = editRecipeText(text, r.use_for, r.body);
  if (title === recipeName(note)) {
    if (next === text) return makeNote(note.path, sha, text);
    const newSha = await source.write(note.path, next, sha, 'recipes: edit ' + title + '\n\nEdited in the Story Forge app.');
    return makeNote(note.path, newSha, next);
  }
  if (!source.remove) throw new Error('This vault cannot rename notes from the app. Keep the old name, or rename it in Obsidian.');
  next = Frontmatter.setScalar(next, 'title', title);
  const { files } = await source.tree();
  const path = freePath(RECIPES_FOLDER, title, files.map((f) => f.path).filter((p) => p !== note.path));
  const newSha = await source.write(path, next, '', 'recipes: rename ' + recipeName(note) + ' to ' + title + '\n\nRenamed in the Story Forge app.');
  await source.remove(note.path, sha, 'recipes: rename ' + recipeName(note) + ' to ' + title + '\n\nThe recipe now lives in ' + path + '.');
  return makeNote(path, newSha, next);
}
