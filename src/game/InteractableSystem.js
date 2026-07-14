export class InteractableSystem {
  constructor(hud) {
    this.hud = hud;
    this.interactables = [];
    this.activeInteractable = null;
    this.activePrompt = '';
    this.inFlight = null;
  }

  register(interactable) {
    this.interactables.push(interactable);
    return interactable;
  }

  update(playerPosition, inputManager) {
    let closest = null;
    let closestDist = Infinity;

    for (const item of this.interactables) {
      const enabled = typeof item.enabled === 'function'
        ? item.enabled()
        : item.enabled !== false;
      if (!enabled) continue;

      const dist = item.position.distanceTo(playerPosition);
      if (dist <= item.radius && dist < closestDist) {
        closest = item;
        closestDist = dist;
      }
    }

    const prompt = closest
      ? String(typeof closest.prompt === 'function' ? closest.prompt() : closest.prompt || 'Interact')
      : '';

    if (closest !== this.activeInteractable || prompt !== this.activePrompt) {
      this.activeInteractable = closest;
      this.activePrompt = prompt;
      if (closest) {
        this.hud.showPrompt(`Press E — ${prompt}`);
      } else {
        this.hud.hidePrompt();
      }
    }

    if (!closest) {
      inputManager.consumeKeyPress('KeyE');
      return;
    }

    if (inputManager.consumeKeyPress('KeyE') && !this.inFlight) {
      const interaction = closest;
      let pending;
      try {
        pending = interaction.onInteract?.();
      } catch (error) {
        pending = Promise.reject(error);
      }
      this.inFlight = Promise.resolve(pending)
        .then((message) => {
          // Story directors return structured interaction results for tests and
          // save-state consumers. Only authored string messages belong in the
          // town-whisper toast.
          if (typeof message === 'string' && message.trim()) this.hud.setStatus(message);
        })
        .catch((error) => {
          console.error(`[InteractableSystem] ${interaction.id || 'interaction'} failed`, error);
          this.hud.setStatus('The valley lost its train of thought. Please try again.');
        })
        .finally(() => {
          this.inFlight = null;
        });
    }
  }
}
