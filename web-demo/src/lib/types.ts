// Demo types
export interface DemoNode {
  id: string;
  url: string;
  title: string;
  domain: string;
  favicon: string | null;
  position: [number, number, number];
  isAlive: boolean;
}

export interface DemoEdge {
  id: string;
  source: string;
  target: string;
}
