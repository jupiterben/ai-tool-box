export type ToolRegion = 'domestic' | 'international';

export interface AITool {
  id: string;
  name: string;
  url: string;
  region: ToolRegion;
  icon?: string;
  description?: string;
}

export interface ToolRegionGroup {
  region: ToolRegion;
  label: string;
  tools: AITool[];
}
