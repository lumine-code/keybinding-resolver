const { it, fit, ffit, beforeEach } = require("./async-spec-helpers"); // eslint-disable-line no-unused-vars
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
      spyOn(etch.getScheduler(), "updateDocument").andCallThrough();
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

    it("displays all commands for the keydown event but does not clear for the keyup when there is no keyup binding", async () => {
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
