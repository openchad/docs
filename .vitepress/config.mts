import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "OpenChad Docs",
  description: "Complete Documentation and Guide for OpenChad",
  base: 'docs',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      {
        text: 'Guides',
        items: [
          { text: 'Installation', link: '/guides/installation' },
          { text: 'Shipping / Distribution', link: '/guides/shipping' },
        ]
      },
      {
        text: 'Customization',
        items: [
          { text: 'Creating Custom App', link: '/customization/custom-app' },
          { text: 'Creating Custom Tool', link: '/customization/custom-tools' },
          { text: 'Creating Custom Pipeline', link: '/customization/custom-pipeline' },
          { text: 'Creating Custom Backend', link: '/customization/custom-backend' },
          { text: 'Creating Custom Model Provider', link: '/customization/custom-model-provider' }
        ]
      },
      {
        text: 'openchad-react',
        items: [
          { text: 'Core & Global APIs', link: '/openchad-react/core' },
          { text: 'AppInfo Context', link: '/openchad-react/appinfo' },
          { text: 'UI Components', link: '/openchad-react/ui' },
          { text: 'Utilities Reference', link: '/openchad-react/utils' },
          { text: 'Python Integration', link: '/openchad-react/usepython' },
          { text: 'pyInvoke Commands', link: '/openchad-react/pyinvoke-commands' }
        ]
      },
    ],

    sidebar: [
      {
        text: 'Guides',
        items: [
          { text: 'Installation', link: '/guides/installation' },
          { text: 'Shipping / Distribution', link: '/guides/shipping' },
        ]
      },
      {
        text: 'Customization',
        items: [
          { text: 'Creating Custom App', link: '/customization/custom-app' },
          { text: 'Creating Custom Tool', link: '/customization/custom-tools' },
          { text: 'Creating Custom Pipeline', link: '/customization/custom-pipeline' },
          { text: 'Creating Custom Backend', link: '/customization/custom-backend' },
          { text: 'Creating Custom Model Provider', link: '/customization/custom-model-provider' },
        ]
      },
      {
        text: 'openchad-react',
        items: [
          { text: 'Core & Global APIs', link: '/openchad-react/core' },
          { text: 'AppInfo Context', link: '/openchad-react/appinfo' },
          { text: 'UI Components', link: '/openchad-react/ui' },
          { text: 'Utilities Reference', link: '/openchad-react/utils' },
          { text: 'Python Integration', link: '/openchad-react/usepython' },
          { text: 'pyInvoke Commands', link: '/openchad-react/pyinvoke-commands' }
        ]
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/openchad/openchad' }
    ]
  }
})
