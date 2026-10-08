const etch = require("@lumine-code/etch");

describe("KeyBindingResolverView", () => {
  let workspaceElement, bottomDockElement;

  beforeEach(async () => {
    workspaceElement = lumine.views.getView(lumine.workspace);
    bottomDockElement = lumine.views.getView(lumine.workspace.getBottomDock());
    await lumine.packages.activatePackage("keybinding-resolver");
    jasmine.attachToDOM(workspaceElement);
  });

  describe("when the keybinding-resolver:toggle event is triggered", () => {
    function deferred() {
      let resolve;
      const promise = new Promise((done) => {
        resolve = done;
      });
      return { promise, resolve };
    }

    it("does not reopen the dock when an open finishes after deactivation", async () => {
      const main = lumine.packages.getActivePackage("keybinding-resolver").mainModule;
      const originalOpen = lumine.workspace.open.bind(lumine.workspace);
      const completion = deferred();
      let openedItem;
      spyOn(lumine.workspace, "open").and.callFake(async (...args) => {
        openedItem = await originalOpen(...args);
        await completion.promise;
        return openedItem;
      });
      const pending = main.toggle();
      await conditionPromise(() => openedItem, "the resolver pane item to open");
      await lumine.packages.deactivatePackage("keybinding-resolver");
      lumine.workspace.getBottomDock().hide();

      completion.resolve();
      await pending;

      expect(lumine.workspace.getBottomDock().isVisible()).toBe(false);
      expect(lumine.workspace.paneForItem(openedItem)).toBeUndefined();
    });

    it("disposes a late-created resolver item without revealing the dock", async () => {
      await lumine.packages.deactivatePackage("keybinding-resolver");
      const addOpener = spyOn(lumine.workspace, "addOpener").and.callThrough();
      const main = (await lumine.packages.activatePackage("keybinding-resolver")).mainModule;
      const opener = addOpener.calls.mostRecent().args[0];
      const originalOpeners = lumine.workspace.getOpeners();
      const completion = deferred();
      let lateItem;
      spyOn(lumine.workspace, "getOpeners").and.returnValue([
        async (uri, options) => {
          lateItem = opener(uri, options);
          if (!lateItem) return;
          await completion.promise;
          return lateItem;
        },
        ...originalOpeners,
      ]);
      const pending = main.toggle();
      await conditionPromise(() => lateItem, "the delayed opener to create its resolver item");
      await lumine.packages.deactivatePackage("keybinding-resolver");

      completion.resolve();
      await pending;

      expect(lumine.workspace.getBottomDock().isVisible()).toBe(false);
      expect(lumine.workspace.paneForItem(lateItem)).toBeUndefined();
      expect(lateItem.disposables.disposed).toBe(true);
    });

    it("does not alter a newer activation or destroy its resolver item", async () => {
      const main = lumine.packages.getActivePackage("keybinding-resolver").mainModule;
      const originalOpen = lumine.workspace.open.bind(lumine.workspace);
      const completion = deferred();
      let openedItem;
      const open = spyOn(lumine.workspace, "open").and.callFake(async (...args) => {
        openedItem = await originalOpen(...args);
        await completion.promise;
        return openedItem;
      });
      const pending = main.toggle();
      await conditionPromise(() => openedItem, "the retired resolver item");
      await lumine.packages.deactivatePackage("keybinding-resolver");
      const current = (await lumine.packages.activatePackage("keybinding-resolver")).mainModule;
      open.and.callFake(originalOpen);
      await current.toggle();
      const currentItem = lumine.workspace.getBottomDock().getActivePaneItem();
      expect(currentItem).not.toBe(openedItem);
      lumine.workspace.getBottomDock().hide();

      completion.resolve();
      await pending;

      expect(lumine.workspace.getBottomDock().isVisible()).toBe(false);
      expect(lumine.workspace.paneForItem(currentItem)).toBeDefined();
      expect(currentItem.disposables.disposed).toBe(false);
    });

    it("keeps a newer hide while the first toggle is still waiting", async () => {
      const main = lumine.packages.getActivePackage("keybinding-resolver").mainModule;
      const originalOpen = lumine.workspace.open.bind(lumine.workspace);
      const completion = deferred();
      let item;
      spyOn(lumine.workspace, "open").and.callFake(async (...args) => {
        item = await originalOpen(...args);
        await completion.promise;
        return item;
      });
      const pending = main.toggle();
      await conditionPromise(() => item, "the pending resolver item");
      lumine.workspace.getBottomDock().show();
      await main.toggle();
      expect(lumine.workspace.getBottomDock().isVisible()).toBe(false);

      completion.resolve();
      await pending;

      expect(lumine.workspace.getBottomDock().isVisible()).toBe(false);
      expect(lumine.workspace.paneForItem(item)).toBeDefined();
    });

    it("keeps an adopted late item when its stale destruction listener finishes", async () => {
      await lumine.packages.deactivatePackage("keybinding-resolver");
      const addOpener = spyOn(lumine.workspace, "addOpener").and.callThrough();
      const oldMain = (await lumine.packages.activatePackage("keybinding-resolver")).mainModule;
      const opener = addOpener.calls.mostRecent().args[0];
      const originalOpeners = lumine.workspace.getOpeners();
      const opening = deferred();
      const closing = deferred();
      let lateItem,
        destroying = false;
      spyOn(lumine.workspace, "getOpeners").and.returnValue([
        async (uri, options) => {
          lateItem = opener(uri, options);
          if (!lateItem) return;
          await opening.promise;
          return lateItem;
        },
        ...originalOpeners,
      ]);
      const pending = oldMain.toggle();
      await conditionPromise(() => lateItem);
      await lumine.packages.deactivatePackage("keybinding-resolver");
      const pane = lumine.workspace.getBottomDock().getActivePane();
      const listener = pane.onWillDestroyItem(({ item }) => {
        if (item === lateItem) {
          destroying = true;
          return closing.promise;
        }
      });
      try {
        opening.resolve();
        await conditionPromise(() => destroying, "the stale destruction listener");
        const current = (await lumine.packages.activatePackage("keybinding-resolver")).mainModule;
        await current.toggle();
        expect(lumine.workspace.getBottomDock().getActivePaneItem()).toBe(lateItem);
        closing.resolve();
        await pending;
        expect(lumine.workspace.paneForItem(lateItem)).toBe(pane);
        expect(lateItem.disposables.disposed).toBe(false);
      } finally {
        listener.dispose();
        opening.resolve();
        closing.resolve();
        await pending;
      }
    });

    it("toggles the view", async () => {
      expect(lumine.workspace.getBottomDock().isVisible()).toBe(false);
      expect(bottomDockElement.querySelector(".keybinding-resolver")).not.toExist();

      await lumine.commands.dispatch(workspaceElement, "keybinding-resolver:toggle");
      expect(lumine.workspace.getBottomDock().isVisible()).toBe(true);
      expect(bottomDockElement.querySelector(".keybinding-resolver")).toExist();

      await lumine.commands.dispatch(workspaceElement, "keybinding-resolver:toggle");
      expect(lumine.workspace.getBottomDock().isVisible()).toBe(false);
      expect(bottomDockElement.querySelector(".keybinding-resolver")).toExist();

      await lumine.commands.dispatch(workspaceElement, "keybinding-resolver:toggle");
      expect(lumine.workspace.getBottomDock().isVisible()).toBe(true);
      expect(bottomDockElement.querySelector(".keybinding-resolver")).toExist();
    });

    it("focuses the view if it is not visible instead of destroying it", async () => {
      expect(lumine.workspace.getBottomDock().isVisible()).toBe(false);
      expect(bottomDockElement.querySelector(".keybinding-resolver")).not.toExist();

      await lumine.commands.dispatch(workspaceElement, "keybinding-resolver:toggle");
      expect(lumine.workspace.getBottomDock().isVisible()).toBe(true);
      expect(bottomDockElement.querySelector(".keybinding-resolver")).toExist();

      lumine.workspace.getBottomDock().hide();
      await lumine.commands.dispatch(workspaceElement, "keybinding-resolver:toggle");

      expect(lumine.workspace.getBottomDock().isVisible()).toBe(true);
      expect(bottomDockElement.querySelector(".keybinding-resolver")).toExist();
    });

    it("destroys the old view when the package is deactivated", async () => {
      await lumine.commands.dispatch(workspaceElement, "keybinding-resolver:toggle");
      const oldView = lumine.workspace.getBottomDock().getActivePaneItem();

      await lumine.packages.deactivatePackage("keybinding-resolver");

      expect(lumine.workspace.paneForItem(oldView)).toBeUndefined();
      expect(bottomDockElement.querySelector(".keybinding-resolver")).not.toExist();

      await lumine.packages.activatePackage("keybinding-resolver");
      await lumine.commands.dispatch(workspaceElement, "keybinding-resolver:toggle");
      expect(lumine.workspace.getBottomDock().getActivePaneItem()).not.toBe(oldView);
    });
  });

  describe("capturing keybinding events", () => {
    it("captures events when the keybinding resolver is visible", async () => {
      await lumine.commands.dispatch(workspaceElement, "keybinding-resolver:toggle");
      const keybindingResolverView = lumine.workspace.getBottomDock().getActivePaneItem();
      expect(keybindingResolverView.keybindingDisposables).not.toBe(null);

      document.dispatchEvent(
        lumine.keymaps.constructor.buildKeydownEvent("x", { target: bottomDockElement }),
      );
      await etch.getScheduler().getNextUpdatePromise();
      expect(bottomDockElement.querySelector(".keybinding-resolver .keystroke").textContent).toBe(
        "x",
      );
    });

    it("does not capture events when the keybinding resolver is not the active pane item", async () => {
      await lumine.commands.dispatch(workspaceElement, "keybinding-resolver:toggle");
      const keybindingResolverView = lumine.workspace.getBottomDock().getActivePaneItem();
      expect(keybindingResolverView.keybindingDisposables).not.toBe(null);

      lumine.workspace.getBottomDock().getActivePane().splitRight();
      expect(keybindingResolverView.keybindingDisposables).toBe(null);

      lumine.workspace.getBottomDock().getActivePane().destroy();
      document.dispatchEvent(
        lumine.keymaps.constructor.buildKeydownEvent("x", { target: bottomDockElement }),
      );
      await etch.getScheduler().getNextUpdatePromise();
      expect(bottomDockElement.querySelector(".keybinding-resolver .keystroke").textContent).toBe(
        "x",
      );
    });

    it("does not capture events when the dock the keybinding resolver is in is not visible", async () => {
      await lumine.commands.dispatch(workspaceElement, "keybinding-resolver:toggle");
      const keybindingResolverView = lumine.workspace.getBottomDock().getActivePaneItem();
      expect(keybindingResolverView.keybindingDisposables).not.toBe(null);

      lumine.workspace.getBottomDock().hide();
      expect(keybindingResolverView.keybindingDisposables).toBe(null);

      lumine.workspace.getBottomDock().show();
      document.dispatchEvent(
        lumine.keymaps.constructor.buildKeydownEvent("x", { target: bottomDockElement }),
      );
      await etch.getScheduler().getNextUpdatePromise();
      expect(bottomDockElement.querySelector(".keybinding-resolver .keystroke").textContent).toBe(
        "x",
      );
    });
  });

  describe("when a keydown event occurs", () => {
    it("displays all commands for the keydown event but does not clear for the keyup when there is no keyup binding", async () => {
      lumine.keymaps.add("name", {
        ".workspace": {
          x: "match-1",
        },
      });
      lumine.keymaps.add("name", {
        ".workspace": {
          x: "match-2",
        },
      });
      lumine.keymaps.add("name", {
        ".never-again": {
          x: "unmatch-2",
        },
      });

      await lumine.commands.dispatch(workspaceElement, "keybinding-resolver:toggle");

      document.dispatchEvent(
        lumine.keymaps.constructor.buildKeydownEvent("x", { target: bottomDockElement }),
      );
      await etch.getScheduler().getNextUpdatePromise();
      expect(bottomDockElement.querySelector(".keybinding-resolver .keystroke").textContent).toBe(
        "x",
      );
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .used")).toHaveLength(1);
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .unused")).toHaveLength(1);
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .unmatched")).toHaveLength(1);

      // It should not render the keyup event data because there is no match
      spyOn(etch.getScheduler(), "updateDocument").and.callThrough();
      document.dispatchEvent(
        lumine.keymaps.constructor.buildKeyupEvent("x", { target: bottomDockElement }),
      );
      expect(etch.getScheduler().updateDocument).not.toHaveBeenCalled();
      expect(bottomDockElement.querySelector(".keybinding-resolver .keystroke").textContent).toBe(
        "x",
      );
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .used")).toHaveLength(1);
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .unused")).toHaveLength(1);
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .unmatched")).toHaveLength(1);
    });

    it("displays keyup bindings and dispatches keydown matches with keyup-only remainders", async () => {
      lumine.keymaps.add("name", {
        ".workspace": {
          x: "match-1",
        },
      });
      lumine.keymaps.add("name", {
        ".workspace": {
          "x ^x": "match-2",
        },
      });
      lumine.keymaps.add("name", {
        ".workspace": {
          "a ^a": "match-3",
        },
      });
      lumine.keymaps.add("name", {
        ".never-again": {
          x: "unmatch-2",
        },
      });

      await lumine.commands.dispatch(workspaceElement, "keybinding-resolver:toggle");

      // Not partial because it dispatches the command for `x` immediately due to only having keyup events in remainder of partial match
      document.dispatchEvent(
        lumine.keymaps.constructor.buildKeydownEvent("x", { target: bottomDockElement }),
      );
      await etch.getScheduler().getNextUpdatePromise();
      expect(bottomDockElement.querySelector(".keybinding-resolver .keystroke").textContent).toBe(
        "x",
      );
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .used")).toHaveLength(1);
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .unused")).toHaveLength(0);
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .unmatched")).toHaveLength(1);

      // It should not render the keyup event data because there is no match
      document.dispatchEvent(
        lumine.keymaps.constructor.buildKeyupEvent("x", { target: bottomDockElement }),
      );
      await etch.getScheduler().getNextUpdatePromise();
      expect(bottomDockElement.querySelector(".keybinding-resolver .keystroke").textContent).toBe(
        "x ^x",
      );
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .used")).toHaveLength(1);
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .unused")).toHaveLength(0);
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .unmatched")).toHaveLength(0);

      document.dispatchEvent(
        lumine.keymaps.constructor.buildKeydownEvent("a", { target: bottomDockElement }),
      );
      await etch.getScheduler().getNextUpdatePromise();
      expect(bottomDockElement.querySelector(".keybinding-resolver .keystroke").textContent).toBe(
        "a (partial)",
      );
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .used")).toHaveLength(0);
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .unused")).toHaveLength(1);
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .unmatched")).toHaveLength(0);

      document.dispatchEvent(
        lumine.keymaps.constructor.buildKeyupEvent("a", { target: bottomDockElement }),
      );
      await etch.getScheduler().getNextUpdatePromise();
      expect(bottomDockElement.querySelector(".keybinding-resolver .keystroke").textContent).toBe(
        "a ^a",
      );
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .used")).toHaveLength(1);
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .unused")).toHaveLength(0);
      expect(bottomDockElement.querySelectorAll(".keybinding-resolver .unmatched")).toHaveLength(0);
    });
  });
});
