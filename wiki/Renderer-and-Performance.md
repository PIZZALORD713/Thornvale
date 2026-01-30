# Renderer & Performance

## Targets (Draft)

* Desktop Chrome: stable, responsive, minimal stutter
* Fast first paint: show loading UI immediately

## Budgets (Draft)

* Town slice assets: keep small for iteration
* Avoid huge HDRs early

## Performance Checklist

* Use compressed textures when available (later KTX2)
* Merge static meshes
* Keep draw calls low
* Avoid per-frame allocations
