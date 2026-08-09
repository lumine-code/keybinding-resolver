const { CompositeDisposable } = require("lumine");

const KeyBindingResolverView = require("./keybinding-resolver-view");

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
