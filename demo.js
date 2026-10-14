// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: ["language-gfm"],
  viewport: { width: 1100, height: 500 },
  async before() {},
  async prepare(context) {
    const { lumine, state, fixture, open } = context;
    state.editor = await open("more/README.md");
    await lumine.project.setPaths([fixture("more")]);
  },
  scenes: [
    {
      id: "scene-1",
      file: "demo.png",
      caption: "Inspect the command and scope resolved by a keyboard shortcut.",
      timeout: 60000,
      async run(context) {
        const { lumine, state } = context;
        {
          lumine.commands.dispatch(
            lumine.views.getView(state.editor),
            "keybinding-resolver:toggle",
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        {
          state.editor.getElement().focus();
          state.editor.getElement().dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "ArrowDown",
              code: "ArrowDown",
              bubbles: true,
              cancelable: true,
            }),
          );
        }
      },
      ready() {
        return Boolean(
          document.querySelector(".keybinding-resolver")?.innerText.includes("core:move-down"),
        );
      },
    },
  ],
  async cleanup() {},
};
