/** @jsx etch.dom */
const fs = require("@lumine-code/fs-plus");
const etch = require("@lumine-code/etch");
const { CompositeDisposable } = require("lumine");
const path = require("path");

module.exports = class KeyBindingResolverView {
  constructor() {
    this.keystrokes = null;
    this.usedKeyBinding = null;
    this.unusedKeyBindings = [];
    this.unmatchedKeyBindings = [];
    this.partiallyMatchedBindings = [];
    this.attached = false;
    this.disposables = new CompositeDisposable();
    this.keybindingDisposables = new CompositeDisposable();

    this.disposables.add(
      lumine.workspace.getBottomDock().observeActivePaneItem((item) => {
        if (item === this) {
          this.attach();
        } else {
          this.detach();
        }
      }),
    );

    this.disposables.add(
      lumine.workspace.getBottomDock().observeVisible((visible) => {
        if (visible) {
          if (lumine.workspace.getBottomDock().getActivePaneItem() === this) this.attach();
        } else {
          this.detach();
        }
      }),
    );

    etch.initialize(this);
  }

  getTitle() {
    return "Key Binding Resolver";
  }

  getIconName() {
    return "keyboard";
  }

  getDefaultLocation() {
    return "bottom";
  }

  getAllowedLocations() {
    // TODO: Support left and right possibly
    return ["bottom"];
  }

  getURI() {
    return "lumine://keybinding-resolver";
  }

  serialize() {
    return {
      deserializer: "keybinding-resolver/KeyBindingResolverView",
    };
  }

  destroy() {
    this.disposables.dispose();
    this.detach();
    return etch.destroy(this);
  }

  attach() {
    if (this.attached) return;

    this.attached = true;
    this.keybindingDisposables = new CompositeDisposable();
    this.keybindingDisposables.add(
      lumine.keymaps.onDidMatchBinding(
        ({ keystrokes, binding, keyboardEventTarget, eventType }) => {
          if (eventType === "keyup" && binding == null) {
            return;
          }

          const unusedKeyBindings = lumine.keymaps
            .findKeyBindings({ keystrokes, target: keyboardEventTarget })
            .filter((b) => b !== binding);

          const unmatchedKeyBindings = lumine.keymaps
            .findKeyBindings({ keystrokes })
            .filter((b) => b !== binding && !unusedKeyBindings.includes(b));

          this.update({
            usedKeyBinding: binding,
            unusedKeyBindings,
            unmatchedKeyBindings,
            keystrokes,
          });
        },
      ),
    );

    this.keybindingDisposables.add(
      lumine.keymaps.onDidPartiallyMatchBindings(({ keystrokes, partiallyMatchedBindings }) => {
        this.update({ keystrokes, partiallyMatchedBindings });
      }),
    );

    this.keybindingDisposables.add(
      lumine.keymaps.onDidFailToMatchBinding(({ keystrokes, keyboardEventTarget, eventType }) => {
        if (eventType === "keyup") {
          return;
        }

        const unusedKeyBindings = lumine.keymaps.findKeyBindings({
          keystrokes,
          target: keyboardEventTarget,
        });
        const unmatchedKeyBindings = lumine.keymaps
          .findKeyBindings({ keystrokes })
          .filter((b) => !unusedKeyBindings.includes(b));

        this.update({ unusedKeyBindings, unmatchedKeyBindings, keystrokes });
      }),
    );
  }

  detach() {
    if (!this.attached) return;

    this.attached = false;
    this.keybindingDisposables.dispose();
    this.keybindingDisposables = null;
  }

  update(props) {
    this.keystrokes = props.keystrokes;
    this.usedKeyBinding = props.usedKeyBinding;
    this.unusedKeyBindings = props.unusedKeyBindings || [];
    this.unmatchedKeyBindings = props.unmatchedKeyBindings || [];
    this.partiallyMatchedBindings = props.partiallyMatchedBindings || [];
    return etch.update(this);
  }

  render() {
    return (
      <div className="keybinding-resolver">
        <div className="panel-heading">{this.renderKeystrokes()}</div>
        <div className="panel-body">{this.renderKeyBindings()}</div>
      </div>
    );
  }

  renderKeystrokes() {
    if (this.keystrokes) {
      if (this.partiallyMatchedBindings.length > 0) {
        return <span className="keystroke highlight-info">{this.keystrokes} (partial)</span>;
      } else {
        return <span className="keystroke highlight-info">{this.keystrokes}</span>;
      }
    } else {
      return <span>Press any key</span>;
    }
  }

  renderKeyBindings() {
    if (this.partiallyMatchedBindings.length > 0) {
      return (
        <table className="table-condensed">
          <tbody>
            {this.partiallyMatchedBindings.map((binding) => (
              <tr className="unused">
                <td className="copy" onclick={() => this.copyKeybinding(binding)}>
                  <span className="icon icon-clippy" />
                </td>
                <td className="command">{binding.command}</td>
                <td className="keystrokes">{binding.keystrokes}</td>
                <td className="selector">{binding.selector}</td>
                <td className="source" onclick={() => this.openKeybindingFile(binding.source)}>
                  {binding.source}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else {
      let usedKeyBinding = "";
      if (this.usedKeyBinding) {
        usedKeyBinding = (
          <tr className="used">
            <td className="copy" onclick={() => this.copyKeybinding(this.usedKeyBinding)}>
              <span className="icon icon-clippy" />
            </td>
            <td className="command">{this.usedKeyBinding.command}</td>
            <td className="selector">{this.usedKeyBinding.selector}</td>
            <td
              className="source"
              onclick={() => this.openKeybindingFile(this.usedKeyBinding.source)}
            >
              {this.usedKeyBinding.source}
            </td>
          </tr>
        );
      }
      return (
        <table className="table-condensed">
          <tbody>
            {usedKeyBinding}
            {this.unusedKeyBindings.map((binding) => (
              <tr className="unused">
                <td className="copy" onclick={() => this.copyKeybinding(binding)}>
                  <span className="icon icon-clippy" />
                </td>
                <td className="command">{binding.command}</td>
                <td className="selector">{binding.selector}</td>
                <td className="source" onclick={() => this.openKeybindingFile(binding.source)}>
                  {binding.source}
                </td>
              </tr>
            ))}
            {this.unmatchedKeyBindings.map((binding) => (
              <tr className="unmatched">
                <td className="copy" onclick={() => this.copyKeybinding(binding)}>
                  <span className="icon icon-clippy" />
                </td>
                <td className="command">{binding.command}</td>
                <td className="selector">{binding.selector}</td>
                <td className="source" onclick={() => this.openKeybindingFile(binding.source)}>
                  {binding.source}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  }

  isInAsarArchive(pathToCheck) {
    const resourcePath = lumine.application.getResourcePath();
    return (
      pathToCheck.startsWith(`${resourcePath}${path.sep}`) && path.extname(resourcePath) === ".asar"
    );
  }

  extractBundledKeymap(bundledKeymapPath) {
    const metadata = require(path.join(lumine.application.getResourcePath(), "package.json"));
    const bundledKeymaps = metadata ? metadata._lumineKeymaps : {};
    const keymapName = path.basename(bundledKeymapPath);
    const extractedKeymapPath = path.join(
      require("@lumine-code/temp").mkdirSync("lumine-bundled-keymap-"),
      keymapName,
    );
    fs.writeFileSync(
      extractedKeymapPath,
      JSON.stringify(bundledKeymaps[keymapName] || {}, null, 2),
    );
    return extractedKeymapPath;
  }

  extractBundledPackageKeymap(keymapRelativePath) {
    const packageName = keymapRelativePath.split(path.sep)[1];
    const keymapName = path.basename(keymapRelativePath);
    const metadata = lumine.packages.packagesCache[packageName] || {};
    const keymaps = metadata.keymaps || {};
    const extractedKeymapPath = path.join(
      require("@lumine-code/temp").mkdirSync("lumine-bundled-keymap-"),
      keymapName,
    );
    fs.writeFileSync(
      extractedKeymapPath,
      JSON.stringify(keymaps[keymapRelativePath] || {}, null, 2),
    );
    return extractedKeymapPath;
  }

  openKeybindingFile(keymapPath) {
    if (this.isInAsarArchive(keymapPath)) {
      keymapPath = this.extractBundledKeymap(keymapPath);
    } else if (keymapPath.startsWith("core:node_modules")) {
      keymapPath = this.extractBundledPackageKeymap(keymapPath.replace("core:", ""));
    } else if (keymapPath.startsWith("core:")) {
      keymapPath = this.extractBundledKeymap(keymapPath.replace("core:", ""));
    }

    lumine.workspace.open(keymapPath);
  }

  copyKeybinding(binding) {
    let content;
    const keymapExtension = path.extname(lumine.keymaps.getUserKeymapPath());
    let escapedKeystrokes = binding.keystrokes.replace(/\\/g, "\\\\"); // Escape backslashes
    if (keymapExtension === ".cson") {
      content = `\
'${binding.selector}':
  '${escapedKeystrokes}': '${binding.command}'
`;
    } else {
      content = `\
"${binding.selector}": {
  "${escapedKeystrokes}": "${binding.command}"
}
`;
    }

    lumine.notifications.addInfo("Keybinding Copied");
    return lumine.clipboard.write(content);
  }
};
