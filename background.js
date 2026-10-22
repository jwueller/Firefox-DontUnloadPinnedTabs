// Firefox's low-memory unloader (TabUnloader.sys.mjs) never unloads a tab
// marked undiscardable, which is what autoDiscardable:false sets. Pinned
// tabs on their own only get a lower unload priority, not protection.
//
// The undiscardable attribute is not persisted by session restore, so it is
// re-applied on every startup. Moving a tab to another window copies it.
// Known gap: tearing a pinned tab off into its own window unpins it without
// an onUpdated event, and the attribute copy lands after onAttached, so that
// tab stays protected until the next restart.

function protect(tabId, pinned) {
  // Agent's choice: unpinning restores autoDiscardable:true unconditionally,
  // overriding a value another extension may have set. Tracking which tabs we
  // changed would avoid that, but it needs storage that survives restarts.
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
