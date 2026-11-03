// The Express browser extension as a .zip, made on the spot with this admin's address inside
// (leamingtonexpress.ca, express-corp.web.app, or the demo), so its products come back here.
// The extension's own files are in /extension.
import background from "../../../extension/background.js?raw";
import content from "../../../extension/content.js?raw";
import extract from "../../../extension/extract.js?raw";
import manifest from "../../../extension/manifest.json?raw";
import readme from "../../../extension/README.txt?raw";
import { makeZip } from "./zip";

export const EXTENSION_VERSION = JSON.parse(manifest).version;
export const EXTENSION_FILE = "express-add-products.zip";

/** Download the extension for this admin. */
export async function downloadExtension() {
  const { origin, protocol, hostname } = window.location;
  const icon = await fetch("/apps/admin-192.png").then((r) => {
    if (!r.ok) throw new Error("The extension's icon couldn't be loaded.");
    return r.arrayBuffer();
  });
  // no folder inside the zip: unzipping makes "express-add-products/" with manifest.json in it
  const zip = makeZip([
    { name: "manifest.json", data: manifest.replace("__ADMIN_MATCH__", `${protocol}//${hostname}/*`) },
    { name: "config.js", data: `// Your Express admin (written when you downloaded the extension)\nglobalThis.EXPRESS = ${JSON.stringify({ admin: origin })};\n` },
    { name: "background.js", data: background },
    { name: "content.js", data: content },
    { name: "extract.js", data: extract },
    { name: "icon.png", data: new Uint8Array(icon) },
    { name: "README.txt", data: readme.replaceAll("__ADMIN__", origin) },
  ]);
  const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = EXTENSION_FILE;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
