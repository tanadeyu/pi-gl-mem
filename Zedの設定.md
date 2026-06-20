🛠️ settings.json の開き方Ctrl + Shift + P を押してコマンドパレットを開きます。zed: open settings と入力します


//settings.json
{
  "project_panel": {
    "dock": "left",
  },
  "outline_panel": {
    "dock": "left",
  },
  "collaboration_panel": {
    "dock": "left",
  },
  "git_panel": {
    "dock": "left",
  },
  "telemetry": {
    "diagnostics": false,
    "metrics": false,
    "anthropic_retention": false,
  },
  "vim_mode": false,
  "base_keymap": "VSCode",
  "icon_theme": "Zed (Default)",
  "ui_font_size": 16,
  "buffer_font_size": 15,
  "theme": {
    "mode": "dark",
    "light": "One Light",
    "dark": "One Dark",
  },
  "terminal": {
    "shell": {
      "with_arguments": {
        "program": "wsl.exe",
        "args": ["--"],
      },
    },
  },
  "agent": {
    "dock": "right",
  },
  "title_bar": {
    "show_menus": true,
  },
}







Ctrl + Shift + P を押してコマンドパレットを開きます。zed: open keymap と入力してエンターキーを押し、キー設定ファイル（keymap.json）を開きます。

// Zed keymap.json
//
// For information on binding keys, see the Zed
// documentation: https://zed.dev/docs/key-bindings
//
// To see the default key bindings run `zed: open default keymap`
// from the command palette.
[
  {
    "context": "Workspace",
    "bindings": {
      // "shift shift": "file_finder::Toggle"
      "ctrl-@": "terminal_panel::ToggleFocus",
      "ctrl-shift-a": "workspace::ToggleRightDock",
    },
  },
  {
    "context": "Editor && vim_mode == insert",
    "bindings": {
      // "j k": "vim::NormalBefore"
    },
  },
  {
    "context": "AgentPanel",
    "bindings": {
      "escape": "workspace::ToggleRightDock",
    },
  },
]
