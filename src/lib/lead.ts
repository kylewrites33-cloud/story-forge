// The blank lines between a note's properties and its words. The writing page, Beats mode and Sparrow Pocket all show a
// scene's words without them and put them back when the words go in; one function, so they always agree.

/** The editor shows the body without the blank line that follows the properties; this puts it back. */
export function splitLead(body: string): { lead: string; text: string } {
  const m = /^(\r?\n)+/.exec(body);
  const lead = m ? m[0] : '';
  return { lead, text: body.slice(lead.length) };
}
