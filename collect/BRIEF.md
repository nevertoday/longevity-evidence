# 采集任务：从论文摘要里抄出死亡风险的效应值

你会收到一批 PubMed 论文（每行一个 JSON，字段见下文“输入”）。任务是：从每篇的摘要里找出它报告的死亡风险或寿命估计值，每个估计值写成一行 JSON。

## 铁律

1. **只用给你的摘要。** 不要上网，不要搜索，不要凭记忆补数字。摘要里没有的，就当不存在。
2. **每个数字都要有原文。** `quote` 从摘要里逐字复制，数字、标点、大小写都不改，也不翻译。`value`、`ciLow`、`ciHigh` 必须是 `quote` 里出现的数字。程序会逐字比对，对不上的整行作废。
3. **每篇论文都要有交代。** 抄出的估计值写成 finding 行。一个估计值都没有的论文，写一行 skip 并给出原因。不允许漏掉论文。
4. **只输出 JSON 行。** 一行一个对象，不写解释，不加 Markdown 代码块。

## 抄什么

只抄**死亡或寿命**结局的估计值：全因死亡、心血管死亡、癌症死亡、预期寿命。其他结局（发病率、住院、血压变化等）不抄。

一篇摘要报告了几个暴露、几个剂量或几个结局，就分别写几行。**亚组只抄摘要原文明确给出数值的**，不要自己推算。

## finding 行

```json
{"pmid":"43003325","n":1,"exposure":"wildfire-related pm2.5","contrast":"per 10 μg/m3 increase","outcome":"all-cause-mortality","measure":"RR","value":1.066,"ciLow":1.014,"ciHigh":1.121,"participants":null,"deaths":null,"design":"meta-analysis","topic":"environment","section":"RESULTS","quote":"A 10 μg/m3 increase in wildfire-related PM2.5 exposure was found to be associated with a 6.6% increase in all-cause mortality (RR = 1.066; 95% CI: 1.014-1.121)"}
```

`quote` 必须是摘要里连续的一整段原文，不能用 `...` 省略中间。

| 字段 | 写法 |
| --- | --- |
| `pmid` | 输入里的 pmid，原样照抄 |
| `n` | 这篇论文里的第几个估计值，从 1 开始 |
| `exposure` | 比较的是什么，用摘要原词，英文小写："coffee"、"aspirin 100 mg daily"、"leisure-time physical activity" |
| `contrast` | 跟什么比："highest vs lowest"、"per 1 cup/day"、"vs placebo"、"vs never drinkers"。摘要没说就写 "not stated" |
| `outcome` | `all-cause-mortality` · `cardiovascular-mortality` · `cancer-mortality` · `life-expectancy` · `other-mortality` |
| `measure` | `HR` · `RR` · `OR` · `IRR` · `SMR` · `risk-difference` · `mean-difference` · `years-of-life` |
| `value`, `ciLow`, `ciHigh` | 数字。没给置信区间的，两个都写 `null` |
| `participants`, `deaths` | 摘要给出的总人数和死亡数，没给写 `null`，不要估算 |
| `design` | `meta-analysis` · `rct` · `cohort` · `case-control` · `mendelian-randomization` · `other`。按这篇论文自己的设计判断，不按它引用的研究 |
| `topic` | `eating` 吃 · `drinking` 喝（含酒、咖啡、茶）· `movement` 运动和久坐 · `sleep` 睡眠 · `habits` 日常习惯（含吸烟）· `mind` 情绪、社交和贫富 · `body` 体重和身体指标 · `environment` 空气、光照、温度 · `supplements` 药物和补充剂 · `illness` 已经确诊的病人的治疗 |
| `section` | `quote` 所在段落的标签，和输入里的 `label` 一字不差，比如 `"RESULTS"`。摘要没分段时写 `null` |
| `quote` | 摘要里连续的一段原文，包含这个估计值和它的置信区间，越短越好，但要能看出比的是什么 |

## skip 行

```json
{"pmid":"12345678","skip":"no-mortality-estimate"}
```

原因只能是这四个之一：

- `no-mortality-estimate`：摘要里没有死亡或寿命的数值估计
- `no-abstract`：没有摘要
- `not-human`：动物或细胞研究
- `protocol-or-commentary`：研究方案、评论、通信、勘误

## 拿不准时

- 一个数字看不出比的是什么 → 不抄这个数字。
- 摘要写的是 "reduced risk by 15%" 而没给比值 → 不要换算成 0.85，也不要抄。只抄摘要原文写出的比值或差值。
- 宁可少抄，也不要错抄。错一行比漏一行代价大。
