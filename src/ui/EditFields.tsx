import { useState } from 'preact/hooks';
import { label } from '../lib/format.ts';
import { enumValues, propDef } from '../lib/schema.ts';
import type { NoteRecord, Schema } from '../lib/types.ts';

/** The line after a field's name that says what the field is for. */
function hint(type: string, k: string): string {
  if (k === 'labels') return ' (separate them with commas, for example flashback, needs research)';
  if (type !== 'scene') return '';
  if (k === 'title') return ' (the file\'s name; the Summary below is what shows at the top of the scene)';
  if (k === 'headline') return ' (one line saying what happens, shown at the top of the scene; leave it empty and the team writes a new one from the scene)';
  if (k === 'summary') return ' (a few sentences for the team)';
  return '';
}

/** A card's own words, changed in place: one box per field, saved together through the write queue. */
export function EditFields({ schema, note, fields, onSave, onClose }: {
  schema: Schema;
  note: NoteRecord;
  fields: string[];
  onSave: (changed: Record<string, string>) => void;
  onClose: () => void;
}) {
  const start = (k: string) => (note.data[k] == null ? '' : Array.isArray(note.data[k]) ? (note.data[k] as unknown[]).join(', ') : String(note.data[k]));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((k) => [k, start(k)])));
  const save = () => {
    const changed: Record<string, string> = {};
    fields.forEach((k) => { if (values[k].replace(/\s+/g, ' ').trim() !== start(k).trim()) changed[k] = values[k]; });
    if (Object.keys(changed).length) onSave(changed);
    onClose();
  };
  return (
    <div class="edit-fields">
      {fields.map((k) => {
        const def = propDef(schema, note.type, k);
        const choices = enumValues(schema, def);
        const set = (v: string) => setValues({ ...values, [k]: v });
        return (
          <label key={k}>
            {note.type === 'scene' && k === 'summary' ? 'Longer summary' : label(k)}{hint(note.type, k)}
            {choices.length
              ? <select value={values[k]} onChange={(e) => set((e.currentTarget as HTMLSelectElement).value)}>
                {choices.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              : <textarea rows={Math.min(5, Math.max(2, Math.ceil(values[k].length / 45)))} value={values[k]}
                onInput={(e) => set((e.currentTarget as HTMLTextAreaElement).value)} />}
          </label>
        );
      })}
      <div class="buttons">
        <button type="button" class="primary" onClick={save}>Save</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
