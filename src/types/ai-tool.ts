export type ToolRegion = 'domestic' | 'international';
export type ToolCategory = 'chat' | 'image' | 'video';

export interface AITool {
  id: string;
  name: string;
  url: string;
  region: ToolRegion;
  category: ToolCategory;
  icon?: string;
  description?: string;
}

export interface ToolRegionGroup {
  region: ToolRegion;
  label: string;
  tools: AITool[];
}
