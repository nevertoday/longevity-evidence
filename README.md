# 活得更久 · Live Longer

[中文](#中文) · [English](#english)

## 中文

这是一个静态网站，用白话讲 [geekan/HowToLiveLonger](https://github.com/geekan/HowToLiveLonger) 核验过的 64 项长寿研究。首页和话题页把每项研究做成一张卡片：一个普通人会问的问题、一句回答、有益还是有害、证据有多强。点进去是一条主线：回答、你可以怎么做、为什么这么说、要注意什么、证据有多可靠、原始论文。原版说法里说错、说大的地方，单独放在「流行说法」页。

医学内容和对每条说法的结论原样来自上游。每页的白话问题、回答和解释由本站根据上游数据写成（`content/explain/<语言>.json`），可能有简化；每页「想看原始数据？」里保留上游的完整原文。界面用[小小东 UI Kit](https://ui.xiaoxiaodong.ai) 的原生层。

### 构建

需要 Node 26 或更高版本。构建和检查不需要安装依赖。

```sh
npm run build    # 生成 dist/
npm run check    # 检查内容完整、没有 TODO 占位、链接、lang、canonical、hreflang、sitemap 和结构化数据
```

线上地址是 https://longevity.xiaoxiaodong.ai （Cloudflare Workers 静态资源，配置见 `wrangler.jsonc`）。`npm run deploy` 会构建、检查并上传。fork 后部署到别的域名时设置 `SITE_ORIGIN`，canonical、hreflang、sitemap 和结构化数据都会用到它：

```sh
SITE_ORIGIN=https://你的域名 npm run build
```

`dist/` 是纯静态文件，放到任何静态托管上即可。本地预览可以用 `python3 -m http.server --directory dist`，看完记得停掉。

其他命令：

```sh
npm install                 # 只为下面的类型检查装 typescript
npm run typecheck
npm run screenshots         # 390 和 1440 宽的截图，写到 .screenshots/
```

### 语言

网站有 8 种语言：简体中文、English、Español、Français、Deutsch、Português、日本語、العربية。研究文字、术语表和等级说明来自上游；界面文字在 `src/ui/<语言>.json`。西、法、德、葡、日、阿六种语言的界面文字由 Gemini 翻译，还没有母语者审读，欢迎提修改。

改界面文字时，所有语言文件的键和 `{count}` 这样的占位符必须和 `src/ui/zh.json` 一致，否则构建失败。还没翻译的文字写成 `"TODO "` 加英文，`npm run check` 会把它们列出来，有占位就不能部署。

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

`src/model.ts` 在边界上把上游文件解析成 `Study`。子分类、结论和等级都查表转换，遇到不认识的值会直接报错。话题由子分类表决定，另有 8 条按 ID 的例外。`src/explain.ts` 读 `content/explain/`，每种语言每条记录都要有问题、回答、两到四句解释、注意事项，以及（原说法有问题时）流行说法。流行说法只写原说法里被研究否定的那部分，一句话说完，中文不超过 40 字，超长会构建失败；原说法全文留在研究页的「原始数据」里。它还按研究设计把每条记录分成随机试验、跟踪观察和间接证据三类。

上游可能只改某条记录的数字而不改 ID。`src/fingerprint.ts` 给每条记录的中文原文算一个指纹，`content/upstream-fingerprints.json` 记着本站的方向、研究类型、话题例外和白话解读上次核对时它的指纹。同步后如果有记录变了，`npm run check` 会列出这些 ID；对照 `git diff -- data/upstream` 改好本站的几层内容，再运行 `npm run mark-checked -- <ID>`。`src/explain.ts` 里的 `EXPLAIN_STAGE` 记着每种语言的解读审到了哪一步（机器翻译、已对照上游核对、已有人审读），关于页会照实告诉读者。

证据等级只说证据有多可靠，不说有益还是有害。`src/directions.ts` 给每条记录定一个方向（有益、有害、没看到效果、好坏不定），附一行依据，只看上游的效应量、区间、比较对象和研究发现。上游新增或删除记录而这张表没跟上，构建会报错。首页按方向分成「值得做的事」和「没用，甚至有害」，`npm run check` 会核对前者里没有有害或没效果的研究。医学内容的修改请提交到上游，见它的 [CONTRIBUTING.md](https://github.com/geekan/HowToLiveLonger/blob/main/CONTRIBUTING.md)。

### 搜索引擎

`npm run build` 还会生成 `dist/sitemap.xml` 和 `dist/robots.txt`。sitemap 列出根页面和每种语言的每个页面，每条都带 8 种语言的 hreflang 互链，首页和根页面另有 x-default。它不写 lastmod，因为全站一个日期对大多数页面都不准。robots.txt 允许抓取并指向 sitemap，Cloudflare 会在前面加上它自己托管的内容。

每种语言有 `<语言>/404.html`，`dist/404.html` 用后备语言，Cloudflare 对不存在的地址返回路径上最近的那个。404 页面带 `noindex`，链接都从根路径写起。

每个可索引的页面都有 Open Graph 标签。JSON-LD 里，首页和根页面有 WebSite，话题页和研究页有 BreadcrumbList，研究页还有 MedicalWebPage，列出每篇论文和所依据的上游提交。JSON-LD 不写作者或审稿人，因为还没有医生审读过这些页面。研究页写明两个日期：上游数据的提交日期，和 `content/explain` 最后一次提交的日期。后者在构建时从 git 读取，所以要在 git 仓库里构建。`dateModified` 取两者中较晚的一个。`npm run check` 会核对以上全部。

### 许可

本仓库以 Unlicense 发布到公共领域，和上游一致。`vendor/xxd/` 例外，它来自小小东 UI Kit，按 PolyForm Noncommercial 许可使用，详见 [NOTICE](NOTICE)。

## English

A static website that explains, in plain words, the 64 longevity studies checked by [geekan/HowToLiveLonger](https://github.com/geekan/HowToLiveLonger). The home and topic pages show each study as a card: the question an ordinary reader would ask, a one-line answer, whether it helps or harms, and how strong the evidence is. Each study page follows one storyline: the answer, what you can do, how we know, what to keep in mind, how solid the evidence is, and the original papers. Claims from the original guide that turned out wrong or overstated get their own "Popular claims" page.

The medical content and the verdict on each claim come unchanged from upstream. This site writes the plain-language question, answer and explanation on each page from upstream's data (`content/explain/<code>.json`), and they may simplify it. Every study page keeps upstream's full text under "Want the raw data?". The interface uses the native layer of the [小小东 UI Kit](https://ui.xiaoxiaodong.ai).

### Build

You need Node 26 or later. The build and the check need no installed packages.

```sh
npm run build    # writes dist/
npm run check    # checks content, TODO placeholders, links, lang, canonical, hreflang, the sitemap and structured data
```

The live site is https://longevity.xiaoxiaodong.ai (Cloudflare Workers static assets, configured in `wrangler.jsonc`). `npm run deploy` builds, checks and uploads. A fork that deploys elsewhere sets `SITE_ORIGIN`, which canonical and hreflang URLs, the sitemap and structured data use:

```sh
SITE_ORIGIN=https://your.domain npm run build
```

`dist/` is plain static files for any static host. To preview locally, run `python3 -m http.server --directory dist` and stop it when you finish.

Other commands:

```sh
npm install                 # installs typescript, used only by typecheck
npm run typecheck
npm run screenshots         # 390 and 1440 wide, into .screenshots/
```

### Languages

The site has eight languages: 简体中文, English, Español, Français, Deutsch, Português, 日本語 and العربية. Study text, the glossary and the grade descriptions come from upstream. Interface text lives in `src/ui/<code>.json`. Gemini translated the interface text for Spanish, French, German, Portuguese, Japanese and Arabic, and no native speaker has reviewed it yet. Corrections are welcome.

Every language file must have the same keys and placeholders such as `{count}` as `src/ui/zh.json`, or the build fails. Text that still needs translating is written as `"TODO "` plus the English. `npm run check` lists every such placeholder, and a site with placeholders does not deploy.

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

`src/model.ts` parses the upstream files into `Study` records at the boundary. Subcategories, verdicts and grades go through lookup tables, and an unknown value stops the build. A subcategory table picks each study's topic, with eight per-ID exceptions. `src/explain.ts` reads `content/explain/`. Every record needs, in every language, a question, an answer, two to four sentences of explanation, a caution, and the popular claim when the verdict questions it. The popular claim states only the part the research disputes, in one sentence, with a per-language length limit that fails the build (40 characters in Chinese, 120 in English). The full original wording stays in the study page's raw data. It also sorts each record by study design into randomized trials, observational studies and indirect evidence.

Upstream can change a record's numbers without changing its id. `src/fingerprint.ts` fingerprints each record's Chinese source text, and `content/upstream-fingerprints.json` keeps the fingerprint each record had when this site's direction, kind, topic override and explanations were last checked against it. After a sync, `npm run check` lists every record that changed. Compare with `git diff -- data/upstream`, update this site's layers to fit, then run `npm run mark-checked -- <id>`. `EXPLAIN_STAGE` in `src/explain.ts` records how far each language's explanations have been reviewed (machine-translated, checked against upstream, read by a person), and the about page tells readers.

An evidence grade says how reliable the evidence is, not whether the thing helps. `src/directions.ts` gives every record a direction (helps, harms, no effect found, mixed or unclear) with a one-line reason, read only from upstream's effect estimate, interval, comparison and findings. If upstream adds or drops a record and the table does not follow, the build stops. The home page splits strong evidence by direction, and `npm run check` confirms that nothing that harms or has no effect sits in the "Worth doing" list. Send medical corrections upstream, following its [CONTRIBUTING.md](https://github.com/geekan/HowToLiveLonger/blob/main/CONTRIBUTING.md).

### Search engines

`npm run build` also writes `dist/sitemap.xml` and `dist/robots.txt`. The sitemap lists the root and every page in every language, each with hreflang alternates for all eight languages. Home pages and the root also name x-default. It has no lastmod, because one site-wide date would be wrong for most pages. robots.txt allows everything and points at the sitemap. Cloudflare prepends its own managed block.

Each language has `<code>/404.html`, and `dist/404.html` uses the fallback language. Cloudflare serves the nearest one up a missing URL's path. 404 pages carry `noindex` and use root-absolute links.

Every indexable page has Open Graph tags. In JSON-LD, home pages and the root carry a WebSite node, topic and study pages a BreadcrumbList, and study pages a MedicalWebPage that cites each paper and the upstream commit. The JSON-LD names no author or reviewer, because no clinician has reviewed the pages. Each study page shows two dates: upstream's commit date and the date of the last commit to `content/explain`. The build reads the second from git, so it must run in a git checkout. `dateModified` is the later of the two. `npm run check` verifies all of this.

### License

This repository is released into the public domain under the Unlicense, like upstream. The exception is `vendor/xxd/`, which comes from the 小小东 UI Kit under the PolyForm Noncommercial license. See [NOTICE](NOTICE).

### Layout

```text
data/upstream/       upstream files and SOURCE.json
scripts/build.ts     renders dist/
scripts/check.ts     checks content and dist/
scripts/sync-upstream.ts
scripts/mark-checked.ts  records that a changed upstream record has been rechecked
scripts/screenshots.ts
src/locales.ts       the eight languages and which are on
src/model.ts         parses upstream into Study records; topic tables
src/explain.ts       reads content/explain/; kind of evidence per record
content/explain/     plain-language question, answer and explanation per record and language
src/fingerprint.ts   fingerprints upstream records; content/upstream-fingerprints.json
src/directions.ts    which way each record's evidence points, with the reason
src/pages.ts         routes, layout and one renderer per page kind
src/seo.ts           sitemap.xml, robots.txt, Open Graph tags and JSON-LD serialization
src/claim.ts         renders the archived Markdown in original claims
src/ui/<code>.json   interface text; zh.json defines the keys
src/assets/          site.css and site.js, copied to dist/assets/
vendor/xxd/          the UI kit files from `pnpm xxd init`
```
