export class InteractableSystem {
  constructor(hud) {
    this.hud = hud;
    this.interactables = [];
    this.activeInteractable = null;
  }

  register(interactable) {
    this.interactables.push(interactable);
  }

  update(playerPosition, inputManager) {
    let closest = null;
    let closestDist = Infinity;

    for (const item of this.interactables) {
      const dist = item.position.distanceTo(playerPosition);
      if (dist <= item.radius && dist < closestDist) {
        closest = item;
        closestDist = dist;
      }
    }

    if (closest !== this.activeInteractable) {
      this.activeInteractable = closest;
      if (closest) {
        this.hud.showPrompt(`Press E — ${closest.prompt}`);
      } else {
        this.hud.hidePrompt();
      }
    }

    if (!closest) {
      inputManager.consumeKeyPress('KeyE');
      return;
    }

    if (inputManager.consumeKeyPress('KeyE')) {
      const message = closest.onInteract?.();
      if (message) {
        this.hud.setStatus(message);
      }
    }
  }
}
