# Controls & UX

## Desktop (MVP)

* **WASD**: move
* **Mouse**: camera orbit
* **Shift**: sprint (optional)
* **Space**: jump (optional)
* **E**: interact
* **N**: day/night toggle when debug mode is enabled

## Touch controls pilot

The mobile-controls pilot appears automatically only when the browser reports
both touch capability (`maxTouchPoints > 0`) and a coarse primary pointer. Use
`?controls=touch`, `?controls=desktop`, or `?controls=auto` to force or restore
selection during QA; `auto` is the default.

* **Left analog pad**: move; push into the outer band to sprint
* **Right-side drag**: look
* **Jump**: jump button
* **Interact**: contextual action button when an interaction is available
* **Skip**: the contextual action becomes Skip during the second-Bell camera reveal

The premium presentation is the default. It keeps the movement control quiet
while idle, aligns Jump with the movement-thumb center, places contextual
actions above and slightly inward on the right-thumb arc, and reserves the
space between actions so near misses do not start a camera drag. Inline glyphs
and short contextual verbs improve scanability; moving, sprinting, held Jump,
and available interaction state receive direct visual feedback.

Use `?controlsStyle=classic` to restore the original fixed horizontal action
row. An absent or unknown value resolves to the modern presentation. This
selector changes only presentation; movement, camera, action edges, blocking,
and cancellation continue through the same semantic input path.

Reduced-motion mode removes control transitions while preserving direct stick
translation. Increased-contrast and forced-color modes keep controls fully
opaque with stronger system-readable borders.

Touch movement and look can run simultaneously. Opening a story card or other
blocking modal disables and clears the touch surface. Pointer cancellation,
window blur, page visibility changes, resize, and orientation changes also
clear touch input so movement cannot remain latched.

Pass-out recovery disables and clears the touch surface through the blackout,
then restores it only after the player has safely reappeared and no story card
owns input. The second-Bell reveal clears held movement before the fly-to and
routes its temporary Skip action through the same exact-once semantic edge as
desktop `E`.

This is an included input pilot, not a mobile performance or support claim.
Full mobile parity remains outside the current Plan 2.0 milestone; desktop
keyboard and mouse behavior remains the supported baseline.

### iPhone Safari display mode

Rotating an iPhone does not grant Safari permission to enter element
fullscreen, so Thornvale does not claim that landscape rotation can remove the
address or button bars from an ordinary browser tab. Eligible Apple touch
sessions instead show a short Home Screen instruction on the entry card and a
dismissible reminder after the first in-play rotation. The reminder appears
only once per page session, waits until a blocking story card closes, and is
suppressed when Thornvale is already running as a standalone web app.

For the physical-device gate:

1. Remove any older Thornvale shortcut from the iPhone Home Screen.
2. Open the current candidate in Safari.
3. Choose **Share > Add to Home Screen**.
4. Enable **Open as Web App** if iOS shows that option, then add it.
5. Launch Thornvale from the new Home Screen icon rather than rotating the
   still-open Safari tab.

The manifest and Apple web-app metadata remove Safari's URL and button bars in
the Home Screen launch; the iOS status area may remain. iOS may also give that
web app storage separate from the Safari tab, so an existing tab save might not
appear after launch from the icon. Test from the state the standalone app
actually presents.

The page uses dynamic viewport height and listens to both normal and visual
viewport resizing. Rotation or Safari-chrome changes schedule one renderer and
post-processing resize; dynamic viewport and safe-area CSS reflow the HUD and
touch layout while the existing input-cancellation contract prevents latched
movement.

## UX Principles

* Prompts are minimal, diegetic when possible
* Keep HUD small: crosshair (optional), interact prompt, phase indicator
* Debug UI is separate and easy to disable
