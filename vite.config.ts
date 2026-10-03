import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function webmanifestIconPlugin(): Plugin {
  return {
    name: 'webmanifest-icon-sync',
    generateBundle(options, bundle) {
      let bundledIconName: string | null = null;
      for (const fileName of Object.keys(bundle)) {
        if (fileName.includes('IMG_20261002_051242_302') && fileName.endsWith('.jpg')) {
          bundledIconName = path.basename(fileName);
          break;
        }
      }
      if (!bundledIconName) return;

      for (const [fileName, file] of Object.entries(bundle)) {
        if (fileName.endsWith('.webmanifest') && 'source' in file) {
          try {
            const manifest = JSON.parse(file.source.toString());
            manifest.icons = [
              {
                src: `./${bundledIconName}`,
                type: 'image/jpeg',
                sizes: '235x235',
              },
            ];
            file.source = JSON.stringify(manifest, null, 2);
          } catch (e) {
            console.error('Error updating bundled webmanifest:', e);
          }
        }
      }
    },
    closeBundle() {
      try {
        const distManifestPath = path.resolve('dist', 'site.webmanifest');
        if (fs.existsSync(distManifestPath)) {
          const files = fs.readdirSync(path.resolve('dist', 'assets'));
          const iconFile = files.find(
            (f) => f.includes('IMG_20261002_051242_302') && f.endsWith('.jpg')
          );
          if (iconFile) {
            const content = JSON.parse(fs.readFileSync(distManifestPath, 'utf-8'));
            content.icons = [
              {
                src: `./assets/${iconFile}`,
                type: 'image/jpeg',
                sizes: '235x235',
              },
            ];
            fs.writeFileSync(distManifestPath, JSON.stringify(content, null, 2));
          }
        }
      } catch (e) {
        console.error('Error syncing dist/site.webmanifest:', e);
      }
    },
  };
}

export default defineConfig(() => {
  const rootDir = import.meta.dirname ?? path.resolve('.');
  return {
    base: './',
    plugins: [react(), tailwindcss(), webmanifestIconPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(rootDir, 'index.html'),
          generator: path.resolve(rootDir, 'qr-code-generator/index.html'),
          about: path.resolve(rootDir, 'about/index.html'),
          privacy: path.resolve(rootDir, 'privacy/index.html'),
          terms: path.resolve(rootDir, 'terms/index.html'),
          contact: path.resolve(rootDir, 'contact/index.html'),
          notfound: path.resolve(rootDir, '404.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
