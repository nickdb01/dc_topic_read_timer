import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { parse } from "yaml";
let expected;
for (const file of (await readdir("locales")).filter((name) => name.endsWith(".yml")).sort()) {
  const locale = parse(await readFile(`locales/${file}`, "utf8"));
  const entries = Object.entries(locale);
  assert.equal(entries.length, 1);
  assert.equal(entries[0][0], file.slice(0, -4));
  const strings = entries[0][1].reading_requirement;
  assert.deepEqual(Object.keys(strings).sort(), ["check_failed", "explanation", "guidelines_prompt"]);
  for (const value of Object.values(strings)) { assert.equal(typeof value, "string"); }
  assert.ok(strings.explanation.includes("%{minutes}"), `missing minutes in ${file}`);
  expected = strings;
}
assert.ok(expected);
console.log("Locale keys and minute interpolation verified.");
