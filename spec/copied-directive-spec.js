const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
describe("Keybinding Resolver copied directive syntax", () => {
  let main, view, directory, leases, clipboard;
  beforeEach(async () => {
    jasmine.useRealClock();
    for (const method of ["openPath", "openExternal", "openApplication", "showItemInFolder"])
      spyOn(lumine.shell, method).and.resolveTo();
    spyOn(lumine.application, "openWindow").and.resolveTo();
    clipboard = spyOn(lumine.clipboard, "write");
    jasmine.attachToDOM(lumine.workspace.getElement());
    main = (await lumine.packages.activatePackage("keybinding-resolver")).mainModule;
    await main.toggle();
    view = lumine.workspace.getBottomDock().getActivePaneItem();
    leases = [];
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "keybinding-copy-owned-"));
  });
  afterEach(async () => {
    for (const lease of leases) lease.dispose();
    await lumine.packages.deactivatePackage("keybinding-resolver");
    const target = path.resolve(directory);
    if (
      path.dirname(target) !== path.resolve(os.tmpdir()) ||
      !path.basename(target).startsWith("keybinding-copy-owned-")
    )
      throw Error("Unsafe keybinding fixture cleanup");
    fs.rmSync(target, { recursive: true, force: true });
  });
  async function copy(extension, selector, keystrokes, command) {
    const source = path.join(directory, "owned-binding.json");
    leases.push(lumine.keymaps.add(source, { [selector]: { [keystrokes]: command } }));
    const binding = lumine.keymaps
      .getKeyBindings()
      .find((entry) => entry.source === source && entry.command === command);
    expect(binding).toBeDefined();
    const output = path.join(directory, "copied" + extension);
    spyOn(lumine.keymaps, "getUserKeymapPath").and.returnValue(output);
    await view.update({ usedKeyBinding: binding, keystrokes: binding.keystrokes });
    view.element.querySelector("tr.used .copy").click();
    expect(clipboard).toHaveBeenCalledTimes(1);
    const text = clipboard.calls.mostRecent().args[0];
    fs.writeFileSync(output, extension === ".cson" ? text : "{" + text + "}");
    return { bindings: lumine.keymaps.readKeymap(output), binding };
  }
  it("copies an actual quoted CSS selector and command into valid JSON", async () => {
    const { bindings, binding } = await copy(
      ".json",
      'lumine-text-editor[data-copy="O\'Reilly"]',
      "ctrl-\\",
      'audit:quoted"command\\value',
    );
    expect(bindings).toEqual({ [binding.selector]: { [binding.keystrokes]: binding.command } });
  });
  it("escapes actual apostrophes and backslashes in the supported CSON directive", async () => {
    const { bindings, binding } = await copy(
      ".cson",
      'lumine-text-editor[data-copy="O\'Reilly"]',
      "ctrl-\\",
      "audit:quoted'command\\value",
    );
    expect(bindings).toEqual({ [binding.selector]: { [binding.keystrokes]: binding.command } });
  });
  it("keeps an ordinary directive compatible with the user's JSON keymap", async () => {
    const { bindings, binding } = await copy(
      ".json",
      "lumine-text-editor:not([mini])",
      "ctrl-alt-k",
      "audit:ordinary-copy",
    );
    expect(bindings).toEqual({ [binding.selector]: { [binding.keystrokes]: binding.command } });
  });
});
