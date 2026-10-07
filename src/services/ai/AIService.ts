// src/services/ai/AIService.ts
/**
 * AIService — Lazy orchestrator for all AI features.
 *
 * Why this exists:
 *   `expo-ai-kit`, `react-native-executorch`, `edge-llm`, and
 *   `react-native-smart-ai` are HUGE native packages. If you `import`
 *   them at the top of App.tsx or any screen, Metro will try to bundle
 *   the entire JS surface at startup — adding 8–12 minutes to the first
 *   bundle and a lot of memory.
 *
 *   Instead, we `require()` them INSIDE the init() function, which only
 *   runs after the UI is already on screen.
 */

export type AIStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'unavailable';

export interface AIStatusSnapshot {
  status: AIStatus;
  error?: string;
  packages: {
    aiKit: boolean;
    executorch: boolean;
    edgeLlm: boolean;
    smartAi: boolean;
    visionModel: boolean;
  };
  initializedAt?: number;
}

type Listener = (snap: AIStatusSnapshot) => void;

class AIServiceImpl {
  private snap: AIStatusSnapshot = {
    status: 'idle',
    packages: {
      aiKit: false,
      executorch: false,
      edgeLlm: false,
      smartAi: false,
      visionModel: false,
    },
  };

  private listeners = new Set<Listener>();
  private initPromise: Promise<AIStatusSnapshot> | null = null;

  // Lazy-loaded module handles (kept as `any` so TS doesn't try to
  // resolve them at compile-time when the package isn't installed).
  private aiKit: any = null;
  private executorch: any = null;
  private edgeLlm: any = null;
  private smartAi: any = null;

  getSnapshot(): AIStatusSnapshot {
    return this.snap;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snap);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) {
      try {
        fn(this.snap);
      } catch (e) {
        console.warn('[AIService] listener error', e);
      }
    }
  }

  private update(patch: Partial<AIStatusSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.emit();
  }

  /**
   * Initialize AI. Safe to call multiple times.
   * Runs in the BACKGROUND — never blocks the UI.
   */
  init(): Promise<AIStatusSnapshot> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.update({ status: 'loading' });

      // ── 1. expo-ai-kit ────────────────────────────────────────────
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.aiKit = require('expo-ai-kit');
        this.snap.packages.aiKit = true;
        console.log('[AIService] ✅ expo-ai-kit loaded');

        if (this.aiKit?.default?.initialize) {
          await this.aiKit.default.initialize();
        }
      } catch (e) {
        console.warn('[AIService] expo-ai-kit unavailable:', e);
      }

      // ── 2. react-native-executorch ────────────────────────────────
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.executorch = require('react-native-executorch');
        this.snap.packages.executorch = true;
        console.log('[AIService] ✅ react-native-executorch loaded');
      } catch (e) {
        console.warn('[AIService] executorch unavailable:', e);
      }

      // ── 3. edge-llm ───────────────────────────────────────────────
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.edgeLlm = require('edge-llm');
        this.snap.packages.edgeLlm = true;
        console.log('[AIService] ✅ edge-llm loaded');
      } catch (e) {
        console.warn('[AIService] edge-llm unavailable:', e);
      }

      // ── 4. react-native-smart-ai ──────────────────────────────────
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.smartAi = require('react-native-smart-ai');
        this.snap.packages.smartAi = true;
        console.log('[AIService] ✅ react-native-smart-ai loaded');
      } catch (e) {
        console.warn('[AIService] smart-ai unavailable:', e);
      }

      // ── 5. Vision model (.pte) ────────────────────────────────────
      //   Only try to load the bundled model if executorch is present.
      try {
        if (this.executorch && this.executorch.loadModel) {
          const modelAsset = require('../../../assets/models/baby_vision.pte');
          const uri =
            typeof modelAsset === 'string'
              ? modelAsset
              : modelAsset?.uri || modelAsset?.default;

          if (uri) {
            await this.executorch.loadModel({
              modelPath: uri,
              name: 'baby_vision',
            });
            this.snap.packages.visionModel = true;
            console.log('[AIService] ✅ baby_vision.pte loaded');
          }
        }
      } catch (e) {
        console.warn('[AIService] vision model load failed:', e);
      }

      // ── Verdict ───────────────────────────────────────────────────
      const anyLoaded =
        this.snap.packages.aiKit ||
        this.snap.packages.executorch ||
        this.snap.packages.edgeLlm ||
        this.snap.packages.smartAi;

      if (anyLoaded) {
        this.update({
          status: 'ready',
          initializedAt: Date.now(),
        });
        console.log('[AIService] ✅ AI ready');
      } else {
        this.update({
          status: 'unavailable',
          error: 'No AI package could be loaded',
        });
        console.warn('[AIService] ⚠️ AI unavailable — app will run without AI');
      }

      return this.snap;
    })();

    return this.initPromise;
  }

  // ── Public accessors (all null-safe) ─────────────────────────────
  getAiKit() {
    return this.aiKit;
  }
  getExecutorch() {
    return this.executorch;
  }
  getEdgeLlm() {
    return this.edgeLlm;
  }
  getSmartAi() {
    return this.smartAi;
  }

  isReady(): boolean {
    return this.snap.status === 'ready';
  }
}

export const AIService = new AIServiceImpl();
export default AIService;