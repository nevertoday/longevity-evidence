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

部署前设置网站地址，canonical 和 hreflang 会用到它：

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

### 添加一种语言

上游已经有 8 种语言的研究文字、术语表和等级说明。以西班牙语为例：

1. 在 `src/locales.ts` 里把 `es` 的 `enabled` 改成 `true`。
2. 复制 `src/ui/en.json` 为 `src/ui/es.json`，翻译每个值，保留 `{count}` 这样的占位符。
3. 运行 `npm run build && npm run check`。缺键、占位符不一致、缺研究文字都会报错。

阿拉伯语的 `dir` 已经是 `rtl`，样式全部用逻辑属性。

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

Set the site address before a real deploy. Canonical and hreflang URLs use it:

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

### Add a language

Upstream already has study text, the glossary and the grade descriptions in eight languages. For Spanish:

1. In `src/locales.ts`, set `enabled: true` for `es`.
2. Copy `src/ui/en.json` to `src/ui/es.json` and translate every value. Keep placeholders such as `{count}`.
3. Run `npm run build && npm run check`. A missing key, a changed placeholder or missing study text fails the build or the check.

Arabic already has `dir: 'rtl'`, and the stylesheet uses logical properties throughout.

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
