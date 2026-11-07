# Local PDF form editor

Fills a worker affidavit in the browser. Nothing is uploaded and there is no server.

The page opens with the bundled affidavit already selected. Data fields start empty. A hyphen in a parent, spouse, or child name, passport, or birth date is written into that cell. For a spouse or child name, one hyphen fills both the surname and the given name. The worker’s name is fitted to the width of the old name. The download is named after the worker: `TESTOV TEST` becomes `TESTOV_TEST.pdf`.

Printed birth dates are the father’s `12.02.1952`, the mother’s `11.12.1956`, the spouse’s `15.12.1994`, the first child’s `23.05.2014`, and the second child’s `22.01.2018`. This affidavit has no worker birth date. Replacement text is Liberation Serif Bold.

## Host

Build the static site and upload the `dist/` folder.

```bash
cd pdf-agent-project/frontend
npm install
npm run build
```

`frontend/dist/` is the whole site: `index.html`, the script and style files, the bundled affidavit, and the font. Put that folder on any static host. Paths are relative, so the folder does not have to sit at the domain root.

For a local check of the same build:

```bash
cd pdf-agent-project/frontend
npm run preview
```
