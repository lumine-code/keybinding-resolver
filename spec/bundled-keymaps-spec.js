const fs = require("fs");
const os = require("os");
const path = require("path");
const temp = require("@lumine-code/fs-temp");

describe("Bundled keymap source extraction", () => {
  let directory, resourcePath, metadataPath, view;
  const keymap = { "lumine-workspace": { "ctrl-alt-f9": "core:save" } };

  beforeEach(async () => {
    await lumine.packages.activatePackage("keybinding-resolver");
    // Resolve the constructor from the currently active package generation.
    const View = require("../lib/keybinding-resolver-view");
    view = new View();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "lumine-resolver-keymaps-"));
    resourcePath = path.join(directory, "app.asar");
    metadataPath = path.join(resourcePath, "package.json");
    fs.mkdirSync(resourcePath);
    // The builder bakes these records into package.json; the original keymap
    // files need not exist beside the packaged metadata.
    fs.writeFileSync(
      metadataPath,
      JSON.stringify({
        name: "lumine",
        version: "1.0.0",
        lumineMetadata: {
          packages: {},
          menu: {},
          keymaps: { "base.json": keymap, "other.json": { unrelated: {} } },
        },
      }),
    );
    spyOn(lumine.application, "getResourcePath").and.returnValue(resourcePath);
    spyOn(temp, "mkdirSync").and.callFake((prefix) => fs.mkdtempSync(path.join(directory, prefix)));
    spyOn(lumine.workspace, "open").and.resolveTo(null);
  });

  afterEach(async () => {
    await view?.destroy();
    if (metadataPath) delete require.cache[require.resolve(metadataPath)];
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });

  for (const sourceKind of ["ASAR", "core:"]) {
    it(`opens the baked keymap contents from a ${sourceKind} source`, () => {
      const source =
        sourceKind === "ASAR"
          ? path.join(resourcePath, "keymaps", "base.json")
          : `core:${path.join("keymaps", "base.json")}`;
      expect(view.isInAsarArchive(path.join(resourcePath, "keymaps", "base.json"))).toBe(true);
      view.openKeybindingFile(source);

      expect(lumine.workspace.open.calls.count()).toBe(1);
      const extractedPath = lumine.workspace.open.calls.mostRecent().args[0];
      expect(path.dirname(extractedPath).startsWith(directory + path.sep)).toBe(true);
      expect(path.basename(extractedPath)).toBe("base.json");
      expect(JSON.parse(fs.readFileSync(extractedPath, "utf8"))).toEqual(keymap);
    });
  }

  for (const metadata of [{ name: "lumine" }, { lumineMetadata: {} }]) {
    it(`extracts an empty keymap when ${metadata.name ? "the metadata namespace" : "keymaps"} is absent`, () => {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata));
      const extractedPath = view.extractBundledKeymap("base.json");
      expect(JSON.parse(fs.readFileSync(extractedPath, "utf8"))).toEqual({});
    });
  }

  it("extracts an empty keymap for a name absent from the baked metadata", () => {
    const extractedPath = view.extractBundledKeymap("missing.json");
    expect(JSON.parse(fs.readFileSync(extractedPath, "utf8"))).toEqual({});
  });
});
