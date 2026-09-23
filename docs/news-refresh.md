# Getting the football news to refresh on time

## How often it actually refreshes: about every 4 to 5 hours

Not every 30 minutes. Measured from the real run history, 21-23 September:

| Workflow | Schedule asks | Real interval | Worst gap | Runs a day |
|---|---|---|---|---|
| `update-news.yml` (stock) | twice an hour | **4.3 hours** | 5.9 hours | 5.5 |
| `update-quotes.yml` (stock) | twice an hour | **4.3 hours** | 7.4 hours | 5.6 |

Every schedule on this repository lands the same way, and none of them has
ever failed: GitHub simply does not start most `schedule` events, and says
so in its own documentation:

> The `schedule` event can be delayed during periods of high loads of GitHub
> Actions workflow runs.

No change to the script can fix that, because the script is never reached.

### Asking more often does not help, and neither does asking at all

`update-football-news.yml` asked six times an hour, then twice an hour to
match the schedules that work. It has started **zero** scheduled runs either
way, across roughly ten hours, while `update-news.yml` has started 659. Every
football refresh in that window was triggered by hand.

So the schedule is not what brings the news in. The four workflows whose
schedules *do* fire each end by dispatching this one:

```yaml
- name: Also refresh the football news
  if: always()
  env:
    GH_TOKEN: ${{ github.token }}
  run: gh workflow run update-football-news.yml --ref <branch>
```

A dispatch made with `GITHUB_TOKEN` does start another workflow - unlike a
push, which GitHub blocks to prevent loops. Four wake-ups, each firing about
every four hours and staggered across the hour, should land the football feed
somewhere near every ninety minutes. No token to create, store or renew.

The workflow keeps its own schedule as well, in case GitHub ever starts
honouring it.

### Where to read the truth

`data/football-news.json` carries `generatedAt`, and the panel prints it as
"updated N ago". That is when the news was last collected. The time under
each headline is something else entirely - it is when the publisher filed
the story, which is usually hours older and is not a sign of a stale page.

## If an exact clock ever matters

Everything below is wired up and unused, by choice. It is here for the day
the trade looks worth making.

### Poke it from outside GitHub

Something outside GitHub has to call the API on a real clock. The workflow
already accepts this — it listens for `repository_dispatch` with the type
`refresh-news`.

Setting it up, once (not currently done):

1. **Make a token.** GitHub → Settings → Developer settings → Personal access
   tokens → Fine-grained tokens → Generate new token.
   - Repository access: only `raisfirdaus-sys/my-portfolio-website`
   - Permissions: **Contents: Read and write**
   - Nothing else. Set an expiry you are willing to renew.

2. **Point a free pinger at it.** [cron-job.org](https://cron-job.org) and
   UptimeRobot both do this on a free plan. Create a job that runs every 30
   minutes and makes this request:

   ```
   POST https://api.github.com/repos/raisfirdaus-sys/my-portfolio-website/dispatches

   Accept:        application/vnd.github+json
   Authorization: Bearer <the token from step 1>
   Content-Type:  application/json

   {"event_type":"refresh-news"}
   ```

   A `204 No Content` means it worked.

3. **Keep the schedule as the backstop.** If the pinger dies, GitHub's own
   schedule still runs it, just every few hours instead.

### Why the token is not in this repository

A token with write access to the repository is a key to it. It belongs in
the pinger's own settings, and nowhere else — not in a file here, not in a
commit, not pasted into a chat. `.gitignore` already blocks `*.token`,
`*.secret`, `.env`, `secrets.json` and `api-keys.json` so it cannot be
committed by accident.

If a token is ever exposed, revoke it on GitHub and make a new one; the
pinger is the only thing that needs updating.
