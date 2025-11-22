// Re-export Firebase app and storage from src/firebase,
// so Firebase is initialized only once.

import app, { storage } from "../firebase";

export { app, storage };
export default app;