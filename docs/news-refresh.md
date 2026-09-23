# Getting the football news to refresh on time

## The problem, measured

The workflow says every 30 minutes. It does not run every 30 minutes.

Over 658 runs on the old schedule:

| | |
|---|---|
| Scheduled interval | 30 minutes |
| Real average interval | **234 minutes** |
| Worst gap observed | 355 minutes |
| Scheduled runs GitHub never started | **~86%** |
| Runs that started and failed | **0** |

The script has never failed. GitHub drops `schedule` events when its shared
runner pool is busy, and says so in its own documentation:

> The `schedule` event can be delayed during periods of high loads of GitHub
> Actions workflow runs.

No change to the script can fix that, because the script is never reached.

## What is in place now

`.github/workflows/update-football-news.yml` asks six times an hour
(`03,13,23,33,43,53`) instead of twice. GitHub is no more punctual, but far
more attempts survive, so the gap between real runs comes down. This needs
nothing from anyone and is already live.

It is an improvement, not a guarantee.

## The exact fix: poke it from outside GitHub

Something outside GitHub has to call the API on a real clock. The workflow
already accepts this — it listens for `repository_dispatch` with the type
`refresh-news`.

Setting it up, once:

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
   schedule still runs it, just less punctually.

### Why the token is not in this repository

A token with write access to the repository is a key to it. It belongs in
the pinger's own settings, and nowhere else — not in a file here, not in a
commit, not pasted into a chat. `.gitignore` already blocks `*.token`,
`*.secret`, `.env`, `secrets.json` and `api-keys.json` so it cannot be
committed by accident.

If a token is ever exposed, revoke it on GitHub and make a new one; the
pinger is the only thing that needs updating.

## Checking whether it is working

`data/football-news.json` carries `generatedAt` at the top, and the panel
prints it as "updated N minutes ago". That number is the truth about when
the news was last collected — not the schedule in the workflow file.
