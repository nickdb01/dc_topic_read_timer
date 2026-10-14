import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Preprocessor } from "content-tag";

const preprocessor = new Preprocessor();
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await check(filename);
    } else if (filename.endsWith(".gjs")) {
      preprocessor.process(await readFile(filename, "utf8"), { filename });
      console.log(`Compiled: ${filename}`);
    }
  }
}
await check("javascripts");
