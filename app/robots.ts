import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://subukan.ph'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/auth/verify-phone'],
      },
      {
        // Block AI scrapers from indexing private logic and data, but allow indexation of general context
        userAgent: ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot'],
        disallow: '/',
      },
      {
        // Explicitly allow AI Search Engines that support live citations and direct answers
        userAgent: ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'applebot-extended'],
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/auth/verify-phone'],
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
