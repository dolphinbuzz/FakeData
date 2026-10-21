import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Ajv from "ajv";

const schemaSource = process.argv[2]
  ? resolve(process.argv[2])
  : new URL("../chrome-manifest-schema.json", import.meta.url);
const dataSource = process.argv[3]
  ? resolve(process.argv[3])
  : new URL("../manifest.json", import.meta.url);

const schema = JSON.parse(await readFile(schemaSource, "utf8"));
const manifest = JSON.parse(await readFile(dataSource, "utf8"));

const ajv = new Ajv({
  strict: false,
  allErrors: true,
  validateFormats: false
});
const validate = ajv.compile(schema);

if (!validate(manifest)) {
  console.error(`Manifest inválido: ${dataSource}`);
  console.error(ajv.errorsText(validate.errors, { separator: "\n" }));
  process.exit(1);
}

console.log(`Manifest válido: ${dataSource}`);
