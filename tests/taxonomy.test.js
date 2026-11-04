// The store's departments and categories: where Walmart's, Amazon's and typed categories land,
// the names products store, the labels customers see, and the icons the store draws.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  CATEGORIES,
  CATEGORY_RULES,
  DEPARTMENTS,
  TAXONOMY_ICONS,
  canonicalCategory,
  canonicalDepartment,
  categoryByRules,
  categoryIcon,
  categoryLabel,
  departmentFor,
  departmentLabel,
  pathParts,
  placeInStore,
} from "../src/lib/taxonomy.js";
import { normalize } from "../src/lib/text.js";

const place = (path, name = "") => placeInStore(path, { name });

test("Walmart's paths: no department called Root, and the store's own categories", () => {
  assert.deepEqual(pathParts("Root > Electronics > TV & Video"), ["Electronics", "TV & Video"]);
  assert.deepEqual(place("Root > Electronics > TV & Video > TVs > 30 inch - 39 inch TVs"), { category: "Television", department: "Electronics" });
  // what Walmart sent for the products added on Nov 3 and 4
  assert.deepEqual(place("Root > 29 inch & Small TVs"), { category: "Television", department: "Electronics" });
  assert.deepEqual(place("Root > 50 inch - 59 inch TVs"), { category: "Television", department: "Electronics" });
  assert.deepEqual(place("Root > True Wireless Earbuds"), { category: "Earbuds", department: "Electronics" });
  assert.deepEqual(place("Root > On-Ear Headphones"), { category: "Headphones", department: "Electronics" });
  assert.deepEqual(place("Root > Smart Watches"), { category: "Watch", department: "Electronics" });
  assert.deepEqual(place("Root > Instant Film Cameras"), { category: "Camera", department: "Electronics" });
  assert.deepEqual(place("Root > Foam Blasters"), { category: "Foam blasters", department: "Toys" });
  assert.deepEqual(place("Root > Baby > Baby Monitors"), { category: "Baby gear", department: "Baby" });
  assert.deepEqual(place("Root > Sports & Outdoors > Camping > Tents"), { category: "Camping", department: "Sports" });
  assert.deepEqual(place("Root > Home > Heating, Cooling & Air Quality > Space Heaters"), { category: "Fans & heaters", department: "Home" });
  assert.deepEqual(place("Root > Electronics > Cell Phones > Cell Phone Accessories > Cases"), { category: "Phone accessories", department: "Electronics" });
});

test("Amazon's and other stores' breadcrumbs", () => {
  assert.deepEqual(place("Electronics › Headphones, Earbuds & Accessories › Headphones › Earbud Headphones"), { category: "Earbuds", department: "Electronics" });
  assert.deepEqual(place("Electronics › Computers & Accessories › Data Storage › External Hard Drives"), { category: "Data storage", department: "Electronics" });
  // the last part says nothing the store knows: a parent's exact name does
  assert.deepEqual(place("Home & Kitchen › Kitchen & Dining › Small Appliances › Coffee Machines › Single-Serve Brewers"), { category: "Kitchen appliances", department: "Home" });
  assert.deepEqual(place("Toys & Games › Baby & Toddler Toys › Musical Toys"), { category: "Baby toys", department: "Toys" });
  // a website's "Home" breadcrumb isn't the Home department
  assert.deepEqual(place("Home > Electronics > TVs"), { category: "Television", department: "Electronics" });
  assert.deepEqual(place("Home > Bedding > Comforters"), { category: "Bedding", department: "Home" });
});

test("categories the store doesn't have yet keep the supplier's name, in the right department", () => {
  // "TV & Video" is no reason to call a DVD player a TV
  assert.deepEqual(place("Root > Electronics > TV & Video > DVD & Blu-ray Players"), { category: "DVD & Blu-ray Players", department: "Electronics" });
  assert.deepEqual(place("Electronics > Power stations"), { category: "Power stations", department: "Electronics" });
  assert.deepEqual(place("Garden Center > Planters"), { category: "Planters", department: "Garden Center" });
  // a path that is only a department: the name decides, else Other
  assert.deepEqual(place("Electronics", "Sony WH-1000XM5 Wireless Headphones"), { category: "Headphones", department: "Electronics" });
  assert.deepEqual(place("Electronics", "Portable Power Station 300W"), { category: "Other", department: "Electronics" });
  assert.deepEqual(place(""), { category: "Other", department: "" });
});

test("without a category from the store, the product's name decides", () => {
  assert.deepEqual(place("", "onn 32” 1080P FHD Smart Roku TV"), { category: "Television", department: "Electronics" });
  assert.deepEqual(place("", "Onn. Google TV Full HD Streaming Device"), { category: "Streaming devices", department: "Electronics" });
  assert.deepEqual(place("", "Seagate Expansion Portable 2TB External Hard Drive HDD - USB 3.0"), { category: "Data storage", department: "Electronics" });
  assert.deepEqual(place("", "AirPods 5 with Wireless Charging Case"), { category: "Earbuds", department: "Electronics" });
  assert.deepEqual(place("", "\u200bFisher-Price Little People Toddler Toy School Bus"), { category: "Baby toys", department: "Toys" });
  assert.deepEqual(place("", "Philips Smart TV QLED 50\" 4K UHD con Roku TV"), { category: "Television", department: "Electronics" });
  assert.deepEqual(place("", "Samsung 55\" TV Wall Mount"), { category: "TV accessories", department: "Electronics" });
  assert.deepEqual(place("", "Gaming Chair with Footrest"), { category: "Furniture", department: "Home" });
  assert.deepEqual(place("", "Apple iPhone 15 Clear Case"), { category: "Phone accessories", department: "Electronics" });
  assert.deepEqual(place("", "Apple iPhone 15 128GB"), { category: "Phone", department: "Electronics" });
  assert.deepEqual(place("", "Car Seat for Toddlers"), { category: "Baby gear", department: "Baby" });
  assert.deepEqual(place("", "Dash Cam 1080p"), { category: "Car electronics", department: "Auto" });
  assert.deepEqual(place("", "Dog Plush Squeaky Toy"), { category: "Pet supplies", department: "Pets" });
  // a generic toys path: the name says which toys
  assert.deepEqual(place("Root > Toys > Kids Toys", "Hot Wheels Track Builder Set"), { category: "Toy vehicles", department: "Toys" });
});

test("what someone typed: Spanish and English names of the store's categories", () => {
  assert.deepEqual(place("Televisores"), { category: "Television", department: "Electronics" });
  assert.deepEqual(place("Electronics > Juguetes"), { category: "Toys", department: "Toys" });
  assert.deepEqual(placeInStore("", { fallback: "TVs" }), { category: "Television", department: "Electronics" });
  assert.deepEqual(placeInStore("", { fallback: "Gift cards" }), { category: "Gift cards", department: "" });
});

test("the values products store", () => {
  assert.equal(canonicalDepartment("Root"), "");
  assert.equal(canonicalDepartment("  "), "");
  assert.equal(canonicalDepartment("Hair care"), "Personal care");
  assert.equal(canonicalDepartment("electrónica"), "Electronics");
  assert.equal(canonicalDepartment("Electronicos"), "Electronics");
  assert.equal(canonicalDepartment("Garden Center"), "Garden Center");
  assert.equal(canonicalCategory("Smart Watches"), "Watch");
  assert.equal(canonicalCategory("True Wireless Earbuds"), "Earbuds");
  assert.equal(canonicalCategory("Kids toys"), "Toys");
  assert.equal(canonicalCategory("Hair straightener"), "Hair Straightener");
  assert.equal(canonicalCategory("Gift cards"), "Gift cards");
  assert.equal(departmentFor("Television"), "Electronics");
  assert.equal(departmentFor("Gift cards"), "");
});

test("labels in Spanish and English; unknown names as typed", () => {
  assert.equal(categoryLabel("Television"), "Televisores");
  assert.equal(categoryLabel("tv", "en"), "TVs");
  assert.equal(categoryLabel("Streaming devices"), "Dispositivos de streaming");
  assert.equal(categoryLabel("Foam Blasters"), "Lanzadores de espuma");
  assert.equal(categoryLabel("Gift cards"), "Gift cards");
  assert.equal(departmentLabel("Toys"), "Juguetes");
  assert.equal(departmentLabel("Hair care"), "Cuidado personal");
  assert.equal(departmentLabel("Other", "en"), "Other");
  assert.equal(categoryIcon("Television"), "Television");
  assert.equal(categoryIcon("Gift cards"), "Tag");
});

test("every name points to one category (and one department)", () => {
  for (const [kind, list] of [
    ["category", CATEGORIES],
    ["department", DEPARTMENTS],
  ]) {
    const owner = new Map();
    for (const x of list) {
      for (const name of [x.value, x.en, x.es, ...x.aka]) {
        const key = normalize(name);
        assert.ok(key, `${kind} ${x.value}: an empty name`);
        const before = owner.get(key);
        assert.ok(!before || before === x.value, `${kind} name "${name}" is both ${before} and ${x.value}`);
        owner.set(key, x.value);
      }
    }
    assert.equal(new Set(list.map((x) => x.value)).size, list.length, `${kind} values repeat`);
  }
});

test("every category's department exists, and every rule leads to a category", () => {
  const departments = new Set(DEPARTMENTS.map((d) => d.value));
  for (const c of CATEGORIES) assert.ok(c.value === "Other" || departments.has(c.department), `${c.value}: no department ${c.department}`);
  const values = new Set(CATEGORIES.map((c) => c.value));
  for (const [re, value] of CATEGORY_RULES) assert.ok(values.has(value), `rule ${re} leads to ${value}`);
  assert.equal(categoryByRules(""), null);
});

test("the store can draw every department's and category's icon", () => {
  const component = readFileSync(new URL("../src/features/store/components/CategoryIcon.jsx", import.meta.url), "utf8");
  for (const icon of TAXONOMY_ICONS) {
    assert.ok(component.includes(`${icon}: () => import("@phosphor-icons/react/dist/csr/${icon}")`), `CategoryIcon.jsx can't load ${icon}`);
    const file = new URL(`../node_modules/@phosphor-icons/react/dist/csr/${icon}.es.js`, import.meta.url);
    if (existsSync(new URL("../node_modules/@phosphor-icons/react/", import.meta.url))) assert.ok(existsSync(file), `no Phosphor icon ${icon}`);
  }
});
