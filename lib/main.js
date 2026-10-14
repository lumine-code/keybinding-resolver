const { CompositeDisposable } = require("lumine");

const KEYBINDING_RESOLVER_URI = "lumine://keybinding-resolver";
// A returned item can be adopted by a later module generation while an older
// workspace.open is pending. Keep its ownership visible across those generations.
const VIEW_OWNER = Symbol.for("keybinding-resolver.activation-owner");

module.exports = {
  provideBackgroundTips() {
    return {
      packageName: "keybinding-resolver",
      tips: [
        "You can see which command a keystroke resolves to with {{ 'keybinding-resolver:toggle' | keystroke }}",
      ],
    };
  },

  activate() {
    const activation = Symbol("keybinding-resolver activation");
    this.activation = activation;
    this.toggleSequence = 0;
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(
      lumine.workspace.addOpener((uri, options) => {
        if (uri === KEYBINDING_RESOLVER_URI) {
          return this.createView(options?.[VIEW_OWNER] ?? activation);
        }
      }),
    );

    this.subscriptions.add(
      lumine.commands.add("lumine-workspace", {
        "keybinding-resolver:toggle": () => this.toggle(),
      }),
    );
  },

  async deactivate() {
    const activation = this.activation;
    this.activation = null;
    this.subscriptions?.dispose();
    this.subscriptions = null;
    await this.destroyViews(activation);
  },

  createView(activation = this.activation) {
    require("@lumine-code/etch").setScheduler(lumine.views);
    const KeyBindingResolverView = require("./keybinding-resolver-view");
    const item = new KeyBindingResolverView();
    item[VIEW_OWNER] = activation;
    return item;
  },

  async destroyView(item, activation = this.activation) {
    if (!item || item.disposables?.disposed) return;
    const canDestroy = () => item[VIEW_OWNER] == null || item[VIEW_OWNER] === activation;
    if (!canDestroy()) return;
    const pane = lumine.workspace.paneForItem(item);
    if (pane) await pane.destroyItem(item, true, { canDestroy });
    else if (canDestroy()) await item.destroy?.();
  },

  async destroyViews(activation = this.activation) {
    const closures = [];
    for (const item of lumine.workspace.getPaneItems()) {
      if (item?.getURI?.() !== KEYBINDING_RESOLVER_URI) continue;
      if (item[VIEW_OWNER] != null && item[VIEW_OWNER] !== activation) continue;
      closures.push(this.destroyView(item, activation));
    }
    await Promise.all(closures);
  },

  async toggle() {
    const activation = this.activation;
    if (!activation) return;
    const sequence = ++this.toggleSequence;
    // Not workspace.toggle(): that activates the pane on show, pulling focus
    // out of the editor whose keystrokes the resolver is meant to watch. The
    // dock only reveals itself on pane activation, so show it explicitly.
    if (lumine.workspace.hide(KEYBINDING_RESOLVER_URI)) return;
    const item = await lumine.workspace.open(KEYBINDING_RESOLVER_URI, {
      searchAllPanes: true,
      activatePane: false,
      [VIEW_OWNER]: activation,
    });
    if (this.activation !== activation) {
      if (item?.[VIEW_OWNER] === activation) await this.destroyView(item, activation);
      return;
    }
    if (!item || this.toggleSequence !== sequence) return;
    item[VIEW_OWNER] = activation;
    lumine.workspace.getBottomDock().show();
  },

  deserializeKeyBindingResolverView(_serialized) {
    return this.createView();
  },
};
