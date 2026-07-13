<div align="center">

![](img/hero.png)

### Crafted for the way you think.

</div>

## Overview

### Fresh. Familiar. Focused.

**A modern design that feels at home.** Clean typography, refined spacing, and native-inspired components make Bamboo China feel like it belongs on your device.

![](img/desktop.png)

**Built for mobile.** Everything is redesigned for touch. One-hand reachability, comfortable spacing, and intuitive layout make your vault feel right in your pocket.

![](img/mobile.png)

**Native everywhere.** Bamboo China adapts to every platform, delivering a consistent and polished look whether you're on desktop or mobile.

![](img/adaptive.png)

## Philosophy

### Less is more.

Bamboo China exists because great tools should just work. No rabbit holes. No endless tweaking. Just a beautiful, distraction-free place to think and write.

- **Fewer plugins**

  Everything you need is here without plugins. Bamboo China is complete the moment you install it.

- **Fewer customizations**

  Every option is an invitation to procrastinate. Bamboo China keeps choices intentionally minimal so you stay in flow.

- **Less visual noise**

  Low-priority UI elements step back automatically. What remains is what matters.

## Plugins

Bamboo China works beautifully on its own. These plugins let you fine-tune the experience if you'd like.

### [Style Settings](https://github.com/mgmeyers/obsidian-style-settings)

Enable focus view, hover sidebars. Or disable active line highlight, centered tabs, and compact status bar, and more.

### [Pseudo Mica](https://github.com/aaaaalexis/obsidian-pseudo-mica)

Bring translucent window effects to Windows and macOS for an even more native feel. (第三方插件,原作者 aaaaalexis)

### Ambience color schemes (意境配色)

A signature Bamboo China feature. Choose an Eastern palette from **Style Settings → Bamboo China → 意境配色**; the theme adds a `cn-<name>` class to `<body>` and re-tints the side panels (the "frame", `--background-secondary`) and the signature accent — while keeping the editor canvas pure white. This is the *"white paper at the heart, indigo frame around it"* (白纸为心、黛青为框) principle in action.

| Palette (pinyin) | 中文 | Mood |
| :--------------- | :--- | :--- |
| `zhuyin`   | 朱印 | Vermillion Seal   |
| `moye`     | 墨叶 | Ink Leaf          |
| `yanzhi`   | 胭脂 | Rouge             |
| `qinglu`   | 青绿 | Cyan-Green        |
| `liujin`   | 流金 | Flowing Gold      |
| `tianqing` | 天青 | Sky Cyan          |
| `daizi`    | 黛紫 | Dark Violet       |
| `haitang`  | 海棠 | Crabapple         |
| `bohe`     | 薄荷 | Mint              |
| `hupo`     | 琥珀 | Amber             |
| `dianlan`  | 靛蓝 | Indigo            |
| `danju`    | 丹橘 | Cinnabar Orange   |
| `ehuang`   | 鹅黄 | Gosling Yellow    |
| `songhua`  | 松花 | Pine Pollen       |
| `zheshi`   | 赭石 | Ochre             |
| `ouhe`     | 藕荷 | Lotus Pink        |
| `yuebai`   | 月白 | Moon White        |

## Features

Bamboo China supports most filter and helper classes from [Minimal](https://github.com/kepano/obsidian-minimal).

### Banner

| Class                   | Description                                                                                 |
| :---------------------- | :------------------------------------------------------------------------------------------ |
| `banner`                | Add at the end of the image link, e.g. `![[image.jpeg\|banner]]`                            |
| `banner-fade`           | Add faded edge to the banner (requires `banner`)                                            |
| `banner-icon`           | Add an emoji or letter as note icon using callout, e.g. `> [!banner-icon] 👋`               |
| `banner-title`          | Moves inline title next to the icon (requires `banner-icon`)                                |
| `y0`, `y5`... to `y100` | Adjust the vertical position of the banner (requires `banner`), from 0 to 100 in steps of 5 |

### [Block width](https://minimal.guide/features/block-width)

| Class                                  | Description                           |
| :------------------------------------- | :------------------------------------ |
| `wide`                                 | Entire note uses wide line width      |
| `max`                                  | Entire note uses max line width       |
| `table-100`, `bases-100`, `img-100`    | Fill 100% of the pane width           |
| `table-max`, `bases-max`, `img-max`    | Fill the max line width (default 90%) |
| `table-wide`, `bases-wide`, `img-wide` | Fill the wide line width              |

### [Cards](https://minimal.guide/Block+types/Cards)

| Class                 | Description                                      |
| :-------------------- | :----------------------------------------------- |
| `cards` (required)    | Set all Dataview tables to card layout           |
| `list-cards`          | Set all bullet lists to card layout              |
| `cards-align-bottom`  | Align the last element of a card to the bottom   |
| `cards-cover`         | Images are resized to fill the defined space     |
| `cards-16-9`          | Fit images in cards to 16:9 ratio                |
| `cards-1-1`           | Fit images in cards to 1:1 ratio (square)        |
| `cards-2-1`           | Fit images in cards to 2:1 ratio                 |
| `cards-2-3`           | Fit images in cards to 2:3 ratio                 |
| `cards-cols-1` to `8` | Force a specific number of columns (from 1 to 8) |

### Embeds

| Class              | Description              |
| :----------------- | :----------------------- |
| `embed-strict`     | Remove embed background  |
| `embed-hide-title` | Hide embedded file title |

### [Image filters](https://minimal.guide/images#Image+filters)

Add at the end of the image link, e.g. `![[image.jpeg#invert]]`

| Filter       | Description                                                                        |
| :----------- | :--------------------------------------------------------------------------------- |
| `#blend`     | Blend image into background                                                        |
| `#invert`    | Invert images in dark mode — ideal for charts and handwriting on light backgrounds |
| `#invertW`   | Invert images in light mode — ideal for charts and handwriting on dark backgrounds |
| `#circle`    | Crop image to a circle                                                             |
| `#outline`   | Add outline around image                                                           |
| `#interface` | Add drop shadow behind image                                                       |

### [Image grids](https://minimal.guide/Block+types/Image+grids)

| Class      | Description          |
| :--------- | :------------------- |
| `img-grid` | Activate image grids |

### [Tables](https://minimal.guide/tables)

| Class           | Description                                         |
| :-------------- | :-------------------------------------------------- |
| `table-nowrap`  | Disable line wrapping in table cells                |
| `table-wrap`    | Force line wrapping in table cells                  |
| `table-center`  | Center small tables narrower than line width        |
| `table-numbers` | Add row numbers to tables                           |
| `table-tabular` | Use tabular figures in tables                       |
| `table-small`   | Use small font size in tables                       |
| `table-tiny`    | Use tiny font size in tables                        |
| `table-lines`   | Add borders around all table cells                  |
| `row-lines`     | Add borders between table rows                      |
| `col-lines`     | Add borders between table columns                   |
| `row-alt`       | Add striped background to alternating table rows    |
| `col-alt`       | Add striped background to alternating table columns |
| `row-hover`     | Highlight rows on hover                             |

### [Bases](https://minimal.guide/tables)

| Class           | Description                                                    |
| :-------------- | :------------------------------------------------------------- |
| `bases-row-alt` | Add striped background to alternating Bases table view rows    |
| `bases-col-alt` | Add striped background to alternating Bases table view columns |
| `bases-plain`   | Hide embedded Bases toolbar                                    |

### [Alternate checkboxes](https://github.com/damiankorcz/Alternative-Checkboxes-Reference-Set)

![Preview of alternate checkboxes.](img/checkbox.png)

| Syntax  | Description |
| ------- | ----------- |
| `- [ ]` | To-do       |
| `- [/]` | Incomplete  |
| `- [x]` | Done        |
| `- [-]` | Canceled    |
| `- [>]` | Forwarded   |
| `- [<]` | Scheduling  |
| `- [?]` | Question    |
| `- [!]` | Important   |
| `- [*]` | Star        |
| `- ["]` | Quote       |
| `- [l]` | Location    |
| `- [b]` | Bookmark    |
| `- [i]` | Information |
| `- [S]` | Savings     |
| `- [I]` | Idea        |
| `- [p]` | Pros        |
| `- [c]` | Cons        |
| `- [f]` | Fire        |
| `- [k]` | Key         |
| `- [w]` | Win         |
| `- [u]` | Up          |
| `- [d]` | Down        |
| `- [+]` | Add         |
| `- [B]` | Brainstorm  |
| `- [a]` | Alarm       |
| `- [n]` | Note        |
| `- [R]` | Review      |
| `- [t]` | Time        |
| `- [P]` | Phone       |
| `- [L]` | Love        |

## Credits

- [**Craft Docs**](https://www.craft.do/) - Interface design inspiration
- [**Yushan Main East Peak** by Huang Chung Yu](https://commons.wikimedia.org/wiki/File:Yushan_main_east_peak%2BHuang_Chung_Yu%E9%BB%83%E4%B8%AD%E4%BD%91%2B9030.png) - Yushan background
- [**Minimal** by kepano](https://github.com/kepano/obsidian-minimal) ([Donate](https://www.buymeacoffee.com/kepano)) - Dataview cards, image filters, table helper classes

## License

Bamboo China is licensed under the [MIT license](LICENSE).
