// Single place the functions reach Netlify Blobs through.
//
// Wrapped in a mutable object so unit tests — which run outside the Netlify
// runtime, where getStore() throws — can substitute an in-memory double without
// the handlers needing a test-only code path.
export const stores = {
  async get(name) {
    const { getStore } = await import('@netlify/blobs');
    return getStore(name);
  },
};
