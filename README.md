# Four States

Four independent, single-screen Three.js studies:

- `aether/` — a model-free turbulent shader field
- `null-garden/` — an obsidian monolith and procedural terrain
- `eidolon/` — a pale fabricated-porcelain armature
- `eventide/` — an eclipsed orbital instrument

The pages use only local, procedurally generated visuals. There are no remote
assets, analytics, external fonts, models, textures, or runtime API calls.

## Local development

```sh
npm install
npm run dev
```

Build the static GitHub Pages output into `docs/`:

```sh
npm run build
```

GitHub Pages publishes the `main` branch’s `/docs` folder. All generated asset
paths are relative, so the same output also works beneath a repository subpath.
