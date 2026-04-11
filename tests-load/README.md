# pi-quiz Load Tests (k6)

Load and spike tests for the pi-quiz API using [k6](https://k6.io/).

## Prerequisites

Install k6 (Linux/macOS):

```bash
# macOS
brew install k6

# Ubuntu / Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Running the tests

**IMPORTANT:** Run load tests against a local Docker stack or a dedicated
staging environment.  Never run load tests against the production deployment.

### Start the local stack

```bash
docker compose up -d
# Wait for the API health check
curl -s http://localhost:3000/health || sleep 5
```

### Seed test users

The CSV file at `data/users.csv` contains roll numbers `TEST001`–`TEST050`.
These users are auto-created on first login (the app registers new users
automatically), so no separate seed step is required.

For the admin account (`ADMIN001`), run the setup script once:

```bash
bash scripts/setup-admin.sh
```

### Login spike test

Simulates a sudden burst of 50 concurrent logins.  Validates that the rate
limiter (429) is returned gracefully and no 5xx errors occur.

```bash
BASE_URL=http://localhost:3000 k6 run tests-load/scenarios/login-spike.js
```

### Steady-state quiz load test

20 VUs running a realistic login → home → quiz-detail flow for 2 minutes.
p95 latency must remain under 500 ms.

```bash
BASE_URL=http://localhost:3000 k6 run tests-load/scenarios/quiz-load.js
```

## Understanding the thresholds

| Scenario | Metric | Threshold |
|---|---|---|
| login-spike | `http_req_duration` p95 | < 2 000 ms |
| login-spike | `server_error_rate` | < 1 % |
| quiz-load | `http_req_duration` p95 | < 500 ms |
| quiz-load | `http_req_failed` | < 1 % |

k6 exits with a non-zero code when any threshold is breached, making it safe
to use as a CI gate.

## Directory structure

```
tests-load/
  scenarios/
    login-spike.js    ← spike: sudden burst of logins
    quiz-load.js      ← steady: 20 VUs, full user flow
  helpers/
    auth.js           ← shared login + header helpers
  data/
    users.csv         ← parameterised roll numbers (TEST001–TEST050)
  README.md
```
