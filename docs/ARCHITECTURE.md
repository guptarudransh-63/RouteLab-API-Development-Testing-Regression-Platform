# RouteLab Technical Architecture & Security Model

RouteLab is a Postman-grade API development and testing platform equipped with a signature **API Contract Change Detection and Regression Engine**.

---

## 1. Request Execution & SSRF Protection Architecture

```mermaid
flowchart TD
    ClientReq[Client Request Definition] --> VarResolver[Variable Resolution Engine]
    VarResolver --> SSRFShield[SSRF Shield & DNS Validator]
    
    subgraph SSRFShield [Zero-Trust SSRF Defense]
        SchemeCheck[1. Scheme Validation: http/https only]
        CredCheck[2. Embedded Credentials Rejection]
        HostCheck[3. Blacklist: localhost, metadata.google.internal]
        DNSLookup[4. DNS Resolution: dns.lookup all: true]
        IPCheck[5. CIDR & Subnet Check: RFC 1918, Loopback, Link-Local, Cloud Metadata]
        RebindGuard[6. Destination IP Pinning]
    end
    
    SSRFShield -->|Blocked Destination| BlockErr[Throw SSRFSecurityError 403]
    SSRFShield -->|Validated Outbound| FetchDispatch[Native HTTP Dispatcher]
    FetchDispatch --> RedirectCheck{Is 3xx Redirect?}
    RedirectCheck -->|Yes| SSRFShield
    RedirectCheck -->|No| RecvResp[Capture Response & Timing]
    RecvResp --> Redactor[Redact Sensitive Tokens & Cookies]
    Redactor --> AssertEngine[Declarative Assertion Evaluator]
    AssertEngine --> ContractEngine[Contract Diff & Normalizer]
    ContractEngine --> ClientRes[Return Safe Response Snapshot]
```

### Defense-in-Depth SSRF Strategy
1. **URL Scheme Enforcement**: Only `http:` and `https:` schemes are accepted. Protocols like `file://`, `ftp://`, and `gopher://` are rejected.
2. **Userinfo Stripping**: Embedded credentials (`http://user:pass@host`) are blocked.
3. **DNS Pre-Flight & Multi-A Record Inspection**: Resolves hostnames to their underlying IP addresses using `dns.lookup`. If *any* resolved address points to a private or restricted subnet, the request is aborted.
4. **Subnet Filtering**: Evaluated using `ipaddr.js`:
   - `127.0.0.0/8` & `::1` (Loopback)
   - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (Private RFC 1918)
   - `169.254.0.0/16` & `fe80::/10` (Link-Local & Cloud Instance Metadata `169.254.169.254`)
   - `224.0.0.0/4` & `ff00::/8` (Multicast)
   - `100.64.0.0/10` (Carrier-Grade NAT)
5. **DNS Rebinding Mitigation**: Binds the connection directly to the resolved primary IP while preserving the user's `Host` header.
6. **Redirect Interception**: Outbound `301/302/307/308` redirects are caught manually. The target `Location` is passed back through the full SSRF validator before following the redirect.
7. **Explicit Local Development Flag**: Access to `127.0.0.1` is strictly disabled by default. It can be selectively enabled for local mock development via `ALLOW_LOCAL_REQUESTS=true` or user workspace preference with visible UI warning indicators.

---

## 2. Variable Resolution & Precedence Hierarchy

Variables are defined in templates as `{{variableName}}`. RouteLab resolves them using strict precedence:

```
Runtime Variables (Previous Step Extraction)
  ↳ Request-Local Variables
    ↳ Collection Variables
      ↳ Active Environment Variables
        ↳ System Built-ins ({{$timestamp}}, {{$guid}}, {{$randomInt}})
```

- **Unresolved Variables**: If any `{{...}}` tags remain after checking all scopes in strict mode, execution halts with a detailed diagnostic `UnresolvedVariableError`.
- **Secret Masking**: Sensitive variables marked with `isSecret: true` are stored safely, masked in UI editors (`••••••••`), and omitted from collection exports.

---

## 3. API Contract Change Detection Engine

RouteLab's signature feature compares API response structures across runs and determines whether changes break consumer integrations.

```mermaid
flowchart LR
    CandidateResp[Candidate Response] --> Inferrer[Schema Inferrer]
    Inferrer --> Normalizer[Volatile Normalizer: ISO Dates, UUIDs, IDs]
    Normalizer --> Diff[Structural Diff Engine]
    BaselineSnapshot[(Approved Baseline Snapshot)] --> Diff
    Diff --> Classifier{Classifier}
    Classifier -->|Removed Field / Type Mismatch / Status Change| Breaking[BREAKING]
    Classifier -->|Nullability / Array Item Shape| PotBreaking[POTENTIALLY BREAKING]
    Classifier -->|Added Optional Field| NonBreaking[NON-BREAKING]
    Classifier -->|Latency Surge > 500ms| PerfRegress[PERFORMANCE REGRESSION]
```

### Volatile Field Normalization
To prevent false alarms caused by dynamic timestamps (`createdAt`, `updatedAt`), auto-incrementing database IDs, or random UUIDs, RouteLab inspects property names and formats. Volatile values are structurally typed rather than compared literally.

---

## 4. Run-to-Run Regression Comparison Engine

Each batch execution creates a persistent `TestRun` record. RouteLab performs automatic diffing between any candidate run and its baseline:
- **Test Regressions**: Tests that previously passed but now fail.
- **Fixed Tests**: Tests that previously failed but now pass.
- **Status Code Shifts**: Status code alterations.
- **Latency Deviations**: Latency spikes greater than 30% (+150ms).
- **Contract Findings**: Accumulated breaking or structural changes.
