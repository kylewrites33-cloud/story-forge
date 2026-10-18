// Recipes (Writers Room, Kyle 2026-10-18): Kyle's standing instructions, used by name. The page lists the vault's Recipes
// notes with Add and Edit; RecipePicker is the "with a recipe" choice beside the jobs that take Kyle's words.
import { useState } from 'preact/hooks';
import { render } from '../lib/markdown.ts';
import { recipeName, recipeNotes, type RecipeFields } from '../lib/recipes.ts';
import type { NoteRecord, VaultIndex } from '../lib/types.ts';
import { Icon } from './Icon.tsx';

export type OnAddRecipe = (r: RecipeFields) => Promise<string | null>;
export type OnSaveRecipe = (note: NoteRecord, r: RecipeFields) => Promise<string | null>;

function RecipeForm({ start, onSave, onDone, saveLabel }: {
  start: RecipeFields; onSave: (r: RecipeFields) => Promise<string | null>; onDone: () => void; saveLabel: string;
}) {
  const [r, setR] = useState<RecipeFields>(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof RecipeFields) => (e: Event) => setR({ ...r, [k]: (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value });
  const go = async () => {
    setBusy(true);
    const err = await onSave(r);
    setBusy(false);
    setError(err);
    if (!err) onDone();
  };
  return (
    <form class="note-form" onSubmit={(e) => { e.preventDefault(); if (!busy && r.title.trim() && r.body.trim()) go(); }}>
      <label class="reason">Name (the team uses it by this name)
        <input type="text" value={r.title} placeholder="For example Chapter-End Hook" onInput={set('title')} />
      </label>
      <label class="reason">What it is for, in a few words
        <input type="text" value={r.use_for} placeholder="For example the last lines of a chapter" onInput={set('use_for')} />
      </label>
      <label class="reason">The instruction, in your words
        <textarea rows={6} value={r.body} placeholder="What the team should do every time it uses this recipe." onInput={set('body')} />
      </label>
      <div class="buttons">
        <button type="submit" class="primary" disabled={busy || !r.title.trim() || !r.body.trim()}>{busy ? 'Saving…' : saveLabel}</button>
        <button type="button" onClick={onDone}>Cancel</button>
      </div>
      {error && <p class="error">{error}</p>}
    </form>
  );
}

export function RecipesScreen({ index, onAdd, onSave }: { index: VaultIndex; onAdd?: OnAddRecipe; onSave?: OnSaveRecipe }) {
  const list = recipeNotes(index);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState('');
  return (
    <section class="recipes-screen">
      <div class="chat-head">
        <h1>Recipes</h1>
        {onAdd && !adding && <button type="button" class="primary" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> New recipe</button>}
      </div>
      <p class="meta">
        Your own standing instructions, used by name: "draft chapter 4 with the Chapter-End Hook recipe". In the writing screen's Team tab,
        pick one under "With a recipe" and the job tells the team to use it. They live in the vault's Recipes folder, for every book.
      </p>
      {adding && onAdd && <RecipeForm start={{ title: '', use_for: '', body: '' }} saveLabel="Add the recipe" onSave={onAdd} onDone={() => setAdding(false)} />}
      {!list.length && !adding && (
        <div class="empty-box">
          <h2>No recipes yet</h2>
          <p>Write down something you ask for again and again, like how a chapter should end or how a stat block looks.</p>
          {onAdd && <div class="buttons"><button type="button" class="primary" onClick={() => setAdding(true)}>Write the first recipe</button></div>}
        </div>
      )}
      <ul class="note-list">
        {list.map((n) => (
          <li key={n.path} class="note-card recipe-card">
            {editing === n.path && onSave ? (
              <RecipeForm start={{ title: recipeName(n), use_for: String(n.data.use_for || ''), body: n.body.trim() }} saveLabel="Save"
                onSave={(r) => onSave(n, r)} onDone={() => setEditing('')} />
            ) : (
              <>
                <h3>{recipeName(n)}</h3>
                {n.data.use_for != null && <p class="meta">For {String(n.data.use_for)}</p>}
                <div class="prose" dangerouslySetInnerHTML={{ __html: render(n.body) }} />
                {onSave && !n.error && <div class="buttons"><button type="button" onClick={() => setEditing(n.path)}><Icon name="pen" size={18} /> Edit</button></div>}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "With a recipe": a choice of the vault's recipes for the next job; '' is none. */
export function RecipePicker({ names, value, onChange }: { names: string[]; value: string; onChange: (name: string) => void }) {
  if (!names.length) return null;
  return (
    <label class="reason recipe-picker">With a recipe
      <select value={value} onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value)}>
        <option value="">No recipe</option>
        {names.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
}
