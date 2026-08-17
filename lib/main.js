const { CompositeDisposable } = require("lumine");

const KeyBindingResolverView = require("./keybinding-resolver-view");
const etch = require("@lumine-code/etch");

// Etch holds its scheduler per copy of the library, and this package resolves
// its own copy — so the assignment the editor makes on core's copy never
// reaches it. Point it at the view registry before anything renders, or this
// package's DOM writes land on an animation frame of their own alongside the
// editor's and force a synchronous reflow.
etch.setScheduler(lumine.views);

const KEYBINDING_RESOLVER_URI = "lumine://keybinding-resolver";

module.exports = {
  activate() {
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      lumine.workspace.addOpener((uri) => {
        if (uri === KEYBINDING_RESOLVER_URI) {
          return new KeyBindingResolverView();
        }
      }),
    );

    this.subscriptions.add(
      lumine.commands.add("lumine-workspace", {
        "keybinding-resolver:toggle": () => this.toggle(),
      }),
    );
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  async toggle() {
    // Not workspace.toggle(): that activates the pane on show, pulling focus
    // out of the editor whose keystrokes the resolver is meant to watch. The
    // dock only reveals itself on pane activation, so show it explicitly.
    if (lumine.workspace.hide(KEYBINDING_RESOLVER_URI)) return;
    await lumine.workspace.open(KEYBINDING_RESOLVER_URI, {
      searchAllPanes: true,
      activatePane: false,
    });
    lumine.workspace.getBottomDock().show();
  },

  deserializeKeyBindingResolverView(_serialized) {
    return new KeyBindingResolverView();
  },
};
