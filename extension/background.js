// Express — takes the products you add on Walmart.ca / Amazon.ca to your admin's
// "Add from Walmart & Amazon" list (in the address of that page, #add=…), and runs the
// toolbar button. config.js holds your admin's address (written when you downloaded this).
importScripts("config.js");

const ADMIN = String(globalThis.EXPRESS?.admin || "").replace(/\/+$/, "");
const LIST = `${ADMIN}/admin/productos/agregar`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** JSON → UTF-8 → base64url (what the admin page reads back) */
function encode(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Wait until a tab has finished loading (or give up after a while). */
function loaded(tabId, timeout = 20000) {
  return new Promise((resolve) => {
    let timer = 0;
    const done = () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") done();
    };
    timer = setTimeout(done, timeout);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs
      .get(tabId)
      .then((tab) => tab.status === "complete" && done())
      .catch(done);
  });
}

/** The admin tab already showing the list, if there is one. */
async function listTab() {
  const u = new URL(ADMIN);
  const tabs = await chrome.tabs.query({ url: `${u.protocol}//${u.hostname}/admin/productos/agregar*` });
  return tabs.find((t) => (t.url || "").startsWith(LIST)) || null;
}

/** Put a product on the list: in the open list tab (staying here), or in a new tab. */
async function deliver(product) {
  const url = `${LIST}#add=${encode([product])}`;
  const tab = await listTab();
  if (tab) {
    await loaded(tab.id);
    await chrome.tabs.update(tab.id, { url }); // only the #part changes: the page doesn't reload
    await sleep(400); // one at a time, so none gets lost
    return { opened: false };
  }
  const created = await chrome.tabs.create({ url, active: true });
  await loaded(created.id);
  await sleep(600);
  return { opened: true };
}

let line = Promise.resolve();
chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type !== "express-add" || !message.product) return false;
  line = line
    .then(() => deliver(message.product))
    .then(
      (result) => reply({ ok: true, ...result }),
      (err) => reply({ ok: false, error: String(err?.message || err) }),
    );
  return true; // the answer comes later
});

/** Add the product on this tab's page (any store; Walmart and Amazon have the button too). */
async function addOnTab(tab) {
  if (!tab?.id || !/^https?:/.test(tab.url || "")) return;
  const target = { tabId: tab.id };
  try {
    const [first] = await chrome.scripting.executeScript({ target, func: () => typeof globalThis.__expressAdd === "function" });
    if (!first?.result) await chrome.scripting.executeScript({ target, files: ["extract.js", "content.js"] });
    await chrome.scripting.executeScript({ target, func: () => globalThis.__expressAdd() });
  } catch (err) {
    console.warn("Express: this page can't be read", err);
  }
}

// The toolbar button, and the shortcut Alt+Shift+E (chrome://extensions/shortcuts to change it)
chrome.action.onClicked.addListener(addOnTab);
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "add-product") addOnTab(tab);
});

// Right after installing: open the list, which confirms the extension works
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") chrome.tabs.create({ url: `${LIST}#installed` });
});
