














import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';



export interface Classification {
  label: string;
  confidence: number; 
}

export interface ClassificationResult {
  labels: Classification[];
  /** Raw top-1 for quick access */
  topLabel: string;
  /** Raw top-1 confidence for quick access */
  topConfidence: number;
}





const PARENT_RELEVANT_LABELS: Record<number, string> = {
  
  720: 'pill bottle',
  504: 'coffee mug',
  505: 'cup',
  899: 'water bottle',
  907: 'wine bottle',
  737: 'water bottle',
  
  850: 'teddy bear',
  851: 'teddy',
  852: 'toy',
  441: 'ball',
  444: 'basketball',
  873: 'plastic bag',
  
  0: 'tench (fish)', 
  
};





let LABELS_CACHE: string[] | null = null;

async function loadLabels(): Promise<string[]> {
  if (LABELS_CACHE) return LABELS_CACHE;
  try {
    const asset = Asset.fromModule(
      
      require('../../../assets/models/imagenet_labels.json')
    );
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 1000) {
      LABELS_CACHE = parsed;
      return parsed;
    }
  } catch (e) {
    if (__DEV__) console.warn('[PhotoClassifier] Failed to load labels:', e);
  }
  
  LABELS_CACHE = Array.from({ length: 1000 }, (_, i) => `class_${i}`);
  return LABELS_CACHE;
}



type ExecutorchModule = {
  forward: (input: unknown) => Promise<unknown>;
  load: () => Promise<void>;
  isLoaded: () => boolean;
};

let modelInstance: ExecutorchModule | null = null;
let modelLoadPromise: Promise<ExecutorchModule | null> | null = null;

/**
 * Lazily load the ExecuTorch runtime and the .pte model.
 * Safe to call from anywhere — idempotent.
 */
async function loadModel(): Promise<ExecutorchModule | null> {
  if (modelInstance) return modelInstance;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    try {
      
      const ReactNativeExecuTorch = await import('react-native-executorch');
      const useExecutorchModule = (ReactNativeExecuTorch as any)
        ?.useExecutorchModule;

      if (!useExecutorchModule) {
        if (__DEV__) {
          console.warn(
            '[PhotoClassifier] react-native-executorch not available'
          );
        }
        return null;
      }

      
      const asset = Asset.fromModule(
        require('../../../assets/models/baby_vision.pte')
      );
      await asset.downloadAsync();
      const modelUri = asset.localUri || asset.uri;

      if (!modelUri) {
        if (__DEV__) {
          console.warn('[PhotoClassifier] .pte asset could not be resolved');
        }
        return null;
      }

      
      
      
      const module = await (ReactNativeExecuTorch as any).loadModel?.({
        modelSource: modelUri,
      });

      if (!module) {
        if (__DEV__) {
          console.warn(
            '[PhotoClassifier] loadModel returned null — using hook-based path instead'
          );
        }
        return null;
      }

      modelInstance = module;
      return module;
    } catch (e) {
      if (__DEV__) console.warn('[PhotoClassifier] loadModel failed:', e);
      return null;
    }
  })();

  return modelLoadPromise;
}



/**
 * Convert an image URI into a 224×224 RGB float32 tensor input
 * suitable for MobileNetV2.
 *
 * Returns a Uint8Array of RGB pixels (HWC order) plus dimensions.
 * The ExecuTorch runtime handles the tensor wrapping.
 */
async function preprocessImage(
  uri: string
): Promise<{ pixels: Uint8Array; width: number; height: number } | null> {
  try {
    
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 224, height: 224 } }],
      {
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!manipulated.base64) return null;

    
    
    
    
    
    const binary = atob(manipulated.base64);
    const pixels = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      pixels[i] = binary.charCodeAt(i);
    }

    return { pixels, width: 224, height: 224 };
  } catch (e) {
    if (__DEV__) console.warn('[PhotoClassifier] preprocess failed:', e);
    return null;
  }
}



/**
 * Classify an image by URI. Returns the top-N labels sorted by
 * confidence. Never throws.
 *
 * @param uri  Local file URI, remote URL, or base64 data URI
 * @param topN Number of labels to return (default 5)
 */
export async function classifyImage(
  uri: string,
  topN: number = 5
): Promise<ClassificationResult> {
  const empty: ClassificationResult = {
    labels: [],
    topLabel: '',
    topConfidence: 0,
  };

  if (!uri || typeof uri !== 'string') return empty;

  try {
    const model = await loadModel();
    if (!model) return empty;

    const preprocessed = await preprocessImage(uri);
    if (!preprocessed) return empty;

    
    const output = await model.forward({
      data: preprocessed.pixels,
      width: preprocessed.width,
      height: preprocessed.height,
      channels: 3,
    });

    
    const logits = extractLogits(output);
    if (!logits || logits.length !== 1000) return empty;

    
    const probs = softmax(Array.from(logits));

    
    const labels = await loadLabels();

    
    const indexed = probs.map((p, i) => ({ index: i, prob: p }));
    indexed.sort((a, b) => b.prob - a.prob);

    const top: Classification[] = indexed.slice(0, topN).map(({ index, prob }) => ({
      label: labels[index] || `class_${index}`,
      confidence: prob,
    }));

    return {
      labels: top,
      topLabel: top[0]?.label || '',
      topConfidence: top[0]?.confidence || 0,
    };
  } catch (e) {
    if (__DEV__) console.warn('[PhotoClassifier] classifyImage failed:', e);
    return empty;
  }
}



function extractLogits(output: unknown): Float32Array | number[] | null {
  if (!output) return null;
  if (output instanceof Float32Array) return output;
  if (Array.isArray(output)) return output;
  if (typeof output === 'object' && 'data' in (output as any)) {
    const data = (output as any).data;
    if (data instanceof Float32Array) return data;
    if (Array.isArray(data)) return data;
  }
  return null;
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}



/**
 * True when the top label looks like a baby-relevant object
 * (bottle, teddy bear, bib, etc.). Adjust the list to your needs.
 */
export function isBabyRelevant(result: ClassificationResult): boolean {
  const BABY_KEYWORDS = [
    'bottle', 'cup', 'mug', 'teddy', 'toy', 'ball', 'bib',
    'pacifier', 'diaper', 'stroller', 'blanket', 'pillow',
  ];
  const top = result.topLabel.toLowerCase();
  return BABY_KEYWORDS.some((kw) => top.includes(kw));
}

export default {
  classifyImage,
  isBabyRelevant,
};