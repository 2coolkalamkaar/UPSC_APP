import { pipeline, env } from '@xenova/transformers';

// Configure transformers to use local cache
env.cacheDir = './.cache/transformers';

async function downloadModel() {
  console.log("Downloading Xenova/all-MiniLM-L6-v2... This may take a moment.");
  // Instantiate the pipeline. This will trigger the download if not cached.
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  
  console.log("Model downloaded successfully!");
  
  // Test run
  const output = await extractor('Hello world', { pooling: 'mean', normalize: true });
  console.log(`Test embedding generated. Dimensions: ${output.data.length}`);
}

downloadModel().catch(console.error);
