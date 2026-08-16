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

  toggle() {
    lumine.workspace.toggle(KEYBINDING_RESOLVER_URI);
  },

  deserializeKeyBindingResolverView(_serialized) {
    return new KeyBindingResolverView();
  },
};
