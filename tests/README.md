# Image generation API tests

## Fast Bing unit tests

These tests do not access the network:

```bash
pnpm test
pnpm test:coverage
```

## Real end-to-end tests

Start AI Tool Box and sign in to every site that will be tested. The E2E suite calls the real
HTTP API and validates returned image bytes; it does not mock `fetch`, webviews, or provider
responses.

```bash
pnpm dev

# In another terminal: Gemini + Bing plus the complete HTTP validation group
pnpm test:e2e

# Every documented provider and every long-running request form
pnpm test:e2e:all
```

`test:e2e:all` performs real generations for all 15 providers. It additionally covers `count=2`,
JSON and multipart reference images, all three multipart file aliases, reference-only requests,
SSE, concurrent workers, every supported Bing model/aspect-ratio pair, Bing transport modes, and
both flattened and JSON multipart Bing options. It consumes provider credits and can take a long
time.

### Environment variables

| Variable | Default | Purpose |
|---|---:|---|
| `IMAGE_GEN_E2E_BASE_URL` | `http://127.0.0.1:3920` | Real API address |
| `IMAGE_GEN_E2E_TOKEN` | empty | API token sent as `X-Api-Token` |
| `IMAGE_GEN_E2E_TIMEOUT_MS` | `90000` | Timeout passed to each generation request |
| `IMAGE_GEN_E2E_LONG_TIMEOUT_MS` | `240000` | Client/test timeout |
| `E2E_IMAGE_TOOLS` | `gemini-image,bing-create` | Comma-separated provider IDs, or `all` |
| `E2E_PRIMARY_TOOL` | first selected tool | Provider used for request-shape cases |
| `E2E_INCLUDE_REFERENCE` | false | Run real reference-image cases |
| `E2E_INCLUDE_COUNT` | false | Run `count=2` |
| `E2E_INCLUDE_CONCURRENCY` | false | Run two real requests concurrently |
| `E2E_BING_MATRIX` | false | Run the complete Bing model/ratio/mode matrix |
| `E2E_GEMINI_MATRIX` | false | Run Gemini auto/web-api/DOM and multipart option cases |
| `E2E_EXPECT_AUTH` | false | Assert that an invalid token returns HTTP 401 |

Example for a single provider:

```bash
E2E_IMAGE_TOOLS=recraft pnpm test:e2e
```

Failures caused by missing provider login, exhausted credits, policy rejection, TLS/network
errors, or page changes remain test failures and include the real API response. They are never
converted into skips or mocked successes.
