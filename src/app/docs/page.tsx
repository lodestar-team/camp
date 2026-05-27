import Script from "next/script";
import { Nav } from "../_components/Nav";

export const metadata = {
  title: "docs · camp",
  description: "OpenAPI 3.1 reference for the camp REST API.",
};

export default function DocsPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="container hero" style={{ paddingBottom: 24 }}>
          <p className="section-eyebrow">docs</p>
          <h1
            style={{
              fontSize: "clamp(40px, 6vw, 64px)",
              letterSpacing: "-0.035em",
              lineHeight: 1,
              marginBottom: 12,
            }}
          >
            REST reference.
          </h1>
          <p className="lede">
            OpenAPI 3.1 spec for every endpoint. Raw YAML at{" "}
            <a href="/openapi.yaml">/openapi.yaml</a> — feed it to your client
            generator of choice.
          </p>
        </section>

        <div id="scalar-api-reference" />

        <Script
          src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
          strategy="afterInteractive"
        />
        <Script id="scalar-bootstrap" strategy="afterInteractive">
          {`
            (function () {
              function mount() {
                if (typeof Scalar === 'undefined' || !Scalar.createApiReference) {
                  return setTimeout(mount, 50);
                }
                Scalar.createApiReference('#scalar-api-reference', {
                  url: '/openapi.yaml',
                  theme: 'default',
                  layout: 'modern',
                  hideDarkModeToggle: false,
                  customCss: 'body { background: transparent; }',
                });
              }
              mount();
            })();
          `}
        </Script>
      </main>
    </>
  );
}
