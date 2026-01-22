/**
 * Mock implementations of Tauri APIs for web build
 * These no-op or throw errors to prevent crashes in web mode
 */

// @tauri-apps/api/core
export async function invoke(cmd: string, args?: any): Promise<any> {
  console.warn(`[Web Demo] Tauri invoke called: ${cmd}`, args);
  throw new Error(`Tauri command '${cmd}' not available in web demo`);
}

export function convertFileSrc(path: string): string {
  console.warn('[Web Demo] convertFileSrc not available');
  return path;
}

// @tauri-apps/api/event  
export async function listen(event: string, handler: (event: any) => void): Promise<() => void> {
  console.warn(`[Web Demo] Tauri event listener: ${event}`);
  return () => {}; // Return unsubscribe function
}

export async function emit(event: string, payload?: any): Promise<void> {
  console.warn(`[Web Demo] Tauri emit: ${event}`, payload);
}

// @tauri-apps/api/window
export function getCurrentWindow() {
  return {
    setTitle: async (title: string) => {
      document.title = title;
    },
    setFullscreen: async (fullscreen: boolean) => {
      if (fullscreen) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    },
    isFullscreen: async () => false,
    minimize: async () => {},
    maximize: async () => {},
    close: async () => {},
  };
}

// @tauri-apps/plugin-dialog
export async function open(options?: any): Promise<string | string[] | null> {
  console.warn('[Web Demo] File dialog not available');
  return null;
}

export async function save(options?: any): Promise<string | null> {
  console.warn('[Web Demo] Save dialog not available');
  return null;
}

export async function message(msg: string, options?: any): Promise<void> {
  alert(msg);
}

export async function confirm(msg: string, options?: any): Promise<boolean> {
  return window.confirm(msg);
}

// @tauri-apps/plugin-fs
export async function readTextFile(path: string): Promise<string> {
  console.warn('[Web Demo] File system not available');
  throw new Error('File system not available in web demo');
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  console.warn('[Web Demo] File system not available');
  throw new Error('File system not available in web demo');
}

export async function readDir(path: string): Promise<any[]> {
  console.warn('[Web Demo] File system not available');
  return [];
}

// @tauri-apps/plugin-sql
export default class Database {
  static async load(path: string): Promise<Database> {
    console.warn('[Web Demo] SQL database not available');
    return new Database();
  }
  
  async execute(sql: string, bindings?: any[]): Promise<any> {
    throw new Error('SQL not available in web demo');
  }
  
  async select<T>(sql: string, bindings?: any[]): Promise<T[]> {
    throw new Error('SQL not available in web demo');
  }
  
  async close(): Promise<void> {}
}
