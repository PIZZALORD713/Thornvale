# Local Draco decoder

These runtime decoder files are copied from
`three/examples/jsm/libs/draco/gltf/` in the installed Three.js `0.169.x`
package. Keeping them local allows the bundled Steward #8914 models to load
without a request to Google's decoder CDN.

Three.js is distributed under the MIT License. See the repository dependency
and `node_modules/three/LICENSE` in a development checkout.

The production build applies Oxc compression with decode-verified identifier
mangling to the copied `draco_decoder.js` fallback and
`draco_wasm_wrapper.js`. The checked-in Three.js sources remain byte-identical,
the `/draco/` runtime URLs and decoder API remain stable, and the WASM binary is
copied unchanged. A build must fail rather than ship either JavaScript decoder
surface if this deterministic transform reports an error.
