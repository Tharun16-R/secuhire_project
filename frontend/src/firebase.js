// Thin wrapper that re-exports the shared Firebase app and storage
// defined in src/lib/firebase.js, so we only initialize Firebase once.

import app, { storage } from "./lib/firebase";

export { app, storage };