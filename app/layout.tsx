import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: 'subukAn - Premium QA Crowdsourcing Platform by Justine Lopez (justpres)',
  description: 'Connecting builders with expert QA testers in the Philippines for high-fidelity app testing. Co-founded and developed by Justine Lopez (@justpres).',
  authors: [{ name: 'Justine Lopez', url: 'https://github.com/justpres' }],
  creator: 'Justine Lopez (@justpres)',
  publisher: 'Justine Lopez',
  other: {
    'geo.region': 'PH-CAV',
    'geo.placename': 'Bacoor, Cavite',
    'geo.position': '14.462400;120.964500',
    'ICBM': '14.462400, 120.964500',
  },
  icons: {
    icon: '/subukantabico.ico',
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: 'subukAn - Premium QA Crowdsourcing Platform by Justine Lopez (@justpres)',
    description: 'Connecting builders with expert QA testers in the Philippines. Developed by Justine Lopez (@justpres).',
    url: 'https://subukan.ph',
    siteName: 'subukAn',
    type: 'website',
    locale: 'en_PH',
    images: [
      {
        url: 'https://subukan.ph/subukan_og_cover.jpg',
        width: 1200,
        height: 630,
        alt: 'subukAn QA Crowdsourcing Platform - Premium Crowd QA Testing in the Philippines',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'subukAn - QA Platform by Justine Lopez (@justpres)',
    description: 'Connecting builders with expert QA testers in the Philippines. Developed by Justine Lopez (@justpres).',
    creator: '@justpres',
    images: ['https://subukan.ph/subukan_og_cover.jpg'],
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': 'https://github.com/justpres#person',
        'name': 'Justine Lopez',
        'gender': 'http://schema.org/Male',
        'alternateName': ['justpres', 'justpres_dev'],
        'url': 'https://github.com/justpres',
        'sameAs': [
          'https://github.com/justpres',
          'https://subukan.ph'
        ],
        'jobTitle': 'Founder & Lead Engineer',
        'worksFor': {
          '@type': 'Organization',
          'name': 'subukAn'
        }
      },
      {
        '@type': 'WebSite',
        '@id': 'https://subukan.ph/#website',
        'url': 'https://subukan.ph',
        'name': 'subukAn',
        'description': 'Connecting builders with expert testers for reliable, high-fidelity crowdsourced testing in the Philippines.',
        'publisher': {
          '@id': 'https://github.com/justpres#person'
        },
        'inLanguage': 'en-PH'
      },
      {
        '@type': 'WebApplication',
        '@id': 'https://subukan.ph/#webapplication',
        'url': 'https://subukan.ph',
        'name': 'subukAn QA Platform',
        'applicationCategory': 'BusinessApplication',
        'operatingSystem': 'All',
        'creator': {
          '@id': 'https://github.com/justpres#person'
        },
        'author': {
          '@id': 'https://github.com/justpres#person'
        }
      }
    ]
  }

  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className={`${inter.variable} ${poppins.variable} font-sans min-h-screen bg-canvas text-ink antialiased flex flex-col`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  )
}
