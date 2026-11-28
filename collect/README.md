# Collecting evidence at scale

Bots read abstracts and copy out mortality and lifespan estimates, one line each, each with the sentence it came from. Scripts decide which papers the bots see, and they check every line before it can be imported.

| Layer | Written by | File | Key |
| --- | --- | --- | --- |
| Paper | `fetch-pubmed.ts`, from PubMed | `out/papers.jsonl` | `pmid` |
| Finding or skip | a bot, following `BRIEF.md` | `out/findings/<shard>.jsonl` | `pmid#n` |
| Study on the site | people, grouping findings by exposure | `data/`, `content/` | study id |

Bots never search the web and never decide which papers to read. The PubMed query decides that, and the query is written down and rerunnable. The types and the import rules are in `schema.ts`.

## Steps

```sh
node collect/fetch-pubmed.ts --term '<PubMed query>' --shard-size 20   # set NCBI_API_KEY to go 3x faster
node collect/run.ts --bot claude --shards 10 --parallel 2              # or --bot codex
node collect/validate.ts                                               # exits 1 if any shard fails
node collect/import-batch.ts <dir>/*.jsonl                             # batches a web bot wrote by hand
```

Web bots such as Grok or Muse cannot run these scripts. They follow a standalone instruction document instead. That document gives each topic-and-design card a frozen PubMed query, which is cut into 20-paper batches. The bot writes each batch as JSON lines, starting with a manifest that lists the PMIDs it read. `import-batch.ts` fetches those PMIDs from PubMed itself, so every quote is checked against PubMed's text and never against text the bot supplied.

Every command can be stopped and run again. Papers already fetched are not fetched again, shards are never rewritten, and a shard whose output passes is never sent to a bot again. A shard that fails goes back to its bot once more, with the rejected lines and the reasons attached.

`validate.ts` accepts a line only when all of these hold:

- Its PMID is in the shard.
- Its quote appears word for word in the abstract section it names.
- Its value and interval are numbers that appear in that quote.
- The value lies inside its interval.
- Its enums are valid.
- Its id is not used twice.

Every paper in the shard must have at least one line, either a finding or a skip with its reason.

The validator cannot tell whether the bot named the exposure and the comparison correctly. Read a random sample of findings against their abstracts before importing a batch.

`out/` is not committed.

## Claims found on the web

The pipeline above starts from PubMed. This one starts from what people say. A web bot searches one language, topic and channel at a time (a card such as `zh-eating-factcheck`). It records each health claim it finds, where it saw the claim, a verdict, and evidence quoted word for word from PubMed abstracts or official health sites. The instructions the bot follows are a standalone document kept outside the repo. The format is defined in `claims.ts`.

```sh
node collect/import-claims.ts --pages <dir>/*.jsonl
```

The importer accepts a claim only when all of these hold:

- Its fields and enums are valid.
- Every PubMed quote is in that PMID's title or abstract. The importer fetches the abstract itself.
- Every official page is on the `AUTHORITY_HOSTS` list. With `--pages`, the page also has to open and contain the quote.
- The verdict and grade follow from the evidence. For example, `false` needs refuting evidence, and grade `A` needs a meta-analysis, systematic review or RCT.

Accepted claims are merged by `claimKey` into `out/claims/claims.jsonl`, with every language's version kept. `out/claims/done/<card>.txt` lists the keys a card already has. Paste it into the bot's next session so it skips them.

The importer cannot tell whether a sighting really says what the bot claims, or whether the verdict reads the evidence fairly. Read a random sample against the sources before using a batch.
