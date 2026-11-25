import { mkdir, readFile, writeFile } from 'node:fs/promises';
const packages = ["@fontsource-variable/inter","@fontsource-variable/roboto","@fontsource-variable/open-sans","@fontsource-variable/montserrat","@fontsource-variable/oswald","@fontsource-variable/raleway","@fontsource-variable/nunito-sans","@fontsource-variable/merriweather","@fontsource-variable/lora","@fontsource-variable/playfair-display","@fontsource-variable/source-code-pro","@fontsource/lobster","@fontsource/pacifico","@fontsource/bebas-neue"];
const directory = new URL('../public/font-licenses/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const pkg of packages) {
  const license = await readFile(new URL('../node_modules/' + pkg + '/LICENSE', import.meta.url), 'utf8');
  await writeFile(new URL(pkg.split('/')[1] + '.txt', directory), license);
}
