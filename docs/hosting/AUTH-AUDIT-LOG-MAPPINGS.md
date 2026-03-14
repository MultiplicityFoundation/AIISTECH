# Auth Audit Log Shipping Mappings

Status: Active
Updated: 2026-03-12

This document defines centralized log shipping mappings for auth audit JSON events emitted by the backend.

## Source event shape

Auth audit logs are emitted as one JSON object per line from backend stdout.

Example:

{
  "type": "auth_audit",
  "event": "auth_login_succeeded",
  "at": "2026-03-12T23:11:33.766Z",
  "requestId": "4c9b6082-c5fd-46a7-811a-59a5b2d20a95",
  "method": "POST",
  "path": "/api/auth/login",
  "origin": "https://app.aiistech.com",
  "ip": "203.0.113.25",
  "userAgent": "Mozilla/5.0 ...",
  "outcome": "allowed",
  "email": "exec@aiistech.com",
  "userId": "1",
  "role": "EXECUTIVE",
  "tenantId": "tenant-1"
}

## Canonical field mapping

| Source field | Canonical key | Type | Notes |
|---|---|---|---|
| type | event.dataset | keyword | Fixed value: auth_audit |
| event | event.action | keyword | auth_login_attempt, auth_refresh_succeeded, etc. |
| at | @timestamp | date | ISO8601 |
| requestId | trace.id | keyword | Correlates cross-service logs |
| method | http.request.method | keyword | HTTP verb |
| path | url.path | keyword | API route |
| origin | http.request.headers.origin | keyword | Browser origin if present |
| ip | source.ip | ip | Client IP |
| userAgent | user_agent.original | keyword | Raw user-agent |
| outcome | event.outcome | keyword | allowed, denied, attempt |
| email | user.email | keyword | Optional on unauthenticated events |
| userId | user.id | keyword | Optional |
| role | user.roles | keyword | Optional |
| tenantId | labels.tenant_id | keyword | Optional tenant partition key |
| limiter | labels.rate_limiter | keyword | Present on rate-limit events |
| key | labels.rate_limit_key | keyword | Present on rate-limit events |
| max | labels.rate_limit_max | long | Present on rate-limit events |
| windowMs | labels.rate_limit_window_ms | long | Present on rate-limit events |
| reason | error.message | keyword | Present on denied outcomes |

## Loki mapping

Use low-cardinality labels only.

Recommended labels:
- service=mock-backend
- dataset=auth_audit
- event
- outcome
- method
- path

Do not label high-cardinality fields:
- requestId
- email
- userId
- key
- userAgent
- ip

Example Promtail pipeline snippet:

```yaml
pipeline_stages:
  - json:
      expressions:
        type: type
        event: event
        at: at
        outcome: outcome
        method: method
        path: path
        requestId: requestId
        tenantId: tenantId
        email: email
        reason: reason
  - match:
      selector: '{job="mock-backend"}'
      stages:
        - labels:
            dataset: type
            event: event
            outcome: outcome
            method: method
            path: path
        - timestamp:
            source: at
            format: RFC3339
```

## ELK mapping

### Index template

```json
{
  "index_patterns": ["aiistech-auth-audit-*"],
  "template": {
    "mappings": {
      "dynamic": true,
      "properties": {
        "@timestamp": { "type": "date" },
        "event": {
          "properties": {
            "dataset": { "type": "keyword" },
            "action": { "type": "keyword" },
            "outcome": { "type": "keyword" }
          }
        },
        "trace": {
          "properties": {
            "id": { "type": "keyword" }
          }
        },
        "http": {
          "properties": {
            "request": {
              "properties": {
                "method": { "type": "keyword" },
                "headers": {
                  "properties": {
                    "origin": { "type": "keyword" }
                  }
                }
              }
            }
          }
        },
        "url": {
          "properties": {
            "path": { "type": "keyword" }
          }
        },
        "source": {
          "properties": {
            "ip": { "type": "ip" }
          }
        },
        "user": {
          "properties": {
            "id": { "type": "keyword" },
            "email": { "type": "keyword" },
            "roles": { "type": "keyword" }
          }
        },
        "labels": {
          "properties": {
            "tenant_id": { "type": "keyword" },
            "rate_limiter": { "type": "keyword" },
            "rate_limit_key": { "type": "keyword" },
            "rate_limit_max": { "type": "long" },
            "rate_limit_window_ms": { "type": "long" }
          }
        },
        "error": {
          "properties": {
            "message": { "type": "keyword" }
          }
        }
      }
    }
  }
}
```

### Logstash filter example

```conf
filter {
  json { source => "message" }

  if [type] == "auth_audit" {
    mutate {
      add_field => {
        "[event][dataset]" => "%{[type]}"
        "[event][action]" => "%{[event]}"
        "[event][outcome]" => "%{[outcome]}"
        "[trace][id]" => "%{[requestId]}"
        "[http][request][method]" => "%{[method]}"
        "[url][path]" => "%{[path]}"
        "[http][request][headers][origin]" => "%{[origin]}"
        "[source][ip]" => "%{[ip]}"
        "[user][email]" => "%{[email]}"
        "[user][id]" => "%{[userId]}"
        "[user][roles]" => "%{[role]}"
        "[labels][tenant_id]" => "%{[tenantId]}"
      }
    }

    date {
      match => ["at", "ISO8601"]
      target => "@timestamp"
    }
  }
}
```

## Recommended alerts

1. High denied login count: event.action=auth_login_failed and event.outcome=denied.
2. Refresh token abuse: event.action=auth_refresh_failed spikes by source.ip.
3. Rate limit trip spikes: event.action=auth_rate_limited grouped by labels.rate_limiter.
4. CORS probe activity: event.action=cors_rejected grouped by source.ip and http.request.headers.origin.
