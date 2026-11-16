# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/wangconghua/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/wangconghua/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a sealed DefiLlama snapshot, finds every protocol that records no token yet and is not a wrapped, staked or bridged product of a token that already trades, and ranks them by implied launch value — TVL priced at the market's own category multiple (the median market-cap-to-TVL ratio of live-token protocols in the same category), adjusted for 7-day growth and for how long the protocol has run with no token. Each protocol ships with a six-step farm plan with costs and times. The dashboard is a static page with no network: a sortable, filterable board, a detail view per protocol with a model breakdown, a live model sandbox that re-ranks the board, and the already-trading protocols set aside as comparables.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Node 22 or later, standard library only, no install step. The program writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8max8wdd&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
