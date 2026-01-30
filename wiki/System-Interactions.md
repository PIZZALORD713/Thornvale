# System — Interactions

## MVP Interactables (Milestone 1)

* **Door:** open/close
* **Sign:** read text
* **Lantern:** toggle light

## Interaction Rules

* Must be in range
* Must be in view (optional)
* Prompt: “Press E to …”

## Implementation Notes

* Use tags on objects in glTF (name prefix or custom extras)
* Maintain an `InteractableRegistry`
