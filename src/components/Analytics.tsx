"use client";
import Script from "next/script";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

export default function Analytics() {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      {/* Carga del script de GA4 */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />

      {/* Inicialización de GA4 */}
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            anonymize_ip: true,
            debug_mode: true
          });
        `}
      </Script>
    </>
  );
}
