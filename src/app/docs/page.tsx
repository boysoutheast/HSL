'use client'

export default function DocsPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.7, color: '#1a1a1a' }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>HSL Media API</h1>
      <p style={{ color: '#666', marginBottom: 40 }}>
        Generate video content programmatically. Simple REST API with credit-based billing.
      </p>

      {/* Authentication */}
      <Section title="Authentication">
        <p>All API requests require an API key passed as a Bearer token:</p>
        <CodeBlock>{`Authorization: Bearer hs_your_api_key_here`}</CodeBlock>
        <p>
          Generate your API key from the <a href="/studio" style={{ color: '#2563eb' }}>Studio</a> page or Settings → Profile.
          Keys are shown <strong>once</strong> — store them securely.
        </p>
      </Section>

      {/* Video Generation */}
      <Section title="Video Generation">
        <Endpoint method="POST" path="/api/hermes/generate/video" />

        <p style={{ marginTop: 12 }}>Submit a video generation job. Credits are debited immediately.</p>

        <h4 style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 8px' }}>Request Body</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Field</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Required</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>prompt</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>string</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>✓</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>Description of the video to generate</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>photoReferenceIds</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>string[]</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}></td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>Up to 5 reference photo IDs</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>instagramAccountId</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>string</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}></td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>Target Instagram account</td>
            </tr>
          </tbody>
        </table>

        <h4 style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 8px' }}>Example Request</h4>
        <CodeBlock>{`curl -X POST https://api.example.com/api/hermes/generate/video \\
  -H "Authorization: Bearer hs_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "A skincare product showcase with smooth transitions"}'`}</CodeBlock>

        <h4 style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 8px' }}>Response (201 Created)</h4>
        <CodeBlock lang="json">{`{
  "id": "clx123abc",
  "status": "queued",
  "creditsCost": 1300,
  "balanceRemaining": 8700
}`}</CodeBlock>

        <h4 style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 8px' }}>Error Responses</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>401</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>Missing or invalid API key</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>402</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>Insufficient credits — returns <code>balance</code> and <code>required</code></td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>403</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>No billing owner or resource not in scope</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Check Status */}
      <Section title="Check Generation Status">
        <Endpoint method="GET" path="/api/hermes/generated-media/:id" />

        <p style={{ marginTop: 12 }}>Poll the status and result of a video generation job.</p>

        <h4 style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 8px' }}>Response (200 OK)</h4>
        <CodeBlock lang="json">{`{
  "id": "clx123abc",
  "status": "completed",
  "prompt": "A skincare product showcase...",
  "mediaType": "VIDEO",
  "creditsCost": 1300,
  "videoUrl": "https://cdn.example.com/media/clx123abc.mp4",
  "thumbnailUrl": "https://cdn.example.com/media/clx123abc.jpg",
  "durationSeconds": 10,
  "errorMessage": null,
  "refundedAt": null,
  "createdAt": "2026-06-13T10:30:00.000Z",
  "completedAt": "2026-06-13T10:31:15.000Z",
  "inputs": []
}`}</CodeBlock>

        <h4 style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 8px' }}>Status Values</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>queued</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>Waiting for a worker to pick up</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>processing</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>Worker is generating</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>completed</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>Generation succeeded — videoUrl is available</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>failed</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>Generation failed — credits refunded (refundedAt is set)</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Credits */}
      <Section title="Credits & Billing">
        <Endpoint method="GET" path="/api/hermes/credits" />

        <p style={{ marginTop: 12 }}>
          Check your credit balance and transaction history.
          Video generation costs <strong>1,300 credits</strong> per 10-second video.
        </p>

        <h4 style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 8px' }}>Response (200 OK)</h4>
        <CodeBlock lang="json">{`{
  "balance": 8700,
  "transactions": [
    {
      "id": "ctx456def",
      "amount": -1300,
      "reason": "video_generation",
      "refId": "clx123abc",
      "refType": "generated_media",
      "balanceAfter": 8700,
      "createdAt": "2026-06-13T10:30:00.000Z"
    }
  ],
  "total": 12,
  "limit": 20,
  "offset": 0
}`}</CodeBlock>

        <h4 style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 8px' }}>Query Parameters</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Parameter</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Default</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Max</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>limit</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>20</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>100</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>Transactions per page</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>offset</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>0</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>-</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>Pagination offset</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Image Generation (Coming Soon) */}
      <Section title="Image Generation">
        <Endpoint method="POST" path="/api/hermes/generate/image" />

        <div style={{ marginTop: 12, padding: '12px 16px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fcd34d' }}>
          <strong>Coming Soon · 501</strong><br />
          Image generation is planned but not yet available. Use <code>mediaType</code> filtering on the credits endpoint to prepare.
        </div>
      </Section>

      {/* Rate Limits */}
      <Section title="Rate Limits">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Tier</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Requests</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Window</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>Free</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>30</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>per minute</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>Generate</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>5</td>
              <td style={{ padding: '8px 12px', fontSize: 12 }}>per minute</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <div style={{ marginTop: 60, paddingTop: 20, borderTop: '1px solid #e5e5e5', fontSize: 12, color: '#999' }}>
        Questions? Contact support or visit the <a href="/studio" style={{ color: '#2563eb' }}>Studio</a>.
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #e5e5e5' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Endpoint({ method, path }: { method: string; path: string }) {
  const color = method === 'GET' ? '#16a34a' : method === 'POST' ? '#2563eb' : '#9333ea'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
      <span style={{
        padding: '2px 8px',
        background: color,
        color: '#fff',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'monospace',
        textTransform: 'uppercase',
      }}>
        {method}
      </span>
      <code style={{ fontSize: 14, color: '#333' }}>{path}</code>
    </div>
  )
}

function CodeBlock({ children, lang }: { children: string; lang?: string }) {
  return (
    <pre style={{
      background: '#1a1a2e',
      color: '#e0e0e0',
      padding: '16px',
      borderRadius: 8,
      fontSize: 12,
      lineHeight: 1.5,
      overflowX: 'auto',
      margin: '8px 0',
    }}>
      <code>{children}</code>
    </pre>
  )
}
