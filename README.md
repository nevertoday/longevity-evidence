# 长寿证据 · Longevity Evidence

[中文](#中文) · [English](#english)

## 中文

这是一个静态网站，把 [geekan/HowToLiveLonger](https://github.com/geekan/HowToLiveLonger) 核验过的 64 项长寿研究按日常话题重新组织。每项研究先说可以怎么做，再说证据等级，最后列出原始论文。原版说法里说错、说大的地方，单独放在「流行说法」页。

医学内容原样来自上游，本仓库不改写。界面用[小小东 UI Kit](https://ui.xiaoxiaodong.ai) 的原生层。

### 构建

需要 Node 26 或更高版本。构建和检查不需要安装依赖。

```sh
npm run build    # 生成 dist/
npm run check    # 检查内容完整、链接、lang、canonical 和 hreflang
```

线上地址是 https://longevity.xiaoxiaodong.ai （Cloudflare Workers 静态资源，配置见 `wrangler.jsonc`）。`npm run deploy` 会构建、检查并上传。fork 后部署到别的域名时设置 `SITE_ORIGIN`，canonical 和 hreflang 会用到它：

```sh
SITE_ORIGIN=https://你的域名 npm run build
```

`dist/` 是纯静态文件，放到任何静态托管上即可。本地预览可以用 `python3 -m http.server --directory dist`，看完记得停掉。

其他命令：

```sh
npm install                 # 只为下面的类型检查装 typescript
npm run typecheck
npm run screenshots         # 390 和 1440 宽、亮暗两种主题的截图，写到 .screenshots/
```

### 语言

网站有 8 种语言：简体中文、English、Español、Français、Deutsch、Português、日本語、العربية。研究文字、术语表和等级说明来自上游；界面文字在 `src/ui/<语言>.json`。西、法、德、葡、日、阿六种语言的界面文字由 Gemini 翻译，还没有母语者审读，欢迎提修改。

改界面文字时，所有语言文件的键和 `{count}` 这样的占位符必须和 `src/ui/zh.json` 一致，否则构建失败。

加第 9 种语言需要上游先有这种语言的研究文字，然后：

1. 在 `src/locales.ts` 的 `LOCALE_CODES` 和 `LOCALES` 里各加一项。
2. 复制 `src/ui/en.json` 为 `src/ui/<代码>.json`，翻译每个值。
3. 运行 `npm run build && npm run check`。

阿拉伯语的 `dir` 是 `rtl`，样式全部用逻辑属性。

### 数据来源

`data/upstream/` 是上游文件的副本，`data/upstream/SOURCE.json` 记录仓库地址和提交 SHA（现在是 `5637cbc`）。更新上游：

```sh
git clone https://github.com/geekan/HowToLiveLonger /tmp/HowToLiveLonger
npm run sync -- /tmp/HowToLiveLonger
npm run build && npm run check
```

`src/model.ts` 在边界上把上游文件解析成 `Study`。子分类、结论和等级都查表转换，遇到不认识的值会直接报错。话题由子分类表决定，另有 8 条按 ID 的例外。

证据等级只说证据有多可靠，不说有益还是有害。`src/directions.ts` 给每条记录定一个方向（有益、有害、没看到效果、好坏不定），附一行依据，只看上游的效应量、区间、比较对象和研究发现。上游新增或删除记录而这张表没跟上，构建会报错。首页按方向分成「有较强证据支持去做的」和「有较强证据说没用或有害的」，`npm run check` 会核对前者里没有有害或没效果的研究。医学内容的修改请提交到上游，见它的 [CONTRIBUTING.md](https://github.com/geekan/HowToLiveLonger/blob/main/CONTRIBUTING.md)。

### 许可

本仓库以 Unlicense 发布到公共领域，和上游一致。`vendor/xxd/` 例外，它来自小小东 UI Kit，按 PolyForm Noncommercial 许可使用，详见 [NOTICE](NOTICE)。

## English

A static website that reorganizes the 64 longevity studies checked by [geekan/HowToLiveLonger](https://github.com/geekan/HowToLiveLonger) into everyday topics. Each study page starts with what you can do, then gives the evidence grade and the original papers. Claims from the original guide that turned out wrong or overstated get their own "Popular claims" page.

The medical content comes unchanged from upstream. This repository does not rewrite it. The interface uses the native layer of the [小小东 UI Kit](https://ui.xiaoxiaodong.ai).

### Build

You need Node 26 or later. The build and the check need no installed packages.

```sh
npm run build    # writes dist/
npm run check    # checks content, links, lang, canonical and hreflang
```

The live site is https://longevity.xiaoxiaodong.ai (Cloudflare Workers static assets, configured in `wrangler.jsonc`). `npm run deploy` builds, checks and uploads. A fork that deploys elsewhere sets `SITE_ORIGIN`, which canonical and hreflang URLs use:

```sh
SITE_ORIGIN=https://your.domain npm run build
```

`dist/` is plain static files for any static host. To preview locally, run `python3 -m http.server --directory dist` and stop it when you finish.

Other commands:

```sh
npm install                 # installs typescript, used only by typecheck
npm run typecheck
npm run screenshots         # 390 and 1440 wide, light and dark, into .screenshots/
```

### Languages

The site has eight languages: 简体中文, English, Español, Français, Deutsch, Português, 日本語 and العربية. Study text, the glossary and the grade descriptions come from upstream. Interface text lives in `src/ui/<code>.json`. Gemini translated the interface text for Spanish, French, German, Portuguese, Japanese and Arabic, and no native speaker has reviewed it yet. Corrections are welcome.

Every language file must have the same keys and placeholders such as `{count}` as `src/ui/zh.json`, or the build fails.

A ninth language needs upstream study text in that language first. Then:

1. Add it to `LOCALE_CODES` and `LOCALES` in `src/locales.ts`.
2. Copy `src/ui/en.json` to `src/ui/<code>.json` and translate every value.
3. Run `npm run build && npm run check`.

Arabic has `dir: 'rtl'`, and the stylesheet uses logical properties throughout.

### Data provenance

`data/upstream/` holds copies of the upstream files. `data/upstream/SOURCE.json` records the repository and the commit SHA, currently `5637cbc`. To update:

```sh
git clone https://github.com/geekan/HowToLiveLonger /tmp/HowToLiveLonger
npm run sync -- /tmp/HowToLiveLonger
npm run build && npm run check
```

`src/model.ts` parses the upstream files into `Study` records at the boundary. Subcategories, verdicts and grades go through lookup tables, and an unknown value stops the build. A subcategory table picks each study's topic, with eight per-ID exceptions.

An evidence grade says how reliable the evidence is, not whether the thing helps. `src/directions.ts` gives every record a direction (helps, harms, no effect found, mixed or unclear) with a one-line reason, read only from upstream's effect estimate, interval, comparison and findings. If upstream adds or drops a record and the table does not follow, the build stops. The home page splits strong evidence by direction, and `npm run check` confirms that nothing that harms or has no effect sits in the "these help" list. Send medical corrections upstream, following its [CONTRIBUTING.md](https://github.com/geekan/HowToLiveLonger/blob/main/CONTRIBUTING.md).

### License

This repository is released into the public domain under the Unlicense, like upstream. The exception is `vendor/xxd/`, which comes from the 小小东 UI Kit under the PolyForm Noncommercial license. See [NOTICE](NOTICE).

### Layout

```text
data/upstream/       upstream files and SOURCE.json
scripts/build.ts     renders dist/
scripts/check.ts     checks content and dist/
scripts/sync-upstream.ts
scripts/screenshots.ts
src/locales.ts       the eight languages and which are on
src/model.ts         parses upstream into Study records; topic tables
src/directions.ts    which way each record's evidence points, with the reason
src/pages.ts         routes, layout and one renderer per page kind
src/claim.ts         renders the archived Markdown in original claims
src/ui/<code>.json   interface text; zh.json defines the keys
src/assets/          site.css and site.js, copied to dist/assets/
vendor/xxd/          the UI kit files from `pnpm xxd init`
```
