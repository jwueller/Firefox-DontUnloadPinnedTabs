// Firefox's low-memory unloader (TabUnloader.sys.mjs) never unloads a tab
// marked undiscardable, which is what autoDiscardable:false sets. Pinned
// tabs on their own only get a lower unload priority, not protection.
//
// The undiscardable attribute is not persisted by session restore, so it is
// re-applied on every startup. Moving a tab to another window copies it.
// Tearing a pinned tab off into its own window unpins it without an
// onUpdated event, and the attribute copy lands after onAttached (where the
// tab cannot even be queried yet). The torn-off tab is then activated in its
// new window, and by then the copy has landed, so it is fixed up there.

function protect(tabId, pinned) {
  // Unpinning restores autoDiscardable:true unconditionally, overriding a
  // value another extension may have set. Tracking which tabs we changed
  // would avoid that, but the MV3 event page loses script variables when it
  // unloads, so it would need storage.session and the storage permission.
  return browser.tabs.update(tabId, { autoDiscardable: !pinned });
}

async function protectAllPinned() {
  const tabs = await browser.tabs.query({ pinned: true });
  await Promise.all(tabs.map((tab) => protect(tab.id, true)));
}

browser.runtime.onStartup.addListener(protectAllPinned);
browser.runtime.onInstalled.addListener(protectAllPinned);

browser.tabs.onCreated.addListener((tab) => {
  if (tab.pinned) {
    protect(tab.id, true);
  }
});

browser.tabs.onUpdated.addListener(
  (tabId, changeInfo) => protect(tabId, changeInfo.pinned),
  { properties: ["pinned"] }
);

// Holds tab IDs only between onAttached and the onActivated that follows it,
// which is too short for the event page to unload and lose them.
const justAttached = new Set();

browser.tabs.onAttached.addListener((tabId) => justAttached.add(tabId));

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!justAttached.delete(tabId)) {
    return;
  }
  const tab = await browser.tabs.get(tabId);
  if (!tab.pinned) {
    protect(tabId, false);
  }
});
