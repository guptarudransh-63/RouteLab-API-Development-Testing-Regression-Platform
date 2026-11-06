# RouteLab — API Development, Testing & Regression Platform

![RouteLab Platform](https://img.shields.io/badge/Status-Production%20Ready-success)
![Node.js](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-green)
![React](https://img.shields.io/badge/Frontend-React%20%7C%20Vite%20%7C%20Tailwind-blue)
![Database](https://img.shields.io/badge/Database-MongoDB%20%7C%20Mongoose-emerald)
![Security](https://img.shields.io/badge/Security-SSRF%20Shield%20Active-indigo)

RouteLab is a developer platform inspired by Postman, engineered for constructing HTTP requests, organizing collections, managing multi-tier environments, evaluating declarative assertions, chaining multi-step workflows, and detecting **API Contract Regressions & Breaking Changes** across test runs.

---

## Key Features

1. **HTTP Request Studio**:
   - Supports `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`.
   - Dynamic parameter substitution using `{{variable}}` templates.
   - Comprehensive configuration tabs: Query Params, Headers, Authorization (Bearer, Basic, API Key), Body (JSON, Form URL-Encoded, Raw Text), and Tests.
   - Response Inspector with Pretty JSON, Headers table, Assertion results, and Contract Diff.

2. **Zero-Trust SSRF Defense Engine**:
   - Deep network validation blocking RFC 1918 subnets, loopback addresses (`127.0.0.0/8`, `::1`), link-local IPs, cloud metadata endpoints (`169.254.169.254`), and multicast.
   - DNS pre-flight verification, DNS rebinding mitigation (IP pinning), and strict redirect re-validation.
   - Configurable development mode toggle for local network testing.

3. **API Contract Change Detection (Signature Feature)**:
   - Inferred normalized schema generator with automatic masking of volatile fields (timestamps, UUIDs, numeric IDs).
   - Diffing candidate responses against approved baselines with classified severity:
     - **BREAKING**: Removed fields, type mutations, unexpected HTTP status code shifts.
     - **POTENTIALLY BREAKING**: Field made nullable, array item structure altered.
     - **NON-BREAKING**: Optional additions.
     - **PERFORMANCE REGRESSION**: Latency breaches exceeding threshold.
   - Baseline snapshot management and promotion.

4. **Multi-Step Chained Workflows**:
   - Sequential execution of dependent requests.
   - Dynamic variable extraction (e.g., extract `token` from `POST /auth/login` and inject as `Bearer {{token}}` in `GET /users/profile`).

5. **Automated Suite Runner & Regression Analytics**:
   - Batch collection test runner with stop-on-failure controls.
   - Cross-run regression comparison identifying newly failing tests, resolved tests, and latency shifts.
   - Visual trend charts powered by Recharts.
   - Report export in CSV and JSON formats.

6. **OpenAPI 3.0 & Postman Compatibility**:
   - Importer for OpenAPI 3.0 / Swagger JSON or YAML specs.
   - Import and export for Postman Collections v2.1 and RouteLab native collections.

---

## Demo Credentials & Seed Data

The database includes pre-configured seed data for instant exploration:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin / Developer** | `demo@routelab.dev` | `RouteLabDemo123!` |

### Included Seed Collections
- **Auth & Petstore Chained Flow**: Pre-configured login request, token extraction, authenticated profile query, and orders listing.
- **Contract & Regression Detection Suite**: Pre-configured baseline order snapshot, plus an endpoint simulating a breaking regression (`?simulateRegression=breaking`) to demonstrate live contract diffing.
- **Environments**: "Local Mock Environment" (`http://localhost:5001/api/v1/mock`), "Staging", and "Production".

---

## Quick Start & Installation

### Prerequisites
- Node.js >= 18
- MongoDB running on `mongodb://127.0.0.1:27017`

### 1. Install Dependencies
```bash
# Install root, server, and client dependencies
npm run install:all
```

### 2. Seed the Database
```bash
# Seeds demo user, collections, contract baselines, and workflows
npm run seed
```

### 3. Run Development Servers
```bash
# Starts both Express backend (:5001) and Vite frontend (:5173)
npm run dev
```

Visit the application at [http://localhost:5173](http://localhost:5173).

---

## Running Automated Tests

RouteLab includes comprehensive unit and integration tests covering SSRF defense, variable resolution, assertion evaluation, contract schema diffing, regression comparisons, and API endpoints.

```bash
# Run Jest test suite
npm test
```

---

## API Documentation (Swagger)

When the server is running, interactive Swagger/OpenAPI documentation is available at:
[http://localhost:5001/api-docs](http://localhost:5001/api-docs)

---

## Environment Variables Configuration

Copy `.env.example` to `server/.env`:

```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/routelab
JWT_SECRET=routelab_super_secret_jwt_key_development_change_in_production_32char
COOKIE_SECRET=routelab_cookie_secret_salt_12345

# SSRF Protection Configuration
ALLOW_LOCAL_REQUESTS=true
REQUEST_TIMEOUT_MS=15000
MAX_RESPONSE_SIZE_BYTES=10485760

CLIENT_URL=http://localhost:5173
```
